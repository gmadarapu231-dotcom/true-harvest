import { farmerContext } from '@/lib/farmer-page';
import { query } from '@/lib/db';
import { farmerEarnings } from '@/lib/money';
import { Chip, Empty, PageHead, Stat, fmtMoney, fmtDate } from '@/components/ui';

export const metadata = { title: 'Payments' };

export default async function FarmerPayments() {
  const { u, lang, t, fp } = await farmerContext();
  const rows = await farmerEarnings(u.id);
  const settlements = await query('SELECT * FROM settlements WHERE farmer_id=$1 ORDER BY created_at DESC', [u.id]);
  const sum = (state: string) => rows.filter((r) => r.payout_state === state).reduce((a, r) => a + Number(r.net), 0);
  const kg = await query(
    `SELECT c.name, c.name_te, sum(ol.delivered_kg) AS kg, sum(ol.line_total) AS value FROM order_lines ol JOIN sub_orders s ON s.id=ol.sub_order_id
       JOIN listings l ON l.id=ol.listing_id JOIN crops c ON c.id=l.crop_id
      WHERE s.farmer_id=$1 AND ol.status='delivered' GROUP BY c.name, c.name_te ORDER BY value DESC`, [u.id]);
  const max = Math.max(1, ...kg.map((k) => Number(k.value)));
  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <PageHead title={t('nav.payments')} sub={fp.upi_id ? `UPI ${fp.upi_id}` : fp.bank_last4 ? `Bank ••••${fp.bank_last4}` : 'Add bank or UPI in profile'} />
      {fp.payout_hold && <div className="flash flash-error">{lang === 'te' ? 'చెల్లింపు నిలిపివేయబడింది' : 'Payout on hold'}: {fp.payout_hold}</div>}
      <div className="stats">
        <Stat label={lang === 'te' ? 'చెల్లించవలసినది' : 'Due (ready to pay)'} value={fmtMoney(sum('Due'))} />
        <Stat label={lang === 'te' ? 'ఫిర్యాదు గడువులో' : 'In complaint window'} value={fmtMoney(sum('In complaint window'))} />
        <Stat label={lang === 'te' ? 'వస్తున్నది' : 'Accruing'} value={fmtMoney(sum('Accruing'))} hint="orders not yet delivered" />
        <Stat label={t('farmer.paidOut')} value={fmtMoney(sum('Paid'))} />
      </div>
      {kg.length > 0 && (
        <div className="card">
          <h3>{lang === 'te' ? 'పంట వారీగా అమ్మకాలు' : 'Sales by crop'}</h3>
          <div className="bars">
            {kg.map((k) => (
              <div key={k.name} className="bar"><span>{lang === 'te' ? k.name_te : k.name}</span><span className="track"><span className="fill" style={{ display: 'block', width: `${(Number(k.value) / max) * 100}%` }} /></span><span className="num r">{fmtMoney(k.value)}</span></div>
            ))}
          </div>
        </div>
      )}
      <section className="section">
        <h2>{lang === 'te' ? 'ఆర్డర్ వారీగా' : 'Per order'}</h2>
        {!rows.length ? <Empty>{t('farmer.noOrders')}</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Order</th><th className="r">Value</th><th className="r">Commission</th><th className="r">Deductions</th><th className="r">You get</th><th>Status</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}><td>{r.order_no}<div className="small muted">{fmtDate(r.created_at)}</div></td><td className="r num">{fmtMoney(r.items_total)}</td><td className="r num">{fmtMoney(r.commission)}</td>
                <td className="r num">{r.deductions ? fmtMoney(r.deductions) : '—'}</td><td className="r num"><b>{fmtMoney(r.net)}</b></td>
                <td><Chip s={r.payout_state} />{r.utr ? <div className="small muted">UTR {r.utr}</div> : null}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      {settlements.length > 0 && (
        <section className="section">
          <h2>{lang === 'te' ? 'చెల్లింపులు' : 'Settlements'}</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Date</th><th className="r">Orders</th><th className="r">Gross</th><th className="r">Commission</th><th className="r">Deductions</th><th className="r">Net paid</th><th>UTR</th></tr></thead>
            <tbody>{settlements.map((s) => <tr key={s.id}><td>{fmtDate(s.created_at)}</td><td className="r">{s.sub_order_count}</td><td className="r num">{fmtMoney(s.gross)}</td><td className="r num">{fmtMoney(s.commission)}</td><td className="r num">{fmtMoney(s.deductions)}</td><td className="r num"><b>{fmtMoney(s.net)}</b></td><td>{s.utr}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
    </main>
  );
}
