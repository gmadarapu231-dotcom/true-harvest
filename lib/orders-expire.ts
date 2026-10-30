import { tx } from './db';
import { moveStock } from './inventory';
import { notify, notifyAdmins } from './notify';

export async function expireSubOrder(subId: number) {
  await tx(async (q) => {
    const [sub] = await q.query(
      "UPDATE sub_orders SET status='expired', commission=0, rejected_reason='Not accepted in time' WHERE id=$1 AND status='awaiting_acceptance' AND accept_deadline < now() RETURNING *",
      [subId]);
    if (!sub) return;
    const lines = await q.query("SELECT * FROM order_lines WHERE sub_order_id=$1 AND status='reserved'", [subId]);
    for (const l of lines) {
      await moveStock(q, l.listing_id, 'reserved', 'sellable', l.ordered_kg, { reason: 'accept window expired', orderLineId: l.id });
      await q.query("UPDATE order_lines SET status='released' WHERE id=$1", [l.id]);
    }
    const [o] = await q.query('SELECT * FROM orders WHERE id=$1', [sub.order_id]);
    if (o.payment_status === 'paid' || o.payment_status === 'partly_refunded') {
      await q.query("UPDATE orders SET refunded = refunded + $2, payment_status='partly_refunded' WHERE id=$1", [o.id, sub.items_total]);
    }
    await q.query("INSERT INTO order_events (order_id, sub_order_id, status, note) VALUES ($1,$2,'expired','not accepted in time')", [o.id, subId]);
    const remaining = await q.query("SELECT 1 FROM sub_orders WHERE order_id=$1 AND status NOT IN ('rejected','expired','cancelled')", [o.id]);
    if (!remaining.length) {
      await q.query("UPDATE orders SET status='cancelled', payment_status = CASE WHEN payment_status='pending' THEN 'pending' ELSE 'refunded' END, refunded = CASE WHEN payment_status='pending' THEN 0 ELSE total END WHERE id=$1", [o.id]);
      await notify(q, o.buyer_id, 'Order could not be fulfilled', `The farmer did not confirm order ${o.order_no} in time. Any payment will be refunded.`, `/orders/${o.order_no}`);
    } else {
      // Remaining sub-orders all answered? Promote the order to confirmed.
      const waiting = await q.query("SELECT 1 FROM sub_orders WHERE order_id=$1 AND status='awaiting_acceptance'", [o.id]);
      if (!waiting.length && o.status === 'placed') await q.query("UPDATE orders SET status='confirmed' WHERE id=$1", [o.id]);
    }
    await notify(q, sub.farmer_id, 'Order expired', `You did not accept order ${o.order_no} in time.`, '/farmer/orders');
    await notifyAdmins(q, 'Order not accepted in time', `Order ${o.order_no}: farmer did not respond. Re-source or refund.`, '/admin/orders');
  });
}
