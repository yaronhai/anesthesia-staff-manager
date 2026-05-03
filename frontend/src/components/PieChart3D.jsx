import styles from '../styles/PieChart3D.module.scss';
const PIE_COLORS = ['#7c3aed', '#0891b2', '#059669', '#f59e0b', '#e11d48', '#9ca3af'];

function darken(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * 0.55);
  const g = Math.round(((n >> 8) & 0xff) * 0.55);
  const b = Math.round((n & 0xff) * 0.55);
  return `rgb(${r},${g},${b})`;
}

// size: 'normal' | 'small' | 'tiny'
export default function PieChart3D({ items, small = false, tiny = false }) {
  const total = items.reduce((s, d) => s + d.value, 0);
  if (!total) return null;

  const cx     = tiny ? 58  : small ? 75  : 118;
  const cy     = tiny ? 34  : small ? 44  : 78;
  const rx     = tiny ? 50  : small ? 63  : 104;
  const ry     = tiny ? 30  : small ? 43  : 71;
  const dep    = tiny ? 5   : small ? 7   : 12;
  const W      = tiny ? 116 : small ? 150 : 236;
  const H      = tiny ? 72  : small ? 98  : 168;
  const fName  = tiny ? 7.5 : small ? 8.5 : 10.5;
  const fNum   = tiny ? 8   : small ? 9   : 11;
  const fPct   = tiny ? 7   : small ? 7.5 : 9.5;
  const lRatio = tiny ? 0.56: small ? 0.58: 0.60;
  const minPct = tiny ? 10  : small ? 8   : 6;

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
    <svg width={W} height={H} className={styles.svg}>
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
              <text x={lx} y={ly - (tiny ? 6 : small ? 8 : 10)} textAnchor="middle" dominantBaseline="middle" fontSize={fName} fontWeight="700" fill="white">{s.name}</text>
              <text x={lx} y={ly + (tiny ? 1 : small ? 2 : 3)}  textAnchor="middle" dominantBaseline="middle" fontSize={fNum}  fontWeight="700" fill="white">{s.count}</text>
              {!tiny && <text x={lx} y={ly + (small ? 12 : 16)} textAnchor="middle" dominantBaseline="middle" fontSize={fPct} fill="rgba(255,255,255,0.88)">{s.pct}%</text>}
            </>}
          </g>
        );
      })}
    </svg>
  );
}
