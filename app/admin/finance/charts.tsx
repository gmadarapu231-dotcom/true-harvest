// Small server-rendered SVG charts for the finance pages. One y-scale per chart, ticks on round values, every mark has a tooltip.
const step = (range: number, n = 4) => {
  const raw = range / n, mag = Math.pow(10, Math.floor(Math.log10(raw || 1))), r = raw / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
};
export function axisLabel(v: number) {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e7) return `${s}₹${+(a / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${s}₹${+(a / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${s}₹${+(a / 1e3).toFixed(1)}K`;
  return `${s}₹${Math.round(a)}`;
}
const money = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;

function scale(values: number[], h: number, top: number, bottom: number) {
  let lo = Math.min(0, ...values), hi = Math.max(0, ...values);
  if (hi === lo) hi = lo + 1;
  const st = step(hi - lo);
  hi = Math.ceil(hi / st) * st; lo = Math.floor(lo / st) * st;
  const y = (v: number) => top + ((hi - v) / (hi - lo)) * (h - top - bottom);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + st / 2; v += st) ticks.push(v);
  return { y, ticks };
}

export function BarChart({ bars, height = 230 }: { bars: { label: string; value: number; color: string }[]; height?: number }) {
  const W = 420, L = 56, R = 10, T = 12, B = 28;
  const { y, ticks } = scale(bars.map((b) => b.value), height, T, B);
  const bw = (W - L - R) / bars.length;
  return (
    <div className="fin-chart"><svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={bars.map((b) => `${b.label} ${money(b.value)}`).join(', ')}>
      {ticks.map((t) => <g key={t}><line className={t === 0 ? 'axis' : 'grid'} x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text x={L - 8} y={y(t) + 4} textAnchor="end">{axisLabel(t)}</text></g>)}
      {bars.map((b, i) => {
        const w = Math.min(110, bw * 0.6), x = L + i * bw + (bw - w) / 2, top = y(Math.max(0, b.value)), h = Math.max(1, Math.abs(y(b.value) - y(0)));
        return <g key={b.label}><rect x={x} y={top} width={w} height={h} rx={4} fill={b.color}><title>{`${b.label}: ${money(b.value)}`}</title></rect>
          <text x={x + w / 2} y={height - 8} textAnchor="middle">{b.label}</text></g>;
      })}
    </svg></div>
  );
}

export function LineChart({ labels, series, height = 250 }: { labels: string[]; series: { name: string; color: string; values: number[] }[]; height?: number }) {
  const W = 680, L = 64, R = 150, T = 14, B = 30;
  const { y, ticks } = scale(series.flatMap((s) => s.values), height, T, B);
  const x = (i: number) => L + (labels.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (labels.length - 1));
  // End labels, nudged apart so they never overlap.
  const ends = series.map((s) => ({ s, y: y(s.values[s.values.length - 1] ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
  return (
    <div className="fin-chart"><svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Contribution by week and channel">
      {ticks.map((t) => <g key={t}><line className={t === 0 ? 'axis' : 'grid'} x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text x={L - 8} y={y(t) + 4} textAnchor="end">{axisLabel(t)}</text></g>)}
      {labels.map((l, i) => <text key={l} x={x(i)} y={height - 8} textAnchor="middle">{l}</text>)}
      {series.map((s) => (
        <g key={s.name}>
          <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2.5} />
          {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === s.values.length - 1 ? 6 : 5} fill={s.color} stroke="var(--paper)" strokeWidth={2}><title>{`${labels[i]} · ${s.name}: ${money(v)}`}</title></circle>)}
        </g>
      ))}
      {ends.map(({ s, y: ey }) => <text key={s.name} x={x(labels.length - 1) + 12} y={ey + 4} style={{ fill: 'var(--ink)' }}>{`${s.name.split(' ')[0]}: ${money(s.values[s.values.length - 1] ?? 0)}`}</text>)}
    </svg></div>
  );
}
