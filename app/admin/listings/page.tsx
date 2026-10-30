import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { SELLABLE_SQL } from '@/lib/inventory';
import { reviewListing, adminAdjustStock } from '@/lib/actions/admin';
import AdminNav from '@/components/AdminNav';
import BucketBar from '@/components/BucketBar';
import { Chip, CropArt, Empty, Flash, PageHead, fmtMoney, fmtKg, fmtDate } from '@/components/ui';

export const metadata = { title: 'Listings · Ops' };

export default async function AdminListings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser('admin');
  const sp = await searchParams;
  const all = await query(
    `SELECT l.*, ${SELLABLE_SQL} AS sellable_kg, c.name AS crop, c.emoji, u.name AS farmer_name, fp.district, fp.status AS farmer_status
       FROM listings l JOIN crops c ON c.id=l.crop_id JOIN users u ON u.id=l.farmer_id JOIN farmer_profiles fp ON fp.user_id=l.farmer_id
      WHERE l.status IN ('pending_review','live','paused') ORDER BY (l.status='pending_review') DESC, c.name`);
  const pending = all.filter((l) => l.status === 'pending_review');
  // R-9.8: inventory by crop and district, today and next 7 days.
  const summary = await query(
    `SELECT c.name, fp.district,
            sum(CASE WHEN l.ready_from <= current_date THEN ${SELLABLE_SQL} ELSE 0 END) AS sellable_now,
            sum(CASE WHEN l.ready_from > current_date THEN ${SELLABLE_SQL} ELSE 0 END) AS sellable_7d,
            sum(l.reserved_kg) AS reserved, sum(l.confirmed_kg) AS confirmed
       FROM listings l JOIN crops c ON c.id=l.crop_id JOIN farmer_profiles fp ON fp.user_id=l.farmer_id
      WHERE l.status='live' AND fp.status='verified' GROUP BY c.name, fp.district ORDER BY c.name, fp.district`);
  const labels = { available: 'Sellable', reserved: 'Reserved', confirmed: 'Confirmed', sold: 'Delivered', spoiled: 'Spoiled/removed' };
  return (
    <main className="wrap">
      <AdminNav current="/admin/listings" />
      <PageHead title="Listings and inventory" />
      <Flash sp={sp} />
      <section>
        <h2>Pending review ({pending.length})</h2>
        {!pending.length ? <Empty>Nothing to review.</Empty> : (
          <div className="stack">
            {pending.map((l) => (
              <div key={l.id} className="card" style={{ display: 'flex', gap: 14 }}>
                <CropArt emoji={l.emoji} photoId={l.photo_id} size="sm" alt={l.crop} />
                <div style={{ flex: 1 }}>
                  <b>{l.crop} · {l.variety}</b> <span className="small muted">by {l.farmer_name} ({l.district})</span> {l.farmer_status !== 'verified' && <Chip s={l.farmer_status} label={`farmer ${l.farmer_status}`} />}
                  <div className="small">{fmtKg(l.listed_kg)} · grade {l.grade} · {fmtMoney(l.price_per_kg)}/kg · ready {fmtDate(l.ready_from)} · {l.channels}</div>
                  {l.description && <div className="small muted">{l.description}</div>}
                  <form action={reviewListing} className="row" style={{ marginTop: 8 }}>
                    <input type="hidden" name="listing_id" value={l.id} />
                    <button className="btn btn-sm" name="decision" value="approve">Approve</button>
                    <input name="reason" placeholder="Reason if rejecting" style={{ minHeight: 36, padding: '4px 8px', width: 220 }} />
                    <button className="btn btn-danger btn-sm" name="decision" value="reject">Reject</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="section">
        <h2>Stock by crop and district</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Crop</th><th>District</th><th className="r">Sellable now</th><th className="r">Coming in 7 days</th><th className="r">Reserved</th><th className="r">Confirmed</th></tr></thead>
          <tbody>{summary.map((s) => <tr key={s.name + s.district}><td>{s.name}</td><td>{s.district}</td><td className="r num">{fmtKg(s.sellable_now)}</td><td className="r num">{fmtKg(s.sellable_7d)}</td><td className="r num">{fmtKg(s.reserved)}</td><td className="r num">{fmtKg(s.confirmed)}</td></tr>)}</tbody>
        </table></div>
      </section>
      <section className="section">
        <h2>All live listings</h2>
        <div className="stack">
          {all.filter((l) => l.status !== 'pending_review').map((l) => (
            <div key={l.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>{l.emoji} <b>{l.crop} · {l.variety}</b> <span className="small muted">#{l.id} · {l.farmer_name}, {l.district} · {fmtMoney(l.price_per_kg)}/kg · until {fmtDate(l.available_until)}</span></span>
                <Chip s={l.status} />
              </div>
              <BucketBar l={l} labels={labels} />
              <form action={adminAdjustStock} className="row" style={{ marginTop: 8 }}>
                <input type="hidden" name="listing_id" value={l.id} />
                <input name="kg" inputMode="decimal" placeholder="kg" style={{ minHeight: 36, padding: '4px 8px', width: 80 }} aria-label="kg" />
                <select name="to" style={{ minHeight: 36, padding: '4px 8px', width: 'auto' }} aria-label="Move to"><option value="spoiled">Mark spoiled</option><option value="removed">Remove</option></select>
                <input name="reason" placeholder="Reason" style={{ minHeight: 36, padding: '4px 8px', width: 200 }} aria-label="Reason" />
                <button className="btn btn-ghost btn-sm">Adjust</button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
