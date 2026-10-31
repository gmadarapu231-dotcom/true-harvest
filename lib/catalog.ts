import { query, one } from './db';
import { SELLABLE_SQL } from './inventory';

// Buyer-facing reads. Farmer contact, bank and ID details are never selected here (R-2.2).
const BASE = `
  SELECT l.id, l.farmer_id, l.variety, l.grade, l.price_per_kg, l.b2b_price_per_kg, l.open_to_offers, l.min_order_kg,
         l.ready_from, l.available_until, l.channels, l.fulfilment, l.description, l.photo_id, l.created_at,
         ${SELLABLE_SQL} AS sellable_kg,
         c.id AS crop_id, c.name AS crop, c.name_te AS crop_te, c.category, c.emoji,
         u.name AS farmer_name, fp.village, fp.mandal, fp.district, fp.state, fp.farm_size_acres,
         (SELECT avg(r.farmer_stars) FROM ratings r JOIN sub_orders s ON s.id=r.sub_order_id WHERE s.farmer_id=l.farmer_id) AS rating
    FROM listings l JOIN crops c ON c.id=l.crop_id JOIN users u ON u.id=l.farmer_id JOIN farmer_profiles fp ON fp.user_id=l.farmer_id
   WHERE l.status='live' AND fp.status='verified' AND ${SELLABLE_SQL} > 0`;

export type Channel = 'b2c' | 'b2b';
const channelSql = (ch: Channel) => (ch === 'b2b' ? "l.channels IN ('b2b','both')" : "l.channels IN ('b2c','both')");

export async function browse(opts: { channel: Channel; category?: string; q?: string; farmerId?: number; cropId?: number; sort?: string; state?: string; district?: string }) {
  const where: string[] = [channelSql(opts.channel)];
  const params: unknown[] = [];
  if (opts.category) { params.push(opts.category); where.push(`c.category = $${params.length}`); }
  if (opts.q) { params.push(`%${opts.q}%`); where.push(`(c.name ILIKE $${params.length} OR c.name_te ILIKE $${params.length} OR l.variety ILIKE $${params.length} OR u.name ILIKE $${params.length})`); }
  if (opts.farmerId) { params.push(opts.farmerId); where.push(`l.farmer_id = $${params.length}`); }
  if (opts.state) { params.push(opts.state); where.push(`fp.state = $${params.length}`); }
  if (opts.district) { params.push(opts.district); where.push(`fp.district = $${params.length}`); }
  if (opts.cropId) { params.push(opts.cropId); where.push(`l.crop_id = $${params.length}`); }
  const order = opts.sort === 'price' ? 'l.price_per_kg ASC' : opts.sort === 'harvest' ? 'l.ready_from DESC' : 'l.ready_from <= current_date DESC, l.created_at DESC';
  return query(`${BASE} AND ${where.join(' AND ')} ORDER BY ${order} LIMIT 120`, params);
}

/** Districts with stock on sale for a channel, for the shop's area filter. */
export async function stockedDistricts(channel: Channel) {
  return query<{ state: string; district: string; n: number }>(
    `SELECT fp.state, fp.district, count(*)::int AS n FROM (${BASE} AND ${channelSql(channel)}) b JOIN farmer_profiles fp ON fp.user_id=b.farmer_id GROUP BY 1, 2 ORDER BY 1 DESC, 2`);
}

export async function listingById(id: number) {
  return one(`${BASE} AND l.id = $1`, [id]);
}

export async function farmerStorefront(id: number) {
  return one(
    `SELECT u.id, u.name, fp.village, fp.mandal, fp.district, fp.state, fp.farm_size_acres, fp.main_crops, fp.verified_at,
            (SELECT avg(r.farmer_stars) FROM ratings r JOIN sub_orders s ON s.id=r.sub_order_id WHERE s.farmer_id=u.id) AS rating,
            (SELECT count(*)::int FROM ratings r JOIN sub_orders s ON s.id=r.sub_order_id WHERE s.farmer_id=u.id) AS rating_count
       FROM users u JOIN farmer_profiles fp ON fp.user_id=u.id WHERE u.id=$1 AND fp.status='verified'`, [id]);
}

export async function latestMandi(cropId: number) {
  return query('SELECT * FROM (SELECT DISTINCT ON (market) market, date, min_price, max_price, modal_price FROM mandi_prices WHERE crop_id=$1 ORDER BY market, date DESC) x ORDER BY date DESC, market LIMIT 3', [cropId]);
}
