import { useState, useEffect } from 'react';
import styles from '../styles/TrainingGapsPanel.module.scss';

const SEVERITY_LABEL = {
  critical: 'קריטי',
  warning:  'אזהרה',
  ok:       'תקין',
};

function SeverityBadge({ severity }) {
  return (
    <span className={`${styles.badge} ${styles[`badge_${severity}`]}`}>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export default function TrainingGapsPanel({ authToken, branchId, isSuperAdmin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!branchId && !isSuperAdmin) return;
    fetchGaps();
  }, [branchId]);

  async function fetchGaps() {
    setLoading(true);
    setError(null);
    try {
      const qs = isSuperAdmin && branchId ? `?branch_id=${branchId}` : '';
      const res = await fetch(`/api/staffing/training-gaps${qs}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'שגיאה');
      }
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className={styles.loading}>טוען נתונים...</div>;
  if (error)   return <div className={styles.errorMsg}>{error}</div>;
  if (!data)   return null;

  const { activityGaps, siteGaps, workersWithoutAuth } = data;

  const criticalActs = activityGaps.filter(a => a.severity === 'critical');
  const warningActs  = activityGaps.filter(a => a.severity === 'warning');
  const okActs       = activityGaps.filter(a => a.severity === 'ok');

  return (
    <div className={styles.panel}>

      {/* ── Section 1: Activity coverage ─────────────────────────────── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>פעילויות עם כיסוי נמוך</h3>
        {activityGaps.length === 0 ? (
          <p className={styles.empty}>כל סוגי הפעילות מכוסים היטב.</p>
        ) : (
          [{ items: criticalActs, label: 'קריטי' }, { items: warningActs, label: 'אזהרה' }, { items: okActs, label: 'תקין' }]
            .filter(g => g.items.length > 0)
            .map(({ items, label }) => (
              <div key={label} className={styles.severityGroup}>
                <div className={styles.severityGroupHeader}>{label}</div>
                <div className={styles.cardGrid}>
                  {items.map(act => (
                    <div
                      key={act.activity_type_id}
                      className={`${styles.actCard} ${styles[`actCard_${act.severity}`]}`}
                    >
                      <div className={styles.actCardName}>{act.activity_type_name}</div>
                      {act.group_name && (
                        <div className={styles.actCardGroup}>{act.group_name}</div>
                      )}
                      <div className={styles.actCardCount}>
                        <span className={styles.actCardCountNum}>{act.authorized_count}</span>
                        <span className={styles.actCardCountLabel}> מורשים</span>
                      </div>
                      <SeverityBadge severity={act.severity} />
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </section>

      {/* ── Section 2: Site gaps ──────────────────────────────────────── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>אתרים עם חוסר מורשים</h3>
        {siteGaps.length === 0 ? (
          <p className={styles.empty}>אין פערי כיסוי באתרים.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>אתר</th>
                  <th className={styles.th}>סוג פעילות</th>
                  <th className={styles.th}>מורשים כשירים</th>
                  <th className={styles.th}>חומרה</th>
                </tr>
              </thead>
              <tbody>
                {siteGaps.map((row, i) => (
                  <tr
                    key={`${row.site_id}-${row.activity_type_id}`}
                    className={`${styles.tr} ${styles[`tr_${row.severity}`]} ${i % 2 === 0 ? styles.trEven : ''}`}
                  >
                    <td className={styles.td}>{row.site_name}</td>
                    <td className={styles.td}>{row.activity_type_name}</td>
                    <td className={`${styles.td} ${styles.tdCenter}`}>{row.eligible_count}</td>
                    <td className={`${styles.td} ${styles.tdCenter}`}>
                      <SeverityBadge severity={row.severity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Section 3: Workers without authorizations ─────────────────── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          עובדים ללא הרשאות פעילות
          {workersWithoutAuth.length > 0 && (
            <span className={styles.countChip}>{workersWithoutAuth.length}</span>
          )}
        </h3>
        {workersWithoutAuth.length === 0 ? (
          <p className={styles.empty}>לכל העובדים הפעילים יש לפחות הרשאת פעילות אחת.</p>
        ) : (
          <ul className={styles.workerList}>
            {workersWithoutAuth.map(w => (
              <li key={w.id} className={styles.workerItem}>
                <span className={styles.workerName}>{w.family_name} {w.first_name}</span>
                {w.job_name && <span className={styles.workerJob}>{w.job_name}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
