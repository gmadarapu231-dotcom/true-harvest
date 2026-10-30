// R-9.7: 100 simultaneous orders against a listing with 50 kg must never reserve more than 50 kg.
// Run against a real PostgreSQL so the orders truly race:  DATABASE_URL=postgres://... npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { query, one } from '../lib/db';
import { placeOrder, farmerDecide } from '../lib/orders';
import { saveSetting } from '../lib/settings';

const db = { query };

test('100 concurrent orders cannot oversell a 50 kg listing', async () => {
  const farmer = (await one<{ user_id: number }>("SELECT user_id FROM farmer_profiles WHERE status='verified' LIMIT 1"))!.user_id;
  const crop = (await one<{ id: number }>("SELECT id FROM crops WHERE name='Tomato'"))!.id;
  const today = new Date().toISOString().slice(0, 10);
  const listing = (await one<{ id: number }>(
    `INSERT INTO listings (farmer_id, crop_id, variety, listed_kg, price_per_kg, min_order_kg, ready_from, available_until, channels, status)
     VALUES ($1,$2,'race test',50,300,1,$3,$3,'b2c','live') RETURNING id`, [farmer, crop, today]))!.id;
  await saveSetting(db, 'min_order_value', 0);

  const buyers = await query<{ id: number }>("SELECT id FROM users WHERE role='consumer' LIMIT 1");
  const results = await Promise.allSettled(
    Array.from({ length: 100 }, () =>
      placeOrder({ buyerId: buyers[0].id, channel: 'b2c', lines: [{ listingId: listing, packKg: 1, count: 1 }], address: 'Test address', pin: '500084', deliveryDate: today, slot: '07:00-10:00', paymentMode: 'pay_on_delivery' })),
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const l = (await one<{ reserved_kg: number }>('SELECT reserved_kg FROM listings WHERE id=$1', [listing]))!;
  const lines = (await one<{ kg: number }>("SELECT coalesce(sum(ordered_kg),0) AS kg FROM order_lines WHERE listing_id=$1", [listing]))!;
  console.log(`placed ${ok}/100, reserved ${l.reserved_kg} kg, order lines ${lines.kg} kg`);
  assert.equal(ok, 50, 'exactly 50 one-kilo orders should succeed');
  assert.equal(Number(l.reserved_kg), 50);
  assert.equal(Number(lines.kg), 50, 'failed orders must leave no order lines behind');
  await saveSetting(db, 'min_order_value', 299);
});

test('rejecting a sub-order releases its stock back to sellable', async () => {
  const sub = (await one<{ id: number; farmer_id: number; listing_id: number; kg: number }>(
    `SELECT s.id, s.farmer_id, ol.listing_id, ol.ordered_kg AS kg FROM sub_orders s JOIN order_lines ol ON ol.sub_order_id=s.id
      JOIN listings l ON l.id=ol.listing_id WHERE l.variety='race test' AND s.status='awaiting_acceptance' LIMIT 1`))!;
  const before = (await one<{ r: number }>('SELECT reserved_kg AS r FROM listings WHERE id=$1', [sub.listing_id]))!.r;
  await farmerDecide(sub.farmer_id, sub.id, false, 'Quality dropped');
  const after = (await one<{ r: number }>('SELECT reserved_kg AS r FROM listings WHERE id=$1', [sub.listing_id]))!.r;
  assert.equal(Number(before) - Number(after), Number(sub.kg));
});
