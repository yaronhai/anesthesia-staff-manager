import { useState, useEffect } from 'react';

const PIE_COLORS = ['#7c3aed', '#0891b2', '#059669', '#f59e0b', '#e11d48', '#9ca3af'];

function darken(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * 0.55);
  const g = Math.round(((n >> 8) & 0xff) * 0.55);
  const b = Math.round((n & 0xff) * 0.55);
  return `rgb(${r},${g},${b})`;
}

// items: [{name, value}]
function PieChart3D({ items, small = false }) {
  const total = items.reduce((s, d) => s + d.value, 0);
  if (!total) return null;

  const cx  = small ? 75  : 118;
  const cy  = small ? 44  : 78;
  const rx  = small ? 63  : 104;
  const ry  = small ? 43  : 71;
  const dep = small ? 7   : 12;
  const W   = small ? 150 : 236;
  const H   = small ? 98  : 168;
  const fName = small ? 8.5  : 10.5;
  const fNum  = small ? 9    : 11;
  const fPct  = small ? 7.5  : 9.5;
  const lRatio = small ? 0.58 : 0.60;
  const minPct = small ? 8   : 6;

  const pt = (a, dy = 0) => [cx + rx * Math.cos(a), cy + ry * Math.sin(a) + dy];

  let a = -Math.PI / 2;
  const slices = items.map((d, i) => {
    const sa = a;
    const ea = a + (d.value / total) * 2 * Math.PI;
    a = ea;
    return { sa, ea, mid: (sa + ea) / 2, pct: Math.round((d.value / total) * 100), count: d.value, name: d.name, color: PIE_COLORS[i % PIE_COLORS.length] };
  });

  const frontIntervals = (sa, ea) => {
    const res = [];
    for (let k = -1; k <= 1; k++) {
      const fsa = Math.max(sa, 2 * Math.PI * k);
      const fea = Math.min(ea, Math.PI + 2 * Math.PI * k);
      if (fsa < fea) res.push([fsa, fea]);
    }
    return res;
  };

  const sides = [];
  for (const s of slices) {
    for (const [fsa, fea] of frontIntervals(s.sa, s.ea)) {
      const [tx1, ty1] = pt(fsa), [tx2, ty2] = pt(fea);
      const [bx1, by1] = pt(fsa, dep), [bx2, by2] = pt(fea, dep);
      const lg = (fea - fsa) > Math.PI ? 1 : 0;
      sides.push({
        path: `M${tx1},${ty1} A${rx},${ry} 0 ${lg} 1 ${tx2},${ty2} L${bx2},${by2} A${rx},${ry} 0 ${lg} 0 ${bx1},${by1}Z`,
        color: darken(s.color), sortY: Math.max(ty1, ty2) + dep,
      });
    }
  }
  sides.sort((a, b) => a.sortY - b.sortY);
  const sortedSlices = [...slices].sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <ellipse cx={cx} cy={cy + dep} rx={rx} ry={ry} fill="rgba(0,0,0,0.08)" />
      {sides.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
      {sortedSlices.map((s, i) => {
        const [x1, y1] = pt(s.sa), [x2, y2] = pt(s.ea);
        const lg = (s.ea - s.sa) > Math.PI ? 1 : 0;
        const lx = cx + rx * lRatio * Math.cos(s.mid);
        const ly = cy + ry * lRatio * Math.sin(s.mid);
        return (
          <g key={i}>
            <path d={`M${cx},${cy} L${x1},${y1} A${rx},${ry} 0 ${lg} 1 ${x2},${y2}Z`} fill={s.color} stroke="white" strokeWidth="1.5" />
            {s.pct >= minPct && <>
              <text x={lx} y={ly - (small ? 8 : 10)} textAnchor="middle" dominantBaseline="middle" fontSize={fName} fontWeight="700" fill="white">{s.name}</text>
              <text x={lx} y={ly + (small ? 2 : 3)}  textAnchor="middle" dominantBaseline="middle" fontSize={fNum}  fontWeight="700" fill="white">{s.count}</text>
              <text x={lx} y={ly + (small ? 12 : 16)} textAnchor="middle" dominantBaseline="middle" fontSize={fPct}  fill="rgba(255,255,255,0.88)">{s.pct}%</text>
            </>}
          </g>
        );
      })}
    </svg>
  );
}

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
