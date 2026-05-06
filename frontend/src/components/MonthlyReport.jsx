import { useState, useEffect, useCallback } from 'react';
import styles from '../styles/MonthlyReport.module.scss';

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

export default function MonthlyReport({ token, config, isAdmin, branchId }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [requests, setRequests] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [fulfillmentStats, setFulfillmentStats] = useState([]);

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();

  const reportShifts = (config.shift_types || []).filter(st => st.show_in_assignments);
  const prefTypes = config.preference_types || [];
  const reportShiftKeys = new Set(reportShifts.map(st => st.key));

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

  const fetchFulfillment = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const branchQ = branchId ? `&branch_id=${branchId}` : '';
      const res = await fetch(`/api/fulfillment-stats?month=${month + 1}&year=${year}${branchQ}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setFulfillmentStats(await res.json());
    } catch (err) {
      console.error('Failed to fetch fulfillment stats:', err);
    }
  }, [month, year, token, isAdmin, branchId]);

  useEffect(() => {
    fetchRequests();
    fetchFulfillment();
  }, [fetchRequests, fetchFulfillment]);

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  const reportData = {};
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    reportData[dateStr] = {};
    reportShifts.forEach(st => {
      reportData[dateStr][st.key] = { prefer: [], can: [] };
    });
  }

  requests.forEach(req => {
    if (req.preference_type === 'cannot' || !reportData[req.date]) return;
    if (!reportShiftKeys.has(req.shift_type)) return;

    const workerName = req.first_name && req.family_name
      ? `${req.first_name} ${req.family_name}`
      : req.username;

    const bucket = req.preference_type === 'prefer' ? 'prefer' : 'can';
    reportData[req.date][req.shift_type][bucket].push(workerName);
  });

  Object.values(reportData).forEach(dayShifts => {
    reportShifts.forEach(st => {
      dayShifts[st.key].can.sort();
      dayShifts[st.key].prefer.sort();
    });
  });

  const weeks = buildCalendarWeeks(year, month);

  return (
    <div className="report-container">
      <div className={`report-header ${styles.header}`}>
        <div className={styles.navRow}>
          <button onClick={prevMonth} className="btn-secondary btn-sm">← קודם</button>
          <h2 className={styles.monthTitle}>{MONTHS[month]} {year}</h2>
          <button onClick={nextMonth} className="btn-secondary btn-sm">הבא →</button>
        </div>

        <div className={styles.controls}>
          <button onClick={() => window.print()} className="btn-primary btn-sm">🖨️ הדפסה</button>
          <div className={styles.legend}>
            {prefTypes.filter(p => p.key !== 'cannot').map(p => (
              <div key={p.key} className={styles.legendItem}>
                <div
                  className={styles.legendSwatch}
                  style={{ '--swatch-bg': p.key === 'prefer' ? '#16a34a' : '#0369a1' }}
                />
                <span>{p.label_he}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`calendar-wrapper ${styles.calendarWrapper}`}>
        <div className={`calendar-row header ${styles.calendarHeaderRow}`}>
          {WEEK_HEADERS.map(day => (
            <div key={day} className="calendar-header-cell">{day}</div>
          ))}
        </div>

        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className={`calendar-row ${styles.calendarWeekRow}`}>
            {week.map((day, dayIdx) => {
              const uniqueKey = `week-${weekIdx}-day-${dayIdx}`;
              if (day === null) {
                return <div key={uniqueKey} className="calendar-cell empty"></div>;
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayData = reportData[dateStr];
              const isSelected = selectedDay === dateStr;

              return (
                <div
                  key={uniqueKey}
                  className={`calendar-cell ${styles.calendarCell}`}
                  style={{
                    '--cell-border': isSelected ? '3px solid #1a2e4a' : 'none',
                    '--cell-bg': isSelected ? '#e0f2fe' : 'white',
                  }}
                  onClick={() => setSelectedDay(dateStr)}
                >
                  <div className={`day-header ${styles.dayHeader}`}>{day}</div>

                  {reportShifts.map(st => (
                    <div key={st.key} className={styles.shiftBlock}>
                      <div className={styles.shiftLabel}>{st.label_he}</div>
                      {dayData[st.key].prefer.map((name, i) => (
                        <div key={`${st.key}-p-${i}`} className={styles.preferName}>{name}</div>
                      ))}
                      {dayData[st.key].can.map((name, i) => (
                        <div key={`${st.key}-c-${i}`} className={styles.canName}>{name}</div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {isAdmin && fulfillmentStats.length > 0 && (() => {
        const totals = fulfillmentStats.reduce(
          (acc, w) => {
            acc.total += +w.total_assignments;
            acc.prefer += +w.pref_prefer;
            acc.can += +w.pref_can;
            acc.cannot += +w.pref_cannot;
            acc.none += +w.pref_none;
            return acc;
          },
          { total: 0, prefer: 0, can: 0, cannot: 0, none: 0 }
        );
        const pct = (w) => w.total_assignments > 0
          ? Math.round((+w.pref_prefer + +w.pref_can) / +w.total_assignments * 100)
          : 0;
        const totalPct = totals.total > 0
          ? Math.round((totals.prefer + totals.can) / totals.total * 100)
          : 0;
        const rowClass = (p) => p >= 80 ? styles.rowGreen : p >= 50 ? styles.rowYellow : styles.rowRed;

        return (
          <div className={styles.fulfillmentSection}>
            <h3 className={styles.fulfillmentTitle}>מדד התחשבות בבקשות</h3>
            <p className={styles.fulfillmentHint}>
              לכל עובד ששובץ בחודש זה — כמה שיבוצים תאמו את בקשתו
            </p>
            <table className={styles.fulfillmentTable}>
              <thead>
                <tr>
                  <th>עובד</th>
                  <th>שיבוצים</th>
                  <th>מעדיף ✓</th>
                  <th>יכול ✓</th>
                  <th>לא יכול ✗</th>
                  <th>ללא בקשה</th>
                  <th>% התחשבות</th>
                </tr>
              </thead>
              <tbody>
                {fulfillmentStats.map(w => {
                  const p = pct(w);
                  return (
                    <tr key={w.worker_id} className={rowClass(p)}>
                      <td>{w.first_name} {w.family_name}</td>
                      <td>{w.total_assignments}</td>
                      <td>{w.pref_prefer}</td>
                      <td>{w.pref_can}</td>
                      <td>{w.pref_cannot}</td>
                      <td>{w.pref_none}</td>
                      <td><strong>{p}%</strong></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className={styles.summaryRow}>
                  <td>סה"כ</td>
                  <td>{totals.total}</td>
                  <td>{totals.prefer}</td>
                  <td>{totals.can}</td>
                  <td>{totals.cannot}</td>
                  <td>{totals.none}</td>
                  <td><strong>{totalPct}%</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}

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
                {reportShifts.map(st => (
                  <div key={st.key} className="daily-shift-section">
                    <h4>{st.label_he}</h4>
                    {dayData[st.key].prefer.length === 0 && dayData[st.key].can.length === 0 ? (
                      <p className="empty-list">אין בקשות</p>
                    ) : (
                      <>
                        {dayData[st.key].prefer.length > 0 && (
                          <div className="daily-shift-group">
                            <span className={`group-label ${styles.groupLabelPrefer}`}>{prefTypes.find(p => p.key === 'prefer')?.label_group_he || 'מעדיפים'}:</span>
                            <div className="names-list">
                              {dayData[st.key].prefer.map((name, i) => (
                                <span key={`${st.key}-p-${i}`} className={`name-badge ${styles.badgePrefer}`}>{name}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {dayData[st.key].can.length > 0 && (
                          <div className="daily-shift-group">
                            <span className={`group-label ${styles.groupLabelCan}`}>{prefTypes.find(p => p.key === 'can')?.label_group_he || 'יכולים'}:</span>
                            <div className="names-list">
                              {dayData[st.key].can.map((name, i) => (
                                <span key={`${st.key}-c-${i}`} className={`name-badge ${styles.badgeCan}`}>{name}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
