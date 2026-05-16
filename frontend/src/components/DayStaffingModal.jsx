import { useState, useEffect, useMemo } from 'react';
import { useDraggableModal } from '../hooks/useDraggableModal';
import styles from '../styles/DayStaffingModal.module.scss';

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const SHIFT_ICONS = { morning: '☀️', evening: '🌙', oncall: '📞', night: '⭐' };

export default function DayStaffingModal({
  day, year, month,
  token, branchId,
  workers, requestMap, vacations,
  shifts, prefs,
  onClose,
}) {
  const [staffingData, setStaffingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeShift, setActiveShift] = useState(shifts[0]?.key || 'morning');
  const [expanded, setExpanded] = useState({});

  const { modalRef, dragHandleProps, modalStyle, dragged, reset } = useDraggableModal();

  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dow = new Date(year, month, day).getDay();
  const dateDisplay = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/staffing/month-view?year=${year}&month=${month + 1}${branchId ? '&branchId=' + branchId : ''}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (!cancelled) setStaffingData(data);
      } catch {
        if (!cancelled) setStaffingData({ siteAssignments: [], siteShiftActivities: [], workerAuthorizations: {} });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [year, month, branchId, token]);

  // Pre-filter staffing data for this specific day
  const dayAssignments = useMemo(() =>
    (staffingData?.siteAssignments || []).filter(a => a.date === dateStr),
    [staffingData, dateStr]
  );
  const dayActivities = useMemo(() =>
    (staffingData?.siteShiftActivities || []).filter(a => a.date === dateStr),
    [staffingData, dateStr]
  );
  const workerAuthorizations = staffingData?.workerAuthorizations || {};

  function workerDisplayName(w) {
    return `${w.family_name} ${w.first_name}`;
  }

  function isVacationDay(w) {
    const uid = w.user_id ?? w.userId;
    return vacations.some(v =>
      Number(v.user_id) === Number(uid) &&
      (v.status === 'approved' || v.status === 'partial') &&
      v.approved_start && v.approved_end &&
      v.approved_start <= dateStr && v.approved_end >= dateStr
    );
  }

  // Build per-shift data
  function getShiftData(shiftKey) {
    // Requests for this shift/day
    const requestRows = workers
      .filter(w => requestMap[w.user_id]?.[day]?.[shiftKey])
      .map(w => ({
        name: workerDisplayName(w),
        pref: requestMap[w.user_id][day][shiftKey].pref,
        adminModified: requestMap[w.user_id][day][shiftKey].adminModified &&
                       requestMap[w.user_id][day][shiftKey].workerOriginalPref,
      }))
      .sort((a, b) => {
        const order = { prefer: 0, can: 1, cannot: 2 };
        return (order[a.pref] ?? 9) - (order[b.pref] ?? 9);
      });

    // Site assignments for this shift
    const shiftAssignments = dayAssignments.filter(a => a.shift_type === shiftKey);

    // Group by site
    const siteMap = {};
    shiftAssignments.forEach(a => {
      if (!siteMap[a.site_id]) {
        const act = dayActivities.find(act => act.site_id === a.site_id && act.shift_type === shiftKey);
        siteMap[a.site_id] = {
          siteId: a.site_id,
          siteName: a.site_name,
          activityName: act?.activity_name || null,
          activityTypeId: act?.activity_type_id || null,
          workers: [],
        };
      }
      const worker = workers.find(w => w.id === a.worker_id);
      if (worker) {
        const actTypeId = siteMap[a.site_id].activityTypeId;
        let isAuthorized = null;
        if (actTypeId) {
          isAuthorized = (workerAuthorizations[a.worker_id] || []).includes(actTypeId);
        }
        siteMap[a.site_id].workers.push({
          name: workerDisplayName(worker),
          isAuthorized,
        });
      }
    });
    const siteGroups = Object.values(siteMap);

    // Vacations
    const vacWorkers = workers
      .filter(isVacationDay)
      .map(workerDisplayName);

    // Fit counts
    const available = requestRows.filter(r => r.pref === 'can' || r.pref === 'prefer').length;
    const assigned = shiftAssignments.length;

    return { requestRows, siteGroups, vacWorkers, available, assigned };
  }

  // Tab badges: count of can+prefer for each shift
  function shiftBadgeCount(shiftKey) {
    return workers.filter(w => {
      const req = requestMap[w.user_id]?.[day]?.[shiftKey];
      return req && (req.pref === 'can' || req.pref === 'prefer');
    }).length;
  }

  // Reset expanded sections when shift tab changes
  useEffect(() => { setExpanded({}); }, [activeShift]);

  function toggle(key) { setExpanded(e => ({ ...e, [key]: !e[key] })); }

  function handleClose() { onClose(); reset(); }

  // ── Chart ──────────────────────────────────────────────────────────────────

  function renderChart() {
    const chartData = shifts.map(s => {
      const avail = workers.filter(w => {
        const req = requestMap[w.user_id]?.[day]?.[s.key];
        return req && (req.pref === 'can' || req.pref === 'prefer');
      }).length;
      const assigned = dayAssignments.filter(a => a.shift_type === s.key).length;
      return { key: s.key, label: s.label_he, avail, assigned };
    });

    const maxVal = Math.max(1, ...chartData.map(d => Math.max(d.avail, d.assigned, 1)));

    return (
      <div className={styles.chart}>
        <div className={styles.chartLegend}>
          <span className={styles.legendAvail}>■ יכול / מועדף</span>
          <span className={styles.legendAssign}>■ שובצו לאתרים</span>
        </div>
        {chartData.map(d => {
          const availPct  = Math.round((d.avail    / maxVal) * 100);
          const assignPct = Math.round((d.assigned / maxVal) * 100);
          const isActive  = activeShift === d.key;
          return (
            <div
              key={d.key}
              className={`${styles.chartRow}${isActive ? ' ' + styles.chartRowActive : ''}`}
              onClick={() => setActiveShift(d.key)}
            >
              <div className={styles.chartLabel}>
                <span>{SHIFT_ICONS[d.key]}</span>
                <span>{d.label}</span>
              </div>
              <div className={styles.chartBars}>
                <div className={styles.barRow}>
                  <div className={styles.barTrack}>
                    <div className={styles.barAvail} style={{ '--bar-pct': availPct + '%' }} />
                  </div>
                  <span className={styles.barCount}>{d.avail}</span>
                </div>
                <div className={styles.barRow}>
                  <div className={styles.barTrack}>
                    <div className={styles.barAssign} style={{ '--bar-pct': assignPct + '%' }} />
                  </div>
                  <span className={styles.barCount}>{d.assigned}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render sections ────────────────────────────────────────────────────────

  function renderSummaryStrip(shiftKey) {
    const { requestRows, assigned, available, vacWorkers } = getShiftData(shiftKey);
    const preferCount = requestRows.filter(r => r.pref === 'prefer').length;
    const canCount = requestRows.filter(r => r.pref === 'can').length;
    const cannotCount = requestRows.filter(r => r.pref === 'cannot').length;
    const totalReq = requestRows.length;

    let fitClass = styles.fitNeutral;
    let fitLabel = '— אין שיבוצים';
    if (assigned > 0) {
      if (available >= assigned) {
        fitClass = styles.fitOk;
        fitLabel = '✓ כיסוי מספק';
      } else {
        fitClass = styles.fitWarn;
        fitLabel = `⚠️ חסרים ${assigned - available} עובדים`;
      }
    }

    return (
      <div className={styles.summaryStrip}>
        {totalReq > 0 && (
          <span className={styles.summaryChip}>
            <span className={styles.summaryChipIcon}>📋</span>
            בקשות: {totalReq}
            {preferCount > 0 && ` (${preferCount} מועדף`}
            {canCount > 0 && `, ${canCount} יכול`}
            {cannotCount > 0 && `, ${cannotCount} לא יכול`}
            {totalReq > 0 && ')'}
          </span>
        )}
        {assigned > 0 && (
          <span className={styles.summaryChip}>
            <span className={styles.summaryChipIcon}>🏥</span>
            שובצו: {assigned}
          </span>
        )}
        {vacWorkers.length > 0 && (
          <span className={styles.summaryChip}>
            <span className={styles.summaryChipIcon}>🌴</span>
            חופשות: {vacWorkers.length}
          </span>
        )}
        <span className={`${styles.summaryChip} ${fitClass}`}>{fitLabel}</span>
      </div>
    );
  }

  function renderRequests(shiftKey) {
    const { requestRows } = getShiftData(shiftKey);
    const prefLabel = key => prefs.find(p => p.key === key)?.label_he || key;
    const open = expanded['requests'];
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          📋 בקשות
          <span className={styles.sectionCount}>{requestRows.length}</span>
          <button className={styles.toggleBtn} onClick={() => toggle('requests')}>
            {open ? 'סגירה ▲' : 'פתיחה ▼'}
          </button>
        </div>
        {open && (requestRows.length === 0 ? (
          <div className={styles.emptyNote}>אין בקשות לסוג משמרת זה</div>
        ) : (
          <div className={styles.requestList}>
            {requestRows.map((r, i) => (
              <div key={i} className={styles.requestRow}>
                <span className={styles.workerName}>{r.name}</span>
                <span className={`${styles.prefBadge} ${styles['pref_' + r.pref] || ''}`}>
                  {prefLabel(r.pref)}
                </span>
                {r.adminModified && <span className={styles.adminModIcon} title="שונה ע״י מנהל">✏️</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  function renderSites(shiftKey) {
    const { siteGroups } = getShiftData(shiftKey);
    const open = expanded['sites'];
    const workerCount = siteGroups.reduce((sum, s) => sum + s.workers.length, 0);
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          🏥 שיבוצי אתרים
          <span className={styles.sectionCount}>{siteGroups.length} אתרים, {workerCount} עובדים</span>
          <button className={styles.toggleBtn} onClick={() => toggle('sites')}>
            {open ? 'סגירה ▲' : 'פתיחה ▼'}
          </button>
        </div>
        {open && (siteGroups.length === 0 ? (
          <div className={styles.emptyNote}>אין שיבוצים לסוג משמרת זה</div>
        ) : (
          <div className={styles.siteList}>
            {siteGroups.map(site => (
              <div key={site.siteId} className={styles.siteCard}>
                <div className={styles.siteCardHeader}>
                  <span className={styles.siteName}>🏢 {site.siteName}</span>
                  {site.activityName
                    ? <span className={styles.activityBadge}>{site.activityName}</span>
                    : <span className={styles.noActivityBadge}>ללא פעילות מוגדרת</span>}
                </div>
                <div className={styles.siteWorkers}>
                  {site.workers.length === 0 ? (
                    <div className={styles.noWorkersNote}>לא שובצו עובדים</div>
                  ) : site.workers.map((sw, i) => (
                    <div key={i} className={styles.siteWorkerRow}>
                      {sw.isAuthorized === true && (
                        <span className={`${styles.authIcon} ${styles.authOk}`} title="מורשה לפעילות">✓</span>
                      )}
                      {sw.isAuthorized === false && (
                        <span className={`${styles.authIcon} ${styles.authNo}`} title="לא מורשה לפעילות">✗</span>
                      )}
                      {sw.isAuthorized === null && (
                        <span className={`${styles.authIcon} ${styles.authNone}`} title="לא הוגדרה פעילות">—</span>
                      )}
                      <span className={styles.workerName}>{sw.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  function renderVacations() {
    const vacWorkers = workers.filter(isVacationDay).map(workerDisplayName);
    if (vacWorkers.length === 0) return null;
    const open = expanded['vacations'];
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          🌴 חופשות מאושרות
          <span className={styles.sectionCount}>{vacWorkers.length}</span>
          <button className={styles.toggleBtn} onClick={() => toggle('vacations')}>
            {open ? 'סגירה ▲' : 'פתיחה ▼'}
          </button>
        </div>
        {open && (
          <div className={styles.vacList}>
            {vacWorkers.map((name, i) => (
              <span key={i} className={styles.vacChip}>{name}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
            <span className={styles.headerDate}>סיכום יום — {dateDisplay}</span>
            <span className={styles.headerDow}>{DAYS_HE[dow]}</span>
            <span className={styles.headerDow}>{MONTHS[month]} {year}</span>
          </div>
          <button className="btn-close" onMouseDown={e => e.stopPropagation()} onClick={handleClose}>
            ✕
          </button>
        </div>

        {/* Chart — shown after load */}
        {!loading && renderChart()}

        {/* Shift tabs */}
        <div className={styles.tabs}>
          {shifts.map(s => {
            const count = shiftBadgeCount(s.key);
            const isActive = activeShift === s.key;
            return (
              <button
                key={s.key}
                className={`${styles.tab}${isActive ? ' ' + styles.tabActive : ''}`}
                onClick={() => setActiveShift(s.key)}
              >
                <span className={styles.tabIcon}>{SHIFT_ICONS[s.key]}</span>
                {s.label_he}
                <span className={`${styles.tabBadge}${isActive ? ' ' + styles.tabBadgeActive : ''}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className={styles.body}>
          {loading ? (
            <div className={styles.loading}>טוען נתוני שיבוצים...</div>
          ) : (
            <>
              {renderSummaryStrip(activeShift)}
              {renderRequests(activeShift)}
              {renderSites(activeShift)}
              {renderVacations()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
