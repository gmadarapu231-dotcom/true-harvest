'use server';
import { redirect } from 'next/navigation';
import { currentUser, requireUser } from '../auth';
import { readCart, writeCart } from '../cart';
import { one, query } from '../db';
import { attempt, back, str, num, int } from '../http';
import { placeOrder, capturePayment, cancelByBuyer, OrderError } from '../orders';
import { StockError } from '../inventory';
import { getSettings } from '../settings';
import { notifyAdmins } from '../notify';
import { COMPLAINT_TYPES } from '../config';

export async function addToCart(fd: FormData) {
  const u = await currentUser();
  const listingId = int(fd, 'listing_id');
  const b2b = u?.role === 'business';
  const packKg = b2b ? num(fd, 'qty_kg') : num(fd, 'pack_kg');
  const count = b2b ? 1 : Math.max(1, int(fd, 'count') || 1);
  const path = `/shop/${listingId}`;
  if (!(packKg > 0)) back(path, b2b ? 'Enter the quantity in kg.' : 'Choose a pack size.');
  const l = await one<{ farmer_id: number; min_order_kg: number }>('SELECT farmer_id, min_order_kg FROM listings WHERE id=$1', [listingId]);
  if (!l) back('/shop', 'That item is no longer available.');
  if (b2b && packKg < l.min_order_kg) back(path, `Minimum order for this listing is ${l.min_order_kg} kg.`);
  const cart = await readCart();
  const s = await getSettings();
  if (!b2b && !s.multi_farmer_cart && cart.length) {
    const ids = cart.map((c) => c.listingId);
    const other = await one('SELECT 1 FROM listings WHERE id = ANY($1::int[]) AND farmer_id <> $2 LIMIT 1', [ids, l.farmer_id]);
    if (other) back(path, 'Your cart already has items from another farmer. For now each order comes from one farm, so please check out or empty your cart first.');
  }
  const existing = cart.find((c) => c.listingId === listingId && c.packKg === packKg);
  if (existing) existing.count += count;
  else cart.push({ listingId, packKg, count });
  await writeCart(cart);
  back('/cart', null, 'Added to cart.');
}

export async function updateCartLine(fd: FormData) {
  const idx = int(fd, 'idx');
  const count = int(fd, 'count');
  const cart = await readCart();
  if (cart[idx]) {
    if (count > 0) cart[idx].count = Math.min(count, 99);
    else cart.splice(idx, 1);
  }
  await writeCart(cart);
  redirect('/cart');
}

export async function emptyCart() {
  await writeCart([]);
  redirect('/cart');
}

export async function checkout(fd: FormData) {
  const u = await requireUser('consumer', 'business');
  const lines = await readCart();
  let order: { order_no: string; status: string } | undefined;
  const err = await attempt(async () => {
    order = await placeOrder({
      buyerId: u.id, channel: u.role === 'business' ? 'b2b' : 'b2c', lines,
      address: str(fd, 'address'), pin: str(fd, 'pin'), deliveryDate: str(fd, 'delivery_date'), slot: str(fd, 'slot'),
      paymentMode: str(fd, 'payment_mode') === 'pay_on_delivery' ? 'pay_on_delivery' : 'online',
    });
  });
  if (err || !order) back('/cart', err);
  await writeCart([]);
  if (str(fd, 'save_address')) await query('UPDATE users SET address=$2, pin=$3 WHERE id=$1', [u.id, str(fd, 'address'), str(fd, 'pin')]);
  redirect(order.status === 'pending_payment' ? `/pay/${order.order_no}` : `/orders/${order.order_no}?ok=${encodeURIComponent('Order placed. The farmer will confirm shortly.')}`);
}

export async function payTestMode(fd: FormData) {
  const u = await requireUser('consumer', 'business');
  const no = str(fd, 'order_no');
  if (str(fd, 'outcome') === 'fail') back(`/pay/${no}`, 'Payment failed. You can try again before the order expires.');
  const err = await attempt(() => capturePayment(no, u.id, `TEST-${Date.now()}`));
  back(err ? `/pay/${no}` : `/orders/${no}`, err, 'Payment received. The farmer will confirm shortly.');
}

