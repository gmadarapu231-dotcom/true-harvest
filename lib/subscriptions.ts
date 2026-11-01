import { query, tx, type Queryable } from './db';
import { SELLABLE_SQL } from './inventory';
import { notify } from './notify';
import { placeOrder, OrderError, round2, type CartLine } from './orders';
import { StockError } from './inventory';
import { planDay, type Offer, type PlanItem } from './nutrition';

// Vegetable box subscriptions. A plan fixes the weeks, the delivery days, the household and a budget per box, not the
// prices: each box is filled the evening before delivery from that day's live stock, so it follows the market.

export const PLANS = [
  { weeks: 1, en: '1 week', te: '1 వారం', perk: 'Free delivery and packing on every box' },
  { weeks: 2, en: '2 weeks', te: '2 వారాలు', perk: 'Free delivery and packing, skip any day' },
  { weeks: 3, en: '3 weeks', te: '3 వారాలు', perk: 'Free delivery and packing, skip any day' },
  { weeks: 4, en: 'Monthly', te: 'నెలవారీ', perk: 'Free delivery and packing, skip or pause any time' },
] as const;
export const WEEKDAYS = [
  { d: 1, en: 'Mon', te: 'సోమ' }, { d: 2, en: 'Tue', te: 'మంగళ' }, { d: 3, en: 'Wed', te: 'బుధ' }, { d: 4, en: 'Thu', te: 'గురు' },
  { d: 5, en: 'Fri', te: 'శుక్ర' }, { d: 6, en: 'Sat', te: 'శని' }, { d: 0, en: 'Sun', te: 'ఆది' },
];
export const MIN_BOX = 299; // matches the shop's minimum order value
const PACK = 0.25; // boxes are packed in 250 g steps

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => iso(new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000));
const weekday = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay();
/** Today's date in India, as YYYY-MM-DD. */
export const todayIST = () => iso(new Date(Date.now() + 5.5 * 3600000));

/** Every delivery date of a plan: the chosen weekdays from the start date, for the plan's weeks. */
export function deliveryDates(start: string, weeks: number, days: number[]) {
  const out: string[] = [];
  for (let i = 0; i < weeks * 7; i++) { const d = addDays(start, i); if (days.includes(weekday(d))) out.push(d); }
  return out;
}

/** How many days a box has to last: until the next delivery day (a single weekly day covers 7). */
export function daysCovered(date: string, days: number[]) {
  for (let i = 1; i <= 7; i++) if (days.includes(weekday(addDays(date, i)))) return i;
  return 7;
}

export interface LiveOffer extends Offer { listing_id: number; farmer_id: number; sellable_kg: number }

/** Everything households can buy right now, one row per listing. */
export async function liveOffers(q: Queryable = { query }): Promise<LiveOffer[]> {
  return q.query<LiveOffer>(
    `SELECT l.id AS listing_id, l.farmer_id, c.name AS crop, c.name_te AS crop_te, c.category, c.emoji, l.price_per_kg::float AS price_per_kg,
            ${SELLABLE_SQL}::float AS sellable_kg
       FROM listings l JOIN crops c ON c.id=l.crop_id JOIN farmer_profiles fp ON fp.user_id=l.farmer_id
      WHERE l.status='live' AND fp.status='verified' AND l.channels IN ('b2c','both') AND l.ready_from <= current_date + 1
        AND ${SELLABLE_SQL} >= 0.25`);
}

export interface Box { items: (PlanItem & { kg: number; cost: number })[]; total: number; days: number; farmerId: number | null; trimmed: boolean }

/**
 * Fill one box: the household's daily plan for its goal, times the days until the next delivery, packed in 250 g steps,
 * capped by stock and brought within the budget. While carts are one farm per order, the box comes from the farm whose
 * stock makes the best plan.
 */
