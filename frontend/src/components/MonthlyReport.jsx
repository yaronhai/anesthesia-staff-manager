import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from '../styles/MonthlyReport.module.scss';
import { useDraggableModal } from '../hooks/useDraggableModal';

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const WEEK_HEADERS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const SHIFT_ICON = { morning: '☀️', evening: '🌙', night: '🌃', oncall: '📟' };
const shiftIcon = key => SHIFT_ICON[key] ?? '🔔';

function buildCalendarWeeks(year, month) {
  const weeks = [];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  let week = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    week.push({ day: prevMonthDays - i, current: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    week.push({ day, current: true });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    let next = 1;
    while (week.length < 7) week.push({ day: next++, current: false });
    weeks.push(week);
  }
  return weeks;
}

const todayStr = (() => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
})();

export default function MonthlyReport({ token, config, branchId }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [requests, setRequests] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const { modalRef: dayRef, dragHandleProps: dayDrag, modalStyle: dayStyle, dragged: dayDragged, reset: dayReset } = useDraggableModal();

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();

  const reportShifts = (config.shift_types || []).filter(st => st.show_in_assignments);
  const prefTypes = config.preference_types || [];
  const reportShiftKeys = new Set(reportShifts.map(st => st.key));

  const fetchRequests = useCallback(async () => {
    try {
      const branchQ = branchId ? `&branch_id=${branchId}` : '';
      const res = await fetch(`/api/shift-requests?month=${month + 1}&year=${year}${branchQ}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setRequests(data);
    } catch (err) {
      console.error('Failed to fetch shift requests:', err);
    }
  }, [month, year, token, branchId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

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
      <div className={styles.header}>
        <div className={styles.navRow}>
          <button onClick={prevMonth} className={styles.navBtn}>← קודם</button>
          <h2 className={styles.monthTitle}>{MONTHS[month]} {year}</h2>
          <button onClick={nextMonth} className={styles.navBtn}>הבא →</button>
          <button onClick={() => setViewDate(new Date())} className={styles.navBtn}>היום</button>
        </div>
        <button onClick={() => window.print()} className={styles.printBtn}>🖨️</button>
      </div>

      <div className="calendar-wrapper">
        <div className="calendar-row header">
          {WEEK_HEADERS.map(day => (
            <div key={day} className="calendar-header-cell">{day}</div>
          ))}
        </div>

        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="calendar-row">
            {week.map(({ day, current }, dayIdx) => {
              const uniqueKey = `week-${weekIdx}-day-${dayIdx}`;

              if (!current) {
                return (
                  <div key={uniqueKey} className={`calendar-cell ${styles.calendarCellOther}`}>
                    <div className={styles.dayHeaderOther}>{day}</div>
                  </div>
                );
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayData = reportData[dateStr];
              const isSelected = selectedDay === dateStr;

              return (
                <div
                  key={uniqueKey}
                  className={`calendar-cell ${styles.calendarCell}${isSelected ? ` ${styles.calendarCellSelected}` : ''}`}
                  onClick={() => setSelectedDay(dateStr)}
                >
                  <div className={`day-header ${styles.dayHeader}${dateStr === todayStr ? ` ${styles.dayHeaderToday}` : ''}`}>{day}</div>

                  {reportShifts.map(st => (
                    <div key={st.key} className={styles.shiftBlock}>
                      <div className={styles.shiftLabel}>{st.label_he}</div>
                      {(() => {
                        const all = [
                          ...dayData[st.key].prefer.map(n => ({ n, cls: styles.preferName })),
                          ...dayData[st.key].can.map(n => ({ n, cls: styles.canName })),
                        ];
                        const MAX = 3;
                        const hidden = all.length - MAX;
                        return (
                          <>
                            {all.slice(0, MAX).map(({ n, cls }, i) => (
                              <div key={`${st.key}-${i}`} className={cls}>{n}</div>
                            ))}
                            {hidden > 0 && (
                              <div className={styles.moreNames}>+{hidden} נוספים</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>


      {selectedDay && (() => {
        const dayData = reportData[selectedDay];
        const [y, m, d] = selectedDay.split('-').map(Number);
        const dayName = WEEK_HEADERS[new Date(y, m - 1, d).getDay()];
        const preferLabel = prefTypes.find(p => p.key === 'prefer')?.label_group_he || 'מעדיפים';
        const canLabel = prefTypes.find(p => p.key === 'can')?.label_group_he || 'יכולים';

        return (
          <>
          <div className={`daily-report-overlay${dayDragged ? ' daily-report-overlay--transparent' : ''}`} onClick={() => { setSelectedDay(null); dayReset(); }}>
            <div className="daily-report-modal" ref={dayRef} style={dayStyle} onClick={e => e.stopPropagation()}>
              <div className="daily-report-header" {...dayDrag}>
                <h3>{dayName}, {String(d).padStart(2, '0')}/{String(m).padStart(2, '0')}/{y}</h3>
                <div className={styles.modalHeaderActions}>
                  <button className={styles.printBtn} onMouseDown={e => e.stopPropagation()} onClick={() => {
                    requestAnimationFrame(() => {
                      document.body.classList.add('print-day-modal');
                      window.print();
                      document.body.classList.remove('print-day-modal');
                    });
                  }}>🖨️</button>
                  <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={() => { setSelectedDay(null); dayReset(); }}>✕</button>
                </div>
              </div>

              <div className={styles.reportViewVisible}>
                {reportShifts.map(st => {
                  const prefer = dayData[st.key].prefer;
                  const can = dayData[st.key].can;
                  if (prefer.length === 0 && can.length === 0) return null;
                  return (
                    <div key={st.key} className={`${styles.printShiftBlock} ${styles[`shiftCard_${st.key}`] || ''}`}>
                      <div className={`${styles.shiftCardHeader} ${styles[`shiftCardHeader_${st.key}`] || ''}`}>
                        {shiftIcon(st.key)} {st.label_he}
                      </div>
                      <div className={styles.shiftCardCols}>
                        {prefer.length > 0 && (
                          <div className={styles.shiftCardCol}>
                            <div className={`group-label ${styles.groupLabelPrefer}`}>{preferLabel}</div>
                            <div className={styles.compactNames}>
                              {prefer.map((name, i) => <span key={i} className={styles.nameRowPrefer}>{name}</span>)}
                            </div>
                          </div>
                        )}
                        {can.length > 0 && (
                          <div className={styles.shiftCardCol}>
                            <div className={`group-label ${styles.groupLabelCan}`}>{canLabel}</div>
                            <div className={styles.compactNames}>
                              {can.map((name, i) => <span key={i} className={styles.nameRowCan}>{name}</span>)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {createPortal(
            <div id="day-print-portal" className={styles.dayPrintPortal} dir="rtl">
              <div className={styles.printTitle}>{dayName}, {String(d).padStart(2, '0')}/{String(m).padStart(2, '0')}/{y}</div>
              {reportShifts.map(st => {
                const prefer = dayData[st.key].prefer;
                const can = dayData[st.key].can;
                if (prefer.length === 0 && can.length === 0) return null;
                return (
                  <div key={st.key} className={styles.printShiftBlock}>
                    <div className={`${styles.shiftCardHeader} ${styles[`shiftCardHeader_${st.key}`] || ''}`}>
                      {shiftIcon(st.key)} {st.label_he}
                    </div>
                    <div className={styles.shiftCardCols}>
                      {prefer.length > 0 && (
                        <div className={styles.shiftCardCol}>
                          <div className={`group-label ${styles.groupLabelPrefer}`}>{preferLabel}</div>
                          <div className={styles.compactNames}>
                            {prefer.map((name, i) => <span key={i} className={styles.nameRowPrefer}>{name}</span>)}
                          </div>
                        </div>
                      )}
                      {can.length > 0 && (
                        <div className={styles.shiftCardCol}>
                          <div className={`group-label ${styles.groupLabelCan}`}>{canLabel}</div>
                          <div className={styles.compactNames}>
                            {can.map((name, i) => <span key={i} className={styles.nameRowCan}>{name}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>,
            document.body
          )}
          </>
        );
      })()}
    </div>
  );
}
