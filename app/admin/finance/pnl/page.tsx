import { Suspense } from 'react';
import { query } from '@/lib/db';
import { Flash } from '@/components/ui';
import { CATEGORIES, filterOptions, filtersFrom, getFinanceSettings, inr, monthKey, monthLabel, monthStatement, periodFrom, shiftMonth, type Month } from '@/lib/finance';
import FinanceHeader from '../FinanceHeader';
import { requireFinance } from '../guard';
import { saveFinanceSettings, setFinanceRole } from '../actions';

export const metadata = { title: 'P&L statement · Finance' };

export default async function PnlPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { user, role } = await requireFinance('pnl');
  const sp = await searchParams;
  const p = periodFrom(sp);
  const m = /^\d{4}-\d{2}$/.test(p) ? p : monthKey();
  const f = filtersFrom(sp);
  const filtered = !!(f.channel || f.state || f.district || f.crop);
  const [cur, opts, fs] = await Promise.all([monthStatement(m, f), filterOptions(), getFinanceSettings()]);
  const history: Month[] = await Promise.all(Array.from({ length: 6 }, (_, i) => monthStatement(shiftMonth(m, i - 5), f)));
  const admins = role === 'founder'
    ? await query("SELECT u.id, u.name, u.phone, coalesce(fr.role,'founder') AS role FROM users u LEFT JOIN finance_roles fr ON fr.user_id=u.id WHERE u.role='admin' ORDER BY u.name")
    : [];
  const g = cur.gmv || 1;
  const per100 = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(v / g * 100).toFixed(2)}`;

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
    <>
      <Suspense><FinanceHeader title="Profit and loss statement" exportReport="pnl" {...opts}
        sub={<>Six months to {monthLabel(m)}{m === monthKey() ? ' (month to date)' : ''}. Accrual basis: completed orders and approved expenses.{filtered ? ` Fixed costs allocated by revenue share.` : ''}</>} /></Suspense>
      <Flash sp={sp} />
      <section className="section">
        <div className="section-head"><h2>Profit and loss</h2><span className="small muted">Accrual basis, completed orders, approved expenses</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th></th>{history.map((h) => <th key={h.m} className="r">{monthLabel(h.m)}</th>)}</tr></thead>
          <tbody>{pl.map(([label, fn, cls]) => (
            <tr key={label} className={cls}>
              <td>{label}</td>
              {history.map((h) => { const v = fn(h); return <td key={h.m} className="r num" style={v < 0 ? { color: 'var(--chilli)' } : undefined}>{inr(v)}</td>; })}
            </tr>
          ))}</tbody>
        </table></div>
        <p className="small muted" style={{ marginTop: 8 }}>GMV is a memo line. The company acts as the farmers&apos; agent, so only its commission and its own service fees are revenue. Confirm this treatment with the chartered accountant before filing.</p>
      </section>

      <div className="grid2 section">
        <div className="fin-card">
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
      </div>
      <div className="grid2 section" id="assumptions">
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
    </>
  );
}
