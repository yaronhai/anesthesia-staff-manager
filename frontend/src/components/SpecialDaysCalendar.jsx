import { useState, useEffect } from 'react';
import styles from '../styles/SpecialDaysCalendar.module.scss';

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
  const [showHolidays, setShowHolidays] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);

  const checkLandscape = () => window.innerWidth < 900 && window.innerHeight < 500;
  const checkMobile = () => window.innerWidth < 640;
  const [isLandscape, setIsLandscape] = useState(checkLandscape);
  const [isMobile, setIsMobile] = useState(checkMobile);
  useEffect(() => {
    const h = () => { setIsLandscape(checkLandscape()); setIsMobile(checkMobile()); };
    window.addEventListener('resize', h, { passive: true });
    return () => window.removeEventListener('resize', h);
  }, []);

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

  async function fetchHolidays() {
    if (showHolidays) { setShowHolidays(false); return; }
    setHolidaysLoading(true);
    try {
      const res = await fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&i=on&year=${year}&month=x&ss=off&mf=on&c=off&s=off&nx=off`);
      const data = await res.json();
      const items = (data.items || [])
        .filter(item => item.category === 'holiday' && item.date && item.hebrew)
        .map(item => ({
          date: item.date.substring(0, 10),
          name: item.hebrew,
          subcat: item.subcat || '',
        }));
      setHolidays(items);
      setShowHolidays(true);
    } catch {
      alert('שגיאה בטעינת חגים מהאינטרנט');
    } finally {
      setHolidaysLoading(false);
    }
  }

  async function addHolidayDirect(h) {
    const dow = new Date(h.date + 'T12:00:00').getDay();
    const type = h.subcat === 'eve' || dow === 5 ? 'eve' : 'holiday';
    const color = type === 'eve' ? '#6ee7b7' : '#059669';
    const res = await fetch(`/api/config/special-days${branchQ}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ date: h.date, name: h.name, type, color }),
    });
    if (res.ok) onConfigChange(await res.json());
    else alert('שגיאה בהוספה');
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

  // Each day gets exactly one category — no double-counting
  const categorized = Array.from({ length: daysInMonth }, (_, i) => {
    const dateStr = toStr(year, month, i + 1);
    const dow = new Date(year, month, i + 1).getDay(); // 5=Fri, 6=Sat
    const sd = monthSDs.find(s => s.date === dateStr);
    const type = sd?.type;
    if (type === 'holiday')            return 'holiday';
    if (type === 'eve' && dow === 6)   return 'saturday'; // eve on Sat → Sat
    if (type === 'eve')                return 'eve';
    if (dow === 6)                     return 'saturday';
    if (dow === 5)                     return 'friday';
    return null;
  });
  const monthHolidays  = categorized.filter(c => c === 'holiday').length;
  const monthEves      = categorized.filter(c => c === 'eve').length;
  const monthSaturdays = categorized.filter(c => c === 'saturday').length;
  const monthFridays   = categorized.filter(c => c === 'friday').length;
  const monthTotal = monthHolidays + monthEves + monthSaturdays + monthFridays;

  const categoryMap = new Map(
    Array.from({ length: daysInMonth }, (_, i) => [toStr(year, month, i + 1), categorized[i]])
  );
  const CAT_BADGE = {
    holiday:  { label: 'חג',    bg: '#059669', text: '#fff' },
    eve:      { label: 'ערב',   bg: '#0ea5e9', text: '#fff' },
    saturday: { label: 'שבת',   bg: '#dc2626', text: '#fff' },
    friday:   { label: 'שישי',  bg: '#b45309', text: '#fff' },
  };

  const L = isLandscape || isMobile;

  return (
    <div className={`${styles.root} ${L ? styles.compact : ''}`}>

      {/* Month summary */}
      <div className={styles.monthlySummary}>
        <span className={styles.summaryLabel}>סה"כ חודש זה: {monthTotal}</span>
        <span className={styles.summarySep}>|</span>
        <span className={styles.summaryItem}>חג: <span className={styles.summaryCount}>{monthHolidays}</span></span>
        <span className={styles.summarySep}>|</span>
        <span className={styles.summaryItem}>ערב חג: <span className={styles.summaryCount}>{monthEves}</span></span>
        <span className={styles.summarySep}>|</span>
        <span className={styles.summaryItem}>שבת: <span className={styles.summaryCount}>{monthSaturdays}</span></span>
        <span className={styles.summarySep}>|</span>
        <span className={styles.summaryItem}>שישי: <span className={styles.summaryCount}>{monthFridays}</span></span>
      </div>

      {/* Navigation */}
      <div className="month-year-nav">
        <button className="btn-secondary btn-sm" onClick={() => { setYear(y => y+1); setActiveDay(null); setAddForm(null); }} title="שנה קדימה">»</button>
        <button className="btn-secondary btn-sm" onClick={nextMonth} title="חודש קדימה">›</button>
        <span className="month-year-label">{MONTHS_HE[month]} {year}</span>
        <button className="btn-secondary btn-sm" onClick={prevMonth} title="חודש אחורה">‹</button>
        <button className="btn-secondary btn-sm" onClick={() => { setYear(y => y-1); setActiveDay(null); setAddForm(null); }} title="שנה אחורה">«</button>
        <button className={`btn-secondary btn-sm ${styles.holidaysBtn}`} onClick={fetchHolidays} disabled={holidaysLoading}>
          {holidaysLoading ? '...' : '📅 חגים'}
        </button>
      </div>

      {/* Holidays list panel */}
      {showHolidays && (
        <div className={styles.holidaysPanel}>
          <div className={styles.holidaysPanelHeader}>
            <strong className={styles.holidaysPanelTitle}>חגים {year} — לחץ להוספה</strong>
            <button className={styles.holidaysPanelClose} onClick={() => setShowHolidays(false)}>✕</button>
          </div>
          {holidays.length === 0 ? (
            <div className={styles.holidaysEmpty}>לא נמצאו חגים</div>
          ) : (
            <div className={styles.holidaysList}>
              {holidays.map((h, i) => {
                const alreadyAdded = specialDays.some(s => s.date === h.date);
                return (
                  <div key={i} className={styles.holidayItem} style={{ '--item-bg': alreadyAdded ? '#f0fdf4' : 'white' }}>
                    <span className={styles.holidayItemText}><span className={styles.holidayItemDate}>{h.date}</span> — {h.name}</span>
                    {alreadyAdded
                      ? <span className={styles.holidayAdded}>✓ קיים</span>
                      : <button onClick={() => addHolidayDirect(h)} className={`btn-primary ${styles.holidayAddBtn}`}>הוסף</button>
                    }
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Calendar grid */}
      <div className={styles.calendarGrid}>
        {DAY_INITIALS.map(d => (
          <div key={d} className={styles.dayHeader}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className={styles.emptyCell} />;
          const dateStr = toStr(year, month, d);
          const dow = new Date(year, month, d).getDay();
          const isSat = dow === 6;
          const isFri = dow === 5;
          const sd = sdForDate(dateStr);
          const isActive = activeDay === dateStr;
          const cat = categoryMap.get(dateStr);
          const badge = cat ? CAT_BADGE[cat] : null;
          return (
            <div
              key={d}
              className={styles.cell}
              onClick={() => handleDayClick(dateStr)}
              title={sd ? `${sd.name} — לחץ לאפשרויות` : 'לחץ להוספת יום מיוחד'}
              style={{
                '--cell-border': isActive ? '2px solid #2563eb' : sd ? `2px solid ${sd.color}` : '2px solid transparent',
                '--cell-bg': sd ? sd.color + '28' : isSat ? '#fecaca' : isFri ? '#bfdbfe' : '#f9fafb',
                '--cell-shadow': isActive ? '0 0 0 2px #bfdbfe' : sd ? `0 0 0 1px ${sd.color}55` : 'none',
              }}
            >
              <span
                className={styles.dayNum}
                style={{
                  '--day-num-weight': sd ? 700 : 400,
                  '--day-num-color': sd ? sd.color : isSat ? '#dc2626' : isFri ? '#b45309' : '#374151',
                }}
              >{d}</span>
              {sd && (
                <span className={styles.sdName} style={{ '--sd-name-color': sd.color }}>
                  {sd.name}
                </span>
              )}
              {badge && (
                <span
                  className={styles.catBadge}
                  style={{ '--badge-bg': badge.bg, '--badge-color': badge.text }}
                >
                  {badge.label}
                </span>
              )}
              {!sd && !badge && !L && (
                <span className={styles.addHint}>+</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Active day panel — view or inline edit */}
      {activeDay && activeSd && (
        <div
          className={styles.activeDayPanel}
          style={{
            '--panel-bg': editingSD ? '#eff6ff' : activeSd.color + '18',
            '--panel-border-color': editingSD ? '#3b82f6' : activeSd.color,
          }}
        >
          {!editingSD ? (
            <>
              <span className={styles.colorSwatch} style={{ '--swatch-color': activeSd.color }} />
              <strong className={styles.activeDayDate}>{activeDay}</strong>
              <span className={styles.activeDayName}>{activeSd.name}</span>
              <span className={styles.activeDayType}>
                {activeSd.type === 'holiday' ? 'חג / שבת' : activeSd.type === 'eve' ? 'ערב חג / שישי' : 'אחר'}
              </span>
              <button className={`btn-edit ${styles.activeDayEditBtn}`} title="ערוך" onClick={() => setEditingSD({ ...activeSd })}>✏️</button>
              <button className="btn-delete" title="הסר סימון" onClick={() => removeSD(activeSd.id)}>🗑️</button>
              <button className={styles.activeDayCloseBtn} onClick={() => { setActiveDay(null); setAddForm(null); setEditingSD(null); }}>✕</button>
            </>
          ) : (
            <>
              <input
                className={styles.editInput}
                value={editingSD.name}
                onChange={e => setEditingSD(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && updateSD()}
                autoFocus
              />
              <select
                className={styles.editSelect}
                value={editingSD.type}
                onChange={e => setEditingSD(f => ({ ...f, type: e.target.value, color: e.target.value === 'eve' ? '#6ee7b7' : e.target.value === 'other' ? '#6b7280' : '#059669' }))}
              >
                <option value="holiday">חג / שבת</option>
                <option value="eve">ערב חג / שישי</option>
                <option value="other">אחר</option>
              </select>
              <div className={styles.colorPalette}>
                {COLOR_PALETTE.map(col => (
                  <button
                    key={col}
                    className={styles.paletteBtn}
                    onClick={() => setEditingSD(f => ({ ...f, color: col }))}
                    style={{
                      '--swatch-bg': col,
                      '--swatch-border': editingSD.color === col ? '2px solid #1f2937' : '1px solid #d1d5db',
                    }}
                    title={col}
                  />
                ))}
              </div>
              <button className={styles.editSaveBtn} onClick={updateSD}>✓</button>
              <button className={styles.editCancelBtn} onClick={() => setEditingSD(null)}>✕</button>
            </>
          )}
        </div>
      )}

      {activeDay && !activeSd && addForm && (
        <div className={styles.addFormPanel}>
          <strong className={styles.addFormTitle}>הוסף יום מיוחד — {activeDay}</strong>
          <div className={styles.addFormRow}>
            <input
              className={styles.addNameInput}
              value={addForm.name}
              onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addSD()}
              placeholder="שם היום המיוחד..."
              autoFocus
            />
            <select
              className={styles.addTypeSelect}
              value={addForm.type}
              onChange={e => setAddForm(f => ({ ...f, type: e.target.value, color: e.target.value === 'eve' ? '#6ee7b7' : e.target.value === 'other' ? '#6b7280' : '#059669' }))}
            >
              <option value="holiday">חג / שבת</option>
              <option value="eve">ערב חג / שישי</option>
              <option value="other">אחר</option>
            </select>
            <div className={styles.addColorPalette}>
              {COLOR_PALETTE.map(col => (
                <button
                  key={col}
                  className={styles.addPaletteBtn}
                  onClick={() => setAddForm(f => ({ ...f, color: col }))}
                  style={{
                    '--swatch-bg': col,
                    '--swatch-border': addForm.color === col ? '2px solid #1f2937' : '1px solid #d1d5db',
                  }}
                  title={col}
                />
              ))}
            </div>
            <button className="btn-primary" onClick={addSD}>הוסף</button>
            <button className={styles.addCancelBtn} onClick={() => { setActiveDay(null); setAddForm(null); }}>✕</button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className={styles.instructions}>
        לחץ על יום ריק להוספה • לחץ על יום מסומן לעריכה/הסרה
      </div>

    </div>
  );
}
