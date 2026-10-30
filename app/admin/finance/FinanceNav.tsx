import Link from 'next/link';
import { canSee, type FinanceRole } from '@/lib/finance';

const LINKS = [
  ['overview', '/admin/finance', 'Overview & P&L'], ['orders', '/admin/finance/orders', 'Order economics'],
  ['expenses', '/admin/finance/expenses', 'Expenses'], ['simulator', '/admin/finance/simulator', 'Profit simulator'],
] as const;

export default function FinanceNav({ current, role }: { current: string; role: FinanceRole }) {
  return (
    <nav className="admin-nav" aria-label="Finance" style={{ marginTop: -8 }}>
      {LINKS.filter(([s]) => canSee(role, s)).map(([s, href, label]) => <Link key={href} href={href} aria-current={href === current ? 'page' : undefined}>{label}</Link>)}
      <Link href="/admin/settlements">Farmer settlements ↗</Link>
    </nav>
  );
}

/** Period and filter bar shared by the finance pages; plain GET form so every view has a shareable URL. */
export function FilterBar({ path, sp, months, districts }: { path: string; sp: Record<string, string>; months: { value: string; label: string }[]; districts: string[] }) {
  return (
    <form method="get" action={path} className="row card" style={{ padding: 12, marginBottom: 16, gap: 10, alignItems: 'end' }}>
      <label className="small">Period<br /><select name="m" defaultValue={sp.m}>{months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
      <label className="small">Channel<br /><select name="ch" defaultValue={sp.ch ?? ''}><option value="">B2C + B2B</option><option value="b2c">Households (B2C)</option><option value="b2b">Businesses (B2B)</option></select></label>
      <label className="small">State<br /><select name="st" defaultValue={sp.st ?? ''}><option value="">All states</option><option>Telangana</option><option>Andhra Pradesh</option></select></label>
      <label className="small">District<br /><select name="d" defaultValue={sp.d ?? ''}><option value="">All districts</option>{districts.map((d) => <option key={d}>{d}</option>)}</select></label>
      {sp.view ? <input type="hidden" name="view" value={sp.view} /> : null}
      <button className="btn btn-sm">Apply</button>
    </form>
  );
}
