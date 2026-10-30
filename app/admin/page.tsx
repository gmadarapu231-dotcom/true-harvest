import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { runJobs } from '@/lib/jobs';
import AdminNav from '@/components/AdminNav';
import { Chip, PageHead, Stat, fmtMoney, fmtKg, fmtTime } from '@/components/ui';

export const metadata = { title: 'Operations' };

export default async function AdminHome() {
  await requireUser('admin');
  await runJobs().catch(() => undefined); // make timers current on page load as well
  const [k] = await query(`
    SELECT
      (SELECT coalesce(sum(items_total),0) FROM orders WHERE created_at >= current_date AND status NOT IN ('cancelled','payment_failed','pending_payment')) AS gmv_today,
      (SELECT count(*)::int FROM orders WHERE created_at >= current_date AND status NOT IN ('payment_failed','pending_payment')) AS orders_today,
      (SELECT count(*)::int FROM sub_orders s JOIN orders o ON o.id=s.order_id WHERE s.status='awaiting_acceptance' AND o.status <> 'pending_payment') AS awaiting,
      (SELECT count(*)::int FROM sub_orders WHERE status IN ('accepted','packed') AND partner_id IS NULL) AS unassigned,
      (SELECT count(*)::int FROM complaints WHERE status='open') AS complaints,
      (SELECT count(*)::int FROM farmer_profiles WHERE status='submitted') AS to_verify,
      (SELECT count(*)::int FROM listings WHERE status='pending_review') AS to_review,
      (SELECT coalesce(sum(s.items_total - s.commission - s.deductions),0) FROM sub_orders s JOIN orders o ON o.id=s.order_id WHERE s.status='delivered' AND o.status='completed' AND s.settlement_id IS NULL) AS due,
      (SELECT coalesce(sum(commission),0) FROM sub_orders WHERE status='delivered') AS commission,
      (SELECT coalesce(sum(o.delivery_fee + o.packing_fee),0) FROM orders o WHERE o.status IN ('delivered','completed')) AS fees`);
  const [kpi] = await query(`
    SELECT
      (SELECT count(DISTINCT farmer_id)::int FROM sub_orders WHERE status='delivered' AND delivered_at > now() - interval '30 days') AS active_farmers,
      (SELECT count(*)::int FROM users WHERE role='consumer' AND address <> '') AS households,
      (SELECT count(*)::int FROM (SELECT buyer_id FROM orders o JOIN users u ON u.id=o.buyer_id WHERE u.role='business' AND o.payment_status IN ('paid','partly_refunded') GROUP BY buyer_id HAVING count(*) >= 2) x) AS active_b2b,
      (SELECT round(100.0 * count(*) FILTER (WHERE status='delivered') / nullif(count(*) FILTER (WHERE status IN ('delivered','released','rejected') OR status='confirmed'),0), 1) FROM order_lines) AS fulfilment,
      (SELECT round(100.0 * count(*) FILTER (WHERE n >= 2) / nullif(count(*),0), 1) FROM (SELECT buyer_id, count(*) AS n FROM orders WHERE channel='b2c' AND created_at > now() - interval '30 days' AND status NOT IN ('payment_failed','cancelled') GROUP BY buyer_id) x) AS repeat_b2c,
      (SELECT round(100.0 * coalesce(sum(spoiled_kg),0) / nullif(sum(delivered_kg + spoiled_kg),0), 1) FROM listings) AS spoilage`);
  const byStatus = await query("SELECT status, count(*)::int AS n FROM orders WHERE status NOT IN ('payment_failed') GROUP BY status ORDER BY n DESC");
  const waiting = await query(
    `SELECT s.id, o.order_no, f.name, s.items_total, greatest(0, extract(epoch FROM s.accept_deadline - now())/60)::int AS mins
       FROM sub_orders s JOIN orders o ON o.id=s.order_id JOIN users f ON f.id=s.farmer_id
      WHERE s.status='awaiting_acceptance' AND o.status <> 'pending_payment' ORDER BY s.accept_deadline LIMIT 8`);
  const days = await query(
    `SELECT d::date AS day, coalesce((SELECT sum(items_total) FROM orders o WHERE o.created_at::date = d::date AND o.status NOT IN ('cancelled','payment_failed','pending_payment')),0) AS gmv
       FROM generate_series(current_date - 6, current_date, interval '1 day') d ORDER BY d`);
  const maxG = Math.max(1, ...days.map((d) => Number(d.gmv)));
  const shortage = await query(
    `SELECT c.name, fp.district, sum(l.listed_kg - l.reserved_kg - l.confirmed_kg - l.delivered_kg - l.rejected_kg - l.spoiled_kg - l.removed_kg) AS sellable, sum(l.reserved_kg + l.confirmed_kg) AS held
       FROM listings l JOIN crops c ON c.id=l.crop_id JOIN farmer_profiles fp ON fp.user_id=l.farmer_id
      WHERE l.status='live' GROUP BY c.name, fp.district ORDER BY sellable ASC LIMIT 6`);
  return (
    <main className="wrap">
      <AdminNav current="/admin" />
      <PageHead title="Operations overview" sub={`As of ${fmtTime(new Date())}`} />
      <div className="stats">
        <Stat label="GMV today" value={fmtMoney(k.gmv_today)} hint={`${k.orders_today} orders`} href="/admin/orders" />
        <Stat label="Awaiting farmer" value={k.awaiting} hint={`${k.unassigned} accepted without a partner`} href="/admin/orders?status=awaiting_acceptance" />
        <Stat label="Open complaints" value={k.complaints} href="/admin/complaints" />
        <Stat label="Settlements due" value={fmtMoney(k.due)} href="/admin/settlements" />
        <Stat label="Farmers to verify" value={k.to_verify} href="/admin/farmers?status=submitted" />
        <Stat label="Listings to review" value={k.to_review} href="/admin/listings" />
        <Stat label="Commission earned" value={fmtMoney(k.commission)} />
        <Stat label="Delivery + packing fees" value={fmtMoney(k.fees)} />
      </div>
      <div className="grid2">
        <div className="card">
          <h2>Waiting for farmer acceptance</h2>
          {!waiting.length ? <p className="muted">None.</p> : waiting.map((w) => (
            <div key={w.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{w.order_no} · {w.name}</span>
              <span className="row"><span className="num">{fmtMoney(w.items_total)}</span><Chip s={w.mins < 15 ? 'rejected' : 'pending'} label={`${w.mins} min left`} /></span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>GMV, last 7 days</h2>
          <div className="bars">
            {days.map((d) => (
              <div key={String(d.day)} className="bar"><span>{new Date(d.day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</span><span className="track"><span className="fill" style={{ display: 'block', width: `${(Number(d.gmv) / maxG) * 100}%` }} /></span><span className="num r">{fmtMoney(d.gmv)}</span></div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>KPIs</h2>
          <dl className="kv">
            <dt>Active farmers (30 days)</dt><dd>{kpi.active_farmers}</dd>
            <dt>Active B2B buyers</dt><dd>{kpi.active_b2b}</dd>
            <dt>Registered households</dt><dd>{kpi.households}</dd>
            <dt>Fulfilment (lines delivered)</dt><dd>{kpi.fulfilment ?? '—'}%</dd>
            <dt>Repeat household buyers (30 d)</dt><dd>{kpi.repeat_b2c ?? '—'}%</dd>
            <dt>Spoilage</dt><dd>{kpi.spoilage ?? 0}%</dd>
          </dl>
        </div>
        <div className="card">
          <h2>Orders by status</h2>
          <div className="row">{byStatus.map((s) => <Link key={s.status} href={`/admin/orders?ostatus=${s.status}`}><Chip s={s.status} label={`${s.status.replaceAll('_', ' ')} · ${s.n}`} /></Link>)}</div>
          <h3 style={{ marginTop: 16 }}>Lowest stock by crop and district</h3>
          {shortage.map((s) => <div key={s.name + s.district} className="row small" style={{ justifyContent: 'space-between' }}><span>{s.name} · {s.district}</span><span>{fmtKg(s.sellable)} sellable · {fmtKg(s.held)} held</span></div>)}
        </div>
      </div>
    </main>
  );
}
