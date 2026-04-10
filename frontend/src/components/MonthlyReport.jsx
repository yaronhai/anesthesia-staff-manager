import { useState, useEffect, useCallback } from 'react';

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const WEEK_HEADERS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function buildCalendarWeeks(year, month) {
  const weeks = [];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let week = Array(firstDay).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

export default function MonthlyReport({ token }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [requests, setRequests] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();


  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/shift-requests?month=${month + 1}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setRequests(data);
    } catch (err) {
      console.error('Failed to fetch shift requests:', err);
    }
  }, [month, year, token]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  // Build data structure: date -> shift -> { prefer: [], can: [] }
  const reportData = {};
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    reportData[dateStr] = {
      morning: { prefer: [], can: [] },
      evening: { prefer: [], can: [] },
      night: { prefer: [], can: [] },
    };
  }

  // Populate with requests (exclude "cannot", only morning/evening/night)
  requests.forEach(req => {
    if (req.preference_type === 'cannot' || !reportData[req.date]) return;
    if (req.shift_type !== 'morning' && req.shift_type !== 'evening' && req.shift_type !== 'night') return;

    const workerName = req.first_name && req.family_name
      ? `${req.first_name} ${req.family_name}`
      : req.username;

    const bucket = req.preference_type === 'prefer' ? 'prefer' : 'can';
    reportData[req.date][req.shift_type][bucket].push(workerName);
  });

  // Sort names
  Object.values(reportData).forEach(dayShifts => {
    ['morning', 'evening', 'night'].forEach(shift => {
      dayShifts[shift].can.sort();
      dayShifts[shift].prefer.sort();
    });
  });

  const weeks = buildCalendarWeeks(year, month);

  return (
    <div className="report-container">
      <div className="report-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={prevMonth} className="btn-secondary btn-sm">← קודם</button>
          <h2 style={{ margin: 0, color: '#1a2e4a', fontSize: '1.25rem', minWidth: '150px', textAlign: 'center' }}>{MONTHS[month]} {year}</h2>
          <button onClick={nextMonth} className="btn-secondary btn-sm">הבא →</button>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => window.print()} className="btn-primary btn-sm">🖨️ הדפסה</button>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ width: '12px', height: '12px', background: '#16a34a', borderRadius: '2px' }}></div>
              <span>מעדיף</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ width: '12px', height: '12px', background: '#0369a1', borderRadius: '2px' }}></div>
              <span>יכול</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Header Row */}
      <div className="calendar-wrapper" style={{ display: 'flex', flexDirection: 'column', border: '2px solid #1a2e4a' }}>
        <div className="calendar-row header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#1a2e4a' }}>
          {WEEK_HEADERS.map(day => (
            <div key={day} className="calendar-header-cell">{day}</div>
          ))}
        </div>

        {/* Calendar Week Rows */}
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="calendar-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '2px solid #1a2e4a' }}>
            {week.map((day, dayIdx) => {
              const uniqueKey = `week-${weekIdx}-day-${dayIdx}`;
              if (day === null) {
                return <div key={uniqueKey} className="calendar-cell empty"></div>;
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayData = reportData[dateStr];

              return (
                <div 
                  key={uniqueKey} 
                  className="calendar-cell" 
                  style={{ 
                    padding: '0.15rem',
                    minHeight: '50px',
                    cursor: 'pointer',
                    border: selectedDay === dateStr ? '3px solid #1a2e4a' : 'none',
                    backgroundColor: selectedDay === dateStr ? '#e0f2fe' : 'white'
                  }}
                  onClick={() => setSelectedDay(dateStr)}
                >
                  <div className="day-header" style={{ fontSize: '0.7rem', fontWeight: '700', marginBottom: '0.08rem', paddingBottom: '0.05rem', borderBottom: '1px solid #e2e8f0' }}>{day}</div>

                  {/* Morning Section */}
                  <div style={{ fontSize: '0.5rem', marginBottom: '0.1rem' }}>
                    <div style={{ fontWeight: '700', fontSize: '0.48rem', textTransform: 'uppercase', marginBottom: '0.04rem', color: '#4b5563' }}>בוקר</div>
                    {dayData.morning.prefer.map((name, i) => (
                      <div key={`m-p-${i}`} style={{ color: '#16a34a', fontWeight: '600', lineHeight: '1', marginBottom: '0.01rem' }}>{name}</div>
                    ))}
                    {dayData.morning.can.map((name, i) => (
                      <div key={`m-c-${i}`} style={{ color: '#0369a1', lineHeight: '1', marginBottom: '0.01rem' }}>{name}</div>
                    ))}
                  </div>

                  {/* Evening Section */}
                  <div style={{ fontSize: '0.5rem' }}>
                    <div style={{ fontWeight: '700', fontSize: '0.48rem', textTransform: 'uppercase', marginBottom: '0.04rem', color: '#4b5563' }}>ערב</div>
                    {dayData.evening.prefer.map((name, i) => (
                      <div key={`e-p-${i}`} style={{ color: '#16a34a', fontWeight: '600', lineHeight: '1', marginBottom: '0.01rem' }}>{name}</div>
                    ))}
                    {dayData.evening.can.map((name, i) => (
                      <div key={`e-c-${i}`} style={{ color: '#0369a1', lineHeight: '1', marginBottom: '0.01rem' }}>{name}</div>
                    ))}
                  </div>

                  {/* Night Section */}
                  <div style={{ fontSize: '0.5rem' }}>
                    <div style={{ fontWeight: '700', fontSize: '0.48rem', textTransform: 'uppercase', marginBottom: '0.04rem', color: '#4b5563' }}>תורנות</div>
                    {dayData.night.prefer.map((name, i) => (
                      <div key={`n-p-${i}`} style={{ color: '#16a34a', fontWeight: '600', lineHeight: '1', marginBottom: '0.01rem' }}>{name}</div>
                    ))}
                    {dayData.night.can.map((name, i) => (
                      <div key={`n-c-${i}`} style={{ color: '#0369a1', lineHeight: '1', marginBottom: '0.01rem' }}>{name}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Daily Report Modal */}
      {selectedDay && (() => {
        const dayData = reportData[selectedDay];
        const [y, m, d] = selectedDay.split('-').map(Number);
        const dayName = WEEK_HEADERS[new Date(y, m - 1, d).getDay()];
        
        return (
          <div className="daily-report-overlay" onClick={() => setSelectedDay(null)}>
            <div className="daily-report-modal" onClick={e => e.stopPropagation()}>
              <div className="daily-report-header">
                <h3>{dayName}, {d}.{String(m).padStart(2, '0')}.{y}</h3>
                <button className="btn-close" onClick={() => setSelectedDay(null)}>✕</button>
              </div>

              <div className="daily-report-content">
                {/* Morning */}
                <div className="daily-shift-section">
                  <h4>בוקר</h4>
                  {dayData.morning.prefer.length === 0 && dayData.morning.can.length === 0 ? (
                    <p className="empty-list">אין בקשות</p>
                  ) : (
                    <>
                      {dayData.morning.prefer.length > 0 && (
                        <div className="daily-shift-group">
                          <span className="group-label" style={{ color: '#16a34a', fontWeight: '700' }}>מעדיפים:</span>
                          <div className="names-list">
                            {dayData.morning.prefer.map((name, i) => (
                              <span key={`m-p-${i}`} className="name-badge" style={{ background: '#dcfce7', color: '#166534', borderColor: '#16a34a' }}>{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {dayData.morning.can.length > 0 && (
                        <div className="daily-shift-group">
                          <span className="group-label" style={{ color: '#0369a1', fontWeight: '700' }}>יכולים:</span>
                          <div className="names-list">
                            {dayData.morning.can.map((name, i) => (
                              <span key={`m-c-${i}`} className="name-badge" style={{ background: '#e0f2fe', color: '#0c4a6e', borderColor: '#0369a1' }}>{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Evening */}
                <div className="daily-shift-section">
                  <h4>ערב</h4>
                  {dayData.evening.prefer.length === 0 && dayData.evening.can.length === 0 ? (
                    <p className="empty-list">אין בקשות</p>
                  ) : (
                    <>
                      {dayData.evening.prefer.length > 0 && (
                        <div className="daily-shift-group">
                          <span className="group-label" style={{ color: '#16a34a', fontWeight: '700' }}>מעדיפים:</span>
                          <div className="names-list">
                            {dayData.evening.prefer.map((name, i) => (
                              <span key={`e-p-${i}`} className="name-badge" style={{ background: '#dcfce7', color: '#166534', borderColor: '#16a34a' }}>{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {dayData.evening.can.length > 0 && (
                        <div className="daily-shift-group">
                          <span className="group-label" style={{ color: '#0369a1', fontWeight: '700' }}>יכולים:</span>
                          <div className="names-list">
                            {dayData.evening.can.map((name, i) => (
                              <span key={`e-c-${i}`} className="name-badge" style={{ background: '#e0f2fe', color: '#0c4a6e', borderColor: '#0369a1' }}>{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Night */}
                <div className="daily-shift-section">
                  <h4>תורנות</h4>
                  {dayData.night.prefer.length === 0 && dayData.night.can.length === 0 ? (
                    <p className="empty-list">אין בקשות</p>
                  ) : (
                    <>
                      {dayData.night.prefer.length > 0 && (
                        <div className="daily-shift-group">
                          <span className="group-label" style={{ color: '#16a34a', fontWeight: '700' }}>מעדיפים:</span>
                          <div className="names-list">
                            {dayData.night.prefer.map((name, i) => (
                              <span key={`n-p-${i}`} className="name-badge" style={{ background: '#dcfce7', color: '#166534', borderColor: '#16a34a' }}>{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {dayData.night.can.length > 0 && (
                        <div className="daily-shift-group">
                          <span className="group-label" style={{ color: '#0369a1', fontWeight: '700' }}>יכולים:</span>
                          <div className="names-list">
                            {dayData.night.can.map((name, i) => (
                              <span key={`n-c-${i}`} className="name-badge" style={{ background: '#e0f2fe', color: '#0c4a6e', borderColor: '#0369a1' }}>{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
