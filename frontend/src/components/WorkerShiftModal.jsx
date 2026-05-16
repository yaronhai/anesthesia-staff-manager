import { useState, useEffect } from 'react';
import { useDraggableModal } from '../hooks/useDraggableModal';
import styles from '../styles/WorkerShiftModal.module.scss';

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DAYS_SHORT = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
const SHIFT_ICONS = { morning: '☀️', evening: '🌙', oncall: '📞', night: '⭐' };

function buildWeeks(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const out = [];
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
  return out;
}

export default function WorkerShiftModal({
  worker, token, branchId, shifts, prefs, vacations,
  initialYear, initialMonth, refreshKey, onClose, onEditDay,
}) {
  const [view, setView] = useState('month');
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const { modalRef, dragHandleProps, modalStyle, dragged, reset } = useDraggableModal();

  // Fetch this worker's requests whenever month/year or refreshKey changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/shift-requests?branchId=${branchId}&year=${year}&month=${month + 1}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (!cancelled) {
          setRequests(
            Array.isArray(data)
              ? data.filter(r => Number(r.user_id) === Number(worker.userId))
              : []
          );
        }
      } catch {
        if (!cancelled) setRequests([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [year, month, worker.userId, branchId, token, refreshKey]);

  // day → shiftType → { pref, adminModified, workerOriginalPref }
  const reqMap = {};
  requests.forEach(r => {
    const d = parseInt(r.date.split('-')[2]);
    if (!reqMap[d]) reqMap[d] = {};
    reqMap[d][r.shift_type] = {
      id: r.id, pref: r.preference_type,
      adminModified: r.admin_modified, workerOriginalPref: r.worker_original_pref,
    };
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = buildWeeks(year, month);

  function isVacDay(day) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return vacations.some(v =>
      Number(v.user_id) === Number(worker.userId) &&
      (v.status === 'approved' || v.status === 'partial') &&
      v.approved_start && v.approved_end &&
      v.approved_start <= ds && v.approved_end >= ds
    );
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  function openDayView(day, weekList) {
    const wl = weekList || weeks;
    const wi = wl.findIndex(w => w.includes(day));
    if (wi >= 0) setSelectedWeekIdx(wi);
    setSelectedDay(day);
    setView('day');
  }

  function openWeekView(wi) {
    setSelectedWeekIdx(wi);
    setView('week');
  }

  function goMonth() { setView('month'); }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setView('month');
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setView('month');
  }

  function prevWeek() {
    if (selectedWeekIdx > 0) {
      setSelectedWeekIdx(i => i - 1);
    } else {
      let ny = year, nm = month - 1;
      if (nm < 0) { ny--; nm = 11; }
      const pw = buildWeeks(ny, nm);
      setYear(ny); setMonth(nm); setSelectedWeekIdx(pw.length - 1);
    }
  }

  function nextWeek() {
    if (selectedWeekIdx < weeks.length - 1) {
      setSelectedWeekIdx(i => i + 1);
    } else {
      let ny = year, nm = month + 1;
      if (nm > 11) { ny++; nm = 0; }
      setYear(ny); setMonth(nm); setSelectedWeekIdx(0);
    }
  }

  function prevDay() {
    if (selectedDay > 1) {
      openDayView(selectedDay - 1);
    } else {
      let ny = year, nm = month - 1;
      if (nm < 0) { ny--; nm = 11; }
      const dim = new Date(ny, nm + 1, 0).getDate();
      const nw = buildWeeks(ny, nm);
      setYear(ny); setMonth(nm);
      openDayView(dim, nw);
    }
  }

  function nextDay() {
    if (selectedDay < daysInMonth) {
      openDayView(selectedDay + 1);
    } else {
      let ny = year, nm = month + 1;
      if (nm > 11) { ny++; nm = 0; }
      const nw = buildWeeks(ny, nm);
      setYear(ny); setMonth(nm);
      openDayView(1, nw);
    }
  }

  function handleClose() { onClose(); reset(); }

  // ── Month view ───────────────────────────────────────────────────────────────

  function renderMonth() {
    return (
      <div className={styles.monthView}>
        <table className={styles.calTable}>
          <thead>
            <tr>
              {DAYS_SHORT.map((d, i) => (
                <th key={i} className={i === 6 ? styles.satHeader : i === 5 ? styles.friHeader : ''}>
                  {d}
                </th>
              ))}
              <th className={styles.weekCol}></th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((day, di) => {
                  const isSat = di === 6;
                  const isFri = di === 5;
                  const vac = day && isVacDay(day);
                  const hasReq = day && shifts.some(s => reqMap[day]?.[s.key]);
                  return (
                    <td
                      key={di}
                      className={[
                        styles.calCell,
                        !day ? styles.emptyCell : '',
                        isSat ? styles.satCell : isFri ? styles.friCell : '',
                        vac ? styles.vacCell : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => day && openDayView(day)}
                    >
                      {day && (
                        <>
                          <span className={`${styles.dayNum}${hasReq ? ' ' + styles.dayNumActive : ''}`}>
                            {day}
                          </span>
                          {vac && <span className={styles.vacBadge}>חופש</span>}
                          <div className={styles.dayPills}>
                            {shifts.map(s => {
                              const req = reqMap[day]?.[s.key];
                              return req ? (
                                <span
                                  key={s.key}
                                  className={`cell-pill pref-${req.pref}${req.adminModified && req.workerOriginalPref ? ' ' + styles.adminPill : ''}`}
                                >
                                  {s.label_short}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </>
                      )}
                    </td>
                  );
                })}
                <td className={styles.weekLinkCell}>
                  <button className={styles.weekBtn} onClick={() => openWeekView(wi)}>
                    ש׳{wi + 1}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Week view ─────────────────────────────────────────────────────────────────

  function renderWeek() {
    const week = weeks[Math.min(selectedWeekIdx, weeks.length - 1)] || [];
    return (
      <div className={styles.weekView}>
        <div className={styles.weekDays}>
          {week.map((day, di) => {
            const isSat = di === 6;
            const isFri = di === 5;
            const vac = day && isVacDay(day);
            const dayData = day ? (reqMap[day] || {}) : {};
            const hasReq = day && shifts.some(s => dayData[s.key]);
            return (
              <div
                key={di}
                className={[
                  styles.weekDay,
                  !day ? styles.weekDayEmpty : '',
                  isSat ? styles.satBg : isFri ? styles.friBg : '',
                  vac ? styles.vacBg : '',
                ].filter(Boolean).join(' ')}
                onClick={() => day && openDayView(day)}
              >
                <div className={styles.weekDayHeader}>
                  <span className={styles.weekDayName}>{DAYS_SHORT[di]}</span>
                  {day && <span className={styles.weekDayNum}>{day}</span>}
                  {vac && <span className={styles.vacBadge}>חופש</span>}
                </div>
                {day && shifts.map(s => {
                  const req = dayData[s.key];
                  if (!req) return null;
                  const pref = prefs.find(p => p.key === req.pref);
                  return (
                    <div key={s.key} className={`${styles.weekShiftRow} ${styles['shift_' + s.key] || ''}`}>
                      <span className={styles.shiftIcon}>{SHIFT_ICONS[s.key]}</span>
                      <span className={styles.shiftName}>{s.label_he}</span>
                      <span className={`${styles.prefBadge} ${styles['pref_' + req.pref] || ''}`}>
                        {pref?.label_he || req.pref}
                      </span>
                      {req.adminModified && req.workerOriginalPref && (
                        <span className={styles.adminDot} title="שונה ע״י מנהל">✏️</span>
                      )}
                    </div>
                  );
                })}
                {day && !hasReq && <div className={styles.noRequests}>ללא בקשות</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Day view ──────────────────────────────────────────────────────────────────

  function renderDay() {
    const dayData = selectedDay ? (reqMap[selectedDay] || {}) : {};
    const vac = selectedDay && isVacDay(selectedDay);
    const canEdit = year === initialYear && month === initialMonth;
    const dateDisplay = selectedDay
      ? `${String(selectedDay).padStart(2,'0')}/${String(month + 1).padStart(2,'0')}/${year}`
      : '';
    return (
      <div className={styles.dayView}>
        <div className={styles.dayViewHeader}>
          <span className={styles.dayViewDate}>{dateDisplay}</span>
          {vac && <span className={styles.vacBadgeLg}>חופש מאושר</span>}
        </div>
        <div className={styles.dayShifts}>
          {shifts.map(s => {
            const req = dayData[s.key];
            const pref = req ? prefs.find(p => p.key === req.pref) : null;
            return (
              <div key={s.key} className={`${styles.dayShiftRow} ${styles['shift_' + s.key] || ''}`}>
                <span className={styles.shiftIcon}>{SHIFT_ICONS[s.key]}</span>
                <span className={styles.shiftLabelName}>{s.label_he}</span>
                {req ? (
                  <>
                    <span className={`${styles.prefBadge} ${styles['pref_' + req.pref] || ''}`}>
                      {pref?.label_he || req.pref}
                    </span>
                    {req.adminModified && req.workerOriginalPref && (
                      <span className={styles.adminModBadge}>✏️ שונה ע״י מנהל</span>
                    )}
                  </>
                ) : (
                  <span className={styles.noReq}>ללא בקשה</span>
                )}
              </div>
            );
          })}
        </div>
        <div className={styles.dayViewActions}>
          {canEdit ? (
            <button className="btn-primary" onClick={() => onEditDay(worker.userId, selectedDay)}>
              ✏️ ערוך יום זה
            </button>
          ) : (
            <span className={styles.crossMonthNote}>עריכה זמינה רק בחודש הנוכחי בלוח הראשי</span>
          )}
        </div>
      </div>
    );
  }

  // ── Nav label + actions ───────────────────────────────────────────────────────

  const titleMonth = `${MONTHS[month]} ${year}`;
  const navLabel =
    view === 'day' && selectedDay
      ? `${String(selectedDay).padStart(2,'0')}/${String(month + 1).padStart(2,'0')}/${year}`
      : view === 'week'
        ? `שבוע ${selectedWeekIdx + 1} — ${titleMonth}`
        : titleMonth;

  const prevAction = view === 'day' ? prevDay : view === 'week' ? prevWeek : prevMonth;
  const nextAction = view === 'day' ? nextDay : view === 'week' ? nextWeek : nextMonth;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className={`admin-editor-overlay${dragged ? ' admin-editor-overlay--transparent' : ''}`}
      onClick={handleClose}
    >
      <div
        className={styles.modal}
        ref={modalRef}
        style={modalStyle}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header} {...dragHandleProps}>
          <div className={styles.headerTitle}>
            <span className={styles.workerName}>{worker.name}</span>
            <span className={styles.workerJob}>{worker.job}</span>
          </div>
          <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={handleClose}>
            ✕
          </button>
        </div>

        {/* Navigation bar */}
        <div className={styles.navBar}>
          <div className={styles.breadcrumbs}>
            <button className={styles.breadcrumb} onClick={goMonth}>חודש</button>
            {(view === 'week' || view === 'day') && (
              <>
                <span className={styles.breadSep}>›</span>
                <button className={styles.breadcrumb} onClick={() => setView('week')}>שבוע</button>
              </>
            )}
            {view === 'day' && (
              <>
                <span className={styles.breadSep}>›</span>
                <span className={styles.breadCurrent}>יום</span>
              </>
            )}
          </div>
          <div className={styles.monthNav}>
            <button className={styles.navBtn} onClick={prevAction}>◀</button>
            <span className={styles.monthLabel}>{navLabel}</span>
            <button className={styles.navBtn} onClick={nextAction}>▶</button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {loading ? (
            <div className={styles.loading}>טוען...</div>
          ) : view === 'month' ? renderMonth()
            : view === 'week' ? renderWeek()
            : renderDay()}
        </div>
      </div>
    </div>
  );
}
