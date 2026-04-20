import { useState, useEffect } from 'react';

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '1rem 1.25rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
      minWidth: 0,
    }}>
      <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: color || '#1a2e4a', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{sub}</div>}
    </div>
  );
}

function formatDate(d) {
  if (!d) return '—';
  const s = typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  const [y, m, dd] = s.split('-');
  return `${dd}/${m}/${y}`;
}

export default function Dashboard({ authToken, onSelectBranch }) {
  const [branches, setBranches] = useState([]);
  const [pendingVacations, setPendingVacations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${authToken}` };
    Promise.all([
      fetch('/api/branches/overview', { headers }).then(r => r.ok ? r.json() : []),
      fetch('/api/vacation-requests?status=pending', { headers }).then(r => r.ok ? r.json() : []),
      fetch('/api/dashboard-stats', { headers }).then(r => r.ok ? r.json() : null),
    ]).then(([branchData, vacData, statsData]) => {
      setBranches(Array.isArray(branchData) ? branchData : []);
      setPendingVacations(Array.isArray(vacData) ? vacData : []);
      setStats(statsData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [authToken]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>טוען...</div>;

  return (
    <div style={{ padding: '1.25rem', direction: 'rtl', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
        <StatCard label="סניפים" value={branches.length} color="#2563eb" />
        <StatCard label="עובדים פעילים" value={stats?.active_workers ?? '—'} sub={`מתוך ${stats?.total_workers ?? '—'} סה״כ`} color="#059669" />
        <StatCard label="עובדים לא פעילים" value={stats?.inactive_workers ?? '—'} color="#6b7280" />
        <StatCard label="בקשות חופשה ממתינות" value={pendingVacations.length} color={pendingVacations.length > 0 ? '#dc2626' : '#059669'} />
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

      {/* Pending Vacation Requests */}
      <section>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1a2e4a', marginBottom: '0.75rem' }}>
          בקשות חופשה ממתינות
          {pendingVacations.length > 0 && (
            <span style={{ marginRight: '0.5rem', background: '#fee2e2', color: '#dc2626', borderRadius: '10px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
              {pendingVacations.length}
            </span>
          )}
        </h3>
        {pendingVacations.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>אין בקשות ממתינות.</p>
        ) : (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#374151' }}>עובד</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#374151' }}>מתאריך</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#374151' }}>עד תאריך</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#374151' }}>הגשה</th>
                </tr>
              </thead>
              <tbody>
                {pendingVacations.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.4rem 0.75rem', fontWeight: 600 }}>
                      {v.first_name ? `${v.first_name} ${v.family_name}` : v.username}
                    </td>
                    <td style={{ padding: '0.4rem 0.75rem', color: '#374151' }}>{formatDate(v.start_date)}</td>
                    <td style={{ padding: '0.4rem 0.75rem', color: '#374151' }}>{formatDate(v.end_date)}</td>
                    <td style={{ padding: '0.4rem 0.75rem', color: '#9ca3af' }}>{formatDate(v.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
