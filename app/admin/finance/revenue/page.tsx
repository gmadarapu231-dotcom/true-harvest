import { Suspense } from 'react';
import { filterOptions, filtersFrom, inr, monthStatement, ordersForMonth, periodFrom, periodLabel, previousPeriod, type OrderEcon } from '@/lib/finance';
import FinanceHeader from '../FinanceHeader';
import { requireFinance } from '../guard';

export const metadata = { title: 'Revenue · Finance' };

function group(os: OrderEcon[], key: (o: OrderEcon) => string) {
  const m = new Map<string, { k: string; n: number; gmv: number; rev: number; comm: number; c: number }>();
  for (const o of os) {
    const k = key(o) || 'Unknown';
    const g = m.get(k) ?? { k, n: 0, gmv: 0, rev: 0, comm: 0, c: 0 };
    g.n++; g.gmv += o.gmv; g.rev += o.revenue; g.comm += o.commission; g.c += o.contribution; m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.rev - a.rev);
}

function GroupTable({ title, rows }: { title: string; rows: ReturnType<typeof group> }) {
  return (
    <div className="fin-card"><h3>{title}</h3>
      <div className="table-wrap"><table>
        <thead><tr><th></th><th className="r">Orders</th><th className="r">GMV</th><th className="r">Revenue</th><th className="r">Take rate</th><th className="r">Contribution</th></tr></thead>
        <tbody>{rows.length ? rows.map((r) => <tr key={r.k}><td>{r.k}</td><td className="r num">{r.n}</td><td className="r num">{inr(r.gmv)}</td><td className="r num">{inr(r.rev)}</td>
          <td className="r num">{r.gmv ? ((r.comm / r.gmv) * 100).toFixed(2) : '0.00'}%</td><td className={`r num${r.c < 0 ? ' neg' : ''}`}>{inr(r.c)}</td></tr>)
          : <tr><td colSpan={6} className="muted">No completed orders in this period.</td></tr>}</tbody>
      </table></div>
    </div>
  );
}

export default async function Revenue({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireFinance('revenue');
  const sp = await searchParams;
  const p = periodFrom(sp), f = filtersFrom(sp);
  const [cur, prev, os, opts] = await Promise.all([monthStatement(p, f), monthStatement(previousPeriod(p), f), ordersForMonth(p, f), filterOptions()]);
  const b2c = os.filter((o) => o.channel === 'b2c'), b2b = os.filter((o) => o.channel === 'b2b');
  const s = (l: OrderEcon[], fn: (o: OrderEcon) => number) => l.reduce((t, o) => t + fn(o), 0);
  const rows: [string, number, number?][] = [
    ['B2C commissions', s(b2c, (o) => o.commission)], ['B2B commissions', s(b2b, (o) => o.commission)],
    ['Delivery charges (B2C)', s(b2c, (o) => o.delivery_fee)], ['Logistics fees (B2B)', s(b2b, (o) => o.delivery_fee)],
    ['Packing charges (B2C)', s(b2c, (o) => o.service_fee)], ['Sorting and grading (B2B)', s(b2b, (o) => o.service_fee)],
  ];
  return (
    <>
      <Suspense><FinanceHeader title="Revenue management" exportReport="orders" {...opts}
        sub={<>{periodLabel(p)}. Revenue is what the company earns: commissions and its own service fees. Produce value passed on to farmers is not revenue.</>} /></Suspense>
      <div className="fin-grid even">
        <div className="fin-card"><h3>Revenue by source</h3>
          <div className="table-wrap"><table>
            <thead><tr><th>Source</th><th className="r">This period</th><th className="r">Share</th></tr></thead>
            <tbody>
              {rows.map(([k, v]) => <tr key={k}><td>{k}</td><td className="r num">{inr(v)}</td><td className="r num">{cur.revenue ? ((v / cur.revenue) * 100).toFixed(1) : '0.0'}%</td></tr>)}
              <tr className="muted"><td>Business subscriptions, FPO services, export fees</td><td className="r">Not live yet</td><td></td></tr>
              <tr className="total"><td>Total platform revenue</td><td className="r num">{inr(cur.revenue)}</td><td className="r num">{prev.revenue ? `${cur.revenue >= prev.revenue ? '+' : '−'}${Math.abs((cur.revenue / prev.revenue - 1) * 100).toFixed(1)}% vs prev.` : ''}</td></tr>
            </tbody>
          </table></div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>Take rate (commission ÷ GMV): <b>{cur.gmv ? ((cur.commission / cur.gmv) * 100).toFixed(2) : '0.00'}%</b>. All revenue ÷ GMV: <b>{cur.gmv ? ((cur.revenue / cur.gmv) * 100).toFixed(2) : '0.00'}%</b>.</p>
        </div>
        <GroupTable title="By state" rows={group(os, (o) => o.state)} />
      </div>
      <div className="fin-grid even" style={{ marginTop: 16 }}>
        <GroupTable title="By district" rows={group(os, (o) => o.district)} />
        <GroupTable title="By crop (first crop on the order)" rows={group(os, (o) => o.crops.split(', ')[0])} />
      </div>
    </>
  );
}
