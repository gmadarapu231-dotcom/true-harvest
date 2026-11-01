import crypto from 'node:crypto';
import { tx, type Queryable } from './db';
import { moveStock, StockError, SELLABLE_SQL } from './inventory';
import { getSettings, pins, type Settings } from './settings';
import { notify, notifyAdmins, audit } from './notify';

// Order workflows and state machines (SRS section 10). Every transition is checked here, on the server.

export interface CartLine { listingId: number; packKg: number; count: number }
export const round2 = (n: number) => Math.round(n * 100) / 100;
const rupee = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export class OrderError extends Error {}

function orderNo() {
  const d = new Date();
  return `FM${d.getFullYear() % 100}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${crypto.randomInt(10000, 99999)}`;
}

export function priceFor(listing: Record<string, any>, channel: 'b2c' | 'b2b'): number {
  return channel === 'b2b' && listing.b2b_price_per_kg ? listing.b2b_price_per_kg : listing.price_per_kg;
}

export function deliveryFeeFor(s: Settings, itemsTotal: number, channel: 'b2c' | 'b2b') {
  if (channel === 'b2b') return s.delivery_fee; // B2B fee is quoted per delivery; free-delivery threshold is a household promo
  return itemsTotal >= s.free_delivery_above ? 0 : s.delivery_fee;
}

async function event(q: Queryable, orderId: number, subOrderId: number | null, status: string, actorId: number | null, note = '') {
  await q.query('INSERT INTO order_events (order_id, sub_order_id, status, note, actor_id) VALUES ($1,$2,$3,$4,$5)', [orderId, subOrderId, status, note, actorId]);
}

/**
 * W1 step 1: place an order from a cart. Reserves every line atomically (R-9.1): if any line cannot be
 * reserved the whole transaction rolls back and the buyer is told which items changed.
 */
