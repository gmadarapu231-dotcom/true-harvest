import Link from 'next/link';
import type { ReactNode } from 'react';

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
  if (sp.ok) return <div className="flash flash-ok" role="status">{sp.ok}</div>;
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

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <>
      <div className="stat-label">{label}</div>
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

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--green)" />
      <path d="M16 25V14" stroke="var(--cream)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 15c0-4 3-7 8-7 0 4.5-3 7.5-8 7z" fill="var(--turmeric)" />
      <path d="M16 18.5c0-3.5-2.6-6-7-6 0 3.9 2.6 6.3 7 6z" fill="var(--cream)" />
    </svg>
  );
}
