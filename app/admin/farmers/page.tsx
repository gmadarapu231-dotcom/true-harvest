import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { setFarmerStatus } from '@/lib/actions/admin';
import AdminNav from '@/components/AdminNav';
import { Chip, Empty, Flash, PageHead, Stars, fmtMoney } from '@/components/ui';

export const metadata = { title: 'Farmers · Ops' };
const STATUSES = ['submitted', 'registered', 'verified', 'rejected', 'suspended'];

export default async function AdminFarmers({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser('admin');
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status) ? sp.status : null;
  const params: unknown[] = [];
  let where = 'true';
  if (status) { params.push(status); where += ` AND fp.status = $${params.length}`; }
  if (sp.q) { params.push(`%${sp.q}%`); where += ` AND (u.name ILIKE $${params.length} OR fp.village ILIKE $${params.length} OR fp.district ILIKE $${params.length} OR fp.main_crops ILIKE $${params.length} OR u.phone LIKE $${params.length})`; }
  const rows = await query(
    `SELECT u.id, u.name, u.phone, u.created_at, fp.*,
            (SELECT count(*)::int FROM listings WHERE farmer_id=u.id AND status='live') AS live,
            (SELECT coalesce(sum(items_total),0) FROM sub_orders WHERE farmer_id=u.id AND status='delivered') AS sales,
            (SELECT avg(r.farmer_stars) FROM ratings r JOIN sub_orders s ON s.id=r.sub_order_id WHERE s.farmer_id=u.id) AS rating
       FROM users u JOIN farmer_profiles fp ON fp.user_id=u.id WHERE ${where}
      ORDER BY (fp.status='submitted') DESC, u.created_at DESC LIMIT 200`, params);
  return (
    <main className="wrap">
      <AdminNav current="/admin/farmers" />
      <PageHead title="Farmers" sub="Verify after the field visit. Buyers only see verified farmers." />
      <Flash sp={sp} />
      <form className="searchbar" action="/admin/farmers">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={sp.q} placeholder="Name, village, district, crop or phone" /><button className="btn">Search</button>
      </form>
      <nav className="cats">
        <Link href="/admin/farmers" aria-current={!status}>All</Link>
        {STATUSES.map((s) => <Link key={s} href={`/admin/farmers?status=${s}`} aria-current={status === s}>{s}</Link>)}
      </nav>
      {!rows.length ? <Empty>No farmers match.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Farmer</th><th>Farm</th><th>KYC and bank</th><th className="r">Sales</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{rows.map((f) => (
            <tr key={f.id}>
              <td><b>{f.name}</b><div className="small muted">+91 {f.phone}</div><Stars n={f.rating ? Number(f.rating) : null} /></td>
              <td className="small">{f.village}, {f.mandal}, {f.district}, {f.state}<br />{f.farm_size_acres} acres · {f.main_crops}<br />{f.live} live listings · {f.farmer_type.replace('_', ' ')}</td>
              <td className="small">{f.id_doc_type ? `${f.id_doc_type} ••••${f.id_doc_last4}` : 'No ID yet'}<br />{f.upi_id ? `UPI ${f.upi_id}` : f.bank_last4 ? `Bank ••••${f.bank_last4} ${f.bank_ifsc}` : 'No bank yet'}</td>
              <td className="r num">{fmtMoney(f.sales)}</td>
              <td><Chip s={f.status} />{f.status_reason && <div className="small muted">{f.status_reason}</div>}{f.payout_hold && <div className="small" style={{ color: 'var(--chilli)' }}>Hold: {f.payout_hold}</div>}</td>
              <td>
                <form action={setFarmerStatus} className="stack" style={{ gap: 6, minWidth: 190 }}>
                  <input type="hidden" name="farmer_id" value={f.id} />
                  {f.status !== 'verified' && <button className="btn btn-sm" name="status" value="verified">Verify</button>}
                  <input name="reason" placeholder="Reason (for reject/suspend)" style={{ minHeight: 36, padding: '4px 8px' }} />
                  <div className="row">
                    {f.status !== 'rejected' && f.status !== 'verified' && <button className="btn btn-danger btn-sm" name="status" value="rejected">Reject</button>}
                    {f.status === 'verified' && <button className="btn btn-danger btn-sm" name="status" value="suspended">Suspend</button>}
                  </div>
                </form>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </main>
  );
}
