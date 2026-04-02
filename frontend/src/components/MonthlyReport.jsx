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

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/shift-requests?month=${month + 1}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRequests(await res.json());
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
    };
  }

  // Populate with requests (exclude "cannot", only morning/evening)
  requests.forEach(req => {
    if (req.preference_type === 'cannot' || !reportData[req.date]) return;
    if (req.shift_type !== 'morning' && req.shift_type !== 'evening') return;

    const workerName = req.first_name && req.family_name
      ? `${req.first_name} ${req.family_name}`
      : req.username;

    const bucket = req.preference_type === 'prefer' ? 'prefer' : 'can';
    reportData[req.date][req.shift_type][bucket].push(workerName);
  });

  // Sort names
  Object.values(reportData).forEach(dayShifts => {
    ['morning', 'evening'].forEach(shift => {
      dayShifts[shift].can.sort();
      dayShifts[shift].prefer.sort();
    });
  });

  const weeks = buildCalendarWeeks(year, month);

  return (
    <div className="report-container">
      <div className="report-header">
        <button onClick={prevMonth} className="btn-secondary">← חודש קודם</button>
        <h2>{MONTHS[month]} {year}</h2>
        <button onClick={nextMonth} className="btn-secondary">חודש הבא →</button>
      </div>

      <div className="report-toolbar">
        <button onClick={() => window.print()} className="btn-primary">🖨️ הדפסה</button>
      </div>

      {/* Calendar Header Row */}
      <div className="calendar-wrapper">
        <div className="calendar-row header">
          {WEEK_HEADERS.map(day => (
            <div key={day} className="calendar-header-cell">{day}</div>
          ))}
        </div>

        {/* Calendar Week Rows */}
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="calendar-row">
            {week.map((day, dayIdx) => {
              const uniqueKey = `week-${weekIdx}-day-${dayIdx}`;
              if (day === null) {
                return <div key={uniqueKey} className="calendar-cell empty"></div>;
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayData = reportData[dateStr];

              return (
                <div key={uniqueKey} className="calendar-cell">
                  <div className="day-header">{day}</div>

                  {/* Morning Section */}
                  <div className="shift-box">
                    <div className="shift-name">בוקר</div>
                    {dayData.morning.prefer.length > 0 && (
                      <div className="worker-list">
                        {dayData.morning.prefer.map((name, i) => (
                          <div key={`m-p-${i}`} className="worker-name prefer">{name}</div>
                        ))}
                      </div>
                    )}
                    {dayData.morning.can.length > 0 && (
                      <div className="worker-list">
                        {dayData.morning.can.map((name, i) => (
                          <div key={`m-c-${i}`} className="worker-name can">{name}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Evening Section */}
                  <div className="shift-box">
                    <div className="shift-name">ערב</div>
                    {dayData.evening.prefer.length > 0 && (
                      <div className="worker-list">
                        {dayData.evening.prefer.map((name, i) => (
                          <div key={`e-p-${i}`} className="worker-name prefer">{name}</div>
                        ))}
                      </div>
                    )}
                    {dayData.evening.can.length > 0 && (
                      <div className="worker-list">
                        {dayData.evening.can.map((name, i) => (
                          <div key={`e-c-${i}`} className="worker-name can">{name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
