import { useState, useEffect } from 'react';

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

  if (loading) return <div style={{padding: '2rem', textAlign: 'center'}}>טוען...</div>;

  return (
    <div style={{padding: '1.5rem'}}>
      <h2 style={{marginBottom: '1.5rem', fontSize: '1.2rem'}}>סניפים</h2>
      {branches.length === 0 && (
        <p style={{color: '#6b7280'}}>אין סניפים. פתח את ההגדרות כדי להוסיף סניף.</p>
      )}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem'}}>
        {branches.map(b => (
          <div key={b.id} style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}>
            <div style={{fontWeight: 600, fontSize: '1rem'}}>{b.name}</div>
            {b.description && <div style={{fontSize: '0.82rem', color: '#6b7280'}}>{b.description}</div>}
            <div style={{fontSize: '0.85rem', color: '#374151'}}>
              <span style={{fontWeight: 500}}>{b.worker_count}</span> עובדים
              {' · '}
              <span style={{fontWeight: 500, color: '#059669'}}>{b.active_worker_count}</span> פעילים
            </div>
            <button
              onClick={() => onSelectBranch(b.id)}
              style={{
                marginTop: '0.5rem',
                padding: '0.4rem 0',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              נהל סניף
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
