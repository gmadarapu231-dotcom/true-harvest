import AdminNav from '@/components/AdminNav';
import { Chip, Empty, Flash, PageHead, fmtDate } from '@/components/ui';
import { query } from '@/lib/db';
import { CATEGORIES, inr, monthKey, monthLabel, monthRange, shiftMonth } from '@/lib/finance';
import FinanceNav from '../FinanceNav';
import { requireFinance } from '../guard';
import { addExpense, decideExpense, saveBudgets } from '../actions';

export const metadata = { title: 'Expenses · Finance' };

export default async function Expenses({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { role } = await requireFinance('expenses');
  const sp = await searchParams;
  const m = /^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m : monthKey();
  const [a, b] = monthRange(m);
  const [pa, pb] = monthRange(shiftMonth(m, -1));
  const [rows, budgets, byCat, prevCat, pending] = await Promise.all([
    query("SELECT e.*, u.name AS by_name FROM finance_expenses e LEFT JOIN users u ON u.id=e.created_by WHERE spent_on >= $1 AND spent_on < $2 ORDER BY spent_on DESC, id DESC", [a, b]),
    query('SELECT category, monthly FROM finance_budgets'),
    query("SELECT category, sum(amount) AS v FROM finance_expenses WHERE status='approved' AND spent_on >= $1 AND spent_on < $2 GROUP BY category", [a, b]),
    query("SELECT category, sum(amount) AS v FROM finance_expenses WHERE status='approved' AND spent_on >= $1 AND spent_on < $2 GROUP BY category", [pa, pb]),
    query("SELECT e.*, u.name AS by_name FROM finance_expenses e LEFT JOIN users u ON u.id=e.created_by WHERE e.status='pending' ORDER BY e.spent_on"),
  ]);
  const val = (list: any[], c: string, k = 'v') => Number(list.find((x) => x.category === c)?.[k]) || 0;
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(monthKey(), -i));
  const totals = { v: CATEGORIES.reduce((t, c) => t + val(byCat, c), 0), p: CATEGORIES.reduce((t, c) => t + val(prevCat, c), 0), b: CATEGORIES.reduce((t, c) => t + val(budgets, c, 'monthly'), 0) };

  return (
    <main className="wrap">
      <AdminNav current="/admin/finance" />
      <FinanceNav current="/admin/finance/expenses" role={role} />
      <PageHead title="Expenses" sub="Company operating costs. Per-order costs (delivery partners, packing, gateway fees) are on Order economics." />
      <Flash sp={sp} />
      <form method="get" className="row" style={{ marginBottom: 14 }}>
        <label className="small">Month <select name="m" defaultValue={m}>{months.map((x) => <option key={x} value={x}>{monthLabel(x)}</option>)}</select></label>
        <button className="btn btn-sm btn-ghost">Show</button>
      </form>

      {pending.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h2>Waiting for approval</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th>Category</th><th>Item</th><th>Vendor</th><th className="r">Amount</th><th className="r">GST</th><th>Added by</th><th></th></tr></thead>
            <tbody>{pending.map((e) => (
              <tr key={e.id}><td>{fmtDate(e.spent_on)}</td><td>{e.category}</td><td>{e.item}</td><td>{e.vendor}</td><td className="r num">{inr(e.amount)}</td><td className="r num">{inr(e.gst)}</td><td className="small">{e.by_name}</td>
                <td><span className="row" style={{ flexWrap: 'nowrap' }}>
                  <form action={decideExpense}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="approved" /><button className="btn btn-sm">Approve</button></form>
                  <form action={decideExpense}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="rejected" /><button className="btn btn-sm btn-ghost">Reject</button></form>
                </span></td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      <div className="grid2">
        <form action={saveBudgets} className="card">
          <h2>Budget vs actual, {monthLabel(m)}</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Category</th><th className="r">Actual</th><th className="r">Last month</th><th className="r">Monthly budget</th><th></th></tr></thead>
            <tbody>
              {CATEGORIES.map((c) => {
                const v = val(byCat, c), bud = val(budgets, c, 'monthly');
                return (
                  <tr key={c}><td>{c}</td><td className="r num">{inr(v)}</td><td className="r num">{inr(val(prevCat, c))}</td>
                    <td className="r"><input name={`budget_${c}`} type="number" min="0" step="500" defaultValue={bud} aria-label={`${c} budget`} style={{ width: 110, minHeight: 34, padding: '4px 8px', textAlign: 'right' }} /></td>
                    <td>{v > bud * 1.05 ? <Chip s="rejected" label="Over" /> : v > bud * 0.95 ? <Chip s="pending" label="On budget" /> : <Chip s="verified" label="Under" />}</td></tr>
                );
              })}
              <tr style={{ fontWeight: 700 }}><td>Total</td><td className="r num">{inr(totals.v)}</td><td className="r num">{inr(totals.p)}</td><td className="r num">{inr(totals.b)}</td><td></td></tr>
            </tbody>
          </table></div>
          <button className="btn btn-sm btn-ghost" style={{ marginTop: 10 }}>Save budgets</button>
        </form>

        <form action={addExpense} className="card form">
          <h2>Record an expense</h2>
          <div className="grid2">
            <label>Date<input name="spent_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
            <label>Category<select name="category" required>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>What for<input name="item" placeholder="Cloud hosting, salaries, rent…" required /></label>
            <label>Vendor<input name="vendor" placeholder="AWS India" /></label>
            <label>Amount before GST (₹)<input name="amount" type="number" step="0.01" min="0" required /></label>
            <label>GST (₹)<input name="gst" type="number" step="0.01" min="0" defaultValue={0} /></label>
            <label>Paid by<select name="payment_method"><option>Bank transfer</option><option>UPI</option><option>Corporate card</option><option>Cash</option></select></label>
            <label>Invoice number<input name="invoice_no" /></label>
          </div>
          <button className="btn">Add expense</button>
          <p className="small muted">New expenses wait for approval before they count in the P&amp;L.</p>
        </form>
      </div>

      <section className="section">
        <h2>Expense register, {monthLabel(m)}</h2>
        {!rows.length ? <Empty>No expenses recorded for this month.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th>Category</th><th>Item</th><th>Vendor</th><th className="r">Amount</th><th className="r">GST</th><th>Paid by</th><th>Invoice</th><th>Status</th></tr></thead>
            <tbody>{rows.map((e) => (
              <tr key={e.id}><td>{fmtDate(e.spent_on)}</td><td>{e.category}</td><td>{e.item}</td><td>{e.vendor}</td><td className="r num">{inr(e.amount)}</td><td className="r num">{e.gst ? inr(e.gst) : '–'}</td>
                <td>{e.payment_method}</td><td className="small">{e.invoice_no}</td><td><Chip s={e.status === 'approved' ? 'verified' : e.status === 'pending' ? 'pending' : 'rejected'} label={e.status} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </main>
  );
}
