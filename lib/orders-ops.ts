import { tx } from './db';
import { moveStock } from './inventory';
import { audit, notify } from './notify';

/** Ops cancels one sub-order (for example, the lot failed quality): stock goes back on sale and the buyer is refunded for it. */
export async function releaseByOps(adminId: number, subId: number, reason: string) {
  await tx(async (q) => {
    const [sub] = await q.query(
      "UPDATE sub_orders SET status='cancelled', rejected_reason=$2, commission=0 WHERE id=$1 AND status IN ('awaiting_acceptance','accepted','packed','picked_up','out_for_delivery') RETURNING *",
      [subId, reason]);
    if (!sub) throw new Error('This sub-order can no longer be cancelled.');
    const lines = await q.query("SELECT * FROM order_lines WHERE sub_order_id=$1 AND status IN ('reserved','confirmed')", [subId]);
    for (const l of lines) {
      await moveStock(q, l.listing_id, l.status === 'reserved' ? 'reserved' : 'confirmed', 'sellable', l.ordered_kg, { reason: `ops cancel: ${reason}`, actorId: adminId, orderLineId: l.id });
      await q.query("UPDATE order_lines SET status='released' WHERE id=$1", [l.id]);
    }
    const [o] = await q.query('SELECT * FROM orders WHERE id=$1', [sub.order_id]);
    if (o.payment_status !== 'pending') await q.query("UPDATE orders SET refunded = refunded + $2, payment_status='partly_refunded' WHERE id=$1", [o.id, sub.items_total]);
    const left = await q.query("SELECT 1 FROM sub_orders WHERE order_id=$1 AND status NOT IN ('rejected','expired','cancelled')", [o.id]);
    if (!left.length) await q.query("UPDATE orders SET status='cancelled', payment_status = CASE WHEN payment_status='pending' THEN 'pending' ELSE 'refunded' END, refunded = CASE WHEN payment_status='pending' THEN 0 ELSE total END WHERE id=$1", [o.id]);
    await q.query("INSERT INTO order_events (order_id, sub_order_id, status, note, actor_id) VALUES ($1,$2,'cancelled',$3,$4)", [o.id, subId, reason, adminId]);
    await audit(q, adminId, 'sub_order.cancel', 'sub_order', subId, sub.status, `cancelled: ${reason}`);
    await notify(q, o.buyer_id, 'Part of your order was cancelled', `${reason}. You will be refunded for it.`, `/orders/${o.order_no}`);
    await notify(q, sub.farmer_id, 'Order cancelled by operations', reason, '/farmer/orders');
  });
}
