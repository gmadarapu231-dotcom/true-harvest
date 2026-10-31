import { Suspense } from 'react';
import { fmtDate } from '@/components/ui';
import { compact, filterOptions, inr, receivables } from '@/lib/finance';
import FinanceHeader from '../FinanceHeader';
import { requireFinance } from '../guard';

export const metadata = { title: 'B2B receivables · Finance' };

export default async function Receivables() {
  await requireFinance('receivables');
  const [rows, opts] = await Promise.all([receivables(), filterOptions()]);
  const total = rows.reduce((t, r) => t + Number(r.total), 0);
  const over = rows.filter((r) => r.days > 7);
  return (
    <>
      <Suspense><FinanceHeader title="B2B receivables" exportReport="receivables" filters={false} {...opts}
        sub="Business orders that were delivered but not yet paid for. Farmers are paid within days, so every unpaid invoice is company cash tied up." /></Suspense>
      <div className="fin-card">
        <div className="fin-split">
          <div><div className="k">Outstanding</div><div className="v">{compact(total)}</div></div>
          <div><div className="k">Invoices</div><div className="v">{rows.length}</div></div>
          <div><div className="k">Older than 7 days</div><div className="v">{compact(over.reduce((t, r) => t + Number(r.total), 0))}{over.length ? <span className="fin-flag bad">{over.length} overdue</span> : null}</div></div>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: 16 }}><table>
        <thead><tr><th>Order</th><th>Business</th><th>GSTIN</th><th>Delivered</th><th className="r">Amount</th><th className="r">Days outstanding</th><th></th></tr></thead>
        <tbody>{rows.length ? rows.map((r) => (
          <tr key={r.order_no}><td>{r.order_no}</td><td>{r.buyer}</td><td className="small">{r.gstin || '–'}</td><td>{fmtDate(r.delivered_at)}</td><td className="r num">{inr(r.total)}</td>
            <td className="r num">{r.days}</td><td>{r.days > 15 ? <span className="chip chip-bad">Stop credit</span> : r.days > 7 ? <span className="chip chip-warn">Chase</span> : <span className="chip chip-ok">Within terms</span>}</td></tr>
        )) : <tr><td colSpan={7} className="muted">No unpaid business invoices.</td></tr>}</tbody>
      </table></div>
      <p className="small muted" style={{ marginTop: 8 }}>Credit terms and limits per business are not set up yet; overdue is counted from 7 days after delivery.</p>
    </>
  );
}
