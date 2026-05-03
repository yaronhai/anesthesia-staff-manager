import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import styles from '../styles/ShiftRequests.module.scss';

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const WEEK_HEADERS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function buildCalendarWeeks(year, month) {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// ── Day cell in user calendar ────────────────────────────────────────────────
function DayCell({ day, dateStr, dayRequests, isToday, onClick, dayOfWeek, shifts, vacations, specialDays }) {
  const isSaturday = dayOfWeek === 6;
  const isFriday = dayOfWeek === 5;
  const isVacation = vacations?.some(v =>
    (v.status === 'approved' || v.status === 'partial') &&
    v.approved_start && v.approved_end &&
    v.approved_start <= dateStr && v.approved_end >= dateStr
  );
  const sd = (specialDays || []).find(s => s.date === dateStr);
  return (
    <div
      className={`cal-day${isToday ? ' cal-today' : ''}${isSaturday ? ' cal-saturday' : isFriday ? ' cal-friday' : ''}${dayRequests.length ? ' cal-has-data' : ''}${isVacation ? ' cal-vacation-day' : ''}${sd ? ` cal-special-day ${styles.sdCell}` : ''}`}
      style={sd ? { '--sd-color': sd.color, '--sd-badge-bg': sd.color + '33' } : undefined}
      onClick={() => onClick(day, dateStr)}
    >
      <span className={`cal-day-num${sd ? ` cal-special-day-num ${styles.sdDayNum}` : ''}`}>{day}</span>
      <div className="cal-day-name">{DAYS_HE[dayOfWeek]}</div>
      {sd && <div className={`cal-special-day-badge ${styles.sdBadge}`}>{sd.name}</div>}
      {isVacation && <div className="vac-indicator">חופש ✓</div>}
      <div className="cal-indicators">
        {shifts.map(s => {
          const r = dayRequests.find(r => r.shift_type === s.key);
          return r
            ? <span key={s.key} className={`cal-dot pref-${r.preference_type}`}>{s.label_short}</span>
            : null;
        })}
      </div>
    </div>
  );
}

// ── Day editor modal ─────────────────────────────────────────────────────────
function DayEditor({ dateStr, dayRequests, token, onClose, onRefresh, shifts, prefs, branchId }) {
  const dow = DAYS_HE[new Date(dateStr).getDay()];
  const [d, m, y] = [
    parseInt(dateStr.split('-')[2]),
    parseInt(dateStr.split('-')[1]),
    parseInt(dateStr.split('-')[0]),
  ];
  const [error, setError] = useState(null);

  async function setPref(shiftKey, prefKey) {
    setError(null);
    const existing = dayRequests.find(r => r.shift_type === shiftKey);
    if (existing && existing.preference_type === prefKey) {
      await fetch(`/api/shift-requests/${existing.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      const res = await fetch('/api/shift-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: dateStr, shift_type: shiftKey, preference_type: prefKey, branch_id: branchId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'שגיאה בשמירת הבקשה');
        return;
      }
    }
    onRefresh();
  }

  return (
    <div className="day-editor-backdrop">
      <div className="day-editor">
        <div className="day-editor-header">
          <h3>יום {dow}, {d}.{String(m).padStart(2,'0')}.{y}</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <table className="pref-table">
          <thead>
            <tr>
              <th></th>
              {prefs.map(p => (
                <th key={p.key}>
                  <span className={`pref-label pref-${p.key}`}>{p.label_he}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shifts.map(s => {
              const req = dayRequests.find(r => r.shift_type === s.key);
              return (
                <tr key={s.key}>
                  <td className="pref-shift-label">{s.label_he}</td>
                  {prefs.map(p => (
                    <td key={p.key} className="pref-btn-cell">
                      <button
                        className={`pref-toggle pref-${p.key}${req?.preference_type === p.key ? ' active' : ''}`}
                        onClick={() => setPref(s.key, p.key)}
                        title={`${s.label_he} — ${p.label_he}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {error && (
          <div className="vacation-conflict-msg">{error}</div>
        )}

        <div className="day-editor-legend">
          {prefs.map(p => (
            <span key={p.key} className="legend-item">
              <span className={`pref-toggle pref-${p.key} active small`} />
              {p.label_he}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── User calendar view ───────────────────────────────────────────────────────
function UserCalendar({ requests, viewDate, token, onRefresh, shifts, prefs, branchId, vacations, canSubmit, specialDays }) {
  const [editingDay, setEditingDay] = useState(null); // { day, dateStr }
  const [blockedMsg, setBlockedMsg] = useState(false);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const weeks = buildCalendarWeeks(year, month);
  const todayStr = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  function openEditor(day, dateStr) {
    if (canSubmit === false) { setBlockedMsg(true); return; }
    setEditingDay({ day, dateStr });
  }

  return (
    <>
      {canSubmit === false && (
        <div className={styles.blockedBanner}>
          <strong>⛔ אין לך הרשאה להגיש או לערוך בקשות משמרת.</strong> לפרטים פנה למנהל.
        </div>
      )}
      {blockedMsg && (
        <div className={styles.blockedOverlay} onClick={() => setBlockedMsg(false)}>
          <div className={styles.blockedModal}>
            <div className={styles.blockedIcon}>⛔</div>
            <strong className={styles.blockedText}>אין לך הרשאה להגיש או לערוך בקשות משמרת.</strong>
            <div className={styles.blockedSub}>לפרטים פנה למנהל.</div>
            <button className="btn-primary" onClick={() => setBlockedMsg(false)}>סגור</button>
          </div>
        </div>
      )}
      <div className="cal-grid">
        <div className="cal-week-header">
          {WEEK_HEADERS.map(d => <div key={d} className="cal-week-day-name">{d}</div>)}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="cal-week-row">
            {week.map((day, di) => {
              const dow = day ? new Date(year, month, day).getDay() : null;
              return (
                <div key={di} className="cal-cell">
                  {day && (
                    <DayCell
                      day={day}
                      dateStr={toDateStr(year, month, day)}
                      dayRequests={requests.filter(r => r.date === toDateStr(year, month, day))}
                      isToday={toDateStr(year, month, day) === todayStr}
                      onClick={openEditor}
                      dayOfWeek={dow}
                      shifts={shifts}
                      vacations={vacations}
                      specialDays={specialDays}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="cal-legend">
        {shifts.map(s => (
          <span key={s.key} className="cal-legend-shift">
            <span className="cal-dot pref-can">{s.label_short}</span> = {s.label_he}
          </span>
        ))}
        <span className="cal-legend-sep" />
        {prefs.map(p => (
          <span key={p.key} className="cal-legend-pref">
            <span className={`pref-toggle pref-${p.key} active small`} /> = {p.label_he}
          </span>
        ))}
      </div>

      {editingDay && (
        <DayEditor
          dateStr={editingDay.dateStr}
          dayRequests={requests.filter(r => r.date === editingDay.dateStr)}
          token={token}
          onClose={() => setEditingDay(null)}
          onRefresh={() => { onRefresh(); }}
          shifts={shifts}
          prefs={prefs}
          branchId={branchId}
        />
      )}
    </>
  );
}

// ── Admin grid view ──────────────────────────────────────────────────────────
function AdminGrid({ workers, requests, vacations, token, viewDate, onRefresh, shifts, prefs, branchId, specialDays }) {
  const [editingCell, setEditingCell] = useState(null);
  const [cellError, setCellError] = useState(null);
  const [vacationWarning, setVacationWarning] = useState(null);
  const [blockedWorkerMsg, setBlockedWorkerMsg] = useState(null);
  const bodyWrapRef = useRef(null);
  const headerWrapRef = useRef(null);

  useLayoutEffect(() => {
    function syncGutter() {
      if (!bodyWrapRef.current || !headerWrapRef.current) return;
      const sw = bodyWrapRef.current.offsetWidth - bodyWrapRef.current.clientWidth;
      headerWrapRef.current.style.paddingLeft = sw + 'px';
    }
    syncGutter();
    const ro = new ResizeObserver(syncGutter);
    if (bodyWrapRef.current) ro.observe(bodyWrapRef.current);
    return () => ro.disconnect();
  }, [workers, requests]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Group requests by userId
  const requestMap = {};
  requests.forEach(r => {
    if (!requestMap[r.user_id]) requestMap[r.user_id] = {};
    const d = parseInt(r.date.split('-')[2]);
    if (!requestMap[r.user_id][d]) requestMap[r.user_id][d] = {};
    requestMap[r.user_id][d][r.shift_type] = { id: r.id, pref: r.preference_type };
  });

  async function setPref(userId, day, shiftKey, prefKey) {
    setCellError(null);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = requestMap[userId]?.[day]?.[shiftKey];

    if (existing && existing.pref === prefKey) {
      const res = await fetch(`/api/shift-requests/${existing.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCellError(data.error || 'שגיאה במחיקת הבקשה');
        return;
      }
    } else if (prefKey === '') {
      if (existing) {
        const res = await fetch(`/api/shift-requests/${existing.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setCellError(data.error || 'שגיאה במחיקת הבקשה');
          return;
        }
      }
    } else {
      const res = await fetch('/api/shift-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: dateStr, shift_type: shiftKey, preference_type: prefKey, user_id: userId, branch_id: branchId, force_override: editingCell?.overrideVacation || false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCellError(data.error || 'שגיאה בשמירת הבקשה');
        return;
      }
    }
    await onRefresh();
  }

  const rows = workers.map(w => ({
    id: w.id,
    userId: w.user_id,
    name: `${w.first_name} ${w.family_name}`,
    job: w.job || 'אחר',
    isPrimary: w.is_primary_branch !== false,
    canSubmit: w.can_submit_requests !== false,
  }));

  function buildJobGroups(rowList) {
    const groups = [];
    const map = {};
    rowList.forEach(row => {
      if (!map[row.job]) { map[row.job] = []; groups.push(row.job); }
      map[row.job].push(row);
    });
    groups.sort((a, b) => a.localeCompare(b, 'he'));
    groups.forEach(job => map[job].sort((a, b) => a.name.localeCompare(b.name, 'he')));
    return { groups, map };
  }

  const primaryRows = rows.filter(r => r.isPrimary);
  const borrowedRows = rows.filter(r => !r.isPrimary);
  const { groups: primaryJobGroups, map: primaryJobMap } = buildJobGroups(primaryRows);
  const { groups: borrowedJobGroups, map: borrowedJobMap } = buildJobGroups(borrowedRows);

  // Summary: per day per shift, count workers who have any request
  const summaryMap = {};
  days.forEach(d => {
    summaryMap[d] = {};
    shifts.forEach(s => {
      summaryMap[d][s.key] = rows.filter(row => {
        const entry = requestMap[row.userId]?.[d]?.[s.key];
        return entry && entry.pref !== 'cannot';
      }).length;
    });
  });

  const colgroup = (
    <colgroup>
      <col style={{ width: '90px' }} />
      {days.map(d => <col key={d} />)}
    </colgroup>
  );

  return (
    <>
      <div className="admin-grid-scroll-wrap">
        {/* Fixed header — never scrolls vertically */}
        <div className="admin-grid-header-wrap" ref={headerWrapRef}>
          <table className="admin-grid">
            {colgroup}
            <thead>
              <tr>
                <td className={`admin-grid-name-col ${styles.summaryLabelCell}`}>סיכום</td>
                {days.map(d => {
                  const dow = new Date(year, month, d).getDay();
                  const isSaturday = dow === 6;
                  return (
                    <td key={d} className={styles.summaryDayCell} style={{ '--summary-day-bg': isSaturday ? '#9ca3af' : '#e5e7eb' }}>
                      <div className={styles.summaryCountsCol}>
                        {shifts.map(s => {
                          const count = summaryMap[d][s.key];
                          return count > 0 ? (
                            <span key={s.key} className={styles.summaryCount}>
                              {s.label_short}{count}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th className="admin-grid-name-col">עובד</th>
                {days.map(d => {
                  const dow = new Date(year, month, d).getDay();
                  const isSaturday = dow === 6;
                  const isFriday = dow === 5;
                  const dateStr = toDateStr(year, month, d);
                  const sd = (specialDays || []).find(s => s.date === dateStr);
                  const isWeekend = isSaturday || isFriday;
                  return (
                    <th
                      key={d}
                      className={`admin-grid-day-col${isSaturday ? ' admin-grid-saturday' : isFriday ? ' admin-grid-friday' : ''}${sd && !isWeekend ? ' admin-grid-special-day' : ''}`}
                      style={sd && !isWeekend ? { '--sd-header-bg': sd.color + '44', background: 'var(--sd-header-bg)' } : undefined}
                    >
                      <div>{d}</div>
                      <div className="admin-grid-day-letter">{DAYS_HE[dow]}</div>
                      {sd && <div className="special-day-label" title={sd.name}>{sd.name}</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
          </table>
        </div>
        {/* Scrollable body — only worker rows scroll */}
        <div className="admin-grid-body-wrap" ref={bodyWrapRef}>
          <table className="admin-grid">
            {colgroup}
            <tbody>
            {primaryJobGroups.map(job => ([
              ...primaryJobMap[job].map(row => (
                <tr key={row.userId}>
                  <td className="admin-grid-name-col">{row.name}</td>
                  {days.map(d => {
                    const dayData = requestMap[row.userId]?.[d] || {};
                    const dow = new Date(year, month, d).getDay();
                    const isSaturday = dow === 6;
                    const isFriday = dow === 5;
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const vac = vacations.find(v =>
                      Number(v.user_id) === Number(row.userId) &&
                      (v.status === 'approved' || v.status === 'partial') &&
                      v.approved_start && v.approved_end &&
                      v.approved_start <= dateStr && v.approved_end >= dateStr
                    );
                    return (
                      <td key={d} className={`admin-grid-cell${isSaturday ? ' admin-grid-saturday' : isFriday ? ' admin-grid-friday' : ''}${vac ? ' vacation-day' : ''}${!row.canSubmit ? ' blocked-worker' : ''}`} onClick={() => {
  if (!row.canSubmit) { setBlockedWorkerMsg(row.name); return; }
  if (vac) {
    setVacationWarning({ message: `לעובד ${row.name} יש חופש מאושר בתאריך זה (${vac.approved_start} עד ${vac.approved_end})`, userId: row.userId, day: d });
    return;
  }
  setVacationWarning(null);
  setCellError(null);
  setEditingCell({ userId: row.userId, day: d });
}}>
                        <div className="admin-cell-pills">
                          {shifts.map(s => {
                            const req = dayData[s.key];
                            return req
                              ? <span key={s.key} className={`cell-pill pref-${req.pref}`}>{s.label_short}</span>
                              : null;
                          })}
                        </div>
                        {vac && <span className="vac-badge">חופש</span>}
                      </td>
                    );
                  })}
                </tr>
              ))
            ]))}
            {borrowedRows.length > 0 && [
              ...borrowedJobGroups.map(job => ([
                ...borrowedJobMap[job].map(row => (
                  <tr key={row.userId}>
                    <td className="admin-grid-name-col">
                      {row.name}
                      <span className={styles.borrowedTag}> מושאל</span>
                    </td>
                    {days.map(d => {
                      const dayData = requestMap[row.userId]?.[d] || {};
                      const dow = new Date(year, month, d).getDay();
                      const isSaturday = dow === 6;
                      const isFriday = dow === 5;
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const vac = vacations.find(v =>
                        Number(v.user_id) === Number(row.userId) &&
                        (v.status === 'approved' || v.status === 'partial') &&
                        v.approved_start && v.approved_end &&
                        v.approved_start <= dateStr && v.approved_end >= dateStr
                      );
                      return (
                        <td key={d} className={`admin-grid-cell${isSaturday ? ' admin-grid-saturday' : isFriday ? ' admin-grid-friday' : ''}${vac ? ' vacation-day' : ''}${!row.canSubmit ? ' blocked-worker' : ''}`} onClick={() => {
                          if (!row.canSubmit) { setBlockedWorkerMsg(row.name); return; }
                          if (vac) {
                            setVacationWarning({ message: `לעובד ${row.name} יש חופש מאושר בתאריך זה (${vac.approved_start} עד ${vac.approved_end})`, userId: row.userId, day: d });
                            return;
                          }
                          setVacationWarning(null);
                          setCellError(null);
                          setEditingCell({ userId: row.userId, day: d });
                        }}>
                          <div className="admin-cell-pills">
                            {shifts.map(s => {
                              const req = dayData[s.key];
                              return req ? <span key={s.key} className={`cell-pill pref-${req.pref}`}>{s.label_short}</span> : null;
                            })}
                          </div>
                          {vac && <span className="vac-badge">חופש</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ])).flat()
            ]}
            </tbody>
          </table>
        </div>
      </div>

      {blockedWorkerMsg && (
        <div className="admin-editor-overlay" onClick={() => setBlockedWorkerMsg(null)}>
          <div className={`admin-editor-modal ${styles.alertModalCenter}`} onClick={e => e.stopPropagation()}>
            <div className="admin-editor-header">
              <h3>עובד חסום</h3>
              <button className="btn-close" onClick={() => setBlockedWorkerMsg(null)}>✕</button>
            </div>
            <div className={styles.alertPadIcon}>⛔</div>
            <div className={styles.alertRedText}>{blockedWorkerMsg} אינו/ה מורשה/ת להגיש בקשות משמרת.</div>
            <div className={styles.alertMarginTop}>
              <button className="btn-secondary" onClick={() => setBlockedWorkerMsg(null)}>סגור</button>
            </div>
          </div>
        </div>
      )}

      {vacationWarning && (
        <div className="admin-editor-overlay" onClick={() => setVacationWarning(null)}>
          <div className={`admin-editor-modal ${styles.alertModalCenter}`} onClick={e => e.stopPropagation()}>
            <div className="admin-editor-header">
              <h3>חופש מאושר</h3>
              <button className="btn-close" onClick={() => setVacationWarning(null)}>✕</button>
            </div>
            <div className={styles.alertGrayText}>{vacationWarning.message}</div>
            <div className={styles.alertRow}>
              <button className="btn-secondary" onClick={() => setVacationWarning(null)}>סגור</button>
              <button className="btn-primary" onClick={() => { setCellError(null); setEditingCell({ userId: vacationWarning.userId, day: vacationWarning.day, overrideVacation: true }); setVacationWarning(null); }}>הגש בקשה בכל זאת</button>
            </div>
          </div>
        </div>
      )}

      {editingCell && (
        <div className="admin-editor-overlay" onClick={() => setEditingCell(null)}>
          <div className="admin-editor-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-editor-header">
              <h3>עריכה: {rows.find(r => r.userId === editingCell.userId)?.name} - יום {editingCell.day}</h3>
              <button className="btn-close" onClick={() => setEditingCell(null)}>✕</button>
            </div>
            <div className="admin-editor-content">
              {shifts.map(s => {
                const dayData = requestMap[editingCell.userId]?.[editingCell.day] || {};
                return (
                  <div key={s.key} className="editor-shift-row-large">
                    <span className="editor-shift-label-large">{s.label_he}</span>
                    <div className="editor-pref-buttons">
                      {prefs.map(p => {
                        const isActive = dayData[s.key]?.pref === p.key;
                        return (
                          <button
                            key={p.key}
                            className={`editor-pref-btn-large pref-${p.key}${isActive ? ' active' : ''}`}
                            onClick={() => setPref(editingCell.userId, editingCell.day, s.key, p.key)}
                          >
                            {p.label_he}
                          </button>
                        );
                      })}
                      {dayData[s.key] && (
                        <button
                          className="editor-pref-btn-large btn-clear-large"
                          onClick={() => setPref(editingCell.userId, editingCell.day, s.key, '')}
                        >
                          מחק
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            {cellError && (
              <div className={`vacation-conflict-msg ${styles.cellErrorMargin}`}>{cellError}</div>
            )}
          </div>
        </div>
      </div>
      )}
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ShiftRequests({ currentUser, token, config, selectedBranchId }) {
  const [requests, setRequests] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [workerBranches, setWorkerBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(null);
  const [canSubmit, setCanSubmit] = useState(null); // null = טרם נטען
  const [workerFilter, setWorkerFilter] = useState('all'); // 'allowed' | 'blocked' | 'all'
  const [jobFilter, setJobFilter] = useState(''); // '' = כל התפקידים

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const shifts = config.shift_types || [];
  const prefs = config.preference_types || [];

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // For regular workers: fetch their branches and live can_submit_requests
  useEffect(() => {
    if (!isAdmin && currentUser?.worker_id) {
      fetch(`/api/workers/${currentUser.worker_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(w => setCanSubmit(w ? w.can_submit_requests !== false : true));
      fetch(`/api/workers/${currentUser.worker_id}/branches`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          setWorkerBranches(data);
          if (data.length > 0) setActiveBranchId(data[0].branch_id);
        });
    }
  }, [currentUser?.worker_id, isAdmin, token]);

  const effectiveBranchId = isAdmin ? selectedBranchId : activeBranchId;

  const fetchRequests = useCallback(async () => {
    const branchQ = effectiveBranchId ? `&branch_id=${effectiveBranchId}` : '';
    const res = await fetch(`/api/shift-requests?month=${month + 1}&year=${year}${branchQ}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setRequests(await res.json());
  }, [month, year, token, effectiveBranchId]);

  const fetchWorkers = useCallback(async () => {
    const branchQ = selectedBranchId ? `?branch_id=${selectedBranchId}` : '';
    const res = await fetch(`/api/workers${branchQ}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setWorkers(await res.json());
  }, [token, selectedBranchId]);

  const fetchVacations = useCallback(async () => {
    const res = await fetch('/api/vacation-requests?all_branches=true', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setVacations(await res.json());
  }, [token]);

  useEffect(() => {
    fetchRequests();
    fetchVacations();
    if (isAdmin) { fetchWorkers(); }
  }, [fetchRequests, fetchWorkers, fetchVacations, isAdmin]);

  function prevMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }
  function prevYear() { setViewDate(d => new Date(d.getFullYear() - 1, d.getMonth(), 1)); }
  function nextYear() { setViewDate(d => new Date(d.getFullYear() + 1, d.getMonth(), 1)); }

  if (!shifts.length || !prefs.length) return null;

  if (!isAdmin && canSubmit === null) return null; // טוען הרשאות

  if (!isAdmin && canSubmit === false) {
    return (
      <div className="shift-view">
        <div className={styles.noPermView}>
          <div className={styles.noPermIcon}>⛔</div>
          <strong>אין לך הרשאה להגיש בקשות משמרת.</strong>
          <div className={styles.noPermSub}>לפרטים פנה למנהל.</div>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    const jobOptions = [...new Set(workers.map(w => w.job || 'אחר'))].sort((a, b) => a.localeCompare(b, 'he'));

    const filteredWorkers = workers.filter(w => {
      if (workerFilter === 'allowed' && w.can_submit_requests === false) return false;
      if (workerFilter === 'blocked' && w.can_submit_requests !== false) return false;
      if (jobFilter && (w.job || 'אחר') !== jobFilter) return false;
      return true;
    });

    const filterOptions = [
      { key: 'allowed', label: 'מורשים בלבד' },
      { key: 'blocked', label: 'לא מורשים' },
      { key: 'all',     label: 'כולם' },
    ];

    return (
      <div className="shift-view">
        <div className="shift-admin-header">
          <div className={`shift-admin-filters ${styles.adminFilters}`}>
            <h2 className={`shift-admin-title ${styles.adminTitle}`}>ניהול בקשות משמרות</h2>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>הרשאה:</label>
              <select className={styles.filterSelect} value={workerFilter} onChange={e => setWorkerFilter(e.target.value)}>
                {filterOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>תפקיד:</label>
              <select className={styles.filterSelect} value={jobFilter} onChange={e => setJobFilter(e.target.value)}>
                <option value=''>כל התפקידים</option>
                {jobOptions.map(job => (
                  <option key={job} value={job}>{job}</option>
                ))}
              </select>
            </div>
            <div className={`shift-admin-legend ${styles.legendRow}`}>
              {prefs.map(p => (
                <span key={p.key} className={styles.legendItem}>
                  <span className={styles.legendSwatch} style={{ '--swatch-bg': p.color }}></span>{p.label_he}
                </span>
              ))}
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ '--swatch-bg': '#9ca3af' }}></span>שבת
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ '--swatch-bg': '#e5e7eb', '--swatch-border': '1px solid #9ca3af' }}></span>שישי
              </span>
            </div>
          </div>
          <div className="month-year-nav">
            <button className="btn-secondary btn-sm" onClick={nextYear} title="שנה קדימה">»</button>
            <button className="btn-secondary btn-sm" onClick={nextMonth} title="חודש קדימה">›</button>
            <span className="month-year-label">{MONTHS[month]} {year}</span>
            <button className="btn-secondary btn-sm" onClick={prevMonth} title="חודש אחורה">‹</button>
            <button className="btn-secondary btn-sm" onClick={prevYear} title="שנה אחורה">«</button>
          </div>
        </div>
        <AdminGrid workers={filteredWorkers} requests={requests} vacations={vacations} token={token} viewDate={viewDate} onRefresh={fetchRequests} shifts={shifts} prefs={prefs} branchId={effectiveBranchId} specialDays={config.special_days || []} />
      </div>
    );
  }

  return (
    <div className="shift-view">
      <div className={styles.userNavRow}>
        <div className="month-year-nav">
          <button className="btn-secondary btn-sm" onClick={prevYear}>◀ שנה</button>
          <button className="btn-secondary btn-sm" onClick={prevMonth}>◀ חודש</button>
          <span className="month-year-label">{MONTHS[month]} {year}</span>
          <button className="btn-secondary btn-sm" onClick={nextMonth}>חודש ▶</button>
          <button className="btn-secondary btn-sm" onClick={nextYear}>שנה ▶</button>
        </div>
        {workerBranches.length > 1 && (
          <select
            className={styles.branchSelect}
            value={activeBranchId ?? ''}
            onChange={e => setActiveBranchId(parseInt(e.target.value))}
          >
            {workerBranches.map(wb => (
              <option key={wb.branch_id} value={wb.branch_id}>{wb.branch_name}</option>
            ))}
          </select>
        )}
        {workerBranches.length === 1 && (
          <span className={styles.branchLabel}>{workerBranches[0]?.branch_name}</span>
        )}
      </div>
      <UserCalendar requests={requests} viewDate={viewDate} token={token} onRefresh={fetchRequests} shifts={shifts} prefs={prefs} branchId={effectiveBranchId} vacations={vacations} canSubmit={canSubmit} specialDays={config.special_days || []} />
    </div>
  );
}
