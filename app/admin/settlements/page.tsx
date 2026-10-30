import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { DUE_SQL } from '@/lib/money';
import { payFarmerAction, setPayoutHold } from '@/lib/actions/admin';
import AdminNav from '@/components/AdminNav';
import { Empty, Flash, PageHead, fmtMoney, fmtTime } from '@/components/ui';

export const metadata = { title: 'Settlements · Ops' };

export default async function Settlements({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser('admin');
  const sp = await searchParams;
  const due = await query(
    `SELECT d.*, u.name, fp.upi_id, fp.bank_last4, fp.bank_ifsc, fp.payout_hold FROM (${DUE_SQL} GROUP BY s.farmer_id) d
       JOIN users u ON u.id=d.farmer_id JOIN farmer_profiles fp ON fp.user_id=d.farmer_id ORDER BY d.net DESC`);
  const accruing = await query(
    `SELECT u.name, sum(s.items_total - s.commission - s.deductions) AS net, count(*)::int AS n FROM sub_orders s JOIN orders o ON o.id=s.order_id JOIN users u ON u.id=s.farmer_id
      WHERE s.status='delivered' AND o.status='delivered' AND s.settlement_id IS NULL GROUP BY u.name`);
  const history = await query('SELECT st.*, u.name FROM settlements st JOIN users u ON u.id=st.farmer_id ORDER BY st.created_at DESC LIMIT 50');
  return (
    <main className="wrap">
      <AdminNav current="/admin/settlements" />
      <PageHead title="Farmer settlements" sub="Earnings become due when an order completes (delivered and the complaint window closed). Pay by bank or UPI, then record the UTR." />
      <Flash sp={sp} />
      <h2>Due now</h2>
      {!due.length ? <Empty>Nothing due.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Farmer</th><th>Pay to</th><th className="r">Sub-orders</th><th className="r">Gross</th><th className="r">Commission</th><th className="r">Deductions</th><th className="r">Net</th><th>Pay</th><th>Hold</th></tr></thead>
          <tbody>{due.map((d) => (
            <tr key={d.farmer_id}>
              <td><b>{d.name}</b></td>
              <td className="small">{d.upi_id || (d.bank_last4 ? `••••${d.bank_last4} ${d.bank_ifsc}` : 'missing')}</td>
              <td className="r">{d.sub_orders}</td><td className="r num">{fmtMoney(d.gross)}</td><td className="r num">{fmtMoney(d.commission)}</td><td className="r num">{fmtMoney(d.deductions)}</td>
              <td className="r num"><b>{fmtMoney(d.net)}</b></td>
              <td>{d.payout_hold ? <span className="small" style={{ color: 'var(--chilli)' }}>On hold: {d.payout_hold}</span> : (
                <form action={payFarmerAction} className="row" style={{ flexWrap: 'nowrap' }}>
                  <input type="hidden" name="farmer_id" value={d.farmer_id} />
                  <input name="utr" placeholder="UTR" style={{ minHeight: 36, padding: '4px 8px', width: 130 }} aria-label="UTR" />
                  <button className="btn btn-sm">Mark paid</button>
                </form>
              )}</td>
              <td>
                <form action={setPayoutHold} className="row" style={{ flexWrap: 'nowrap' }}>
                  <input type="hidden" name="farmer_id" value={d.farmer_id} />
                  <input name="hold" defaultValue={d.payout_hold} placeholder="Reason" style={{ minHeight: 36, padding: '4px 8px', width: 120 }} aria-label="Hold reason" />
                  <button className="btn btn-ghost btn-sm">{d.payout_hold ? 'Update' : 'Hold'}</button>
                </form>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {accruing.length > 0 && <p className="small muted" style={{ marginTop: 10 }}>In complaint window: {accruing.map((a) => `${a.name} ${fmtMoney(a.net)}`).join(' · ')}</p>}
      <section className="section">
        <h2>Paid</h2>
        {!history.length ? <Empty>No settlements yet.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>When</th><th>Farmer</th><th className="r">Orders</th><th className="r">Net</th><th>UTR</th></tr></thead>
            <tbody>{history.map((h) => <tr key={h.id}><td>{fmtTime(h.created_at)}</td><td>{h.name}</td><td className="r">{h.sub_order_count}</td><td className="r num">{fmtMoney(h.net)}</td><td>{h.utr}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </main>
  );
}
