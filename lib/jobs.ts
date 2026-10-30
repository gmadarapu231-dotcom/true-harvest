import { query, tx } from './db';
import { moveStock } from './inventory';
import { getSettings } from './settings';
import { notify } from './notify';

// Background jobs (SRS 14.3). Each is idempotent: it only touches rows still in the state it expects.
// They run every minute from instrumentation.ts; in production run them from a scheduler (BullMQ / cron).
export async function runJobs() {
  const s = await getSettings();

  // R-9.2: unpaid online orders release their reservation after the payment timeout.
  const unpaid = await query<{ id: number }>(
    `SELECT id FROM orders WHERE status='pending_payment' AND created_at < now() - ($1 || ' minutes')::interval`,
    [String(s.payment_timeout_min)],
  );
  for (const { id } of unpaid) {
    await tx(async (q) => {
      const [o] = await q.query("UPDATE orders SET status='payment_failed' WHERE id=$1 AND status='pending_payment' RETURNING *", [id]);
      if (!o) return;
      const lines = await q.query(
        "SELECT ol.* FROM order_lines ol JOIN sub_orders so ON so.id=ol.sub_order_id WHERE so.order_id=$1 AND ol.status='reserved'", [id]);
      for (const l of lines) {
        await moveStock(q, l.listing_id, 'reserved', 'sellable', l.ordered_kg, { reason: 'payment timeout', orderLineId: l.id });
        await q.query("UPDATE order_lines SET status='released' WHERE id=$1", [l.id]);
      }
      await q.query("UPDATE sub_orders SET status='cancelled', commission=0 WHERE order_id=$1", [id]);
      await q.query("INSERT INTO order_events (order_id, status, note) VALUES ($1,'payment_failed','payment not completed in time')", [id]);
      await notify(q, o.buyer_id, 'Payment not completed', `Order ${o.order_no} was released because payment did not complete.`, `/orders/${o.order_no}`);
    });
  }

  // R-4.8: sub-orders not accepted in time auto-expire and ops is alerted to re-source.
  const late = await query<{ id: number; order_id: number }>(
    "SELECT id, order_id FROM sub_orders WHERE status='awaiting_acceptance' AND accept_deadline < now()");
  if (late.length) {
    const { expireSubOrder } = await import('./orders-expire');
    for (const sub of late) await expireSubOrder(sub.id);
  }

  // R-6.3: offers past their validity expire.
  await query("UPDATE offers SET status='expired' WHERE status='sent' AND valid_until < now()");

  // R-9.6: listings past their available-until date expire; unsold kg moves to Removed.
  const stale = await query<{ id: number; farmer_id: number; sellable: number }>(
    `SELECT id, farmer_id, (listed_kg - reserved_kg - confirmed_kg - delivered_kg - rejected_kg - spoiled_kg - removed_kg) AS sellable
       FROM listings WHERE status IN ('live','paused') AND available_until < current_date`);
  for (const l of stale) {
    await tx(async (q) => {
      const [row] = await q.query("UPDATE listings SET status='expired' WHERE id=$1 AND status IN ('live','paused') RETURNING id", [l.id]);
      if (!row) return;
      await moveStock(q, l.id, 'sellable', 'removed', l.sellable, { reason: 'listing expired' });
      await notify(q, l.farmer_id, 'Listing expired', 'A listing passed its available-until date. Create a new one for fresh stock.', '/farmer/listings');
    });
  }

  // 10.1: delivered orders become Completed after the complaint window; that makes farmer earnings Due.
  await query(
    `UPDATE orders o SET status='completed', completed_at=now(),
            commission_amount = (SELECT coalesce(sum(commission), 0) FROM sub_orders s WHERE s.order_id=o.id AND s.status='delivered')
      WHERE status='delivered' AND delivered_at < now() - (CASE WHEN channel='b2c' THEN $1 ELSE $2 END || ' hours')::interval`,
    [String(s.complaint_window_b2c_hours), String(s.complaint_window_b2b_hours)],
  );
}
