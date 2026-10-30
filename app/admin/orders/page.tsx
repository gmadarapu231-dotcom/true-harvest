import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { adminOrderAction } from '@/lib/actions/admin';
import AdminNav from '@/components/AdminNav';
import { Chip, Empty, Flash, PageHead, fmtMoney, fmtKg, fmtTime, fmtDate } from '@/components/ui';

export const metadata = { title: 'Orders · Ops' };

const NEXT: Record<string, string> = { accepted: 'packed', packed: 'picked_up', picked_up: 'out_for_delivery', out_for_delivery: 'delivered' };
const FILTERS = ['awaiting_acceptance', 'accepted', 'packed', 'picked_up', 'out_for_delivery', 'delivered', 'rejected', 'expired', 'cancelled'];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser('admin');
  const sp = await searchParams;
  const status = FILTERS.includes(sp.status) ? sp.status : null;
  const params: unknown[] = [];
  let where = "o.status NOT IN ('payment_failed')";
  if (status) { params.push(status); where += ` AND s.status = $${params.length}`; }
  if (sp.ostatus) { params.push(sp.ostatus); where += ` AND o.status = $${params.length}`; }
  if (sp.q) { params.push(`%${sp.q}%`); where += ` AND (o.order_no ILIKE $${params.length} OR b.name ILIKE $${params.length} OR f.name ILIKE $${params.length})`; }
  const rows = await query(
    `SELECT s.*, o.order_no, o.channel, o.status AS order_status, o.payment_mode, o.payment_status, o.address, o.pin, o.delivery_date, o.slot,
            b.name AS buyer_name, f.name AS farmer_name, fp.village, fp.district, p.name AS partner_name,
            (SELECT string_agg(c.name || ' ' || ol.ordered_kg || 'kg', ', ') FROM order_lines ol JOIN listings l ON l.id=ol.listing_id JOIN crops c ON c.id=l.crop_id WHERE ol.sub_order_id=s.id) AS items
       FROM sub_orders s JOIN orders o ON o.id=s.order_id JOIN users b ON b.id=o.buyer_id JOIN users f ON f.id=s.farmer_id
       JOIN farmer_profiles fp ON fp.user_id=s.farmer_id LEFT JOIN users p ON p.id=s.partner_id
      WHERE ${where} ORDER BY s.created_at DESC LIMIT 150`, params);
  const partners = await query("SELECT id, name FROM users WHERE role='partner' AND status='active' ORDER BY name");
  const backTo = `/admin/orders${status ? `?status=${status}` : ''}`;
  return (
    <main className="wrap">
      <AdminNav current="/admin/orders" />
      <PageHead title="Orders and deliveries" sub="Each row is one farmer’s part of an order (a sub-order). Assign a partner once the farmer accepts." />
      <Flash sp={sp} />
      <form className="searchbar" action="/admin/orders">
        <input name="q" defaultValue={sp.q} placeholder="Order no, buyer or farmer" />
        <button className="btn">Search</button>
      </form>
      <nav className="cats">
        <Link href="/admin/orders" aria-current={!status}>All</Link>
        {FILTERS.map((f) => <Link key={f} href={`/admin/orders?status=${f}`} aria-current={status === f}>{f.replaceAll('_', ' ')}</Link>)}
      </nav>
      {!rows.length ? <Empty>No orders match.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Order</th><th>Farmer → Buyer</th><th>Items</th><th className="r">Value</th><th>Status</th><th>Partner</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td><b>{s.order_no}</b><div className="small muted">#{s.id} · {s.channel.toUpperCase()} · {fmtTime(s.created_at)}</div>{s.delivery_date && <div className="small">{fmtDate(s.delivery_date)} {s.slot}</div>}</td>
                <td>{s.farmer_name} <span className="small muted">({s.village}, {s.district})</span><br />→ {s.buyer_name} <span className="small muted">{s.pin}</span></td>
                <td className="small">{s.items}</td>
                <td className="r num">{fmtMoney(s.items_total)}<div className="small muted">{s.payment_mode === 'online' ? 'online' : 'POD'} · {s.payment_status}</div></td>
                <td><Chip s={s.status} />{s.rejected_reason && <div className="small muted">{s.rejected_reason}</div>}</td>
                <td>
                  {['accepted', 'packed', 'picked_up', 'out_for_delivery'].includes(s.status) ? (
                    <form action={adminOrderAction} className="row" style={{ flexWrap: 'nowrap' }}>
                      <input type="hidden" name="sub_order_id" value={s.id} /><input type="hidden" name="back" value={backTo} />
                      <select name="partner_id" defaultValue={s.partner_id ?? ''} style={{ minHeight: 36, padding: '4px 8px', width: 140 }} aria-label="Partner">
                        <option value="">Unassigned</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <button className="btn btn-ghost btn-sm" name="action" value="assign">Save</button>
                    </form>
                  ) : s.partner_name ?? '—'}
                </td>
                <td>
                  <form action={adminOrderAction} className="row" style={{ flexWrap: 'nowrap' }}>
                    <input type="hidden" name="sub_order_id" value={s.id} /><input type="hidden" name="back" value={backTo} />
                    {NEXT[s.status] && <button className="btn btn-sm" name="action" value={NEXT[s.status]}>→ {NEXT[s.status].replaceAll('_', ' ')}</button>}
                    {['awaiting_acceptance', 'accepted', 'packed', 'picked_up', 'out_for_delivery'].includes(s.status) && (
                      <>
                        <input name="reason" placeholder="Cancel reason" style={{ minHeight: 36, padding: '4px 8px', width: 130 }} aria-label="Cancel reason" />
                        <button className="btn btn-danger btn-sm" name="action" value="cancel">Cancel</button>
                      </>
                    )}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </main>
  );
}
