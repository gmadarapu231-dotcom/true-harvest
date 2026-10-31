import Link from 'next/link';
import type { ReactNode } from 'react';
import { BRAND } from '@/lib/config';
import Icon from './Icon';

export const fmtMoney = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const fmtKg = (kg: number) => {
  const v = Number(kg);
  if (v >= 1000) return `${(v / 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} t`;
  if (v < 1 && v > 0) return `${Math.round(v * 1000)} g`;
  return `${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;
};
export const fmtDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
export const fmtTime = (d: string | Date | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export function Money({ v }: { v: number }) {
  return <span className="num">{fmtMoney(v)}</span>;
}

const TONE: Record<string, string> = {
  live: 'ok', verified: 'ok', delivered: 'ok', completed: 'ok', accepted: 'ok', confirmed: 'ok', paid: 'ok', resolved: 'ok', Paid: 'ok',
  placed: 'warn', awaiting_acceptance: 'warn', pending_review: 'warn', submitted: 'warn', pending: 'warn', open: 'warn', sent: 'warn', pending_payment: 'warn', Due: 'warn', registered: 'warn',
  packed: 'info', picked_up: 'info', out_for_delivery: 'info', 'In complaint window': 'info', Accruing: 'info', partly_refunded: 'info',
  rejected: 'bad', expired: 'bad', cancelled: 'bad', payment_failed: 'bad', suspended: 'bad', declined: 'bad', failed: 'bad', refunded: 'bad', blocked: 'bad',
  paused: 'muted', withdrawn: 'muted',
};
const LABEL: Record<string, string> = {
  awaiting_acceptance: 'Awaiting farmer', pending_review: 'Pending review', out_for_delivery: 'Out for delivery', picked_up: 'Picked up',
  pending_payment: 'Awaiting payment', payment_failed: 'Payment failed', partly_refunded: 'Partly refunded', pay_on_delivery: 'Pay on delivery',
};
export function Chip({ s, label }: { s: string; label?: string }) {
  return <span className={`chip chip-${TONE[s] ?? 'muted'}`}>{label ?? LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1).replaceAll('_', ' ')}</span>;
}

export function CropArt({ emoji, photoId, size = 'md', alt }: { emoji: string; photoId?: number | null; size?: 'sm' | 'md' | 'lg'; alt: string }) {
  return (
    <div className={`crop-art crop-art-${size}`} aria-hidden={!photoId}>
      {photoId ? <img src={`/api/photo/${photoId}`} alt={alt} loading="lazy" /> : <span>{emoji}</span>}
    </div>
  );
}

export function Flash({ sp }: { sp: { error?: string; ok?: string } }) {
  if (sp.error) return <div className="flash flash-error" role="alert">{sp.error}</div>;
  if (sp.ok) return <div className="flash flash-ok toast" role="status"><img src="/brand/mark.png" alt="" width={28} height={28} /><span>{sp.ok}</span></div>;
  return null;
}

export function PageHead({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p className="muted">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, href, icon }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; icon?: string }) {
  const body = (
    <>
      <div className="stat-label">{icon ? <span className="stat-ic"><Icon name={icon} size={18} /></span> : null}{label}</div>
      <div className="stat-value num">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </>
  );
  return href ? <Link href={href} className="stat card">{body}</Link> : <div className="stat card">{body}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Stars({ n }: { n: number | null }) {
  if (!n) return <span className="muted small">New</span>;
  return <span className="stars" aria-label={`${n.toFixed(1)} out of 5`}>★ {Number(n).toFixed(1)}</span>;
}

// Brand lockup: the leaf, wheat and handshake mark plus the two-tone wordmark ("True" in script green, "Harvest" in bold gold).
export function Logo({ size = 40, tagline = false, light = false }: { size?: number; tagline?: boolean; light?: boolean }) {
  const cut = BRAND.name.search(/(?<=.)[A-Z]/);
  const [a, b] = cut > 0 ? [BRAND.name.slice(0, cut), BRAND.name.slice(cut)] : [BRAND.name, ''];
  return (
    <span className={`logo${light ? ' logo-light' : ''}`}>
      <img src={light ? '/brand/mark-white.png' : '/brand/mark.png'} width={size} height={size} alt="" />
      <span className="wordmark">
        <span className="wm"><span className="wm-a">{a}</span><span className="wm-b">{b}</span></span>
        {tagline ? <small>{BRAND.tagline}</small> : null}
      </span>
    </span>
  );
}

/** Small server-rendered line chart; points are plotted evenly left to right. */
export function LineChart({ points, height = 230, fmt = (v: number) => String(Math.round(v)) }: { points: { label: string; value: number }[]; height?: number; fmt?: (v: number) => string }) {
  const W = 820, H = height, P = { l: 58, r: 30, t: 14, b: 30 };
  if (!points.length) return <p className="muted">No data yet.</p>;
  const vals = points.map((p) => Number(p.value));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi === lo) { hi += 1; lo = Math.max(0, lo - 1); }
  const pad = (hi - lo) * 0.12; lo = Math.max(0, lo - pad); hi += pad;
  const x = (i: number) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (points.length - 1));
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(Number(p.value)).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${H - P.b} L${x(0).toFixed(1)} ${H - P.b} Z`;
  const ticks = [0, 0.5, 1].map((f) => lo + f * (hi - lo));
  const every = Math.max(1, Math.ceil(points.length / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="linechart" role="img" aria-label={`Trend from ${fmt(vals[0])} to ${fmt(vals[vals.length - 1])}`}>
      {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="grid" /><text x={P.l - 8} y={y(t) + 4} textAnchor="end">{fmt(t)}</text></g>)}
      <path d={area} className="area" />
      <path d={line} className="stroke" />
      {points.map((p, i) => (i % every === 0 || i === points.length - 1) ? <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{p.label}</text> : null)}
      <circle cx={x(points.length - 1)} cy={y(vals[vals.length - 1])} r="4.5" className="dot" />
    </svg>
  );
}