export async function placeOrder(input: {
  buyerId: number; channel: 'b2c' | 'b2b'; lines: CartLine[]; address: string; pin: string;
  deliveryDate: string; slot: string; paymentMode: 'online' | 'pay_on_delivery';
  /** Subscription boxes: delivery and packing are included in the plan, so the buyer pays only for produce. */
  waiveFees?: boolean;
  /** Subscription boxes are assembled at the hub, so they may mix farms even when the cart may not. */
  mixFarms?: boolean;
}) {
  return tx(async (q) => {
    const s = await getSettings(q);
    if (!input.lines.length) throw new OrderError('Your cart is empty.');
    if (input.channel === 'b2c' && !pins(s).includes(input.pin.trim())) {
      throw new OrderError(`Sorry, we don't deliver to PIN ${input.pin || '(blank)'} yet.`);
    }
    if (input.paymentMode === 'pay_on_delivery' && !s.cod_enabled) throw new OrderError('Pay on delivery is not available right now.');
    if (!input.address.trim()) throw new OrderError('Please add a delivery address.');

    const ids = [...new Set(input.lines.map((l) => l.listingId))];
    const listings = await q.query(
      `SELECT l.*, c.name AS crop_name, ${SELLABLE_SQL} AS sellable_kg, fp.status AS farmer_status
         FROM listings l JOIN crops c ON c.id = l.crop_id JOIN farmer_profiles fp ON fp.user_id = l.farmer_id
        WHERE l.id = ANY($1::int[])`,
      [ids],
    );
    const byId = new Map(listings.map((l) => [l.id, l]));
    const problems: string[] = [];
    const bad: number[] = [];
    for (const line of input.lines) {
      const l = byId.get(line.listingId);
      const kg = line.packKg * line.count;
      if (!l || l.status !== 'live' || l.farmer_status !== 'verified') { problems.push(`${l?.crop_name ?? 'An item'} is no longer on sale`); bad.push(line.listingId); continue; }
      const okChannel = l.channels === 'both' || l.channels === input.channel;
      if (!okChannel) { problems.push(`${l.crop_name} (${l.variety}) is not sold to ${input.channel === 'b2b' ? 'businesses' : 'households'}`); bad.push(l.id); }
      if (input.channel === 'b2b' && kg < l.min_order_kg) { problems.push(`${l.crop_name}: minimum order is ${l.min_order_kg} kg`); bad.push(l.id); }
    }
    const farmers = new Set(input.lines.map((l) => byId.get(l.listingId)?.farmer_id));
    if (input.channel === 'b2c' && !s.multi_farmer_cart && !input.mixFarms && farmers.size > 1) {
      throw new OrderError('Your cart has items from more than one farmer. For now each order comes from one farm. Please remove the other farmer’s items.');
    }
    if (problems.length) throw new StockError(problems.join('. ') + '.', bad);

    const totalItems = round2(input.lines.reduce((sum, line) => sum + line.packKg * line.count * priceFor(byId.get(line.listingId)!, input.channel), 0));
    if (input.channel === 'b2c' && totalItems < s.min_order_value) {
      throw new OrderError(`Minimum order value is ${rupee(s.min_order_value)}. Add ${rupee(round2(s.min_order_value - totalItems))} more.`);
    }
    const deliveryFee = input.waiveFees ? 0 : deliveryFeeFor(s, totalItems, input.channel);
    const packingFee = input.channel === 'b2c' && !input.waiveFees ? s.packing_fee : 0;
    const rate = input.channel === 'b2c' ? s.commission_b2c : s.commission_b2b;
    const pod = input.paymentMode === 'pay_on_delivery';

    const [order] = await q.query(
      `INSERT INTO orders (order_no, buyer_id, channel, status, items_total, delivery_fee, packing_fee, total, payment_mode, address, pin, delivery_date, slot, delivery_otp, rules_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [orderNo(), input.buyerId, input.channel, pod ? 'placed' : 'pending_payment', totalItems, deliveryFee, packingFee,
       round2(totalItems + deliveryFee + packingFee), input.paymentMode, input.address.trim(), input.pin.trim(),
       input.deliveryDate || null, input.slot, String(crypto.randomInt(1000, 10000)),
       JSON.stringify({ commission: rate, delivery_fee: s.delivery_fee, free_delivery_above: s.free_delivery_above, packing_fee: s.packing_fee })],
    );
    const windowMin = input.channel === 'b2c' ? s.accept_window_b2c_min : s.accept_window_b2b_min;

    for (const farmerId of farmers) {
      const mine = input.lines.filter((l) => byId.get(l.listingId)!.farmer_id === farmerId);
      const subTotal = round2(mine.reduce((sum, l) => sum + l.packKg * l.count * priceFor(byId.get(l.listingId)!, input.channel), 0));
      const [sub] = await q.query(
        `INSERT INTO sub_orders (order_id, farmer_id, items_total, commission_rate, commission, accept_deadline)
         VALUES ($1,$2,$3,$4,$5, CASE WHEN $6 THEN now() + ($7 || ' minutes')::interval ELSE NULL END) RETURNING id`,
        [order.id, farmerId, subTotal, rate, round2(subTotal * rate), pod, String(windowMin)],
      );
      for (const line of mine) {
        const l = byId.get(line.listingId)!;
        const kg = Math.round(line.packKg * line.count * 1000) / 1000;
        const price = priceFor(l, input.channel);
        const label = line.packKg >= 1 ? `${line.count} × ${line.packKg} kg` : `${line.count} × ${line.packKg * 1000} g`;
        const [ol] = await q.query(
          'INSERT INTO order_lines (sub_order_id, listing_id, pack_label, ordered_kg, price_per_kg, line_total) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
          [sub.id, l.id, label, kg, price, round2(kg * price)],
        );
        if (!(await moveStock(q, l.id, 'sellable', 'reserved', kg, { reason: `order ${order.order_no}`, actorId: input.buyerId, orderLineId: ol.id }))) {
          throw new StockError(`Only ${Math.max(0, l.sellable_kg)} kg of ${l.crop_name} (${l.variety}) is left. Please reduce the quantity.`, [l.id]);
        }
      }
      if (pod) await notify(q, farmerId, 'New order to accept', `Order ${order.order_no}: ${rupee(subTotal)}. Accept within ${windowMin} minutes.`, '/farmer/orders');
    }
    await event(q, order.id, null, order.status, input.buyerId);
    return order as { id: number; order_no: string; status: string };
  });
}

/** Test-mode payment capture. In production this runs only from the verified Razorpay webhook (R-11.1). */
export async function capturePayment(orderNo: string, buyerId: number, ref: string) {
  return tx(async (q) => {
    const [o] = await q.query("SELECT * FROM orders WHERE order_no=$1 AND buyer_id=$2 FOR UPDATE", [orderNo, buyerId]);
    if (!o) throw new OrderError('Order not found.');
    if (o.payment_status === 'paid') return o;
    if (o.status === 'payment_failed' || o.status === 'cancelled') throw new OrderError('This order has expired. Please order again.');
    const s = await getSettings(q);
    const windowMin = o.channel === 'b2c' ? s.accept_window_b2c_min : s.accept_window_b2b_min;
    await q.query("UPDATE orders SET payment_status='paid', payment_ref=$2, status = CASE WHEN status='pending_payment' THEN 'placed' ELSE status END WHERE id=$1", [o.id, ref]);
    const subs = await q.query(
      `UPDATE sub_orders SET accept_deadline = now() + ($2 || ' minutes')::interval
        WHERE order_id=$1 AND status='awaiting_acceptance' RETURNING id, farmer_id, items_total`,
      [o.id, String(windowMin)],
    );
    for (const sub of subs) await notify(q, sub.farmer_id, 'New order to accept', `Order ${o.order_no}: ${rupee(sub.items_total)}. Accept within ${windowMin} minutes.`, '/farmer/orders');
    await event(q, o.id, null, 'paid', buyerId, ref);
    return o;
  });
}

async function releaseSubOrder(q: Queryable, subId: number, status: 'rejected' | 'expired' | 'cancelled', actorId: number | null, reason: string) {
  const [sub] = await q.query(
    `UPDATE sub_orders SET status=$2, rejected_reason=$3, commission=0 WHERE id=$1 AND status IN ('awaiting_acceptance','accepted','packed') RETURNING *`,
    [subId, status, reason],
  );
  if (!sub) return null;
  const lines = await q.query("SELECT * FROM order_lines WHERE sub_order_id=$1 AND status IN ('reserved','confirmed')", [subId]);
  for (const l of lines) {
    await moveStock(q, l.listing_id, l.status === 'reserved' ? 'reserved' : 'confirmed', 'sellable', l.ordered_kg, { reason: status, actorId, orderLineId: l.id });
    await q.query("UPDATE order_lines SET status='released' WHERE id=$1", [l.id]);
  }
  const [o] = await q.query('SELECT * FROM orders WHERE id=$1', [sub.order_id]);
  // Refund the lines that will not be delivered (R-5.6: re-sourcing is manual in this MVP; the line is refunded).
  if (o.payment_status === 'paid' || o.payment_status === 'partly_refunded') {
    await q.query("UPDATE orders SET refunded = refunded + $2, payment_status = 'partly_refunded' WHERE id=$1", [o.id, sub.items_total]);
  }
  await event(q, o.id, subId, status, actorId, reason);
  await settleOrderStatus(q, o.id);
  return { sub, order: o };
}

/** Recompute the customer-facing order status from its sub-orders. */
async function settleOrderStatus(q: Queryable, orderId: number) {
  const [o] = await q.query('SELECT * FROM orders WHERE id=$1', [orderId]);
  const subs = await q.query('SELECT status FROM sub_orders WHERE order_id=$1', [orderId]);
  const live = subs.filter((s) => !['rejected', 'expired', 'cancelled'].includes(s.status));
  let next = o.status;
  if (!live.length) {
    next = 'cancelled';
    if (o.payment_status !== 'pending') await q.query("UPDATE orders SET payment_status='refunded', refunded=total WHERE id=$1", [orderId]);
  } else if (live.every((s) => s.status === 'delivered')) next = 'delivered';
  else if (live.some((s) => ['out_for_delivery', 'delivered'].includes(s.status))) next = 'out_for_delivery';
  else if (live.every((s) => s.status !== 'awaiting_acceptance')) next = 'confirmed';
  if (next !== o.status && !['pending_payment', 'completed'].includes(o.status)) {
    await q.query("UPDATE orders SET status=$2, delivered_at = CASE WHEN $2='delivered' THEN now() ELSE delivered_at END WHERE id=$1", [orderId, next]);
    // Pay-on-delivery is collected by the partner at the door (UPI QR); record it as paid on delivery.
    if (next === 'delivered' && o.payment_mode === 'pay_on_delivery' && o.payment_status === 'pending') {
      await q.query("UPDATE orders SET payment_status = CASE WHEN refunded > 0 THEN 'partly_refunded' ELSE 'paid' END, payment_ref='collected on delivery' WHERE id=$1", [orderId]);
    }
    await event(q, orderId, null, next, null);
    const label: Record<string, string> = { confirmed: 'Your order is confirmed', out_for_delivery: 'Your order is on the way', delivered: 'Order delivered', cancelled: 'Order cancelled' };
    if (label[next]) await notify(q, o.buyer_id, label[next], `Order ${o.order_no}`, `/orders/${o.order_no}`);
  }
}

/** Farmer accepts or rejects a sub-order inside the accept window (R-4.8). */
export async function farmerDecide(farmerId: number, subId: number, accept: boolean, reason = '') {
  return tx(async (q) => {
    const [sub] = await q.query('SELECT s.*, o.order_no, o.buyer_id, o.status AS order_status FROM sub_orders s JOIN orders o ON o.id=s.order_id WHERE s.id=$1 AND s.farmer_id=$2 FOR UPDATE OF s', [subId, farmerId]);
    if (!sub) throw new OrderError('Order not found.');
    if (sub.status !== 'awaiting_acceptance') throw new OrderError('This order has already been handled.');
    if (sub.order_status === 'pending_payment') throw new OrderError('The buyer has not paid yet.');
    if (!accept) {
      await releaseSubOrder(q, subId, 'rejected', farmerId, reason || 'Other');
      await notifyAdmins(q, 'Farmer rejected an order', `Order ${sub.order_no}: ${reason}. Re-source or refund.`, '/admin/orders');
      return;
    }
    if (sub.accept_deadline && new Date(sub.accept_deadline) < new Date()) throw new OrderError('The time to accept this order has passed.');
    const lines = await q.query("SELECT * FROM order_lines WHERE sub_order_id=$1 AND status='reserved'", [subId]);
    for (const l of lines) {
      await moveStock(q, l.listing_id, 'reserved', 'confirmed', l.ordered_kg, { reason: 'farmer accepted', actorId: farmerId, orderLineId: l.id });
      await q.query("UPDATE order_lines SET status='confirmed' WHERE id=$1", [l.id]);
    }
    await q.query("UPDATE sub_orders SET status='accepted', accepted_at=now() WHERE id=$1", [subId]);
    await event(q, sub.order_id, subId, 'accepted', farmerId);
    await settleOrderStatus(q, sub.order_id);
  });
}

const FLOW = ['accepted', 'packed', 'picked_up', 'out_for_delivery', 'delivered'] as const;

/** Forward-only fulfilment steps. Farmers can mark packed; partners and ops move it from pickup to delivery. */
export async function advanceSubOrder(actor: { id: number; role: string }, subId: number, to: (typeof FLOW)[number], otp?: string) {
  return tx(async (q) => {
    const [sub] = await q.query('SELECT s.*, o.delivery_otp, o.order_no, o.buyer_id FROM sub_orders s JOIN orders o ON o.id=s.order_id WHERE s.id=$1 FOR UPDATE OF s', [subId]);
    if (!sub) throw new OrderError('Order not found.');
    const allowed =
      actor.role === 'admin' ||
      (actor.role === 'farmer' && sub.farmer_id === actor.id && to === 'packed') ||
      (actor.role === 'partner' && sub.partner_id === actor.id && ['picked_up', 'out_for_delivery', 'delivered'].includes(to));
    if (!allowed) throw new OrderError('You cannot make this change.');
    const fromIdx = FLOW.indexOf(sub.status);
    const toIdx = FLOW.indexOf(to);
    if (fromIdx < 0 || toIdx <= fromIdx) throw new OrderError(`Cannot move an order from ${sub.status.replaceAll('_', ' ')} to ${to.replaceAll('_', ' ')}.`);
    if (to === 'delivered' && actor.role === 'partner' && (otp ?? '').trim() !== sub.delivery_otp) throw new OrderError('Delivery OTP does not match. Ask the customer for the 4-digit code.');
    if (to === 'delivered') {
      const lines = await q.query("SELECT * FROM order_lines WHERE sub_order_id=$1 AND status='confirmed'", [subId]);
      for (const l of lines) {
        await moveStock(q, l.listing_id, 'confirmed', 'delivered', l.ordered_kg, { reason: 'delivered', actorId: actor.id, orderLineId: l.id });
        await q.query("UPDATE order_lines SET status='delivered', delivered_kg=ordered_kg WHERE id=$1", [l.id]);
      }
      await q.query('UPDATE sub_orders SET delivered_at=now() WHERE id=$1', [subId]);
    }
    await q.query('UPDATE sub_orders SET status=$2 WHERE id=$1', [subId, to]);
    await event(q, sub.order_id, subId, to, actor.id);
    if (actor.role === 'admin') await audit(q, actor.id, 'sub_order.status', 'sub_order', subId, sub.status, to);
    await settleOrderStatus(q, sub.order_id);
  });
}

/** Buyer cancels free of charge until the farmer accepts (R-5.7). */
export async function cancelByBuyer(buyerId: number, orderNo: string) {
  return tx(async (q) => {
    const [o] = await q.query('SELECT * FROM orders WHERE order_no=$1 AND buyer_id=$2', [orderNo, buyerId]);
    if (!o) throw new OrderError('Order not found.');
    const subs = await q.query('SELECT * FROM sub_orders WHERE order_id=$1', [o.id]);
    if (subs.some((s) => !['awaiting_acceptance', 'rejected', 'expired', 'cancelled'].includes(s.status))) {
      throw new OrderError('The farmer has already accepted this order. Please contact support to cancel.');
    }
    for (const s of subs) if (s.status === 'awaiting_acceptance') await releaseSubOrder(q, s.id, 'cancelled', buyerId, 'Cancelled by buyer');
    await q.query("UPDATE orders SET status='cancelled' WHERE id=$1", [o.id]);
  });
}

/** Admin assigns a delivery partner to a sub-order (manual allocation, section 7). */
export async function assignPartner(adminId: number, subId: number, partnerId: number | null) {
  return tx(async (q) => {
    const [before] = await q.query('SELECT partner_id, order_id FROM sub_orders WHERE id=$1', [subId]);
    await q.query('UPDATE sub_orders SET partner_id=$2 WHERE id=$1', [subId, partnerId]);
    await audit(q, adminId, 'sub_order.assign_partner', 'sub_order', subId, before?.partner_id ?? '', partnerId ?? '');
    if (partnerId) await notify(q, partnerId, 'New delivery task', `Sub-order #${subId}`, '/partner');
  });
}

/** W2: buyer accepts a farmer's offer. Stock is taken at this moment and the order is created already accepted (R-6.4). */
export async function acceptOffer(businessId: number, offerId: number, paymentMode: 'online' | 'pay_on_delivery') {
  return tx(async (q) => {
    const [of] = await q.query(
      `SELECT o.*, e.business_id, e.address, e.delivery_date, e.status AS enquiry_status, e.id AS eid, c.name AS crop_name
         FROM offers o JOIN enquiries e ON e.id=o.enquiry_id JOIN listings l ON l.id=o.listing_id JOIN crops c ON c.id=l.crop_id
        WHERE o.id=$1 FOR UPDATE OF o`,
      [offerId],
    );
    if (!of || of.business_id !== businessId) throw new OrderError('Offer not found.');
    if (of.status !== 'sent') throw new OrderError(`This offer is ${of.status}.`);
    if (new Date(of.valid_until) < new Date()) throw new OrderError('This offer has expired. Ask the farmer for a fresh quote.');
    const s = await getSettings(q);
    const itemsTotal = round2(of.qty_kg * of.price_per_kg);
    const deliveryFee = deliveryFeeFor(s, itemsTotal, 'b2b');
    const [order] = await q.query(
      `INSERT INTO orders (order_no, buyer_id, channel, status, items_total, delivery_fee, total, payment_mode, address, delivery_date, slot, delivery_otp, rules_snapshot, offer_id)
       VALUES ($1,$2,'b2b','confirmed',$3,$4,$5,$6,$7,$8,'',$9,$10,$11) RETURNING *`,
      [orderNo(), businessId, itemsTotal, deliveryFee, round2(itemsTotal + deliveryFee), paymentMode, of.address, of.delivery_date,
       String(crypto.randomInt(1000, 10000)), JSON.stringify({ commission: s.commission_b2b, delivery_fee: s.delivery_fee }), offerId],
    );
    const [sub] = await q.query(
      "INSERT INTO sub_orders (order_id, farmer_id, status, items_total, commission_rate, commission, accepted_at) VALUES ($1,$2,'accepted',$3,$4,$5, now()) RETURNING id",
      [order.id, of.farmer_id, itemsTotal, s.commission_b2b, round2(itemsTotal * s.commission_b2b)],
    );
    const [ol] = await q.query(
      "INSERT INTO order_lines (sub_order_id, listing_id, pack_label, ordered_kg, price_per_kg, line_total, status) VALUES ($1,$2,'bulk',$3,$4,$5,'confirmed') RETURNING id",
      [sub.id, of.listing_id, of.qty_kg, of.price_per_kg, itemsTotal],
    );
    if (!(await moveStock(q, of.listing_id, 'sellable', 'confirmed', of.qty_kg, { reason: `offer ${offerId} accepted`, actorId: businessId, orderLineId: ol.id }))) {
      // Fail cleanly: roll this transaction back, then record the failure in its own write.
      throw new StockError(`The farmer no longer has ${of.qty_kg} kg of ${of.crop_name} available. The offer could not be accepted.`, [of.listing_id]);
    }
    await q.query("UPDATE offers SET status='accepted' WHERE id=$1", [offerId]);
    await q.query("UPDATE offers SET status='declined' WHERE enquiry_id=$1 AND id<>$2 AND status='sent'", [of.eid, offerId]);
    await q.query("UPDATE enquiries SET status='accepted' WHERE id=$1", [of.eid]);
    await event(q, order.id, sub.id, 'confirmed', businessId, `offer ${offerId}`);
    await notify(q, of.farmer_id, 'Your offer was accepted', `${of.qty_kg} kg ${of.crop_name} at ₹${of.price_per_kg}/kg. Order ${order.order_no}.`, '/farmer/orders');
    await notifyAdmins(q, 'B2B order confirmed', `Order ${order.order_no} needs a pickup.`, '/admin/orders');
    return order as { order_no: string };
  });
}

export async function markOfferFailed(offerId: number) {
  await tx((q) => q.query("UPDATE offers SET status='failed' WHERE id=$1 AND status='sent'", [offerId]));
}
