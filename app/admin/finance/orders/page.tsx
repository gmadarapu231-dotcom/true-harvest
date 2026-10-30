import Link from 'next/link';
import AdminNav from '@/components/AdminNav';
import { Empty, PageHead, fmtDate } from '@/components/ui';
import { filterOptions, filtersFrom, inr, monthKey, monthLabel, ordersForMonth, type OrderEcon } from '@/lib/finance';
import FinanceNav, { FilterBar } from '../FinanceNav';
import { requireFinance } from '../guard';

export const metadata = { title: 'Order economics · Finance' };

const VIEWS = [['all', 'All completed'], ['negative', 'Negative contribution'], ['estimated', 'Using standard costs']] as const;

export default async function OrderEconomics({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { role } = await requireFinance('orders');
  const sp = await searchParams;
  const m = /^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m : monthKey();
  const view = VIEWS.some(([v]) => v === sp.view) ? sp.view : 'all';
  const [all, opts] = await Promise.all([ordersForMonth(m, filtersFrom(sp)), filterOptions()]);
  const rows = view === 'negative' ? all.filter((o) => o.contribution < 0).sort((a, b) => a.contribution - b.contribution)
    : view === 'estimated' ? all.filter((o) => o.estimated.length) : all;

  const unit = (list: OrderEcon[]) => {
    const n = list.length || 1, kg = list.reduce((t, o) => t + o.kg, 0) || 1;
    const s = (f: (o: OrderEcon) => number) => list.reduce((t, o) => t + f(o), 0);
    return { n: list.length, aov: s((o) => o.gmv) / n, rev: s((o) => o.revenue) / n, cost: s((o) => o.variable) / n, c: s((o) => o.contribution) / n, perKg: s((o) => o.contribution) / kg, neg: list.filter((o) => o.contribution < 0).length };
  };
  const b2c = unit(all.filter((o) => o.channel === 'b2c')), b2b = unit(all.filter((o) => o.channel === 'b2b'));
  const qs = (v: string) => new URLSearchParams({ ...sp, m, view: v }).toString();

  return (
    <main className="wrap">
      <AdminNav current="/admin/finance" />
      <FinanceNav current="/admin/finance/orders" role={role} />
      <PageHead title="Order economics" sub="Contribution = commission + delivery fee + packing fee − delivery partner cost − packing and handling − gateway fee − refunds the platform bears." />
      <FilterBar path="/admin/finance/orders" sp={{ ...sp, m }} {...opts} />

      <div className="table-wrap" style={{ marginBottom: 20 }}><table>
        <thead><tr><th>{monthLabel(m)}</th><th className="r">Households</th><th className="r">Businesses</th></tr></thead>
        <tbody>
          <tr><td>Completed orders</td><td className="r num">{b2c.n}</td><td className="r num">{b2b.n}</td></tr>
          <tr><td>Average order value (GMV)</td><td className="r num">{inr(b2c.aov)}</td><td className="r num">{inr(b2b.aov)}</td></tr>
          <tr><td>Revenue per order</td><td className="r num">{inr(b2c.rev, 1)}</td><td className="r num">{inr(b2b.rev, 1)}</td></tr>
          <tr><td>Variable cost per order</td><td className="r num">{inr(b2c.cost, 1)}</td><td className="r num">{inr(b2b.cost, 1)}</td></tr>
          <tr><td><b>Contribution per order</b></td><td className="r num"><b>{inr(b2c.c, 1)}</b></td><td className="r num"><b>{inr(b2b.c, 1)}</b></td></tr>
          <tr><td>Contribution per kg</td><td className="r num">{inr(b2c.perKg, 2)}</td><td className="r num">{inr(b2b.perKg, 2)}</td></tr>
          <tr><td>Negative-contribution orders</td><td className="r num">{b2c.neg}</td><td className="r num">{b2b.neg}</td></tr>
        </tbody>
      </table></div>

      <div className="row" style={{ marginBottom: 12 }}>
        {VIEWS.map(([v, label]) => <Link key={v} href={`/admin/finance/orders?${qs(v)}`} className={`btn btn-sm ${view === v ? '' : 'btn-ghost'}`}>{label}</Link>)}
      </div>
      {!rows.length ? <Empty>No completed orders match.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr>
            <th>Order</th><th>Completed</th><th>Channel</th><th>Farmer · district</th><th>Crops</th>
            <th className="r">GMV</th><th className="r">Farmer payout</th><th className="r">Commission</th><th className="r">Delivery fee</th><th className="r">Packing fee</th>
            <th className="r">Delivery cost</th><th className="r">Packing cost</th><th className="r">Gateway</th><th className="r">Refunds</th><th className="r">Contribution</th><th className="r">%</th>
          </tr></thead>
          <tbody>{rows.slice(0, 300).map((o) => (
            <tr key={o.id}>
              <td><Link href={`/admin/orders?q=${o.order_no}`}>{o.order_no}</Link></td>
              <td>{fmtDate(o.completed_at)}</td><td>{o.channel === 'b2c' ? 'Household' : 'Business'}</td>
              <td className="small">{o.farmers}{o.district ? ` · ${o.district}` : ''}</td><td className="small">{o.crops}</td>
              <td className="r num">{inr(o.gmv)}</td><td className="r num">{inr(o.payout)}</td><td className="r num">{inr(o.commission, 2)}</td>
              <td className="r num">{inr(o.delivery_fee)}</td><td className="r num">{inr(o.service_fee)}</td>
              <td className="r num">−{inr(o.partner_cost, 2)}{o.estimated.includes('delivery') ? '*' : ''}</td>
              <td className="r num">−{inr(o.packing_cost, 2)}{o.estimated.includes('packing') ? '*' : ''}</td>
              <td className="r num">−{inr(o.gateway_fee, 2)}{o.estimated.includes('gateway') ? '*' : ''}</td>
              <td className="r num">{o.refund_cost ? `−${inr(o.refund_cost)}` : '–'}</td>
              <td className="r num" style={o.contribution < 0 ? { color: 'var(--chilli)', fontWeight: 700 } : { fontWeight: 700 }}>{inr(o.contribution, 2)}</td>
              <td className="r num">{o.revenue ? `${(o.contribution / o.revenue * 100).toFixed(0)}%` : '–'}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="small muted" style={{ marginTop: 8 }}>* Standard cost from Finance assumptions; replaced automatically once the actual cost is recorded on the order.{rows.length > 300 ? ` Showing 300 of ${rows.length}.` : ''}</p>
    </main>
  );
}
