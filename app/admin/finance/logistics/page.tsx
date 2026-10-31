import { Suspense } from 'react';
import { filterOptions, filtersFrom, inr, ordersForMonth, periodFrom, periodLabel, type OrderEcon } from '@/lib/finance';
import FinanceHeader from '../FinanceHeader';
import { requireFinance } from '../guard';

export const metadata = { title: 'Logistics · Finance' };

export default async function Logistics({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireFinance('logistics');
  const sp = await searchParams;
  const p = periodFrom(sp);
  const [os, opts] = await Promise.all([ordersForMonth(p, filtersFrom(sp)), filterOptions()]);
  const line = (label: string, l: OrderEcon[]) => {
    const fee = l.reduce((t, o) => t + o.delivery_fee, 0), cost = l.reduce((t, o) => t + o.partner_cost, 0);
    const kg = l.reduce((t, o) => t + o.kg, 0), withKm = l.filter((o) => o.km), km = withKm.reduce((t, o) => t + (o.km ?? 0), 0);
    const kmMargin = withKm.reduce((t, o) => t + o.delivery_fee - o.partner_cost, 0);
    return { label, n: l.length, fee, cost, m: fee - cost, perOrder: l.length ? (fee - cost) / l.length : 0, perKg: kg ? (fee - cost) / kg : 0, perKm: km ? kmMargin / km : null, est: l.filter((o) => o.estimated.includes('delivery')).length };
  };
  const rows = [line('Households (B2C)', os.filter((o) => o.channel === 'b2c')), line('Businesses (B2B)', os.filter((o) => o.channel === 'b2b'))];
  const partners = new Map<string, OrderEcon[]>();
  for (const o of os) { const k = o.partners || 'Unassigned'; partners.set(k, [...(partners.get(k) ?? []), o]); }
  const byPartner = [...partners.entries()].map(([k, l]) => line(k, l)).sort((a, b) => a.m - b.m);
  const Table = ({ data, first }: { data: typeof rows; first: string }) => (
    <div className="table-wrap"><table>
      <thead><tr><th>{first}</th><th className="r">Deliveries</th><th className="r">Fees collected</th><th className="r">Partner cost</th><th className="r">Delivery margin</th><th className="r">Per order</th><th className="r">Per kg</th><th className="r">Per km</th></tr></thead>
      <tbody>{data.map((r) => <tr key={r.label}><td>{r.label}</td><td className="r num">{r.n}</td><td className="r num">{inr(r.fee)}</td><td className="r num">−{inr(r.cost)}{r.est ? '*' : ''}</td>
        <td className={`r num${r.m < 0 ? ' neg' : ''}`}><b>{inr(r.m)}</b></td><td className="r num">{inr(r.perOrder, 1)}</td><td className="r num">{inr(r.perKg, 2)}</td><td className="r num">{r.perKm == null ? '–' : inr(r.perKm, 2)}</td></tr>)}</tbody>
    </table></div>
  );
  return (
    <>
      <Suspense><FinanceHeader title="Logistics profitability" exportReport="orders" {...opts}
        sub={<>{periodLabel(p)}. Delivery fees charged to buyers against what delivery partners are paid.</>} /></Suspense>
      <Table data={rows} first="Channel" />
      <h2 className="fin-section">By delivery partner</h2>
      <Table data={byPartner} first="Partner" />
      <p className="small muted" style={{ marginTop: 8 }}>* Includes standard partner costs for orders where the actual payout is not recorded yet. Per km needs distance on the delivery task; it shows once partners record it.</p>
    </>
  );
}
