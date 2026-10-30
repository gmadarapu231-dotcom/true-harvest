import Link from 'next/link';
import { query } from '@/lib/db';
import AdminNav from '@/components/AdminNav';
import { Flash, PageHead, Stat } from '@/components/ui';
import { alerts, balances, CATEGORIES, compact, filterOptions, filtersFrom, getFinanceSettings, inr, monthKey, monthLabel, monthStatement, shiftMonth, type Month } from '@/lib/finance';
import FinanceNav, { FilterBar } from './FinanceNav';
import { requireFinance } from './guard';
import { saveFinanceSettings, setFinanceRole } from './actions';

export const metadata = { title: 'Finance · Ops' };

function change(cur: number, prev: number, lowerIsBetter = false) {
  if (!prev) return 'no previous month';
  const c = (cur - prev) / Math.abs(prev);
  const good = lowerIsBetter ? c <= 0 : c >= 0;
  return `${c >= 0 ? '▲' : '▼'} ${Math.abs(c * 100).toFixed(1)}% vs last month${Math.abs(c) > 0.005 ? (good ? '' : ' ⚠') : ''}`;
}

export default async function FinanceOverview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { user, role } = await requireFinance('overview');
  const sp = await searchParams;
  const m = /^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m : monthKey();
  const f = filtersFrom(sp);
  const filtered = !!(f.channel || f.state || f.district);
  const [cur, prev, opts, bal, fs] = await Promise.all([monthStatement(m, f), monthStatement(shiftMonth(m, -1), f), filterOptions(), balances(), getFinanceSettings()]);
  const history: Month[] = await Promise.all(Array.from({ length: 6 }, (_, i) => monthStatement(shiftMonth(m, i - 5), f)));
  const warn = await alerts(cur, bal);
  const admins = role === 'founder'
    ? await query("SELECT u.id, u.name, u.phone, coalesce(fr.role,'founder') AS role FROM users u LEFT JOIN finance_roles fr ON fr.user_id=u.id WHERE u.role='admin' ORDER BY u.name")
    : [];
  const g = cur.gmv || 1;
  const per100 = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(v / g * 100).toFixed(2)}`;
  const liabilities = bal.farmerDue + bal.accruing;

  const pl: [string, (x: Month) => number, string?][] = [
    ['GMV (memo, not revenue)', (x) => x.gmv, 'memo'],
    ['Commission revenue', (x) => x.commission, 'indent'], ['Delivery fees', (x) => x.deliveryFees, 'indent'], ['Packing and grading fees', (x) => x.serviceFees, 'indent'],
    ['Recognised platform revenue', (x) => x.revenue, 'sub'],
    ['Delivery partner costs', (x) => -x.partner, 'indent'], ['Packing and handling', (x) => -x.packing, 'indent'], ['Payment gateway fees', (x) => -x.gateway, 'indent'], ['Refunds borne by platform', (x) => -x.refunds, 'indent'],
    ['Gross profit (contribution)', (x) => x.contribution, 'sub'],
    ...CATEGORIES.map((c): [string, (x: Month) => number, string] => [`${c} expenses`, (x) => -x.opex[c], 'indent']),
    ['EBITDA', (x) => x.ebitda, 'sub'], ['Depreciation', (x) => -x.depreciation, 'indent'], ['Profit before tax', (x) => x.pbt, 'sub'],
    [`Income tax (${(fs.tax_rate * 100).toFixed(2)}%)`, (x) => -x.tax, 'indent'], ['Net profit after tax', (x) => x.npat, 'total'],
  ];

  return (
    <main className="wrap">
      <AdminNav current="/admin/finance" />
      <FinanceNav current="/admin/finance" role={role} />
      <PageHead title="Finance overview" sub={`${monthLabel(m)}${m === monthKey() ? ', month to date' : ''}. GMV, revenue, contribution and profit are kept separate: produce sold is not money earned.`} />
      <Flash sp={sp} />
      <FilterBar path="/admin/finance" sp={{ ...sp, m }} {...opts} />
      <p className="small muted">Every figure comes from {cur.n} completed orders{filtered ? ` matching the filters; fixed costs are allocated by revenue share (${(cur.share * 100).toFixed(1)}%)` : ''} and approved expenses. Click a tile to see its records.</p>

      <div className="stats">
        <Stat label="Total GMV" value={compact(cur.gmv)} hint={change(cur.gmv, prev.gmv)} href={`/admin/finance/orders?m=${m}`} />
        <Stat label="Platform revenue" value={compact(cur.revenue)} hint={change(cur.revenue, prev.revenue)} href={`/admin/finance/orders?m=${m}`} />
        <Stat label="Contribution" value={compact(cur.contribution)} hint={`${cur.revenue ? (cur.contribution / cur.revenue * 100).toFixed(1) : 0}% of revenue · ${change(cur.contribution, prev.contribution)}`} href={`/admin/finance/orders?m=${m}`} />
        <Stat label="Net profit after tax" value={compact(cur.npat)} hint={change(cur.npat, prev.npat)} />
        <Stat label="Marketplace commission" value={compact(cur.commission)} hint={`Take rate ${cur.gmv ? (cur.commission / cur.gmv * 100).toFixed(2) : 0}% of GMV`} />
        <Stat label="Logistics revenue" value={compact(cur.deliveryFees)} hint={change(cur.deliveryFees, prev.deliveryFees)} />
        <Stat label="Service revenue" value={compact(cur.serviceFees)} hint="Packing and grading fees" />
        <Stat label="Variable costs" value={compact(cur.variable)} hint={change(cur.variable, prev.variable, true)} href={`/admin/finance/orders?m=${m}`} />
        <Stat label="Operating expenses" value={compact(cur.opexTotal)} hint={change(cur.opexTotal, prev.opexTotal, true)} href="/admin/finance/expenses" />
        <Stat label="EBITDA" value={compact(cur.ebitda)} hint={change(cur.ebitda, prev.ebitda)} />
        <Stat label="Bank balance (estimated)" value={compact(bal.bank)} hint="Includes money held for farmers" />
        <Stat label="Company cash (own)" value={compact(bal.ownCash)} hint="Bank minus collected farmer money" />
        <Stat label="Farmer payments pending" value={compact(bal.farmerDue)} hint={`${bal.overdueN} overdue · ${compact(bal.accruing)} accruing`} href="/admin/settlements" />
        <Stat label="Business receivables" value={compact(bal.receivables)} hint="Delivered, not yet paid" href="/admin/orders" />
        <Stat label="Outstanding liabilities" value={compact(liabilities)} hint="Farmer payouts due + accruing" href="/admin/settlements" />
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Where ₹100 of GMV goes</h2>
          <dl className="kv">
            <dt>Paid to farmers</dt><dd className="num">{per100(cur.gmv - cur.commission)}</dd>
            <dt>Commission kept</dt><dd className="num">{per100(cur.commission)}</dd>
            <dt>Fees charged on top</dt><dd className="num">+{per100(cur.deliveryFees + cur.serviceFees)}</dd>
            <dt>Variable costs</dt><dd className="num">{per100(-cur.variable)}</dd>
            <dt><b>Contribution</b></dt><dd className="num"><b>{per100(cur.contribution)}</b></dd>
            <dt>Fixed costs and tax</dt><dd className="num">{per100(-(cur.opexTotal + cur.depreciation + cur.tax))}</dd>
            <dt><b>Net profit</b></dt><dd className="num"><b>{per100(cur.npat)}</b></dd>
          </dl>
        </div>
        <div className="card">
          <h2>Alerts</h2>
          {warn.map((a, i) => (
            <div key={i} className="row small" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span><span className={`chip chip-${a.level === 'ok' ? 'ok' : a.level}`}>{a.level === 'bad' ? 'Act now' : a.level === 'warn' ? 'Check' : 'OK'}</span> {a.text}</span>
              {a.href ? <Link href={a.href}>Open</Link> : null}
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Contribution by channel</h2>
          <div className="bars">
            {([['Households', cur.cB2C, cur.nB2C], ['Businesses', cur.cB2B, cur.nB2B]] as const).map(([l, v, n]) => {
              const max = Math.max(1, Math.abs(cur.cB2C), Math.abs(cur.cB2B));
              return <div key={l} className="bar"><span>{l}</span><span className="track"><span className="fill" style={{ display: 'block', width: `${Math.abs(v) / max * 100}%`, background: v < 0 ? 'var(--chilli)' : undefined }} /></span><span className="num r">{compact(v)}</span></div>;
            })}
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Per order: households {inr(cur.nB2C ? cur.cB2C / cur.nB2C : 0, 1)} ({cur.nB2C} orders), businesses {inr(cur.nB2B ? cur.cB2B / cur.nB2B : 0)} ({cur.nB2B} orders).
          </p>
        </div>
        <div className="card">
          <h2>Cash position</h2>
          <dl className="kv">
            <dt>Opening balance ({bal.openingDate})</dt><dd className="num">{inr(bal.openingCash)}</dd>
            <dt>Collected from buyers</dt><dd className="num">+{inr(bal.collected)}</dd>
            <dt>Paid to farmers</dt><dd className="num">−{inr(bal.farmersPaid)}</dd>
            <dt>Delivery, packing, gateway</dt><dd className="num">−{inr(bal.orderCosts)}</dd>
            <dt>Expenses paid</dt><dd className="num">−{inr(bal.expensesPaid)}</dd>
            <dt><b>Estimated bank balance</b></dt><dd className="num"><b>{inr(bal.bank)}</b></dd>
            <dt>Held for farmers</dt><dd className="num">−{inr(bal.heldForFarmers)}</dd>
            <dt><b>Company cash (own)</b></dt><dd className="num"><b>{inr(bal.ownCash)}</b></dd>
          </dl>
          <p className="small muted" style={{ marginTop: 8 }}>Estimated from recorded money movements. Reconcile against the bank statement each month.</p>
        </div>
      </div>

      <section className="section">
        <div className="section-head"><h2>Profit and loss</h2><span className="small muted">Accrual basis, completed orders, approved expenses</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th></th>{history.map((h) => <th key={h.m} className="r">{monthLabel(h.m)}</th>)}</tr></thead>
          <tbody>{pl.map(([label, fn, cls]) => (
            <tr key={label} style={cls === 'sub' || cls === 'total' ? { fontWeight: 700, background: '#f6f3ea' } : cls === 'memo' ? { color: 'var(--ink-2)', fontStyle: 'italic' } : undefined}>
              <td style={cls === 'indent' ? { paddingLeft: 26 } : undefined}>{label}</td>
              {history.map((h) => { const v = fn(h); return <td key={h.m} className="r num" style={v < 0 ? { color: 'var(--chilli)' } : undefined}>{inr(v)}</td>; })}
            </tr>
          ))}</tbody>
        </table></div>
        <p className="small muted" style={{ marginTop: 8 }}>GMV is a memo line. The company acts as the farmers&apos; agent, so only its commission and its own service fees are revenue. Confirm this treatment with the chartered accountant before filing.</p>
      </section>

      <div className="grid2 section">
        <form action={saveFinanceSettings} className="card form">
          <h2>Finance assumptions</h2>
          <div className="grid2">
            <label>Opening bank balance (₹)<input name="opening_cash" type="number" step="1" min="0" defaultValue={fs.opening_cash} /></label>
            <label>Balance date<input name="opening_cash_date" type="date" defaultValue={fs.opening_cash_date} /></label>
            <label>Minimum cash reserve (₹)<input name="min_cash_reserve" type="number" min="0" defaultValue={fs.min_cash_reserve} /></label>
            <label>Depreciation per month (₹)<input name="depreciation_monthly" type="number" min="0" defaultValue={fs.depreciation_monthly} /></label>
            <label>Household delivery cost per drop (₹)<input name="b2c_partner_cost_per_drop" type="number" step="0.5" min="0" defaultValue={fs.b2c_partner_cost_per_drop} /></label>
            <label>Business transport cost per kg (₹)<input name="b2b_partner_cost_per_kg" type="number" step="0.01" min="0" defaultValue={fs.b2b_partner_cost_per_kg} /></label>
            <label>Household packing cost (₹/order)<input name="b2c_packing_cost" type="number" step="0.5" min="0" defaultValue={fs.b2c_packing_cost} /></label>
            <label>Business handling cost per kg (₹)<input name="b2b_handling_cost_per_kg" type="number" step="0.01" min="0" defaultValue={fs.b2b_handling_cost_per_kg} /></label>
            <label>Gateway fee (fraction of online payment)<input name="gateway_fee_pct" type="number" step="0.001" min="0" defaultValue={fs.gateway_fee_pct} /></label>
            <label>Settlement due after (days)<input name="settlement_sla_days" type="number" min="0" defaultValue={fs.settlement_sla_days} /></label>
          </div>
          <p className="small muted">Standard costs apply only to orders with no actual cost recorded yet.</p>
          <button className="btn">Save assumptions</button>
        </form>
        {role === 'founder' && (
          <div className="card">
            <h2>Who can see finance</h2>
            <p className="small muted">Founder and finance see everything. Operations and sales see order economics only.</p>
            {admins.map((a) => (
              <form key={a.id} action={setFinanceRole} className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
                <input type="hidden" name="user_id" value={a.id} />
                <span>{a.name || a.phone}{a.id === user.id ? ' (you)' : ''}</span>
                <span className="row">
                  <select name="role" defaultValue={a.role} aria-label={`Finance role for ${a.name}`}>
                    <option value="founder">Founder / admin</option><option value="finance">Finance manager</option><option value="ops">Operations manager</option><option value="sales">Sales manager</option>
                  </select>
                  <button className="btn btn-ghost btn-sm">Save</button>
                </span>
              </form>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
