import Link from 'next/link';
import { Suspense } from 'react';
import { Chip, Flash } from '@/components/ui';
import {
  alerts, balances, compact, filterOptions, filtersFrom, inr, monthStatement, ordersForMonth, periodFrom, periodLabel, periodRange,
  previousPeriod, settlementPanel, type OrderEcon,
} from '@/lib/finance';
import FinanceHeader from './FinanceHeader';
import { BarChart, LineChart } from './charts';
import { requireFinance } from './guard';

export const metadata = { title: 'Finance Control Center' };

function Kpi({ label, value, cur, prev, dark, tag, lowerIsBetter, href }: { label: string; value: number; cur: number; prev: number; dark?: boolean; tag?: string; lowerIsBetter?: boolean; href?: string }) {
  let chg = <span className="chg">No earlier period to compare</span>;
  if (prev) {
    const c = (cur - prev) / Math.abs(prev);
    const good = lowerIsBetter ? c <= 0 : c >= 0;
    chg = <span className={`chg ${good ? 'good' : 'bad'}`}>{c >= 0 ? '+' : '−'}{Math.abs(c * 100).toFixed(1)}% vs previous</span>;
  }
  const body = <><span className="lbl">{label}</span><span className="val">{compact(value)}</span>{chg}{tag ? <span className="tag">{tag}</span> : null}</>;
  return href ? <Link href={href} className={`fin-kpi ${dark ? 'dark' : 'light'}`}>{body}</Link> : <div className={`fin-kpi ${dark ? 'dark' : 'light'}`}>{body}</div>;
}

/** Splits a period into whole weeks counted back from its end; leftover days join the first week, so no week is a stub. */
function weekly(orders: OrderEcon[], from: string, to: string) {
  const end = Date.parse(to), wk = 7 * 86400000;
  const n = Math.max(1, Math.floor((end - Date.parse(from)) / wk));
  const b2c = Array(n).fill(0), b2b = Array(n).fill(0);
  for (const o of orders) {
    const back = Math.floor((end - 1 - Date.parse(String(o.completed_at))) / wk);
    const i = Math.max(0, n - 1 - Math.max(0, back));
    (o.channel === 'b2c' ? b2c : b2b)[i] += o.contribution;
  }
  return { labels: Array.from({ length: n }, (_, i) => `Week ${i + 1}`), b2c, b2b };
}

function Equation({ who, avg, parts }: { who: string; avg: string; parts: { k: string; v: number; tone: string; op?: string }[] }) {
  const result = parts[parts.length - 1];
  return (
    <div className="fin-eq">
      <div className="who">{who}<small>({avg} avg)</small></div>
      {parts.map((p, i) => (
        <span key={p.k} style={{ display: 'contents' }}>
          {i > 0 && <span className="op">{p.op}</span>}
          <span className={`t ${p.tone}${p === result && p.v < 0 ? ' neg' : ''}`}><span>{p.k}</span><b>{inr(p.v)}</b></span>
        </span>
      ))}
    </div>
  );
}