export async function cancelOrder(fd: FormData) {
  const u = await requireUser('consumer', 'business');
  const no = str(fd, 'order_no');
  const err = await attempt(() => cancelByBuyer(u.id, no));
  back(`/orders/${no}`, err, 'Order cancelled. Any payment will be refunded to the original method.');
}

export async function rateSubOrder(fd: FormData) {
  const u = await requireUser('consumer', 'business');
  const subId = int(fd, 'sub_order_id');
  const no = str(fd, 'order_no');
  const owns = await one("SELECT 1 FROM sub_orders s JOIN orders o ON o.id=s.order_id WHERE s.id=$1 AND o.buyer_id=$2 AND s.status='delivered'", [subId, u.id]);
  if (!owns) back(`/orders/${no}`, 'You can rate an order after it is delivered.');
  const fs = Math.min(5, Math.max(1, int(fd, 'farmer_stars') || 5));
  const ds = int(fd, 'delivery_stars');
  await query(
    `INSERT INTO ratings (sub_order_id, farmer_stars, delivery_stars, comment) VALUES ($1,$2,$3,$4)
     ON CONFLICT (sub_order_id) DO UPDATE SET farmer_stars=EXCLUDED.farmer_stars, delivery_stars=EXCLUDED.delivery_stars, comment=EXCLUDED.comment`,
    [subId, fs, ds >= 1 && ds <= 5 ? ds : null, str(fd, 'comment').slice(0, 500)]);
  back(`/orders/${no}`, null, 'Thanks for rating.');
}

export async function raiseComplaint(fd: FormData) {
  const u = await requireUser('consumer', 'business');
  const no = str(fd, 'order_no');
  const subId = int(fd, 'sub_order_id');
  const type = str(fd, 'type');
  if (!COMPLAINT_TYPES.includes(type as any)) back(`/orders/${no}`, 'Choose what went wrong.');
  const o = await one<{ id: number }>("SELECT o.id FROM orders o JOIN sub_orders s ON s.order_id=o.id WHERE o.order_no=$1 AND o.buyer_id=$2 AND s.id=$3 AND s.status='delivered'", [no, u.id, subId]);
  if (!o) back(`/orders/${no}`, 'You can report a problem once the order is delivered.');
  let photoId: number | null = null;
  const file = fd.get('photo');
  if (file instanceof File && file.size > 0) {
    if (file.size > 3_000_000 || !file.type.startsWith('image/')) back(`/orders/${no}`, 'Photo must be an image under 3 MB.');
    photoId = (await one<{ id: number }>('INSERT INTO photos (mime, data) VALUES ($1,$2) RETURNING id', [file.type, Buffer.from(await file.arrayBuffer())]))!.id;
  }
  await query('INSERT INTO complaints (order_id, sub_order_id, user_id, type, details, photo_id) VALUES ($1,$2,$3,$4,$5,$6)',
    [o.id, subId, u.id, type, str(fd, 'details').slice(0, 1000), photoId]);
  await notifyAdmins({ query }, 'New complaint', `Order ${no}: ${type.replace('_', ' ')}`, '/admin/complaints');
  back(`/orders/${no}`, null, 'Problem reported. We acknowledge every complaint within 48 hours.');
}

export async function reorder(fd: FormData) {
  const u = await requireUser('consumer', 'business');
  const lines = await query<{ listing_id: number; ordered_kg: number; pack_label: string }>(
    'SELECT ol.listing_id, ol.ordered_kg, ol.pack_label FROM order_lines ol JOIN sub_orders s ON s.id=ol.sub_order_id JOIN orders o ON o.id=s.order_id WHERE o.order_no=$1 AND o.buyer_id=$2',
    [str(fd, 'order_no'), u.id]);
  const cart = lines.map((l) => {
    const m = l.pack_label.match(/^(\d+) × ([\d.]+) (kg|g)$/);
    return m ? { listingId: l.listing_id, count: +m[1], packKg: m[3] === 'g' ? +m[2] / 1000 : +m[2] } : { listingId: l.listing_id, count: 1, packKg: l.ordered_kg };
  });
  await writeCart(cart);
  back('/cart', null, 'Items added again. Prices and stock are re-checked when you place the order.');
}

void OrderError; void StockError;
