import { useState, useEffect, useCallback } from 'react';

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const WEEK_HEADERS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

const SHIFTS = [
  { key: 'morning', label: 'בוקר',    short: 'ב' },
  { key: 'evening', label: 'ערב',     short: 'ע' },
  { key: 'oncall',  label: 'כוננות',  short: 'כ' },
];
const PREFS = [
  { key: 'can',     label: 'יכול' },
  { key: 'prefer',  label: 'מעדיף' },
  { key: 'cannot',  label: 'לא יכול' },
];

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
function DayCell({ day, dateStr, dayRequests, isToday, onClick }) {
  return (
    <div
      className={`cal-day${isToday ? ' cal-today' : ''}${dayRequests.length ? ' cal-has-data' : ''}`}
      onClick={() => onClick(day, dateStr)}
    >
      <span className="cal-day-num">{day}</span>
      <div className="cal-indicators">
        {SHIFTS.map(s => {
          const r = dayRequests.find(r => r.shift_type === s.key);
          return r
            ? <span key={s.key} className={`cal-dot pref-${r.preference_type}`}>{s.short}</span>
            : null;
        })}
      </div>
    </div>
  );
}

// ── Day editor modal ─────────────────────────────────────────────────────────
function DayEditor({ dateStr, dayRequests, token, onClose, onRefresh }) {
  const dow = DAYS_HE[new Date(dateStr).getDay()];
  const [d, m, y] = [
    parseInt(dateStr.split('-')[2]),
    parseInt(dateStr.split('-')[1]),
    parseInt(dateStr.split('-')[0]),
  ];

  async function setPref(shiftKey, prefKey) {
    const existing = dayRequests.find(r => r.shift_type === shiftKey);
    if (existing && existing.preference_type === prefKey) {
      // toggle off — delete
      await fetch(`/api/shift-requests/${existing.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      await fetch('/api/shift-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: dateStr, shift_type: shiftKey, preference_type: prefKey }),
      });
    }
    onRefresh();
  }

  return (
    <div className="day-editor-backdrop" onClick={onClose}>
      <div className="day-editor" onClick={e => e.stopPropagation()}>
        <div className="day-editor-header">
          <h3>יום {dow}, {d}.{String(m).padStart(2,'0')}.{y}</h3>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <table className="pref-table">
          <thead>
            <tr>
              <th></th>
              {PREFS.map(p => (
                <th key={p.key}>
                  <span className={`pref-label pref-${p.key}`}>{p.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map(s => {
              const req = dayRequests.find(r => r.shift_type === s.key);
              return (
                <tr key={s.key}>
                  <td className="pref-shift-label">{s.label}</td>
                  {PREFS.map(p => (
                    <td key={p.key} className="pref-btn-cell">
                      <button
                        className={`pref-toggle pref-${p.key}${req?.preference_type === p.key ? ' active' : ''}`}
                        onClick={() => setPref(s.key, p.key)}
                        title={`${s.label} — ${p.label}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="day-editor-legend">
          {PREFS.map(p => (
            <span key={p.key} className="legend-item">
              <span className={`pref-toggle pref-${p.key} active small`} />
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── User calendar view ───────────────────────────────────────────────────────
function UserCalendar({ requests, viewDate, token, onRefresh }) {
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
            {week.map((day, di) => (
              <div key={di} className="cal-cell">
                {day && (
                  <DayCell
                    day={day}
                    dateStr={toDateStr(year, month, day)}
                    dayRequests={requests.filter(r => r.date === toDateStr(year, month, day))}
                    isToday={toDateStr(year, month, day) === todayStr}
                    onClick={openEditor}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="cal-legend">
        {SHIFTS.map(s => (
          <span key={s.key} className="cal-legend-shift">
            <span className="cal-dot pref-can">{s.short}</span> = {s.label}
          </span>
        ))}
        <span className="cal-legend-sep" />
        {PREFS.map(p => (
          <span key={p.key} className="cal-legend-pref">
            <span className={`pref-toggle pref-${p.key} active small`} /> = {p.label}
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
        />
      )}
    </>
  );
}

// ── Admin grid view ──────────────────────────────────────────────────────────
function AdminGrid({ requests, viewDate }) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Group: userMap[userId] = { name, days: { dayNum: { morning, evening, oncall } } }
  const userMap = {};
  requests.forEach(r => {
    if (!userMap[r.user_id]) {
      userMap[r.user_id] = {
        name: r.first_name ? `${r.first_name} ${r.family_name}` : r.username,
        days: {},
      };
    }
    const d = parseInt(r.date.split('-')[2]);
    if (!userMap[r.user_id].days[d]) userMap[r.user_id].days[d] = {};
    userMap[r.user_id].days[d][r.shift_type] = r.preference_type;
  });

  const rows = Object.entries(userMap);
  if (rows.length === 0) return <p className="empty-msg">אין בקשות לחודש זה</p>;

  return (
    <div className="admin-grid-wrap">
      <table className="admin-grid">
        <thead>
          <tr>
            <th className="admin-grid-name-col">עובד</th>
            {days.map(d => (
              <th key={d} className="admin-grid-day-col">
                <div>{d}</div>
                <div className="admin-grid-day-letter">{DAYS_HE[new Date(year, month, d).getDay()][0]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([userId, userData]) => (
            <tr key={userId}>
              <td className="admin-grid-name-col">{userData.name}</td>
              {days.map(d => {
                const cell = userData.days[d] || {};
                return (
                  <td key={d} className="admin-grid-cell">
                    <div className="admin-cell-pills">
                      {SHIFTS.map(s => cell[s.key]
                        ? <span key={s.key} className={`cell-pill pref-${cell[s.key]}`}>{s.short}</span>
                        : null)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ShiftRequests({ currentUser, token }) {
  const [requests, setRequests] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const fetchRequests = useCallback(async () => {
    const res = await fetch(`/api/shift-requests?month=${month + 1}&year=${year}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setRequests(await res.json());
  }, [month, year, token]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  function prevMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  return (
    <div className="shift-view">
      <div className="shift-header">
        <div className="shift-header-top">
          <div className="month-nav">
            <button className="btn-secondary btn-sm" onClick={prevMonth}>חודש קודם</button>
            <span className="month-label">{MONTHS[month]} {year}</span>
            <button className="btn-secondary btn-sm" onClick={nextMonth}>חודש הבא</button>
          </div>
        </div>
      </div>

      <UserCalendar requests={requests} viewDate={viewDate} token={token} onRefresh={fetchRequests} />

      {currentUser.role === 'admin' && (
        <>
          <h3 className="admin-grid-title">סקירת כל העובדים</h3>
          <AdminGrid requests={requests} viewDate={viewDate} />
        </>
      )}
    </div>
  );
}
