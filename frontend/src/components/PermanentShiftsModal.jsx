import { useState, useEffect, useCallback } from 'react';
import styles from '../styles/PermanentShiftsModal.module.scss';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const PREF_CYCLE = [null, 'can', 'prefer', 'cannot'];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PermanentShiftsModal({ token, config, isAdmin, workers, onClose, viewDate, branchId: propBranchId }) {
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
        setStartDate(data.template.start_date || today());
        setEndDate(data.template.end_date || '');
        const g = {};
        for (const e of data.template.entries || []) {
          g[`${e.day_of_week}_${e.shift_type}`] = e.preference_type;
        }
        setGrid(g);
      } else {
        setTemplate(null);
        setGrid({});
        setStartDate(today());
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

  async function handleDelete() {
    if (!template) return;
    setSaving(true);
    setError('');
    try {
      const wId = isAdmin ? selectedWorkerId : template.worker_id;
      const branchQ = branchId ? `?branch_id=${branchId}` : '';
      const res = await fetch(`/api/permanent-shifts/${wId}${branchQ}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setTemplate(null);
      setGrid({});
      setStartDate(today());
      setEndDate('');
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
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>משמרות קבועות</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
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
                <input
                  type="date"
                  className={styles.dateInput}
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>סיום תוקף (אופציונלי):</label>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
                {endDate && (
                  <button className={styles.clearDate} onClick={() => setEndDate('')}>✕</button>
                )}
              </div>
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {applyMsg && <div className={styles.applyMsg}>{applyMsg}</div>}

            <div className={styles.actions}>
              {template && (
                <button className={styles.deleteBtn} onClick={handleDelete} disabled={saving}>
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