export function composeBox(sub: { adults: number; kids: number; goal: string; exclude: string; budget: number; days: string }, date: string,
  offers: LiveOffer[], multiFarm: boolean): Box {
  const days = sub.days.split(',').map(Number);
  const covered = daysCovered(date, days);
  const household = { adults: sub.adults, kids: sub.kids, goal: sub.goal, exclude: sub.exclude.split(',').map((s) => s.trim()).filter(Boolean) };
  const byFarm = new Map<number, LiveOffer[]>();
  for (const o of offers) byFarm.set(o.farmer_id, [...(byFarm.get(o.farmer_id) ?? []), o]);
  const pools: [number | null, LiveOffer[]][] = multiFarm ? [[null, offers]] : [...byFarm];
  let best: Box | null = null;
  for (const [farmerId, pool] of pools) {
    const plan = planDay(household, pool);
    const byListing = new Map(pool.map((o) => [o.listing_id, o]));
    let items = plan.items.map((i) => {
      const stock = byListing.get(i.listing_id!)!.sellable_kg;
      const kg = Math.min(Math.floor(stock / PACK) * PACK, Math.max(PACK, Math.round((i.grams * covered) / 1000 / PACK) * PACK));
      return { ...i, kg, cost: round2(kg * i.price_per_kg) };
    }).filter((i) => i.kg > 0);
    let total = items.reduce((s, i) => s + i.cost, 0);
    const topUp = total > 0 && total < MIN_BOX;
    if (topUp) {
      // A small household's box is topped up to the minimum order, one 250 g pack at a time round the items, within stock.
      for (let grew = true; total < MIN_BOX && grew;) {
        grew = false;
        for (const i of items) {
          if (total >= MIN_BOX) break;
          if (i.kg + PACK > byListing.get(i.listing_id!)!.sellable_kg) continue;
          i.kg += PACK; i.cost = round2(i.kg * i.price_per_kg); total += PACK * i.price_per_kg; grew = true;
        }
      }
    }
    const trimmed = !topUp && total > sub.budget;
    if (trimmed) {
      // Scale every item down to the budget, then drop from the end of the plan (fruit and dal come last) if still over.
      const f = sub.budget / total;
      items = items.map((i) => { const kg = Math.max(PACK, Math.floor((i.kg * f) / PACK) * PACK); return { ...i, kg, cost: round2(kg * i.price_per_kg) }; });
      total = items.reduce((s, i) => s + i.cost, 0);
      while (total > sub.budget && items.length > 1) { total -= items.pop()!.cost; }
    }
    const box = { items, total: round2(total), days: covered, farmerId, trimmed };
    if (!best || box.items.length > best.items.length || (box.items.length === best.items.length && box.total > best.total)) best = box;
  }
  return best ?? { items: [], total: 0, days: covered, farmerId: null, trimmed: false };
}

/**
 * Builds and places every box due: a box for date D is built from 6 pm (India) the evening before, or at once when
 * `through` names a date (ops "build now", tests). Idempotent: each delivery row is claimed with a conditional update.
 */
export async function buildDueBoxes(through?: string) {
  const due = await query<{ id: number }>(
    `SELECT d.id FROM subscription_deliveries d
      WHERE d.status='scheduled' AND d.deliver_on <= coalesce($1::date, ((now() AT TIME ZONE 'Asia/Kolkata') + interval '6 hours')::date)
      ORDER BY d.deliver_on, d.id`, [through ?? null]);
  let placed = 0;
  for (const { id } of due) {
    const [d] = await query(
      `UPDATE subscription_deliveries d SET built_at=now() FROM subscriptions sub
        WHERE d.id=$1 AND d.status='scheduled' AND sub.id=d.subscription_id
        RETURNING d.*, sub.user_id, sub.status AS sub_status, sub.adults, sub.kids, sub.goal, sub.exclude, sub.budget, sub.days, sub.slot, sub.address, sub.pin`, [id]);
    if (!d) continue;
    const date = typeof d.deliver_on === 'string' ? d.deliver_on : iso(d.deliver_on);
    const finish = (status: string, note: string, orderId: number | null = null) =>
      query('UPDATE subscription_deliveries SET status=$2, note=$3, order_id=$4 WHERE id=$1', [id, status, note, orderId]);
    if (d.sub_status !== 'active') { await finish(d.sub_status === 'paused' ? 'skipped' : 'cancelled', `plan ${d.sub_status}`); continue; }
    if (date < todayIST()) { await finish('failed', 'missed: the box was not built before the delivery day'); continue; }
    const box = composeBox(d as Parameters<typeof composeBox>[0], date, await liveOffers(), true);
    const lines: CartLine[] = box.items.map((i) => ({ listingId: i.listing_id!, packKg: PACK, count: Math.round(i.kg / PACK) }));
    try {
      if (box.total < MIN_BOX) throw new OrderError(`Only ₹${box.total} of produce was available for this box, under the ₹${MIN_BOX} minimum.`);
      const order = await placeOrder({ buyerId: d.user_id, channel: 'b2c', lines, address: d.address, pin: d.pin, deliveryDate: date,
        slot: d.slot, paymentMode: 'pay_on_delivery', waiveFees: true, mixFarms: true });
      await finish('placed', `${box.items.length} items for ${box.days} day${box.days > 1 ? 's' : ''}${box.trimmed ? ', trimmed to budget' : ''}`, order.id);
      await tx((q) => notify(q, d.user_id, 'Your vegetable box is packed',
        `${box.items.map((i) => i.crop).join(', ')}: ₹${box.total} at today’s prices. Pay at the door.`, `/orders/${order.order_no}`));
      placed++;
    } catch (e) {
      if (!(e instanceof OrderError || e instanceof StockError)) throw e;
      await finish('failed', e.message);
      await tx((q) => notify(q, d.user_id, 'We could not fill your box', `${date}: ${e.message} This delivery is not charged.`, '/subscriptions'));
    }
  }
  await query("UPDATE subscriptions SET status='finished' WHERE status IN ('active','paused') AND ends_on < $1::date", [todayIST()]);
  return { due: due.length, placed };
}
