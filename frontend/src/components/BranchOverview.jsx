import { useState, useEffect } from 'react';
import styles from '../styles/BranchOverview.module.scss';

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
            <div className={styles.cardName}>{b.name}</div>
            {b.description && <div className={styles.cardDesc}>{b.description}</div>}
            <div className={styles.cardStats}>
              <span className={styles.cardCount}>{b.worker_count}</span> עובדים
              {' · '}
              <span className={styles.cardActiveCount}>{b.active_worker_count}</span> פעילים
            </div>
            <button onClick={() => onSelectBranch(b.id)} className={styles.cardBtn}>
              נהל סניף
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
