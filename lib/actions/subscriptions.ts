'use server';
import { requireUser } from '../auth';
import { one, query, tx } from '../db';
import { attempt, back, str, int } from '../http';
import { getSettings, pins, slots } from '../settings';
import { notifyAdmins, audit } from '../notify';
import { PLANS, MIN_BOX, deliveryDates, todayIST, buildDueBoxes, liveOffers } from '../subscriptions';
import { GOALS, NUTRIENTS, planDay } from '../nutrition';
import { aiEnabled, askNutritionist } from '../ai';

const addDays = (d: string, n: number) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

export async function subscribe(fd: FormData) {
  const u = await requireUser('consumer');
  const path = '/subscribe';
  const s = await getSettings();
  const weeks = int(fd, 'weeks');
  const days = [...new Set(fd.getAll('day').map((d) => parseInt(String(d), 10)).filter((d) => d >= 0 && d <= 6))].sort();
  const adults = int(fd, 'adults'), kids = int(fd, 'kids') || 0;
  const budget = Math.round(Number(str(fd, 'budget')));
  const goal = str(fd, 'goal') in GOALS ? str(fd, 'goal') : 'balanced';
  const exclude = fd.getAll('exclude').map(String).filter((c) => c in NUTRIENTS).join(',');
  const start = str(fd, 'starts_on') || addDays(todayIST(), 1);
  if (!PLANS.some((p) => p.weeks === weeks)) back(path, 'Choose a plan.');
  if (!days.length) back(path, 'Choose at least one delivery day.');
  if (!(adults >= 1 && adults <= 12) || !(kids >= 0 && kids <= 12)) back(path, 'Enter the number of adults (1 to 12) and children.');
  if (!(budget >= MIN_BOX)) back(path, `The budget per box must be at least ₹${MIN_BOX}.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || start <= todayIST()) back(path, 'The first delivery can be tomorrow at the earliest.');
  if (!pins(s).includes(str(fd, 'pin'))) back(path, `Sorry, we don't deliver to PIN ${str(fd, 'pin') || '(blank)'} yet.`);
  if (!str(fd, 'address')) back(path, 'Please add a delivery address.');
  const dates = deliveryDates(start, weeks, days);
  if (!dates.length) back(path, 'No delivery days fall in that plan. Choose other days.');
  const slot = slots(s).includes(str(fd, 'slot')) ? str(fd, 'slot') : slots(s)[0] ?? '';
  const err = await attempt(() => tx(async (q) => {
    const [sub] = await q.query(
      `INSERT INTO subscriptions (user_id, weeks, days, adults, kids, goal, exclude, budget, slot, address, pin, starts_on, ends_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [u.id, weeks, days.join(','), adults, kids, goal, exclude, budget, slot, str(fd, 'address'), str(fd, 'pin'), start, addDays(start, weeks * 7 - 1)]);
    for (const d of dates) await q.query('INSERT INTO subscription_deliveries (subscription_id, deliver_on) VALUES ($1,$2)', [sub.id, d]);
    await q.query('UPDATE users SET address = CASE WHEN address = \'\' THEN $2 ELSE address END, pin = CASE WHEN pin = \'\' THEN $3 ELSE pin END WHERE id=$1',
      [u.id, str(fd, 'address'), str(fd, 'pin')]);
    await notifyAdmins(q, 'New vegetable box subscription', `${u.name}: ${PLANS.find((p) => p.weeks === weeks)!.en}, ${dates.length} boxes`, '/admin/subscriptions');
  }));
  back(err ? path : '/subscriptions', err, err ? undefined : `Subscribed. ${dates.length} boxes scheduled. Each box is packed the evening before at that day's prices.`);
}

async function mine(userId: number, subId: number) {
  return one<{ id: number; status: string; weeks: number; days: string; adults: number; kids: number; goal: string; exclude: string; budget: number; slot: string; address: string; pin: string; ends_on: string }>(
    'SELECT * FROM subscriptions WHERE id=$1 AND user_id=$2', [subId, userId]);
}

export async function skipDelivery(fd: FormData) {
  const u = await requireUser('consumer');
  const [row] = await query(
    `UPDATE subscription_deliveries d SET status='skipped', note='skipped by you'
       FROM subscriptions s WHERE d.id=$1 AND s.id=d.subscription_id AND s.user_id=$2 AND d.status='scheduled' AND d.built_at IS NULL
     RETURNING d.id`, [int(fd, 'delivery_id'), u.id]);
  back('/subscriptions', row ? null : 'That box is already packed or no longer scheduled.', row ? 'Skipped. You will not be charged for that day.' : undefined);
}

export async function setSubscriptionStatus(fd: FormData) {
  const u = await requireUser('consumer');
  const sub = await mine(u.id, int(fd, 'subscription_id'));
  const to = str(fd, 'to');
  if (!sub) back('/subscriptions', 'Subscription not found.');
  const allowed: Record<string, string[]> = { paused: ['active'], active: ['paused'], cancelled: ['active', 'paused'] };
  if (!allowed[to]?.includes(sub.status)) back('/subscriptions', 'That change is not possible now.');
  await tx(async (q) => {
    await q.query('UPDATE subscriptions SET status=$2 WHERE id=$1', [sub.id, to]);
    if (to === 'cancelled') await q.query("UPDATE subscription_deliveries SET status='cancelled', note='plan cancelled' WHERE subscription_id=$1 AND status='scheduled'", [sub.id]);
    await audit(q, u.id, `subscription.${to}`, 'subscription', sub.id, {});
  });
  back('/subscriptions', null, to === 'paused' ? 'Paused. Boxes are skipped until you resume.' : to === 'active' ? 'Resumed.' : 'Cancelled. No more boxes will be packed.');
}

export async function renewSubscription(fd: FormData) {
  const u = await requireUser('consumer');
  const sub = await mine(u.id, int(fd, 'subscription_id'));
  if (!sub) back('/subscriptions', 'Subscription not found.');
  const endsOn = typeof sub.ends_on === 'string' ? sub.ends_on : new Date(sub.ends_on).toISOString().slice(0, 10);
  const start = [addDays(endsOn, 1), addDays(todayIST(), 1)].sort().at(-1)!;
  const days = sub.days.split(',').map(Number);
  const dates = deliveryDates(start, sub.weeks, days);
  await tx(async (q) => {
    const [n] = await q.query(
      `INSERT INTO subscriptions (user_id, weeks, days, adults, kids, goal, exclude, budget, slot, address, pin, starts_on, ends_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [u.id, sub.weeks, sub.days, sub.adults, sub.kids, sub.goal, sub.exclude, sub.budget, sub.slot, sub.address, sub.pin, start, addDays(start, sub.weeks * 7 - 1)]);
    for (const d of dates) await q.query('INSERT INTO subscription_deliveries (subscription_id, deliver_on) VALUES ($1,$2)', [n.id, d]);
  });
  back('/subscriptions', null, `Renewed from ${start}. ${dates.length} more boxes scheduled.`);
}

export async function askAssistant(fd: FormData) {
  const u = await requireUser('consumer');
  const path = '/nutrition';
  const question = str(fd, 'question').slice(0, 500);
  if (question.length < 3) back(path, 'Type a question first.');
  if (!aiEnabled()) back(path, 'The assistant is not switched on yet. Today’s plan above is still worked out for your household.');
  const asked = await one<{ n: number }>("SELECT count(*)::int AS n FROM nutrition_questions WHERE user_id=$1 AND created_at > now() - interval '1 day'", [u.id]);
  if ((asked?.n ?? 0) >= 20) back(path, 'You have asked 20 questions today. Please try again tomorrow.');
  const h = { adults: Math.min(12, Math.max(1, int(fd, 'adults') || 2)), kids: Math.min(12, Math.max(0, int(fd, 'kids') || 0)), goal: str(fd, 'goal') in GOALS ? str(fd, 'goal') : 'balanced' };
  const offers = await liveOffers();
  const plan = planDay(h, offers);
  let answer = '';
  const err = await attempt(async () => {
    try { answer = await askNutritionist(question, h, plan, [...new Set(offers.map((o) => o.crop))]); }
    catch (e) { console.error('[nutrition assistant]', e); throw new Error('The assistant is busy right now. Please try again in a minute.'); }
    await query('INSERT INTO nutrition_questions (user_id, question, answer) VALUES ($1,$2,$3)', [u.id, question, answer]);
  });
  back(`${path}?adults=${h.adults}&kids=${h.kids}&goal=${h.goal}#ask`, err, err ? undefined : 'Answered below.');
}

export async function buildBoxesNow() {
  const u = await requireUser('admin');
  const through = addDays(todayIST(), 1);
  const r = await buildDueBoxes(through);
  await tx((q) => audit(q, u.id, 'subscription.build_now', 'subscription', 0, { through, ...r }));
  back('/admin/subscriptions', null, `Built ${r.placed} of ${r.due} boxes due by ${through}.`);
}
