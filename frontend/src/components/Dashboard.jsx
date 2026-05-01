import { useState, useEffect } from 'react';
import PieChart3D from './PieChart3D';


function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '0.5rem 0.75rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.1rem',
      minWidth: 0,
    }}>
      <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: color || '#1a2e4a', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{sub}</div>}
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

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>טוען...</div>;

  return (
    <div style={{ padding: '1.25rem', direction: 'rtl', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* KPI + Employment Type */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'stretch' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(100px, 1fr))', gap: '0.5rem' }}>
          <StatCard label="עובדים פעילים" value={stats?.active_workers ?? '—'} sub={`מתוך ${stats?.total_workers ?? '—'} סה״כ`} color="#059669" />
          <StatCard label="עובדים לא פעילים" value={stats?.inactive_workers ?? '—'} color="#6b7280" />
        </div>
        {stats?.by_type?.length > 0 && <PieChart3D items={stats.by_type.map(t => ({ name: t.name, value: t.active_count }))} />}
      </div>

      {/* Branches */}
      <section>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1a2e4a', marginBottom: '0.75rem' }}>סניפים</h3>
        {branches.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>אין סניפים.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {branches.map(b => (
              <div key={b.id} style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                padding: '0.9rem 1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a2e4a' }}>{b.name}</div>
                {b.description && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{b.description}</div>}
                <div style={{ fontSize: '0.8rem', color: '#374151', display: 'flex', gap: '0.5rem' }}>
                  <span><strong>{b.worker_count}</strong> עובדים</span>
                  <span style={{ color: '#059669' }}><strong>{b.active_worker_count}</strong> פעילים</span>
                </div>
                {b.emp_type_breakdown?.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.2rem' }}>
                    <PieChart3D items={b.emp_type_breakdown.map(t => ({ name: t.name, value: t.count }))} small />
                  </div>
                )}
                <button
                  onClick={() => onSelectBranch(b.id)}
                  style={{
                    marginTop: '0.25rem',
                    padding: '0.3rem 0',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
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
