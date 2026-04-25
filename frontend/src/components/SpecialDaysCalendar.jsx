import { useState } from 'react';

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                   'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DAY_INITIALS = ['א','ב','ג','ד','ה','ו','ש'];

function toStr(year, month, day) {
  return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().substring(0, 10);
}

export default function SpecialDaysCalendar({ config, authToken, branchId, onConfigChange }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [activeDay, setActiveDay] = useState(null);
  const [addForm, setAddForm] = useState(null);

  const specialDays = config.special_days || [];
  const branchQ = branchId ? `?branch_id=${branchId}` : '';

  // Calendar cells
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function sdForDate(dateStr) {
    return specialDays.find(s => s.date === dateStr);
  }

  function prevMonth() {
    setActiveDay(null); setAddForm(null);
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    setActiveDay(null); setAddForm(null);
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  }

  function handleDayClick(dateStr) {
    if (activeDay === dateStr) { setActiveDay(null); setAddForm(null); return; }
    setActiveDay(dateStr);
    const sd = sdForDate(dateStr);
    if (!sd) {
      const dow = new Date(dateStr).getDay();
      const type = dow === 5 ? 'eve' : 'holiday';
      setAddForm({ date: dateStr, name: '', type, color: type === 'eve' ? '#10b981' : '#059669' });
    } else {
      setAddForm(null);
    }
  }

  async function removeSD(id) {
    const res = await fetch(`/api/config/special-days/${id}${branchQ}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) { onConfigChange(await res.json()); setActiveDay(null); setAddForm(null); }
  }

  async function addSD() {
    if (!addForm?.name.trim()) return alert('יש למלא שם');
    const res = await fetch(`/api/config/special-days${branchQ}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ date: addForm.date, name: addForm.name.trim(), type: addForm.type, color: addForm.color }),
    });
    if (res.ok) { onConfigChange(await res.json()); setActiveDay(null); setAddForm(null); }
    else alert('שגיאה בהוספה');
  }

  const activeSd = activeDay ? sdForDate(activeDay) : null;

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthSDs = specialDays.filter(s => s.date.startsWith(monthStr));

  const specialDayDates = new Set(monthSDs.map(s => s.date));
  const monthHolidays = monthSDs.filter(s => s.type === 'holiday').length;
  // Eves not on Saturday (eve on Sat counts as Saturday instead)
  const monthEves = monthSDs.filter(s => {
    if (s.type !== 'eve') return false;
    return new Date(s.date + 'T12:00:00').getDay() !== 6;
  }).length;
  // Saturdays: no special day OR eve on Saturday
  const monthSaturdays = Array.from({ length: daysInMonth }, (_, i) => {
    const dateStr = toStr(year, month, i + 1);
    if (new Date(year, month, i + 1).getDay() !== 6) return false;
    const sd = monthSDs.find(s => s.date === dateStr);
    return !sd || sd.type === 'eve';
  }).filter(Boolean).length;
  // Fridays: not in specialDayDates (any special day overrides Friday)
  const monthFridays = Array.from({ length: daysInMonth }, (_, i) => {
    return new Date(year, month, i + 1).getDay() === 5 &&
           !specialDayDates.has(toStr(year, month, i + 1));
  }).filter(Boolean).length;
  const monthTotal = monthHolidays + monthEves + monthSaturdays + monthFridays;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Month summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.8rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 12px' }}>
        <span style={{ color: '#374151', fontWeight: 700 }}>סה"כ חודש זה: {monthTotal}</span>
        <span style={{ color: '#9ca3af' }}>|</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#059669', display: 'inline-block' }} />
          <span style={{ color: '#dc2626', fontWeight: 600 }}>חג</span>
          <span style={{ color: '#374151' }}>{monthHolidays}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />
          <span style={{ color: '#b45309', fontWeight: 600 }}>ערב חג</span>
          <span style={{ color: '#374151' }}>{monthEves}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#059669', display: 'inline-block' }} />
          <span style={{ color: '#dc2626', fontWeight: 600 }}>שבת</span>
          <span style={{ color: '#374151' }}>{monthSaturdays}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#0369a1', display: 'inline-block' }} />
          <span style={{ color: '#b45309', fontWeight: 600 }}>שישי</span>
          <span style={{ color: '#374151' }}>{monthFridays}</span>
        </span>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button className="btn-secondary" onClick={() => { setYear(y => y-1); setActiveDay(null); setAddForm(null); }}>◀</button>
        <strong style={{ fontSize: '1rem', minWidth: 40, textAlign: 'center' }}>{year}</strong>
        <button className="btn-secondary" onClick={() => { setYear(y => y+1); setActiveDay(null); setAddForm(null); }}>▶</button>
        <span style={{ width: 10 }} />
        <button className="btn-secondary" onClick={prevMonth}>◀</button>
        <strong style={{ minWidth: 64, textAlign: 'center' }}>{MONTHS_HE[month]}</strong>
        <button className="btn-secondary" onClick={nextMonth}>▶</button>
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {DAY_INITIALS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', paddingBottom: 2 }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} style={{ minHeight: 58 }} />;
          const dateStr = toStr(year, month, d);
          const dow = new Date(year, month, d).getDay();
          const isSat = dow === 6;
          const isFri = dow === 5;
          const sd = sdForDate(dateStr);
          const isActive = activeDay === dateStr;
          return (
            <div
              key={d}
              onClick={() => handleDayClick(dateStr)}
              title={sd ? `${sd.name} — לחץ לאפשרויות` : 'לחץ להוספת יום מיוחד'}
              style={{
                minHeight: 58, borderRadius: 6, padding: '4px 3px', textAlign: 'center',
                cursor: 'pointer',
                border: isActive ? '2px solid #2563eb' : sd ? `2px solid ${sd.color}` : '2px solid transparent',
                background: sd ? sd.color + '28' : isSat ? '#fee2e2' : isFri ? '#fef3c7' : '#f9fafb',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                boxShadow: isActive ? '0 0 0 2px #bfdbfe' : sd ? `0 0 0 1px ${sd.color}55` : 'none',
                transition: 'box-shadow 0.1s',
              }}
            >
              <span style={{
                fontSize: '0.88rem', fontWeight: sd ? 700 : 400,
                color: sd ? sd.color : isSat ? '#dc2626' : isFri ? '#b45309' : '#374151',
              }}>{d}</span>
              {sd && (
                <>
                  <span style={{ fontSize: '0.65rem', color: sd.color, fontWeight: 700, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                    {sd.name}
                  </span>
                  <span style={{ fontSize: '0.58rem', background: sd.color, borderRadius: 3, padding: '0 3px', color: 'white', fontWeight: 600, lineHeight: 1.4 }}>
                    {sd.type === 'holiday' ? 'חג' : sd.type === 'eve' ? 'ערב חג' : 'אחר'}
                  </span>
                </>
              )}
              {!sd && isSat && (
                <span style={{ fontSize: '0.58rem', background: '#059669', borderRadius: 3, padding: '0 3px', color: 'white', fontWeight: 600, lineHeight: 1.4 }}>שבת</span>
              )}
              {!sd && isFri && (
                <span style={{ fontSize: '0.58rem', background: '#0369a1', borderRadius: 3, padding: '0 3px', color: 'white', fontWeight: 600, lineHeight: 1.4 }}>שישי</span>
              )}
              {!sd && !isSat && !isFri && (
                <span style={{ fontSize: '0.5rem', color: '#d1d5db', lineHeight: 1.5 }}>+</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Active day action panel */}
      {activeDay && activeSd && (
        <div style={{ background: activeSd.color + '18', border: `2px solid ${activeSd.color}`, borderRadius: 8, padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: activeSd.color, flexShrink: 0 }} />
          <strong style={{ fontSize: '0.9rem' }}>{activeDay}</strong>
          <span style={{ fontSize: '0.9rem' }}>{activeSd.name}</span>
          <span style={{ fontSize: '0.78rem', color: '#6b7280', background: '#fff', borderRadius: 4, padding: '1px 8px', border: '1px solid #e5e7eb' }}>
            {activeSd.type === 'holiday' ? 'חג / שבת' : activeSd.type === 'eve' ? 'ערב חג / שישי' : 'אחר'}
          </span>
          <button
            className="btn-remove"
            style={{ marginRight: 'auto' }}
            onClick={() => removeSD(activeSd.id)}
          >
            הסר סימון
          </button>
          <button onClick={() => { setActiveDay(null); setAddForm(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>
      )}

      {activeDay && !activeSd && addForm && (
        <div style={{ background: '#eff6ff', border: '2px solid #3b82f6', borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <strong style={{ fontSize: '0.88rem', color: '#1d4ed8' }}>הוסף יום מיוחד — {activeDay}</strong>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={addForm.name}
              onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addSD()}
              placeholder="שם היום המיוחד..."
              autoFocus
              style={{ flex: 1, minWidth: 130, padding: '6px 8px', borderRadius: 4, border: '1px solid #93c5fd', outline: 'none' }}
            />
            <select
              value={addForm.type}
              onChange={e => setAddForm(f => ({ ...f, type: e.target.value, color: e.target.value === 'eve' ? '#10b981' : e.target.value === 'other' ? '#6b7280' : '#059669' }))}
              style={{ padding: '6px', borderRadius: 4, border: '1px solid #93c5fd' }}
            >
              <option value="holiday">חג / שבת</option>
              <option value="eve">ערב חג / שישי</option>
              <option value="other">אחר</option>
            </select>
            <input type="color" value={addForm.color} onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))} style={{ width: 36, height: 32, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
            <button className="btn-primary" onClick={addSD}>הוסף</button>
            <button onClick={() => { setActiveDay(null); setAddForm(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem' }}>✕</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: '#6b7280', alignItems: 'center', flexWrap: 'wrap' }}>
        <span>לחץ על יום ריק להוספה • לחץ על יום מסומן להסרה</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#059669', display: 'inline-block' }} />חג / שבת
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />ערב חג / שישי
        </span>
      </div>

    </div>
  );
}
