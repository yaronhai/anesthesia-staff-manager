import { useState } from 'react';

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                   'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DAY_INITIALS = ['א','ב','ג','ד','ה','ו','ש'];
const COLOR_PALETTE = ['#059669', '#6ee7b7', '#6b7280', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04'];

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
  const [editingSD, setEditingSD] = useState(null);

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
      setAddForm({ date: dateStr, name: '', type, color: type === 'eve' ? '#6ee7b7' : '#059669' });
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
    console.log('[addSD] sending type:', addForm.type, 'full form:', addForm);
    const res = await fetch(`/api/config/special-days${branchQ}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ date: addForm.date, name: addForm.name.trim(), type: addForm.type, color: addForm.color }),
    });
    if (res.ok) { onConfigChange(await res.json()); setActiveDay(null); setAddForm(null); }
    else alert('שגיאה בהוספה');
  }

  async function updateSD() {
    if (!editingSD?.name.trim()) return alert('יש למלא שם');
    const res = await fetch(`/api/config/special-days/${editingSD.id}${branchQ}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ date: editingSD.date, name: editingSD.name.trim(), type: editingSD.type, color: editingSD.color }),
    });
    if (res.ok) { onConfigChange(await res.json()); setEditingSD(null); }
    else alert('שגיאה בעדכון');
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
  // Saturdays: count if no special day, "אחר", or eve on Saturday
  const monthSaturdays = Array.from({ length: daysInMonth }, (_, i) => {
    const dateStr = toStr(year, month, i + 1);
    if (new Date(year, month, i + 1).getDay() !== 6) return false;
    const sd = monthSDs.find(s => s.date === dateStr);
    return !sd || sd.type === 'other' || sd.type === 'eve';
  }).filter(Boolean).length;
  // Fridays: count if no special day or "אחר" (holiday/eve override)
  const monthFridays = Array.from({ length: daysInMonth }, (_, i) => {
    const dateStr = toStr(year, month, i + 1);
    if (new Date(year, month, i + 1).getDay() !== 5) return false;
    const sd = monthSDs.find(s => s.date === dateStr);
    return !sd || sd.type === 'other';
  }).filter(Boolean).length;
  const monthTotal = monthHolidays + monthEves + monthSaturdays + monthFridays;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginLeft: 'auto', marginRight: 0 }}>

      {/* Month summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.7rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 12px' }}>
        <span style={{ color: '#374151', fontWeight: 700 }}>סה"כ חודש זה: {monthTotal}</span>
        <span style={{ color: '#9ca3af' }}>|</span>
        <span style={{ color: '#374151' }}>חג: <span style={{ fontWeight: 700, color: '#7f1d1d' }}>{monthHolidays}</span></span>
        <span style={{ color: '#9ca3af' }}>|</span>
        <span style={{ color: '#374151' }}>ערב חג: <span style={{ fontWeight: 700, color: '#7f1d1d' }}>{monthEves}</span></span>
        <span style={{ color: '#9ca3af' }}>|</span>
        <span style={{ color: '#374151' }}>שבת: <span style={{ fontWeight: 700, color: '#7f1d1d' }}>{monthSaturdays}</span></span>
        <span style={{ color: '#9ca3af' }}>|</span>
        <span style={{ color: '#374151' }}>שישי: <span style={{ fontWeight: 700, color: '#7f1d1d' }}>{monthFridays}</span></span>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button className="btn-secondary" onClick={() => { setYear(y => y-1); setActiveDay(null); setAddForm(null); }}>◀</button>
        <strong style={{ fontSize: '0.85rem', minWidth: 40, textAlign: 'center' }}>{year}</strong>
        <button className="btn-secondary" onClick={() => { setYear(y => y+1); setActiveDay(null); setAddForm(null); }}>▶</button>
        <span style={{ width: 10 }} />
        <button className="btn-secondary" onClick={prevMonth}>◀</button>
        <strong style={{ minWidth: 64, textAlign: 'center' }}>{MONTHS_HE[month]}</strong>
        <button className="btn-secondary" onClick={nextMonth}>▶</button>
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {DAY_INITIALS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#9ca3af', paddingBottom: 2 }}>{d}</div>
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
                minHeight: 48, borderRadius: 6, padding: '3px 2px', textAlign: 'center',
                cursor: 'pointer',
                border: isActive ? '2px solid #2563eb' : sd ? `2px solid ${sd.color}` : '2px solid transparent',
                background: sd ? sd.color + '28' : isSat ? '#fecaca' : isFri ? '#bfdbfe' : '#f9fafb',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                boxShadow: isActive ? '0 0 0 2px #bfdbfe' : sd ? `0 0 0 1px ${sd.color}55` : 'none',
                transition: 'box-shadow 0.1s',
              }}
            >
              <span style={{
                fontSize: '0.75rem', fontWeight: sd ? 700 : 400,
                color: sd ? sd.color : isSat ? '#dc2626' : isFri ? '#b45309' : '#374151',
              }}>{d}</span>
              {sd && (
                <>
                  <span style={{ fontSize: '0.55rem', color: sd.color, fontWeight: 700, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                    {sd.name}
                  </span>
                  {sd.type !== 'other' && (
                    <span style={{ fontSize: '0.48rem', background: sd.color, borderRadius: 3, padding: '0 3px', color: 'white', fontWeight: 600, lineHeight: 1.4 }}>
                      {sd.type === 'holiday' ? 'חג' : 'ערב חג'}
                    </span>
                  )}
                </>
              )}
              {!sd && !isSat && !isFri && (
                <span style={{ fontSize: '0.42rem', color: '#d1d5db', lineHeight: 1.5 }}>+</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Active day panel — view or inline edit */}
      {activeDay && activeSd && (
        <div style={{ background: editingSD ? '#eff6ff' : activeSd.color + '18', border: `2px solid ${editingSD ? '#3b82f6' : activeSd.color}`, borderRadius: 8, padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!editingSD ? (
            <>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: activeSd.color, flexShrink: 0 }} />
              <strong style={{ fontSize: '0.78rem' }}>{activeDay}</strong>
              <span style={{ fontSize: '0.78rem' }}>{activeSd.name}</span>
              <span style={{ fontSize: '0.68rem', color: '#6b7280', background: '#fff', borderRadius: 4, padding: '1px 6px', border: '1px solid #e5e7eb' }}>
                {activeSd.type === 'holiday' ? 'חג / שבת' : activeSd.type === 'eve' ? 'ערב חג / שישי' : 'אחר'}
              </span>
              <button className="btn-edit" title="ערוך" style={{ marginRight: 'auto' }} onClick={() => setEditingSD({ ...activeSd })}>✏️</button>
              <button className="btn-delete" title="הסר סימון" onClick={() => removeSD(activeSd.id)}>🗑️</button>
              <button onClick={() => { setActiveDay(null); setAddForm(null); setEditingSD(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.9rem' }}>✕</button>
            </>
          ) : (
            <>
              <input
                value={editingSD.name}
                onChange={e => setEditingSD(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && updateSD()}
                autoFocus
                style={{ flex: 1, minWidth: 120, padding: '4px 8px', borderRadius: 4, border: '1px solid #93c5fd', outline: 'none', fontSize: '0.78rem' }}
              />
              <select
                value={editingSD.type}
                onChange={e => setEditingSD(f => ({ ...f, type: e.target.value, color: e.target.value === 'eve' ? '#6ee7b7' : e.target.value === 'other' ? '#6b7280' : '#059669' }))}
                style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #93c5fd', fontSize: '0.78rem' }}
              >
                <option value="holiday">חג / שבת</option>
                <option value="eve">ערב חג / שישי</option>
                <option value="other">אחר</option>
              </select>
              <div style={{ display: 'flex', gap: 3 }}>
                {COLOR_PALETTE.map(col => (
                  <button key={col} onClick={() => setEditingSD(f => ({ ...f, color: col }))} style={{ width: 20, height: 20, borderRadius: 3, background: col, border: editingSD.color === col ? '2px solid #1f2937' : '1px solid #d1d5db', cursor: 'pointer', padding: 0 }} title={col} />
                ))}
              </div>
              <button style={{ background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '3px 10px', fontSize: '0.85rem' }} onClick={updateSD}>✓</button>
              <button onClick={() => setEditingSD(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.9rem' }}>✕</button>
            </>
          )}
        </div>
      )}

      {activeDay && !activeSd && addForm && (
        <div style={{ background: '#eff6ff', border: '2px solid #3b82f6', borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <strong style={{ fontSize: '0.75rem', color: '#1d4ed8' }}>הוסף יום מיוחד — {activeDay}</strong>
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
              onChange={e => setAddForm(f => ({ ...f, type: e.target.value, color: e.target.value === 'eve' ? '#6ee7b7' : e.target.value === 'other' ? '#6b7280' : '#059669' }))}
              style={{ padding: '6px', borderRadius: 4, border: '1px solid #93c5fd' }}
            >
              <option value="holiday">חג / שבת</option>
              <option value="eve">ערב חג / שישי</option>
              <option value="other">אחר</option>
            </select>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {COLOR_PALETTE.map(col => (
                <button
                  key={col}
                  onClick={() => setAddForm(f => ({ ...f, color: col }))}
                  style={{
                    width: 24, height: 24, borderRadius: 4, background: col, border: addForm.color === col ? '2px solid #1f2937' : '1px solid #d1d5db',
                    cursor: 'pointer', padding: 0
                  }}
                  title={col}
                />
              ))}
            </div>
            <button className="btn-primary" onClick={addSD}>הוסף</button>
            <button onClick={() => { setActiveDay(null); setAddForm(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.85rem' }}>✕</button>
          </div>
        </div>
      )}


      {/* Instructions */}
      <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>
        לחץ על יום ריק להוספה • לחץ על יום מסומן לעריכה/הסרה
      </div>

    </div>
  );
}
