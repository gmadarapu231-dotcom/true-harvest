import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { SELLABLE_SQL } from '@/lib/inventory';
import AdminNav from '@/components/AdminNav';
import { Chip, Empty, PageHead, fmtMoney, fmtKg, fmtDate } from '@/components/ui';

export const metadata = { title: 'Enquiry board · Ops' };

export default async function EnquiryBoard() {
  await requireUser('admin');
  const rows = await query(
    `SELECT e.*, c.name, c.emoji, bp.legal_name,
            (SELECT count(*)::int FROM offers o WHERE o.enquiry_id=e.id) AS offers,
            (SELECT min(price_per_kg) FROM offers o WHERE o.enquiry_id=e.id AND o.status='sent') AS best,
            (SELECT coalesce(sum(${SELLABLE_SQL}),0) FROM listings l JOIN farmer_profiles fp ON fp.user_id=l.farmer_id WHERE l.crop_id=e.crop_id AND l.status='live' AND fp.status='verified' AND l.channels IN ('b2b','both')) AS supply,
            (SELECT count(DISTINCT l.farmer_id)::int FROM listings l WHERE l.crop_id=e.crop_id AND l.status='live' AND l.channels IN ('b2b','both')) AS farms
       FROM enquiries e JOIN crops c ON c.id=e.crop_id LEFT JOIN business_profiles bp ON bp.user_id=e.business_id
      ORDER BY e.status='open' DESC, e.delivery_date LIMIT 100`);
  return (
    <main className="wrap">
      <AdminNav current="/admin/enquiries" />
      <PageHead title="B2B enquiry board" sub="Open requirements, matched supply and offers. Call farms where supply exists but no one has offered." />
      {!rows.length ? <Empty>No enquiries yet.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Business</th><th>Needs</th><th>By</th><th className="r">Target</th><th className="r">Matched supply</th><th className="r">Offers</th><th>Status</th></tr></thead>
          <tbody>{rows.map((e) => (
            <tr key={e.id}>
              <td>{e.legal_name}</td>
              <td>{e.emoji} {e.name} · {fmtKg(e.qty_kg)} · grade {e.grade}<div className="small muted">{e.recurring}{e.notes ? ` · ${e.notes}` : ''}</div></td>
              <td>{fmtDate(e.delivery_date)}</td>
              <td className="r num">{e.target_price ? fmtMoney(e.target_price) : '—'}</td>
              <td className="r num">{fmtKg(e.supply)}<div className="small muted">{e.farms} farms</div></td>
              <td className="r num">{e.offers}{e.best ? <div className="small muted">best {fmtMoney(e.best)}</div> : null}</td>
              <td><Chip s={e.status} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </main>
  );
}
