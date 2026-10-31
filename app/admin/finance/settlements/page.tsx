import Link from 'next/link';
import { Suspense } from 'react';
import { query } from '@/lib/db';
import { DUE_SQL } from '@/lib/money';
import { Chip, fmtDate } from '@/components/ui';
import { balances, compact, filterOptions, inr, periodFrom, periodLabel, periodRange, settlementPanel } from '@/lib/finance';
import FinanceHeader from '../FinanceHeader';
import { requireFinance } from '../guard';

export const metadata = { title: 'Farmer settlements · Finance' };

export default async function FinanceSettlements({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireFinance('settlements');
  const sp = await searchParams;
  const p = periodFrom(sp);
  const [a, b] = periodRange(p);
  const [bal, st, opts] = await Promise.all([balances(), settlementPanel(p), filterOptions()]);
  const due = await query(`SELECT d.*, u.name, fp.district, fp.state, fp.payout_hold FROM (${DUE_SQL} GROUP BY s.farmer_id) d
    JOIN users u ON u.id=d.farmer_id LEFT JOIN farmer_profiles fp ON fp.user_id=d.farmer_id ORDER BY d.net DESC`);
  const paid = await query(`SELECT st.*, u.name, fp.district, fp.state FROM settlements st JOIN users u ON u.id=st.farmer_id LEFT JOIN farmer_profiles fp ON fp.user_id=st.farmer_id
    WHERE st.status='paid' AND st.paid_at >= $1::date AND st.paid_at < $2::date ORDER BY st.paid_at DESC`, [a, b]);
  return (
    <>
      <Suspense><FinanceHeader title="Farmer settlements" exportReport="settlements" {...opts}
        sub={<>Farmer money is tracked apart from company money. Earnings fall due when an order completes and should be paid within {st.slaDays} days. <Link href="/admin/settlements">Pay farmers and record UTRs</Link>.</>} /></Suspense>
      <div className="fin-card">
        <div className="fin-split" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
          <div><div className="k">Pending settlements</div><div className="v">{compact(bal.farmerDue)}</div></div>
          <div><div className="k">Overdue</div><div className="v">{compact(bal.overdue)}{bal.overdueN ? <span className="fin-flag bad">{bal.overdueN} farmers</span> : null}</div></div>
          <div><div className="k">Paid, {periodLabel(p).toLowerCase()}</div><div className="v">{compact(st.paid)}</div></div>
          <div><div className="k">In complaint window</div><div className="v">{compact(bal.accruing)}</div></div>
        </div>
      </div>
      <h2 className="fin-section">Due now</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Farmer</th><th>Location</th><th className="r">Sub-orders</th><th className="r">Crop sales</th><th className="r">Commission</th><th className="r">Deductions</th><th className="r">Net payable</th><th>Status</th></tr></thead>
        <tbody>{due.length ? due.map((d) => (
          <tr key={d.farmer_id}><td>{d.name}</td><td className="small">{[d.district, d.state].filter(Boolean).join(', ')}</td><td className="r num">{d.sub_orders}</td>
            <td className="r num">{inr(d.gross)}</td><td className="r num">−{inr(d.commission, 2)}</td><td className="r num">{Number(d.deductions) ? `−${inr(d.deductions)}` : '–'}</td><td className="r num"><b>{inr(d.net, 2)}</b></td>
            <td>{d.payout_hold ? <Chip s="rejected" label={`On hold: ${d.payout_hold}`} /> : <Chip s="pending" label="Due" />}</td></tr>
        )) : <tr><td colSpan={8} className="muted">Nothing due.</td></tr>}</tbody>
      </table></div>
      <h2 className="fin-section">Paid, {periodLabel(p).toLowerCase()}</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Paid on</th><th>Farmer</th><th>Location</th><th className="r">Sub-orders</th><th className="r">Gross</th><th className="r">Commission</th><th className="r">Net paid</th><th>UTR</th></tr></thead>
        <tbody>{paid.length ? paid.map((s) => (
          <tr key={s.id}><td>{fmtDate(s.paid_at)}</td><td>{s.name}</td><td className="small">{[s.district, s.state].filter(Boolean).join(', ')}</td><td className="r num">{s.sub_order_count}</td>
            <td className="r num">{inr(s.gross)}</td><td className="r num">−{inr(s.commission, 2)}</td><td className="r num">{inr(s.net, 2)}</td><td className="small">{s.utr}</td></tr>
        )) : <tr><td colSpan={8} className="muted">No payouts in this period.</td></tr>}</tbody>
      </table></div>
    </>
  );
}
