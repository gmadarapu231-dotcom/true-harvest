'use client';
import { useState } from 'react';
import { PRESETS, project, simulate, type Assumptions } from './model';

const FIELDS: [string, [keyof Assumptions, string, number][]][] = [
  ['Volume', [['b2cDay', 'Household orders per day', 1], ['b2bDay', 'Business orders per day', 1], ['days', 'Operating days per month', 1], ['growth', 'Monthly order growth (%)', 0.5]]],
  ['Household order (₹)', [['b2cAov', 'Average order value', 10], ['b2cComm', 'Commission (%)', 0.5], ['b2cDel', 'Delivery fee charged', 1], ['b2cDelCost', 'Delivery partner cost', 1], ['b2cPackFee', 'Packing fee charged', 1], ['b2cPackCost', 'Packing cost', 1], ['b2cPay', 'Payment processing', 1]]],
  ['Business order (₹)', [['b2bAov', 'Average order value', 500], ['b2bComm', 'Commission (%)', 0.5], ['b2bLog', 'Logistics fee charged', 10], ['b2bLogCost', 'Transporter payment', 10], ['b2bGrade', 'Grading and handling fee', 10], ['b2bHandle', 'Handling cost', 10], ['b2bPay', 'Payment and transaction cost', 5]]],
  ['Subscriptions', [['subN', 'Paying businesses', 1], ['subPrice', 'Price per month', 100], ['subCost', 'Servicing cost per business', 10]]],
  ['Fixed costs per month (₹)', [['salaries', 'Salaries', 5000], ['marketing', 'Marketing', 5000], ['otherFixed', 'Technology, rent and admin', 5000], ['cash', 'Cash available today', 50000]]],
];
const inr = (n: number, d = 0) => `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d })}`;
const lakh = (n: number) => (Math.abs(n) >= 1e5 ? `${n < 0 ? '−' : ''}₹${(Math.abs(n) / 1e5).toFixed(2)} L` : inr(n));

export default function Simulator({ start }: { start: Assumptions }) {
  const [a, setA] = useState<Assumptions>(start);
  const r = simulate(a);
  const proj = project(a);
  const low = Math.min(a.cash, ...proj.map((p) => p.cash));
  const out = proj.findIndex((p) => p.cash < 0);
  const firstProfit = proj.find((p) => p.op >= 0);
  const rows: [string, number, boolean?][] = [['Household GMV', r.gmvC], ['Business GMV', r.gmvB], ['Total monthly GMV', r.gmv, true], ['Platform revenue', r.rev], ['Household contribution', r.contribC], ['Business contribution', r.contribB], ['Subscription contribution', r.contribS], ['Total contribution', r.contrib, true], ['Fixed expenses', -r.fixed], ['Monthly operating result', r.op, true]];

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <span className="small muted">Start from:</span>
        {Object.entries(PRESETS).map(([k, p]) => <button key={k} type="button" className="btn btn-sm btn-ghost" onClick={() => setA(p.a)}>{p.label}</button>)}
      </div>
      <div className="grid2">
        <div className="card form">
          {FIELDS.map(([group, fs]) => (
            <fieldset key={group} style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
              <legend className="small muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{group}</legend>
              <div className="grid2">{fs.map(([k, label, step]) => (
                <label key={k}>{label}<input type="number" min="0" step={step} value={a[k]} onChange={(e) => setA({ ...a, [k]: parseFloat(e.target.value) || 0 })} /></label>
              ))}</div>
            </fieldset>
          ))}
        </div>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="small muted">Monthly operating result</div>
            <div className="stat-value num" style={{ color: r.op >= 0 ? 'var(--green)' : 'var(--chilli)', fontSize: '2rem' }}>{inr(r.op)}</div>
            <div className="table-wrap" style={{ marginTop: 10 }}><table><tbody>
              {rows.map(([l, v, b]) => <tr key={l} style={b ? { fontWeight: 700 } : undefined}><td>{l}</td><td className="r num" style={v < 0 ? { color: 'var(--chilli)' } : undefined}>{inr(v)}</td></tr>)}
            </tbody></table></div>
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Contribution per household order</dt><dd className="num">{inr(r.cPer, 1)}</dd>
              <dt>Contribution per business order</dt><dd className="num">{inr(r.bPer)}</dd>
              <dt>Break-even household orders/day</dt><dd className="num">{Number.isFinite(r.beC) ? Math.ceil(r.beC) : 'not reachable'} <span className="small muted">(business held at {a.b2bDay}/day)</span></dd>
              <dt>Break-even business orders/day</dt><dd className="num">{Number.isFinite(r.beB) ? Math.ceil(r.beB) : 'not reachable'} <span className="small muted">(households held at {a.b2cDay}/day)</span></dd>
              <dt>Take rate</dt><dd className="num">{(r.takeRate * 100).toFixed(2)}% of GMV</dd>
              <dt>Contribution margin</dt><dd className="num">{(r.margin * 100).toFixed(1)}% of revenue</dd>
            </dl>
          </div>
          <div className="card">
            <h2>12-month cash outlook</h2>
            <p className={`flash ${out >= 0 ? 'flash-error' : 'flash-ok'}`} style={{ margin: '0 0 10px' }}>
              {out >= 0 ? `Cash runs out in month ${out + 1}; you would need about ${lakh(-low)} more.` : `Cash stays above ${lakh(low)}.`}{' '}
              {firstProfit ? `First profitable month: ${firstProfit.m}.` : 'No profitable month within 12 months.'}
            </p>
            <div className="table-wrap"><table>
              <thead><tr><th>Month</th><th className="r">GMV</th><th className="r">Revenue</th><th className="r">Contribution</th><th className="r">Operating result</th><th className="r">Cash</th></tr></thead>
              <tbody>{proj.map((p) => <tr key={p.m}><td>{p.m}</td><td className="r num">{lakh(p.gmv)}</td><td className="r num">{lakh(p.rev)}</td><td className="r num">{lakh(p.contrib)}</td><td className="r num" style={p.op < 0 ? { color: 'var(--chilli)' } : undefined}>{lakh(p.op)}</td><td className="r num" style={p.cash < 0 ? { color: 'var(--chilli)' } : undefined}>{lakh(p.cash)}</td></tr>)}</tbody>
            </table></div>
          </div>
        </div>
      </div>
    </>
  );
}
