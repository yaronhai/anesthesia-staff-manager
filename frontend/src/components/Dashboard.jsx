import { useState, useEffect } from 'react';
import PieChart3D from './PieChart3D';
import styles from '../styles/Dashboard.module.scss';


function StatCard({ label, value, sub, color }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statCardLabel}>{label}</div>
      <div className={styles.statCardValue} style={{ '--card-color': color || '#1a2e4a' }}>{value}</div>
      {sub && <div className={styles.statCardSub}>{sub}</div>}
    </div>
  );
}


export default function Dashboard({ authToken, onSelectBranch }) {
  const [branches, setBranches] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${authToken}` };
    Promise.all([
      fetch('/api/branches/overview', { headers }).then(r => r.ok ? r.json() : []),
      fetch('/api/dashboard-stats', { headers }).then(r => r.ok ? r.json() : null),
    ]).then(([branchData, statsData]) => {
      setBranches(Array.isArray(branchData) ? branchData : []);
      setStats(statsData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [authToken]);

  if (loading) return <div className={styles.loadingMsg}>טוען...</div>;

  return (
    <div className={styles.root}>

      {/* KPI + Employment Type */}
      <div className={styles.kpiRow}>
        <div className={styles.statGrid}>
          <StatCard label="עובדים פעילים" value={stats?.active_workers ?? '—'} sub={`מתוך ${stats?.total_workers ?? '—'} סה״כ`} color="#059669" />
          <StatCard label="עובדים לא פעילים" value={stats?.inactive_workers ?? '—'} color="#6b7280" />
        </div>
        {stats?.by_type?.length > 0 && <PieChart3D items={stats.by_type.map(t => ({ name: t.name, value: t.active_count }))} />}
      </div>

      {/* Branches */}
      <section>
        <h3 className={styles.sectionTitle}>סניפים</h3>
        {branches.length === 0 ? (
          <p className={styles.branchesEmpty}>אין סניפים.</p>
        ) : (
          <div className={styles.branchesGrid}>
            {branches.map(b => (
              <div key={b.id} className={styles.branchCard}>
                <div className={styles.branchName}>{b.name}</div>
                {b.description && <div className={styles.branchDesc}>{b.description}</div>}
                <div className={styles.branchStats}>
                  <span><strong>{b.worker_count}</strong> עובדים</span>
                  <span className={styles.branchActiveCount}><strong>{b.active_worker_count}</strong> פעילים</span>
                </div>
                {b.emp_type_breakdown?.length > 0 && (
                  <div className={styles.branchPieWrap}>
                    <PieChart3D items={b.emp_type_breakdown.map(t => ({ name: t.name, value: t.count }))} small />
                  </div>
                )}
                <button className={styles.branchBtn} onClick={() => onSelectBranch(b.id)}>
                  נהל סניף ←
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
