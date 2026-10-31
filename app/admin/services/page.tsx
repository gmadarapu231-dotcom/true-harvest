import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { DISTRICTS } from '@/lib/config';
import { EQUIPMENT_KINDS, INPUT_KINDS } from '@/lib/services';
import { createEquipment, setEquipmentStatus, decideBooking, advanceInputOrder, saveInput } from '@/lib/actions/services';
import { Chip, Flash, PageHead, Stat, fmtMoney, fmtDate, fmtTime } from '@/components/ui';

export const metadata = { title: 'Farmer services' };

export default async function AdminServices({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser('admin');
  const sp = await searchParams;
  const [k] = await query(
    `SELECT (SELECT count(*)::int FROM equipment WHERE status='pending_review') AS to_review,
            (SELECT count(*)::int FROM equipment WHERE status='live') AS live,
            (SELECT count(*)::int FROM equipment_bookings WHERE status IN ('requested','confirmed') AND end_date >= current_date) AS bookings,
            (SELECT count(*)::int FROM input_orders WHERE status IN ('placed','dispatched')) AS open_orders,
            (SELECT coalesce(sum(amount),0) FROM input_orders WHERE status <> 'cancelled' AND created_at > date_trunc('month', now())) AS input_sales,
            (SELECT count(*)::int FROM crop_groups) AS groups,
            (SELECT count(*)::int FROM meetups WHERE starts_at > now()) AS meetups`);
  const review = await query("SELECT e.*, u.name AS owner FROM equipment e JOIN users u ON u.id=e.owner_id WHERE e.status='pending_review' ORDER BY e.created_at");
  const bookings = await query(
    `SELECT b.*, e.name AS machine, r.name AS renter, o.name AS owner FROM equipment_bookings b JOIN equipment e ON e.id=b.equipment_id
       JOIN users r ON r.id=b.renter_id JOIN users o ON o.id=e.owner_id ORDER BY b.created_at DESC LIMIT 15`);
  const orders = await query(
    `SELECT o.*, i.name, i.pack, i.dealer, u.name AS buyer, u.phone FROM input_orders o JOIN inputs i ON i.id=o.input_id JOIN users u ON u.id=o.buyer_id
      ORDER BY o.status IN ('placed','dispatched') DESC, o.created_at DESC LIMIT 20`);
  const inputs = await query('SELECT i.*, c.name AS crop FROM inputs i LEFT JOIN crops c ON c.id=i.crop_id ORDER BY i.kind, i.name');
  const crops = await query('SELECT id, name FROM crops ORDER BY name');
  const groups = await query(
    `SELECT g.id, g.name, g.district, (SELECT count(*)::int FROM group_members m WHERE m.group_id=g.id) AS members,
            (SELECT coalesce(sum(kg),0) FROM group_posts p WHERE p.group_id=g.id AND p.kind='pool' AND p.ready_on >= current_date) AS pooled
       FROM crop_groups g ORDER BY members DESC`);
  return (
    <main className="wrap">
      <PageHead title="Farmer services" sub="Machine rental, seeds and inputs, and crop groups." />
      <Flash sp={sp} />
      <div className="stats">
        <Stat icon="truck" label="Machines live" value={k.live} hint={`${k.to_review} to review`} />
        <Stat icon="list" label="Active bookings" value={k.bookings} />
        <Stat icon="sprout" label="Input orders open" value={k.open_orders} hint={`${fmtMoney(k.input_sales)} this month`} />
        <Stat icon="handshake" label="Crop groups" value={k.groups} hint={`${k.meetups} upcoming meetups`} />
      </div>

      {review.length ? (
        <section className="card section">
          <h2>Machines to review</h2>
          {review.map((e) => (
            <div key={e.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span><b>{e.name}</b> · {EQUIPMENT_KINDS[e.kind].en} · {e.owner}, {e.district} <span className="small muted">{e.rate_hour ? `${fmtMoney(e.rate_hour)}/h ` : ''}{e.rate_day ? `${fmtMoney(e.rate_day)}/day` : ''}</span></span>
              <form action={setEquipmentStatus} className="row"><input type="hidden" name="id" value={e.id} /><button name="to" value="live" className="btn btn-sm">Approve</button><button name="to" value="rejected" className="btn btn-danger btn-sm">Reject</button></form>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card section">
        <h2>Seeds and inputs orders</h2>
        {!orders.length ? <p className="muted">None yet.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Placed</th><th>Buyer</th><th>Item</th><th>Dealer</th><th className="r">Amount</th><th>Status</th><th /></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id}>
                <td>{fmtTime(o.created_at)}</td><td>{o.buyer}<br /><span className="small muted">{o.phone} · {o.address}</span></td>
                <td>{o.qty} × {o.name} ({o.pack})</td><td className="small">{o.dealer}</td><td className="r num">{fmtMoney(o.amount)}</td>
                <td><Chip s={o.status === 'placed' ? 'pending' : o.status === 'dispatched' ? 'out_for_delivery' : o.status} label={o.status} /></td>
                <td><form action={advanceInputOrder} className="row"><input type="hidden" name="id" value={o.id} />
                  {o.status === 'placed' ? <><button name="to" value="dispatched" className="btn btn-sm">Dispatch</button><button name="to" value="cancelled" className="btn btn-danger btn-sm">Cancel</button></> : null}
                  {o.status === 'dispatched' ? <button name="to" value="delivered" className="btn btn-sm">Delivered</button> : null}
                </form></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="card section">
        <h2>Machine bookings</h2>
        {!bookings.length ? <p className="muted">None yet.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Machine</th><th>Owner</th><th>Renter</th><th>Dates</th><th className="r">Amount</th><th>Status</th><th /></tr></thead>
            <tbody>{bookings.map((b) => (
              <tr key={b.id}>
                <td>{b.machine}</td><td>{b.owner}</td><td>{b.renter}</td>
                <td>{fmtDate(b.start_date)}{b.end_date !== b.start_date ? ` – ${fmtDate(b.end_date)}` : ''} · {Number(b.quantity)} {b.unit === 'hour' ? 'h' : 'd'}</td>
                <td className="r num">{fmtMoney(b.amount)}</td><td><Chip s={b.status === 'requested' ? 'pending' : b.status} label={b.status} /></td>
                <td><form action={decideBooking} className="row"><input type="hidden" name="id" value={b.id} />
                  {b.status === 'requested' ? <><button name="to" value="confirmed" className="btn btn-sm">Confirm</button><button name="to" value="declined" className="btn btn-danger btn-sm">Decline</button></> : null}
                  {b.status === 'confirmed' ? <button name="to" value="completed" className="btn btn-ghost btn-sm">Done</button> : null}
                </form></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="card section">
        <h2>Inputs catalogue and stock</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Product</th><th>Pack</th><th>Dealer</th><th>Price (₹)</th><th>Stock</th><th>Status</th><th /></tr></thead>
          <tbody>{inputs.map((i) => (
            <tr key={i.id}>
              <td><Link href={`/inputs/${i.id}`}>{i.name}</Link><br /><span className="small muted">{INPUT_KINDS[i.kind].en}{i.crop ? ` · ${i.crop}` : ''}</span></td>
              <td>{i.pack}</td><td className="small">{i.dealer}</td>
              <td colSpan={4}>
                <form action={saveInput} className="row">
                  <input type="hidden" name="id" value={i.id} />
                  <input name="price" type="number" step="0.5" min="1" defaultValue={Number(i.price)} style={{ width: 100 }} aria-label="Price" />
                  <input name="stock" type="number" min="0" defaultValue={i.stock} style={{ width: 90 }} aria-label="Stock" />
                  <select name="status" defaultValue={i.status} style={{ width: 110 }} aria-label="Status"><option value="live">Live</option><option value="paused">Paused</option></select>
                  <button className="btn btn-ghost btn-sm">Save</button>
                </form>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
        <details className="section">
          <summary className="btn btn-warm btn-sm">Add a product</summary>
          <form action={saveInput} className="form" style={{ marginTop: 12 }}>
            <div className="grid3">
              <label>Type<select name="kind">{Object.entries(INPUT_KINDS).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}</select></label>
              <label>For crop<select name="crop_id"><option value="">Any crop</option>{crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label>Pack size<input name="pack" placeholder="10 g, 50 kg bag" required /></label>
              <label>Name<input name="name" required /></label>
              <label>Telugu name<input name="name_te" /></label>
              <label>Brand / variety<input name="brand" /></label>
              <label>Price (₹)<input name="price" type="number" step="0.5" min="1" required /></label>
              <label>MRP (₹)<input name="mrp" type="number" step="0.5" min="0" /></label>
              <label>Stock (packs)<input name="stock" type="number" min="0" defaultValue="0" /></label>
              <label>Dealer<input name="dealer" required /></label>
              <label>Dealer licence no.<input name="licence_no" /></label>
            </div>
            <label>Description<textarea name="description" /></label>
            <button className="btn">Add product</button>
          </form>
        </details>
      </section>

      <div className="grid2 section">
        <div className="card">
          <h2>Crop groups</h2>
          {groups.map((g) => <div key={g.id} className="row" style={{ justifyContent: 'space-between' }}><Link href={`/groups/${g.id}`}>{g.name}</Link><span className="small muted">{g.members} farmers{Number(g.pooled) ? ` · ${Math.round(Number(g.pooled))} kg pooled` : ''}</span></div>)}
        </div>
        <details className="card">
          <summary><b>List a custom hiring centre machine</b></summary>
          <form action={createEquipment} className="form" style={{ marginTop: 12 }}>
            <div className="grid2">
              <label>Type<select name="kind">{Object.entries(EQUIPMENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}</select></label>
              <label>Name<input name="name" required /></label>
              <label>Rate per hour (₹)<input name="rate_hour" type="number" min="0" /></label>
              <label>Rate per day (₹)<input name="rate_day" type="number" min="0" /></label>
              <label>District<select name="district">{Object.values(DISTRICTS).flat().map((d) => <option key={d}>{d}</option>)}</select></label>
              <label>Village<input name="village" /></label>
            </div>
            <label>Description<textarea name="description" /></label>
            <label className="check"><input type="checkbox" name="operator_included" defaultChecked /> Operator included</label>
            <button className="btn">Add machine</button>
          </form>
        </details>
      </div>
    </main>
  );
}
