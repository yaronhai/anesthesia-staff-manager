import { useState, useEffect, useCallback } from 'react';

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
function DayCell({ day, dateStr, dayRequests, isToday, onClick, dayOfWeek, shifts }) {
  const isSaturday = dayOfWeek === 6;
  return (
    <div
      className={`cal-day${isToday ? ' cal-today' : ''}${isSaturday ? ' cal-saturday' : ''}${dayRequests.length ? ' cal-has-data' : ''}`}
      onClick={() => onClick(day, dateStr)}
    >
      <span className="cal-day-num">{day}</span>
      <div className="cal-day-name">{DAYS_HE[dayOfWeek]}</div>
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
function UserCalendar({ requests, viewDate, token, onRefresh, shifts, prefs, branchId }) {
  const [editingDay, setEditingDay] = useState(null); // { day, dateStr }
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const weeks = buildCalendarWeeks(year, month);
  const todayStr = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  function openEditor(day, dateStr) {
    setEditingDay({ day, dateStr });
  }

  return (
    <>
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
function AdminGrid({ workers, requests, vacations, token, viewDate, onRefresh, shifts, prefs, branchId }) {
  const [editingCell, setEditingCell] = useState(null);
  const [cellError, setCellError] = useState(null);
  const [vacationWarning, setVacationWarning] = useState(null);

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
        body: JSON.stringify({ date: dateStr, shift_type: shiftKey, preference_type: prefKey, user_id: userId, branch_id: branchId }),
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
  }));

  // Group rows by job and sort each group alphabetically
  const jobGroups = [];
  const jobMap = {};
  rows.forEach(row => {
    if (!jobMap[row.job]) {
      jobMap[row.job] = [];
      jobGroups.push(row.job);
    }
    jobMap[row.job].push(row);
  });
  jobGroups.sort((a, b) => a.localeCompare(b, 'he'));
  jobGroups.forEach(job => jobMap[job].sort((a, b) => a.name.localeCompare(b.name, 'he')));

  return (
    <>
      <div className="admin-grid-wrap">
        <table className="admin-grid">
          <thead>
            <tr>
              <th className="admin-grid-name-col">עובד</th>
              {days.map(d => {
                const dow = new Date(year, month, d).getDay();
                const isSaturday = dow === 6;
                return (
                  <th key={d} className={`admin-grid-day-col${isSaturday ? ' admin-grid-saturday' : ''}`}>
                    <div>{d}</div>
                    <div className="admin-grid-day-letter">{DAYS_HE[dow]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {jobGroups.map(job => ([
              <tr key={`job-${job}`}>
                <td colSpan={days.length + 1} style={{
                  background: '#1a2e4a', color: 'white',
                  fontWeight: 700, fontSize: '0.78rem',
                  padding: '0.25rem 0.6rem', letterSpacing: '0.03em'
                }}>{job}</td>
              </tr>,
              ...jobMap[job].map(row => (
                <tr key={row.userId}>
                  <td className="admin-grid-name-col">{row.name}</td>
                  {days.map(d => {
                    const dayData = requestMap[row.userId]?.[d] || {};
                    const dow = new Date(year, month, d).getDay();
                    const isSaturday = dow === 6;
                    return (
                      <td key={d} className={`admin-grid-cell${isSaturday ? ' admin-grid-saturday' : ''}`} onClick={() => {
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const vac = vacations.find(v =>
    v.user_id === row.userId &&
    (v.status === 'approved' || v.status === 'partial') &&
    v.approved_start <= dateStr && v.approved_end >= dateStr
  );
  if (vac) {
    setVacationWarning(`לעובד ${row.name} יש חופש מאושר בתאריך זה (${vac.approved_start} עד ${vac.approved_end})`);
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
                      </td>
                    );
                  })}
                </tr>
              ))
            ]))}
          </tbody>
        </table>
      </div>

      {vacationWarning && (
        <div className="admin-editor-overlay" onClick={() => setVacationWarning(null)}>
          <div className="admin-editor-modal" onClick={e => e.stopPropagation()} style={{textAlign: 'center'}}>
            <div className="admin-editor-header">
              <h3>חופש מאושר</h3>
              <button className="btn-close" onClick={() => setVacationWarning(null)}>✕</button>
            </div>
            <div style={{padding: '1rem 0', color: '#374151', fontSize: '0.95rem'}}>{vacationWarning}</div>
            <div style={{marginTop: '1rem'}}>
              <button className="btn-secondary" onClick={() => setVacationWarning(null)}>סגור</button>
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
              <div className="vacation-conflict-msg" style={{margin: '0.75rem 0 0'}}>{cellError}</div>
            )}
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

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const shifts = config.shift_types || [];
  const prefs = config.preference_types || [];

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // For regular workers: fetch their branches
  useEffect(() => {
    if (!isAdmin && currentUser?.worker_id) {
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
    const res = await fetch('/api/vacation-requests', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setVacations(await res.json());
  }, [token]);

  useEffect(() => {
    fetchRequests();
    if (isAdmin) { fetchWorkers(); fetchVacations(); }
  }, [fetchRequests, fetchWorkers, fetchVacations, isAdmin]);

  function prevMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }
  function prevYear() { setViewDate(d => new Date(d.getFullYear() - 1, d.getMonth(), 1)); }
  function nextYear() { setViewDate(d => new Date(d.getFullYear() + 1, d.getMonth(), 1)); }

  if (!shifts.length || !prefs.length) return null;

  if (isAdmin) {
    return (
      <div className="shift-view">
        <div className="shift-admin-header">
          <h2>ניהול בקשות משמרות</h2>
          <div className="month-year-nav">
            <button className="btn-secondary btn-sm" onClick={prevYear}>◀ שנה</button>
            <button className="btn-secondary btn-sm" onClick={prevMonth}>◀ חודש</button>
            <span className="month-year-label">{MONTHS[month]} {year}</span>
            <button className="btn-secondary btn-sm" onClick={nextMonth}>חודש ▶</button>
            <button className="btn-secondary btn-sm" onClick={nextYear}>שנה ▶</button>
          </div>
        </div>
        <AdminGrid workers={workers} requests={requests} vacations={vacations} token={token} viewDate={viewDate} onRefresh={fetchRequests} shifts={shifts} prefs={prefs} branchId={effectiveBranchId} />
        <div className="admin-grid-legend">
          <div className="legend-row">
            <span className="legend-label">תרגום צבעים:</span>
          </div>
          <div className="legend-row">
            {prefs.map(p => (
              <span key={p.key} className="legend-item">
                <span className="legend-color" style={{ background: p.color }}></span> {p.label_he}
              </span>
            ))}
            <span className="legend-item">
              <span className="legend-color" style={{ background: '#fee2e2' }}></span> יום שבת
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shift-view">
      <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap'}}>
        <div className="month-year-nav">
          <button className="btn-secondary btn-sm" onClick={prevYear}>◀ שנה</button>
          <button className="btn-secondary btn-sm" onClick={prevMonth}>◀ חודש</button>
          <span className="month-year-label">{MONTHS[month]} {year}</span>
          <button className="btn-secondary btn-sm" onClick={nextMonth}>חודש ▶</button>
          <button className="btn-secondary btn-sm" onClick={nextYear}>שנה ▶</button>
        </div>
        {workerBranches.length > 1 && (
          <select
            value={activeBranchId ?? ''}
            onChange={e => setActiveBranchId(parseInt(e.target.value))}
            style={{fontSize: '0.9rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1d5db'}}
          >
            {workerBranches.map(wb => (
              <option key={wb.branch_id} value={wb.branch_id}>{wb.branch_name}</option>
            ))}
          </select>
        )}
        {workerBranches.length === 1 && (
          <span style={{fontSize: '0.85rem', color: '#6b7280'}}>{workerBranches[0]?.branch_name}</span>
        )}
      </div>
      <UserCalendar requests={requests} viewDate={viewDate} token={token} onRefresh={fetchRequests} shifts={shifts} prefs={prefs} branchId={effectiveBranchId} />
    </div>
  );
}
