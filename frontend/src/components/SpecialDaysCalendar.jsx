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

async function fetchIsraeliHolidays(year) {
  const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&year=${year}&maj=on&min=off&ss=off&mf=off&nx=off&mod=on&i=off&c=off&s=off&lg=he`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return (data.items || []).filter(item => item.category === 'holiday');
}

export default function SpecialDaysCalendar({ config, authToken, branchId, onConfigChange }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [importList, setImportList] = useState(null);
  const [importSel, setImportSel] = useState({});
  const [loadingImport, setLoadingImport] = useState(false);
  const [applying, setApplying] = useState(false);
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
      setAddForm({ date: dateStr, name: '', type, color: type === 'eve' ? '#f59e0b' : '#dc2626' });
    } else {
      setAddForm(null);
    }
  }

  async function removeSD(id) {
    const res = await fetch(`/api/config/special-days/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) { onConfigChange(await res.json()); setActiveDay(null); setAddForm(null); }
  }

  async function addSD() {
    if (!addForm?.name.trim()) return alert('יש למלא שם');
    const res = await fetch('/api/config/special-days', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ date: addForm.date, name: addForm.name.trim(), type: addForm.type, color: addForm.color }),
    });
    if (res.ok) { onConfigChange(await res.json()); setActiveDay(null); setAddForm(null); }
    else alert('שגיאה בהוספה');
  }

  async function loadHolidays() {
    setLoadingImport(true);
    try {
      const raw = await fetchIsraeliHolidays(year);
      const seen = new Set();
      const list = [];
      raw.forEach(item => {
        const date = item.date.substring(0, 10);
        const name = item.title;
        const hKey = `${date}:holiday`;
        if (!seen.has(hKey)) {
          seen.add(hKey);
          list.push({ id: hKey, date, name, type: 'holiday', color: '#dc2626' });
        }
        const eveDate = shiftDate(date, -1);
        const eKey = `${eveDate}:eve`;
        if (!seen.has(eKey)) {
          seen.add(eKey);
          list.push({ id: eKey, date: eveDate, name: `ערב ${name}`, type: 'eve', color: '#f59e0b' });
        }
      });
      list.sort((a, b) => a.date.localeCompare(b.date));
      setImportList(list);
      const sel = {};
      list.forEach(h => { sel[h.id] = true; });
      setImportSel(sel);
    } catch {
      alert('שגיאה בטעינת חגים מהאינטרנט. בדוק חיבור.');
    }
    setLoadingImport(false);
  }

  async function applyImport() {
    setApplying(true);
    const existing = new Set(specialDays.map(s => `${s.date}:${s.type}`));
    const toAdd = (importList || []).filter(h => importSel[h.id] && !existing.has(`${h.date}:${h.type}`));
    let lastConfig = null;
    for (const h of toAdd) {
      const res = await fetch('/api/config/special-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ date: h.date, name: h.name, type: h.type, color: h.color }),
      });
      if (res.ok) lastConfig = await res.json();
    }
    if (lastConfig) {
      onConfigChange(lastConfig);
    } else {
      const r = await fetch(`/api/config${branchQ}`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (r.ok) onConfigChange(await r.json());
    }
    setImportList(null);
    setApplying(false);
  }

  async function deleteAllForYear() {
    if (!window.confirm(`למחוק את כל ${yearSDs.length} הימים המיוחדים לשנת ${year}?`)) return;
    let last = null;
    for (const sd of yearSDs) {
      const r = await fetch(`/api/config/special-days/${sd.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
      if (r.ok) last = await r.json();
    }
    if (last) onConfigChange(last);
  }

  const yearSDs = specialDays.filter(s => s.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date));
  const activeSd = activeDay ? sdForDate(activeDay) : null;
  const newCount = (importList || []).filter(h => importSel[h.id] && !specialDays.some(s => s.date === h.date && s.type === h.type)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button className="btn-secondary" onClick={() => { setYear(y => y-1); setActiveDay(null); setAddForm(null); }}>◀</button>
        <strong style={{ fontSize: '1rem', minWidth: 40, textAlign: 'center' }}>{year}</strong>
        <button className="btn-secondary" onClick={() => { setYear(y => y+1); setActiveDay(null); setAddForm(null); }}>▶</button>
        <span style={{ width: 10 }} />
        <button className="btn-secondary" onClick={prevMonth}>◀</button>
        <strong style={{ minWidth: 64, textAlign: 'center' }}>{MONTHS_HE[month]}</strong>
        <button className="btn-secondary" onClick={nextMonth}>▶</button>
        <button
          className="btn-primary"
          style={{ marginRight: 'auto', fontSize: '0.85rem' }}
          onClick={loadHolidays}
          disabled={loadingImport}
        >
          {loadingImport ? '⏳ טוען...' : `ייבא חגי ישראל ${year}`}
        </button>
      </div>

      {/* Import panel */}
      {importList && (
        <div style={{ border: '2px solid #f59e0b', borderRadius: 8, padding: '0.75rem', background: '#fffbeb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.88rem' }}>חגי ישראל לשנת {year} — סמן את מה להוסיף:</strong>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
              <button style={{ fontSize: '0.78rem' }} onClick={() => { const s = {}; importList.forEach(h => { s[h.id] = true; }); setImportSel(s); }}>בחר הכל</button>
              <button style={{ fontSize: '0.78rem' }} onClick={() => setImportSel({})}>בטל הכל</button>
              <button className="btn-primary" style={{ fontSize: '0.82rem' }} onClick={applyImport} disabled={applying || newCount === 0}>
                {applying ? '⏳' : `הוסף ${newCount}`}
              </button>
              <button style={{ fontSize: '0.9rem' }} onClick={() => setImportList(null)}>✕</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.2rem', maxHeight: 260, overflowY: 'auto', fontSize: '0.82rem' }}>
            {importList.map(h => {
              const exists = specialDays.some(s => s.date === h.date && s.type === h.type);
              return (
                <label key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '3px 6px',
                  borderRadius: 4, cursor: exists ? 'default' : 'pointer',
                  background: exists ? '#f3f4f6' : importSel[h.id] ? h.color + '22' : 'transparent',
                  opacity: exists ? 0.55 : 1,
                }}>
                  <input type="checkbox" checked={!!importSel[h.id]} disabled={exists}
                    onChange={e => setImportSel(s => ({ ...s, [h.id]: e.target.checked }))} />
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: h.color, flexShrink: 0 }} />
                  <span style={{ color: '#6b7280', fontSize: '0.75rem', flexShrink: 0 }}>{h.date}</span>
                  <span style={{ flex: 1 }}>{h.name}</span>
                  {exists && <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>✓ קיים</span>}
                </label>
              );
            })}
          </div>
        </div>
      )}

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
                border: isActive ? '2px solid #2563eb' : `2px solid ${sd ? sd.color + 'bb' : 'transparent'}`,
                background: sd ? sd.color + '1c' : isSat ? '#fecaca22' : '#f9fafb',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                boxShadow: isActive ? '0 0 0 2px #bfdbfe' : 'none',
                transition: 'box-shadow 0.1s',
              }}
            >
              <span style={{
                fontSize: '0.88rem', fontWeight: sd ? 700 : 400,
                color: sd ? sd.color : isSat ? '#dc2626' : '#374151',
              }}>{d}</span>
              {sd && (
                <>
                  <span style={{ fontSize: '0.48rem', color: sd.color, fontWeight: 600, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                    {sd.name}
                  </span>
                  <span style={{ fontSize: '0.42rem', background: 'rgba(255,255,255,0.7)', borderRadius: 2, padding: '0 2px', color: '#6b7280' }}>
                    {sd.type === 'holiday' ? 'חג' : 'ערב חג'}
                  </span>
                </>
              )}
              {!sd && !isSat && (
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
            {activeSd.type === 'holiday' ? 'חג / שבת' : 'ערב חג / שישי'}
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
              onChange={e => setAddForm(f => ({ ...f, type: e.target.value, color: e.target.value === 'eve' ? '#f59e0b' : '#dc2626' }))}
              style={{ padding: '6px', borderRadius: 4, border: '1px solid #93c5fd' }}
            >
              <option value="holiday">חג / שבת</option>
              <option value="eve">ערב חג / שישי</option>
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
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#dc2626', display: 'inline-block' }} />חג / שבת
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} />ערב חג / שישי
        </span>
      </div>

      {/* Year summary list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <strong style={{ fontSize: '0.88rem', color: '#374151' }}>כל הימים המיוחדים לשנת {year} ({yearSDs.length})</strong>
          {yearSDs.length > 0 && (
            <button
              onClick={deleteAllForYear}
              style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              מחק הכל לשנה זו
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {yearSDs.map(sd => (
            <span key={sd.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              background: sd.color + '1c', border: `1px solid ${sd.color}`,
              borderRadius: 6, padding: '2px 8px', fontSize: '0.78rem',
            }}>
              <span style={{ color: sd.color, fontWeight: 700, fontSize: '0.7rem' }}>{sd.date}</span>
              <span>{sd.name}</span>
              <span style={{ fontSize: '0.68rem', color: '#9ca3af', background: '#f3f4f6', borderRadius: 3, padding: '0 4px' }}>
                {sd.type === 'holiday' ? 'חג' : 'ערב'}
              </span>
              <button onClick={() => removeSD(sd.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '0.75rem', padding: 0, lineHeight: 1, marginRight: '-2px' }}>✕</button>
            </span>
          ))}
          {yearSDs.length === 0 && (
            <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>אין ימים מיוחדים לשנת {year}</span>
          )}
        </div>
      </div>
    </div>
  );
}
