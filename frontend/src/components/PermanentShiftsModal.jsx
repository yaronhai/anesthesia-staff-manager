import { useState, useEffect, useCallback, useRef } from 'react';
import styles from '../styles/PermanentShiftsModal.module.scss';
import { useDraggableModal } from '../hooks/useDraggableModal';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const PREF_CYCLE = [null, 'can', 'prefer', 'cannot'];

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function DateField({ value, onChange, className, min }) {
  const [raw, setRaw] = useState(value ? fmtDate(value) : '');
  const pickerRef = useRef(null);

  useEffect(() => {
    setRaw(value ? fmtDate(value) : '');
  }, [value]);

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '');
    let v = digits;
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + '/' + v.slice(5);
    if (v.length > 10) v = v.slice(0, 10);
    setRaw(v);
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const iso = `${m[3]}-${m[2]}-${m[1]}`;
      if (!min || iso >= min) onChange(iso);
    } else if (!v) {
      onChange('');
    }
  }

  function openPicker() {
    try { pickerRef.current?.showPicker(); } catch {}
  }

  return (
    <div className={styles.dateFieldWrap}>
      <input
        type="text"
        className={`${styles.dateInput} ${className || ''}`}
        value={raw}
        onChange={handleChange}
        placeholder="dd/mm/yyyy"
        maxLength={10}
        inputMode="numeric"
      />
      <button type="button" className={styles.calendarBtn} onClick={openPicker} tabIndex={-1}>📅</button>
      <input
        ref={pickerRef}
        type="date"
        className={styles.hiddenPicker}
        value={value || ''}
        min={min}
        onChange={e => onChange(e.target.value)}
        tabIndex={-1}
      />
    </div>
  );
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextSundayDate() {
  const d = new Date();
  const daysUntilNextSunday = d.getDay() === 0 ? 7 : 7 - d.getDay();
  d.setDate(d.getDate() + daysUntilNextSunday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PermanentShiftsModal({ token, config, isAdmin, workers, onClose, viewDate, branchId: propBranchId }) {
  const { modalRef, dragHandleProps, modalStyle, dragged, reset } = useDraggableModal();
  const close = () => { onClose(); reset(); };
  const shifts = config.shift_types || [];
  const prefs = config.preference_types || [];

  const [selectedWorkerId, setSelectedWorkerId] = useState(
    isAdmin && workers.length > 0 ? workers[0].id : null
  );
  const [template, setTemplate] = useState(null);
  const [grid, setGrid] = useState({}); // { "dow_shiftKey": prefKey | null }
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [applyMsg, setApplyMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [branchId, setBranchId] = useState(propBranchId ?? null);

  const fetchTemplate = useCallback(async (wId) => {
    if (!wId && !isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const branchQ = branchId ? `&branch_id=${branchId}` : '';
      const workerQ = isAdmin ? `?worker_id=${wId}${branchQ}` : branchQ ? `?${branchQ.slice(1)}` : '';
      const res = await fetch(`/api/permanent-shifts${workerQ}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.template) {
        setTemplate(data.template);
        setStartDate((data.template.start_date || today()).slice(0, 10));
        setEndDate(data.template.end_date ? data.template.end_date.slice(0, 10) : '');
        const g = {};
        for (const e of data.template.entries || []) {
          g[`${e.day_of_week}_${e.shift_type}`] = e.preference_type;
        }
        setGrid(g);
      } else {
        setTemplate(null);
        setGrid({});
        setStartDate(nextSundayDate());
        setEndDate('');
      }
    } catch {
      setError('שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, branchId]);

  useEffect(() => {
    if (isAdmin) {
      if (selectedWorkerId) fetchTemplate(selectedWorkerId);
    } else {
      fetchTemplate(null);
    }
  }, [selectedWorkerId, fetchTemplate, isAdmin]);

  function cycleCell(dow, shiftKey) {
    const cellKey = `${dow}_${shiftKey}`;
    const cur = grid[cellKey] ?? null;
    const idx = PREF_CYCLE.indexOf(cur);
    const next = PREF_CYCLE[(idx + 1) % PREF_CYCLE.length];
    setGrid(g => ({ ...g, [cellKey]: next }));
  }

  async function handleSave() {
    if (startDate < today()) {
      setError('לא ניתן לשמור תאריך התחלה בעבר');
      return;
    }
    setSaving(true);
    setError('');
    setApplyMsg('');
    try {
      const entries = [];
      for (const [key, pref] of Object.entries(grid)) {
        if (!pref) continue;
        const [dow, ...shiftParts] = key.split('_');
        entries.push({ day_of_week: parseInt(dow), shift_type: shiftParts.join('_'), preference_type: pref });
      }
      const body = { start_date: startDate, entries };
      if (endDate) body.end_date = endDate;
      if (isAdmin && selectedWorkerId) body.worker_id = selectedWorkerId;
      if (branchId) body.branch_id = branchId;

      const res = await fetch('/api/permanent-shifts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTemplate(data.template);

      if (viewDate && entries.length > 0) {
        const applyBody = {
          year: viewDate.getFullYear(),
          month: viewDate.getMonth() + 1,
        };
        if (branchId) applyBody.branch_id = branchId;
        if (isAdmin && selectedWorkerId) applyBody.worker_id = selectedWorkerId;
        const applyRes = await fetch('/api/permanent-shifts/apply', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(applyBody),
        });
        if (applyRes.ok) {
          const applyData = await applyRes.json();
          const monthName = viewDate.toLocaleString('he-IL', { month: 'long', year: 'numeric' });
          setApplyMsg(`נשמר ✓ — נוספו ${applyData.created} בקשות לחודש ${monthName}`);
        }
      } else {
        setApplyMsg('נשמר ✓');
      }
    } catch {
      setError('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(deleteFuture) {
    if (!template) return;
    setConfirmDelete(false);
    setSaving(true);
    setError('');
    try {
      const wId = isAdmin ? selectedWorkerId : template.worker_id;
      const params = new URLSearchParams();
      if (branchId) params.set('branch_id', branchId);
      if (deleteFuture) params.set('delete_future', 'true');
      const q = params.toString() ? `?${params}` : '';
      const res = await fetch(`/api/permanent-shifts/${wId}${q}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = res.status === 204 ? { deleted_requests: 0 } : await res.json();
      setTemplate(null);
      setGrid({});
      setStartDate(nextSundayDate());
      setEndDate('');
      if (deleteFuture) setApplyMsg(`נמחק ✓ — ${data.deleted_requests} בקשות עתידיות נמחקו`);
    } catch {
      setError('שגיאה במחיקה');
    } finally {
      setSaving(false);
    }
  }

  function prefLabel(key) {
    return prefs.find(p => p.key === key)?.label_he || key;
  }

  return (
    <div className={`${styles.overlay}${dragged ? ' form-overlay--transparent' : ''}`} onClick={e => e.target === e.currentTarget && close()}>
      <div className={styles.modal} ref={modalRef} style={modalStyle}>
        <div className={styles.header} {...dragHandleProps}>
          <h3 className={styles.title}>משמרות קבועות</h3>
          <button className={styles.closeBtn} onMouseDown={e => e.stopPropagation()} onClick={close}>✕</button>
        </div>

        {isAdmin && (
          <div className={styles.workerRow}>
            <label className={styles.fieldLabel}>עובד:</label>
            <select
              className={styles.select}
              value={selectedWorkerId ?? ''}
              onChange={e => setSelectedWorkerId(parseInt(e.target.value))}
            >
              {workers.map(w => (
                <option key={w.id} value={w.id}>
                  {w.first_name} {w.family_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className={styles.loading}>טוען...</div>
        ) : (
          <>
            <div className={styles.hint}>לחיצה על תא מחליפה את הבחירה</div>
            <div className={styles.gridWrapper}>
              <table className={styles.grid}>
                <thead>
                  <tr>
                    <th className={styles.shiftHeader}></th>
                    {DAY_NAMES.map((name, dow) => (
                      <th key={dow} className={styles.dayHeader}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shifts.map(s => (
                    <tr key={s.key}>
                      <td className={styles.dayName}>
                        <span className={styles.shiftIcon}>{s.icon}</span>{s.label_he}
                      </td>
                      {DAY_NAMES.map((_, dow) => {
                        const pref = grid[`${dow}_${s.key}`] ?? null;
                        return (
                          <td key={dow} className={styles.cell}>
                            <button
                              className={`${styles.cellBtn} ${pref ? styles[`pref_${pref}`] : styles.prefNone}`}
                              onClick={() => cycleCell(dow, s.key)}
                              title={pref ? prefLabel(pref) : 'לחץ להגדרה'}
                            >
                              {pref ? prefLabel(pref) : '—'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.legend}>
              {prefs.map(p => (
                <span key={p.key} className={`${styles.legendItem} ${styles[`pref_${p.key}`]}`}>
                  {p.label_he}
                </span>
              ))}
              <span className={`${styles.legendItem} ${styles.prefNone}`}>—  = לא הוגדר</span>
            </div>

            <div className={styles.datesRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>תחילת תוקף:</label>
                <DateField
                  value={startDate}
                  onChange={v => { setStartDate(v); setError(''); }}
                  className={styles.dateInput}
                  min={today()}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>סיום תוקף (אופציונלי):</label>
                <DateField
                  value={endDate}
                  onChange={v => setEndDate(v)}
                  className={styles.dateInput}
                />
                {endDate && (
                  <button className={styles.clearDate} onClick={() => setEndDate('')}>✕</button>
                )}
              </div>
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {applyMsg && <div className={styles.applyMsg}>{applyMsg}</div>}

            {confirmDelete && (
              <div className={styles.confirmWarning}>
                <span>האם למחוק גם את כל הבקשות העתידיות של העובד?</span>
                <div className={styles.confirmActions}>
                  <button className={styles.deleteBtn} onClick={() => handleDelete(true)} disabled={saving}>
                    מחק תבנית ובקשות עתידיות
                  </button>
                  <button className={styles.cancelBtn} onClick={() => handleDelete(false)} disabled={saving}>
                    מחק תבנית בלבד
                  </button>
                  <button className={styles.cancelBtn} onClick={() => setConfirmDelete(false)} disabled={saving}>
                    ביטול
                  </button>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              {template && !confirmDelete && (
                <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)} disabled={saving}>
                  מחק תבנית
                </button>
              )}
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'שומר...' : 'שמור'}
              </button>
              <button className={styles.cancelBtn} onClick={onClose} disabled={saving}>
                סגור
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