export default async function FinanceOverview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireFinance('overview');
  const sp = await searchParams;
  const p = periodFrom(sp);
  const f = filtersFrom(sp);
  const filtered = !!(f.channel || f.state || f.district || f.crop);
  const [from, to] = periodRange(p);
  const [cur, prev, opts, bal, orders, st] = await Promise.all([
    monthStatement(p, f), monthStatement(previousPeriod(p), f), filterOptions(), balances(), ordersForMonth(p, f), settlementPanel(p)]);
  const warn = await alerts(cur, bal);
  const wk = weekly(orders, from, to);
  const avg = (list: OrderEcon[], fn: (o: OrderEcon) => number) => (list.length ? list.reduce((t, o) => t + fn(o), 0) / list.length : 0);
  const c = orders.filter((o) => o.channel === 'b2c'), b = orders.filter((o) => o.channel === 'b2b');
  const qs = new URLSearchParams(Object.entries(sp).filter(([k]) => ['p', 'st', 'ch', 'crop', 'd'].includes(k))).toString();
  const pct = (v: number) => (cur.gmv ? `${Math.round((v / cur.gmv) * 100)}%` : '0%');

  return (
    <>
      <Suspense><FinanceHeader title="Finance Control Center" exportReport="orders" {...opts}
        sub={<>{periodLabel(p)} · {cur.n} completed orders{filtered ? ` · fixed costs allocated by revenue share (${(cur.share * 100).toFixed(1)}%)` : ''}. Every figure traces to orders, settlements and approved expenses.</>} /></Suspense>
      <Flash sp={sp} />

      <h2 className="fin-section">Executive KPI cards</h2>
      <div className="fin-kpis">
        <Kpi dark label="Total GMV" value={cur.gmv} cur={cur.gmv} prev={prev.gmv} tag="Gross merchandise value" href={`/admin/finance/orders?${qs}`} />
        <Kpi label="Platform revenue" value={cur.revenue} cur={cur.revenue} prev={prev.revenue} tag="Commission + fees" href={`/admin/finance/revenue?${qs}`} />
        <Kpi label="Variable costs" value={cur.variable} cur={cur.variable} prev={prev.variable} lowerIsBetter tag="Delivery, packing, gateway" href={`/admin/finance/logistics?${qs}`} />
        <Kpi dark label="Gross contribution" value={cur.contribution} cur={cur.contribution} prev={prev.contribution} tag="Revenue − direct costs" href={`/admin/finance/orders?${qs}`} />
        <Kpi dark label="Operating profit (EBITDA)" value={cur.ebitda} cur={cur.ebitda} prev={prev.ebitda} tag="Contribution − operating expenses" href={`/admin/finance/pnl?${qs}`} />
      </div>

      <h2 className="fin-section">Graphical analysis</h2>
      <div className="fin-grid">
        <div className="fin-card">
          <h3>GMV composition</h3>
          <BarChart bars={[{ label: 'B2B', value: cur.gmvB2B, color: 'var(--green)' }, { label: 'B2C', value: cur.gmvB2C, color: 'var(--fin-gold)' }]} />
          <div className="fin-legend" style={{ marginTop: 6 }}>
            <span><i style={{ background: 'var(--green)' }} />B2B GMV: {compact(cur.gmvB2B)} ({pct(cur.gmvB2B)})</span>
            <span><i style={{ background: 'var(--fin-gold)' }} />B2C GMV: {compact(cur.gmvB2C)} ({pct(cur.gmvB2C)})</span>
          </div>
        </div>
        <div className="fin-card">
          <h3>Contribution by sales channel
            <span className="fin-legend"><span><i className="line" style={{ background: 'var(--green)' }} />B2B contribution</span><span><i className="line" style={{ background: 'var(--fin-gold)' }} />B2C contribution</span></span>
          </h3>
          <LineChart labels={wk.labels} series={[{ name: 'B2B contribution', color: 'var(--green)', values: wk.b2b }, { name: 'B2C contribution', color: 'var(--fin-gold)', values: wk.b2c }]} />
          <p className="small muted" style={{ margin: '6px 0 0' }}>Weekly, by order completion date. Period total: B2B {inr(cur.cB2B)}, B2C {inr(cur.cB2C)}.</p>
        </div>
      </div>

      <h2 className="fin-section">Financial and fulfilment details</h2>
      <div className="fin-grid half">
        <div className="fin-card">
          <h3>Farmer settlement status <Link href="/admin/settlements" className="small">Pay farmers</Link></h3>
          <div className="fin-split">
            <div><div className="k">Pending settlements</div><div className="v">{compact(bal.farmerDue)}{bal.overdueN ? <span className="fin-flag bad">{bal.overdueN} overdue</span> : null}</div></div>
            <div><div className="k">Paid this period</div><div className="v">{compact(st.paid)}</div></div>
            <div><div className="k">In complaint window</div><div className="v">{compact(bal.accruing)}</div></div>
          </div>
          <div className="table-wrap" style={{ border: 0 }}><table>
            <thead><tr><th>Recent payouts</th><th className="r">Payout</th><th>Status</th></tr></thead>
            <tbody>{st.recent.length ? st.recent.map((r: any, i: number) => (
              <tr key={i}><td>{r.name}{r.state ? ` (${r.state === 'Telangana' ? 'TG' : 'AP'})` : ''}</td><td className="r num">{inr(Number(r.amount))}</td>
                <td><Chip s={r.status === 'Paid' ? 'paid' : r.status === 'On hold' ? 'rejected' : 'pending'} label={r.status} /></td></tr>
            )) : <tr><td colSpan={3} className="muted">No payouts yet.</td></tr>}</tbody>
          </table></div>
        </div>
        <div className="fin-card">
          <h3>Order economics <Link href={`/admin/finance/orders?${qs}`} className="small">All orders</Link></h3>
          <Equation who="B2C order" avg={inr(avg(c, (o) => o.gmv))} parts={[
            { k: 'Comm', v: avg(c, (o) => o.commission), tone: 'mint' }, { k: 'Deliv', v: avg(c, (o) => o.delivery_fee), tone: 'sand', op: '+' },
            { k: 'Pack', v: avg(c, (o) => o.service_fee), tone: 'sand', op: '+' }, { k: 'Cost', v: avg(c, (o) => o.variable), tone: 'rose', op: '−' },
            { k: 'Contribution', v: avg(c, (o) => o.contribution), tone: 'result', op: '=' }]} />
          <Equation who="B2B order" avg={inr(avg(b, (o) => o.gmv))} parts={[
            { k: 'Comm', v: avg(b, (o) => o.commission), tone: 'mint' }, { k: 'Log', v: avg(b, (o) => o.delivery_fee), tone: 'sand', op: '+' },
            { k: 'Serv', v: avg(b, (o) => o.service_fee), tone: 'sand', op: '+' }, { k: 'Cost', v: avg(b, (o) => o.variable), tone: 'rose', op: '−' },
            { k: 'Contribution', v: avg(b, (o) => o.contribution), tone: 'result', op: '=' }]} />
          <p className="small muted" style={{ margin: '6px 0 0' }}>Average per completed order: {c.length} household and {b.length} business orders. Cost = delivery partner + packing + gateway + refunds the platform bears.</p>
        </div>
      </div>

      <h2 className="fin-section">Cash and alerts</h2>
      <div className="fin-grid even">
        <div className="fin-card">
          <h3>Alerts</h3>
          {warn.map((a, i) => (
            <div key={i} className="row small" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
              <span><span className={`chip chip-${a.level}`}>{a.level === 'bad' ? 'Act now' : a.level === 'warn' ? 'Check' : 'OK'}</span> {a.text}</span>
              {a.href ? <Link href={a.href}>Open</Link> : null}
            </div>
          ))}
        </div>
        <div className="fin-card">
          <h3>Cash position <Link href="/admin/finance/pnl#assumptions" className="small">Opening balance</Link></h3>
          <dl className="kv">
            <dt>Estimated bank balance</dt><dd className="num"><b>{inr(bal.bank)}</b></dd>
            <dt>Held for farmers</dt><dd className="num">−{inr(bal.heldForFarmers)}</dd>
            <dt>Company cash (own)</dt><dd className="num"><b className={bal.ownCash < bal.reserve ? 'neg' : ''}>{inr(bal.ownCash)}</b></dd>
            <dt>Minimum reserve</dt><dd className="num">{inr(bal.reserve)}</dd>
            <dt>Business receivables</dt><dd className="num"><Link href="/admin/finance/receivables">{inr(bal.receivables)}</Link></dd>
          </dl>
          <p className="small muted" style={{ margin: '8px 0 0' }}>Estimated from recorded money movements since {bal.openingDate}. Reconcile with the bank statement each month.</p>
        </div>
      </div>
    </>
  );
}
