'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const ITEMS = [
  ['overview', '/admin/finance', 'Overview'], ['revenue', '/admin/finance/revenue', 'Revenue management'],
  ['settlements', '/admin/finance/settlements', 'Farmer settlements'], ['receivables', '/admin/finance/receivables', 'B2B receivables'],
  ['logistics', '/admin/finance/logistics', 'Logistics'], ['orders', '/admin/finance/orders', 'Order economics'],
  ['expenses', '/admin/finance/expenses', 'Expenses'], ['pnl', '/admin/finance/pnl', 'P&L statement'], ['simulator', '/admin/finance/simulator', 'Simulator'],
] as const;
const KEEP = ['p', 'st', 'ch', 'crop', 'd'];

export default function FinanceSidebar({ allowed }: { allowed: string[] }) {
  const path = usePathname();
  const sp = useSearchParams();
  // Carry the period and filters between pages so the founder can pick Telangana once and browse.
  const qs = new URLSearchParams([...sp.entries()].filter(([k]) => KEEP.includes(k))).toString();
  return (
    <nav className="fin-side" aria-label="Finance">
      <span className="fin-side-label">Finance</span>
      {ITEMS.filter(([s]) => allowed.includes(s)).map(([s, href, label]) => (
        <Link key={s} href={qs && s !== 'simulator' ? `${href}?${qs}` : href} aria-current={path === href ? 'page' : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
