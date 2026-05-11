import { useState, useEffect } from 'react';
import styles from '../styles/BranchOverview.module.scss';

const R = 13;
const CIRC = 2 * Math.PI * R;

function MiniDonut({ total, active }) {
  const ratio = total > 0 ? active / total : 0;
  const dash = CIRC * ratio;
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" className={styles.donut} aria-hidden="true">
      <circle cx="17" cy="17" r={R} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle cx="17" cy="17" r={R} fill="none" stroke="#059669" strokeWidth="5"
        strokeDasharray={`${dash} ${CIRC}`}
        strokeDashoffset={CIRC * 0.25}
        strokeLinecap="round" />
      <text x="17" y="21" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#374151">
        {total > 0 ? Math.round(ratio * 100) : 0}%
      </text>
    </svg>
  );
}

export default function BranchOverview({ authToken, onSelectBranch }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/branches/overview', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setBranches(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [authToken]);

  if (loading) return <div className={styles.loading}>טוען...</div>;

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>סניפים</h2>
      {branches.length === 0 && (
        <p className={styles.empty}>אין סניפים. פתח את ההגדרות כדי להוסיף סניף.</p>
      )}
      <div className={styles.grid}>
        {branches.map(b => (
          <div key={b.id} className={styles.card}>
            <div className={styles.cardMain}>
              <div className={styles.cardName}>{b.name}</div>
              <div className={styles.cardStats}>
                <span className={styles.cardCount}>{b.worker_count}</span> עובדים
                {' · '}
                <span className={styles.cardActiveCount}>{b.active_worker_count}</span> פעילים
              </div>
            </div>
            <button onClick={() => onSelectBranch(b.id)} className={styles.cardBtn}>
              נהל סניף
            </button>
            <MiniDonut total={b.worker_count} active={b.active_worker_count} />
          </div>
        ))}
      </div>
    </div>
  );
}
