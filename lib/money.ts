import { query, tx } from './db';
import { notify, audit } from './notify';
import { round2 } from './orders';

// Farmer earnings and settlement (SRS 11.4). A sub-order's earnings are Due once its order is Completed.
export const DUE_SQL = `
  SELECT s.farmer_id, count(*)::int AS sub_orders, sum(s.items_total) AS gross, sum(s.commission) AS commission,
         sum(s.deductions) AS deductions, sum(s.items_total - s.commission - s.deductions) AS net
    FROM sub_orders s JOIN orders o ON o.id = s.order_id
   WHERE s.status='delivered' AND o.status='completed' AND s.settlement_id IS NULL`;

export async function farmerEarnings(farmerId: number) {
  const rows = await query(
    `SELECT s.id, s.status, s.items_total, s.commission, s.deductions, (s.items_total - s.commission - s.deductions) AS net,
            o.order_no, o.status AS order_status, o.channel, s.created_at, st.status AS settlement_status, st.utr, st.paid_at
       FROM sub_orders s JOIN orders o ON o.id=s.order_id LEFT JOIN settlements st ON st.id=s.settlement_id
      WHERE s.farmer_id=$1 AND s.status NOT IN ('rejected','expired','cancelled') AND o.status NOT IN ('pending_payment','payment_failed')
      ORDER BY s.created_at DESC LIMIT 100`, [farmerId]);
  return rows.map((r): Record<string, any> => ({
    ...r,
    payout_state: r.settlement_status === 'paid' ? 'Paid' : r.order_status === 'completed' ? 'Due' : r.status === 'delivered' ? 'In complaint window' : 'Accruing',
  }));
}

export async function payFarmer(adminId: number, farmerId: number, utr: string) {
  return tx(async (q) => {
    const [fp] = await q.query('SELECT payout_hold FROM farmer_profiles WHERE user_id=$1', [farmerId]);
    if (fp?.payout_hold) throw new Error(`Payout is on hold: ${fp.payout_hold}`);
    const [due] = await q.query(`${DUE_SQL} AND s.farmer_id=$1 GROUP BY s.farmer_id`, [farmerId]);
    if (!due) throw new Error('Nothing is due for this farmer.');
    const [st] = await q.query(
      `INSERT INTO settlements (farmer_id, gross, commission, deductions, net, sub_order_count, status, utr, approved_by, paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,'paid',$7,$8, now()) RETURNING id`,
      [farmerId, due.gross, due.commission, due.deductions, round2(due.net), due.sub_orders, utr.trim(), adminId]);
    await q.query(
      `UPDATE sub_orders s SET settlement_id=$2 FROM orders o
        WHERE o.id=s.order_id AND s.farmer_id=$1 AND s.status='delivered' AND o.status='completed' AND s.settlement_id IS NULL`,
      [farmerId, st.id]);
    await audit(q, adminId, 'settlement.paid', 'settlement', st.id, '', { farmerId, net: due.net, utr });
    await notify(q, farmerId, 'Payment sent', `₹${round2(due.net)} sent. UTR ${utr}.`, '/farmer/payments');
  });
}

/** W4: ops resolves a complaint. A refund blamed on the farmer is deducted from their next settlement. */
export async function resolveComplaint(adminId: number, id: number, outcome: { status: 'resolved' | 'rejected'; refund: number; fault: string; resolution: string }) {
  return tx(async (q) => {
    const [c] = await q.query('SELECT * FROM complaints WHERE id=$1 FOR UPDATE', [id]);
    if (!c || c.status !== 'open') throw new Error('Complaint is not open.');
    const refund = outcome.status === 'resolved' ? Math.max(0, outcome.refund) : 0;
    await q.query("UPDATE complaints SET status=$2, refund_amount=$3, fault_party=$4, resolution=$5, resolved_at=now() WHERE id=$1",
      [id, outcome.status, refund, outcome.fault, outcome.resolution]);
    if (refund > 0) {
      await q.query("UPDATE orders SET refunded = refunded + $2, payment_status = CASE WHEN payment_status='paid' THEN 'partly_refunded' ELSE payment_status END WHERE id=$1", [c.order_id, refund]);
      if (outcome.fault === 'farmer' && c.sub_order_id) {
        await q.query('UPDATE sub_orders SET deductions = deductions + $2 WHERE id=$1', [c.sub_order_id, refund]);
        const [s] = await q.query('SELECT farmer_id FROM sub_orders WHERE id=$1', [c.sub_order_id]);
        await notify(q, s.farmer_id, 'Complaint deduction', `₹${refund} will be deducted from your next payment: ${outcome.resolution}`, '/farmer/payments');
      }
    }
    await audit(q, adminId, 'complaint.resolve', 'complaint', id, 'open', { ...outcome, refund });
    await notify(q, c.user_id, 'Your complaint was reviewed', outcome.resolution + (refund ? ` Refund: ₹${refund}.` : ''), '/orders');
  });
}
