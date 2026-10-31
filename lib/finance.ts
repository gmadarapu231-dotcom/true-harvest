import fs from 'node:fs';
import path from 'node:path';
import { query, type Queryable } from './db';
import { DUE_SQL } from './money';

// Finance module (FRD Phase 1). GMV, revenue, contribution and profit are computed separately on purpose:
// GMV is the farmers' produce value and is never booked as company revenue (agent model).
// Every number here is derived from orders, sub-orders, settlements and approved expenses, so it can be traced back.

const g = globalThis as unknown as { __financeSchema?: Promise<void> };

/** Creates the finance tables once per process. Kept apart from db/schema.sql so the two modules don't collide. */
export function ensureFinanceSchema(): Promise<void> {
  if (!g.__financeSchema) {
    g.__financeSchema = (async () => {
      const sql = fs.readFileSync(path.join(process.cwd(), 'db', 'finance.sql'), 'utf8')
        .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
      for (const stmt of sql.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean)) await query(stmt);
      const [{ n }] = await query<{ n: number }>('SELECT count(*)::int AS n FROM finance_budgets');
      if (!n) for (const [c, v] of Object.entries(DEFAULT_BUDGETS)) await query('INSERT INTO finance_budgets (category, monthly) VALUES ($1,$2)', [c, v]);
    })().catch((e) => { g.__financeSchema = undefined; throw e; });
  }
  return g.__financeSchema;
}

export const CATEGORIES = ['Technology', 'Employees', 'Marketing', 'Operations', 'Administration'] as const;
export type Category = (typeof CATEGORIES)[number];
const DEFAULT_BUDGETS: Record<Category, number> = { Technology: 26000, Employees: 72000, Marketing: 20000, Operations: 13500, Administration: 16500 };

export const DEFAULT_FINANCE_SETTINGS = {
  opening_cash: 0, // bank balance on opening_cash_date
  opening_cash_date: '2026-06-01',
  min_cash_reserve: 500000,
  // Standard costs, used only while an order has no actual cost recorded.
  b2c_partner_cost_per_drop: 30,
  b2b_partner_cost_per_kg: 0.35,
  b2c_packing_cost: 8,
  b2b_handling_cost_per_kg: 0.1,
  gateway_fee_pct: 0.02, // online payments; pay-on-delivery UPI assumed free
  depreciation_monthly: 0,
  tax_rate: 0.2517,
  settlement_sla_days: 2,
};
export type FinanceSettings = typeof DEFAULT_FINANCE_SETTINGS;

export async function getFinanceSettings(q: Queryable = { query }): Promise<FinanceSettings> {
  await ensureFinanceSchema();
  const s: any = { ...DEFAULT_FINANCE_SETTINGS };
  for (const r of await q.query<{ key: string; value: string }>('SELECT key, value FROM finance_settings')) if (r.key in s) s[r.key] = JSON.parse(r.value);
  return s;
}

export async function saveFinanceSetting(q: Queryable, key: keyof FinanceSettings, value: unknown) {
  await q.query(
    `INSERT INTO finance_settings (key, value, updated_at) VALUES ($1,$2, now())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`, [key, JSON.stringify(value)]);
}

/* ---------- roles ---------- */
export type FinanceRole = 'founder' | 'finance' | 'ops' | 'sales';
export const SECTION_ROLES: Record<string, FinanceRole[]> = {
  overview: ['founder', 'finance'],
  revenue: ['founder', 'finance', 'sales'],
  settlements: ['founder', 'finance'],
  receivables: ['founder', 'finance', 'sales'],
  logistics: ['founder', 'finance', 'ops'],
  orders: ['founder', 'finance', 'ops', 'sales'],
  pnl: ['founder', 'finance'],
  expenses: ['founder', 'finance'],
  simulator: ['founder', 'finance'],
  roles: ['founder'],
};
export async function financeRole(userId: number): Promise<FinanceRole> {
  await ensureFinanceSchema();
  const [r] = await query<{ role: FinanceRole }>('SELECT role FROM finance_roles WHERE user_id=$1', [userId]);
  return r?.role ?? 'founder';
}
export const canSee = (role: FinanceRole, section: keyof typeof SECTION_ROLES) => SECTION_ROLES[section].includes(role);

/* ---------- periods ---------- */
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
export function monthRange(m: string): [string, string] {
  const [y, mo] = m.split('-').map(Number);
  const end = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
  return [`${m}-01`, end];
}
export function shiftMonth(m: string, by: number): string {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1 + by, 1)).toISOString().slice(0, 7);
}
/** A period is a month ('2026-10') or a rolling window ('last30', and 'prev30' for the 30 days before it). */
export function periodRange(p: string): [string, string] {
  if (p === 'last30' || p === 'prev30') {
    const end = new Date(); end.setUTCHours(0, 0, 0, 0); end.setUTCDate(end.getUTCDate() + 1 - (p === 'prev30' ? 30 : 0));
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 30);
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
  }
  return monthRange(p);
}
export const previousPeriod = (p: string) => (p === 'last30' ? 'prev30' : shiftMonth(p, -1));
export const periodFrom = (sp: Record<string, string>) => (sp.p === 'last30' || /^\d{4}-\d{2}$/.test(sp.p ?? '') ? sp.p : sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : 'last30');
export const periodLabel = (p: string) => (p === 'last30' ? 'Last 30 days' : p === 'prev30' ? 'Previous 30 days' : monthLabel(p));
export const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/* ---------- order economics ---------- */
export interface Filters { channel?: string; state?: string; district?: string; crop?: string }
export interface OrderEcon {
  id: number; order_no: string; channel: 'b2c' | 'b2b'; completed_at: string; state: string; district: string; farmers: string; crops: string; kg: number; partners: string; km: number | null;
  items: number; gmv: number; payout: number; commission: number; delivery_fee: number; service_fee: number; revenue: number;
  partner_cost: number; packing_cost: number; gateway_fee: number; refund_cost: number; variable: number; contribution: number;
  estimated: string[]; // which costs are standard estimates rather than recorded actuals
}

const econSql = (where: string) => `
  SELECT o.id, o.order_no, o.channel, coalesce(o.completed_at, o.delivered_at, o.created_at) AS completed_at, o.items_total, o.delivery_fee, o.packing_fee, o.refunded, o.payment_mode, o.total,
         o.commission_amount, o.packing_cost, o.handling_cost, o.gateway_fee, o.gateway_fee_tax,
         sum(s.items_total) FILTER (WHERE s.status='delivered') AS delivered_items,
         sum(s.commission) FILTER (WHERE s.status='delivered') AS sub_commission,
         coalesce(sum(s.deductions),0) AS farmer_deductions,
         coalesce(sum(s.partner_cost),0) AS partner_cost,
         count(s.id) FILTER (WHERE s.status='delivered')::int AS drops,
         min(fp.state) AS state, min(fp.district) AS district,
         string_agg(DISTINCT u.name, ', ') AS farmers,
         string_agg(DISTINCT pu.name, ', ') AS partners,
         sum(s.distance_km) AS distance_km,
         (SELECT string_agg(DISTINCT c.name, ', ') FROM order_lines ol JOIN sub_orders s2 ON s2.id=ol.sub_order_id JOIN listings l ON l.id=ol.listing_id JOIN crops c ON c.id=l.crop_id WHERE s2.order_id=o.id) AS crops,
         (SELECT coalesce(sum(coalesce(ol.delivered_kg, ol.ordered_kg)),0) FROM order_lines ol JOIN sub_orders s2 ON s2.id=ol.sub_order_id WHERE s2.order_id=o.id AND ol.status='delivered') AS kg
    FROM orders o JOIN sub_orders s ON s.order_id=o.id
    JOIN users u ON u.id=s.farmer_id LEFT JOIN farmer_profiles fp ON fp.user_id=s.farmer_id LEFT JOIN users pu ON pu.id=s.partner_id
   WHERE ${where}
   GROUP BY o.id ORDER BY 4 DESC`;
// Older rows (and the demo seed) may be completed without completed_at; fall back to the delivery time.
const DONE_AT = 'coalesce(o.completed_at, o.delivered_at, o.created_at)';
const ECON_SQL = econSql(`o.status='completed' AND ${DONE_AT} >= $1::date AND ${DONE_AT} < $2::date`);

export function orderEconomics(r: any, fs: FinanceSettings): OrderEcon {
  const est: string[] = [];
  const kg = Number(r.kg) || 0;
  const deductions = Number(r.farmer_deductions);
  const gmv = Number(r.delivered_items ?? 0) - deductions; // farmer-fault refunds come off the farmer's sale
  const commission = Number(r.commission_amount) || Number(r.sub_commission) || 0;
  const delivery = Number(r.delivery_fee), service = Number(r.packing_fee);
  const revenue = commission + delivery + service;
  let partner = Number(r.partner_cost);
  if (!partner) { partner = r.channel === 'b2c' ? fs.b2c_partner_cost_per_drop * Math.max(1, r.drops) : kg * fs.b2b_partner_cost_per_kg; est.push('delivery'); }
  let packing = Number(r.packing_cost) + Number(r.handling_cost);
  if (!packing) { packing = r.channel === 'b2c' ? fs.b2c_packing_cost : kg * fs.b2b_handling_cost_per_kg; est.push('packing'); }
  let gateway = Number(r.gateway_fee) + Number(r.gateway_fee_tax);
  if (!gateway && r.payment_mode === 'online') { gateway = Number(r.total) * fs.gateway_fee_pct; est.push('gateway'); }
  const refundCost = Math.max(0, Number(r.refunded) - deductions); // refunds not charged back to a farmer
  const variable = partner + packing + gateway + refundCost;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    id: r.id, order_no: r.order_no, channel: r.channel, completed_at: r.completed_at, state: r.state ?? '', district: r.district ?? '', farmers: r.farmers ?? '', crops: r.crops ?? '', kg, partners: r.partners ?? '', km: r.distance_km == null ? null : Number(r.distance_km),
    items: Number(r.items_total), gmv: round(gmv), payout: round(gmv - commission), commission: round(commission), delivery_fee: delivery, service_fee: service, revenue: round(revenue),
    partner_cost: round(partner), packing_cost: round(packing), gateway_fee: round(gateway), refund_cost: round(refundCost), variable: round(variable), contribution: round(revenue - variable),
    estimated: est,
  };
}

const matches = (o: OrderEcon, f: Filters) =>
  (!f.channel || o.channel === f.channel) && (!f.state || o.state === f.state) && (!f.district || o.district === f.district)
  && (!f.crop || o.crops.split(', ').includes(f.crop));

export async function ordersForMonth(m: string, f: Filters = {}) {
  const fs = await getFinanceSettings();
  const [a, b] = periodRange(m);
  return (await query(ECON_SQL, [a, b])).map((r) => orderEconomics(r, fs)).filter((o) => matches(o, f));
}

/* ---------- monthly statement ---------- */
export interface Month {
  m: string; n: number; nB2C: number; nB2B: number; gmv: number; gmvB2C: number; gmvB2B: number;
  commission: number; deliveryFees: number; serviceFees: number; revenue: number;
  partner: number; packing: number; gateway: number; refunds: number; variable: number;
  contribution: number; cB2C: number; cB2B: number; negative: number; estimatedOrders: number;
  opex: Record<Category, number>; opexTotal: number; share: number; ebitda: number; depreciation: number; pbt: number; tax: number; npat: number;
}

export async function monthStatement(m: string, f: Filters = {}): Promise<Month> {
  const fs = await getFinanceSettings();
  const os = await ordersForMonth(m, f);
  const filtered = !!(f.channel || f.state || f.district || f.crop);
  const s = (fn: (o: OrderEcon) => number, list = os) => list.reduce((t, o) => t + fn(o), 0);
  const b2c = os.filter((o) => o.channel === 'b2c'), b2b = os.filter((o) => o.channel === 'b2b');
  const revenue = s((o) => o.revenue);
  // Fixed costs are company-wide; with filters on they are allocated by the selection's share of revenue.
  let share = 1;
  if (filtered) { const all = await ordersForMonth(m); const tot = all.reduce((t, o) => t + o.revenue, 0); share = tot ? revenue / tot : 0; }
  const [a, b] = periodRange(m);
  const days = (Date.parse(b) - Date.parse(a)) / 86400000;
  const ex = await query<{ category: Category; amount: number }>(
    "SELECT category, sum(amount) AS amount FROM finance_expenses WHERE status='approved' AND spent_on >= $1 AND spent_on < $2 GROUP BY category", [a, b]);
  const opex = Object.fromEntries(CATEGORIES.map((c) => [c, (Number(ex.find((e) => e.category === c)?.amount) || 0) * share])) as Record<Category, number>;
  const opexTotal = Object.values(opex).reduce((t, v) => t + v, 0);
  const contribution = s((o) => o.contribution);
  const ebitda = contribution - opexTotal;
  const depreciation = fs.depreciation_monthly * share * (m.length === 7 ? 1 : days / 30);
  const pbt = ebitda - depreciation;
  const tax = Math.max(0, pbt) * fs.tax_rate; // simple monthly provision; the CA trues it up for losses carried forward
  return {
    m, n: os.length, nB2C: b2c.length, nB2B: b2b.length, gmv: s((o) => o.gmv), gmvB2C: s((o) => o.gmv, b2c), gmvB2B: s((o) => o.gmv, b2b),
    commission: s((o) => o.commission), deliveryFees: s((o) => o.delivery_fee), serviceFees: s((o) => o.service_fee), revenue,
    partner: s((o) => o.partner_cost), packing: s((o) => o.packing_cost), gateway: s((o) => o.gateway_fee), refunds: s((o) => o.refund_cost), variable: s((o) => o.variable),
    contribution, cB2C: s((o) => o.contribution, b2c), cB2B: s((o) => o.contribution, b2b),
    negative: os.filter((o) => o.contribution < 0).length, estimatedOrders: os.filter((o) => o.estimated.length).length,
    opex, opexTotal, share, ebitda, depreciation, pbt, tax, npat: pbt - tax,
  };
}

/* ---------- balances and cash ---------- */
export async function balances() {
  const fs = await getFinanceSettings();
  const since = fs.opening_cash_date;
  const [r] = await query(`
    SELECT
      (SELECT coalesce(sum(net),0) FROM (${DUE_SQL} GROUP BY s.farmer_id) d) AS farmer_due,
      (SELECT count(*)::int FROM sub_orders s JOIN orders o ON o.id=s.order_id
        WHERE s.status='delivered' AND o.status='completed' AND s.settlement_id IS NULL AND coalesce(o.completed_at, o.delivered_at) < now() - ($1 || ' days')::interval) AS overdue_n,
      (SELECT coalesce(sum(s.items_total - s.commission - s.deductions),0) FROM sub_orders s JOIN orders o ON o.id=s.order_id
        WHERE s.status='delivered' AND o.status='completed' AND s.settlement_id IS NULL AND coalesce(o.completed_at, o.delivered_at) < now() - ($1 || ' days')::interval) AS overdue,
      (SELECT coalesce(sum(s.items_total - s.commission - s.deductions),0) FROM sub_orders s JOIN orders o ON o.id=s.order_id
        WHERE s.status IN ('accepted','packed','picked_up','out_for_delivery','delivered') AND o.status NOT IN ('completed','cancelled','payment_failed','pending_payment')) AS accruing,
      (SELECT coalesce(sum(s.items_total - s.commission - s.deductions),0) FROM sub_orders s JOIN orders o ON o.id=s.order_id
        WHERE s.settlement_id IS NULL AND s.status NOT IN ('rejected','expired','cancelled') AND o.payment_status IN ('paid','partly_refunded')) AS held_for_farmers,
      (SELECT count(*)::int FROM farmer_profiles WHERE payout_hold <> '') AS holds,
      (SELECT coalesce(sum(o.total - o.refunded),0) FROM orders o WHERE o.payment_status IN ('paid','partly_refunded') AND o.created_at >= $2::date) AS collected,
      (SELECT coalesce(sum(net),0) FROM settlements WHERE status='paid' AND paid_at >= $2::date) AS farmers_paid,
      (SELECT coalesce(sum(amount + gst),0) FROM finance_expenses WHERE status='approved' AND coalesce(paid_at, spent_on) >= $2::date AND coalesce(paid_at, spent_on) <= current_date) AS expenses_paid,
      (SELECT coalesce(sum(o.total),0) FROM orders o JOIN users u ON u.id=o.buyer_id
        WHERE u.role='business' AND o.status IN ('delivered','completed') AND o.payment_status='pending') AS receivables`,
    [String(fs.settlement_sla_days), since]);
  // Delivery, packing and gateway costs of delivered orders since the opening date (actuals where recorded, else standard costs).
  const delivered = await query(econSql(`o.status IN ('delivered','completed') AND ${DONE_AT} >= $1::date`), [since]);
  const costs = delivered.map((x) => orderEconomics(x, fs)).reduce((t, o) => t + o.partner_cost + o.packing_cost + o.gateway_fee, 0);
  const n = (k: string) => Number(r[k]) || 0;
  const bank = fs.opening_cash + n('collected') - n('farmers_paid') - costs - n('expenses_paid');
  return {
    openingCash: fs.opening_cash, openingDate: since, reserve: fs.min_cash_reserve,
    collected: n('collected'), farmersPaid: n('farmers_paid'), orderCosts: costs, expensesPaid: n('expenses_paid'), bank,
    farmerDue: n('farmer_due'), overdue: n('overdue'), overdueN: n('overdue_n'), accruing: n('accruing'), heldForFarmers: n('held_for_farmers'), holds: n('holds'),
    receivables: n('receivables'), ownCash: bank - n('held_for_farmers'),
  };
}

/* ---------- alerts (FRD section 14) ---------- */
export async function alerts(cur: Month, bal: Awaited<ReturnType<typeof balances>>) {
  const out: { level: 'bad' | 'warn' | 'ok'; text: string; href?: string }[] = [];
  const [a, b] = periodRange(cur.m);
  const pending = await query<{ n: number }>("SELECT count(*)::int AS n FROM finance_expenses WHERE status='pending'");
  const [mk] = await query<{ spent: number; budget: number }>(
    "SELECT (SELECT coalesce(sum(amount),0) FROM finance_expenses WHERE category='Marketing' AND status='approved' AND spent_on >= $1 AND spent_on < $2) AS spent, (SELECT monthly FROM finance_budgets WHERE category='Marketing') AS budget", [a, b]);
  if (cur.negative) out.push({ level: 'warn', text: `${cur.negative} orders had negative contribution in this period.`, href: `/admin/finance/orders?p=${cur.m}&view=negative` });
  if (bal.overdueN) out.push({ level: 'bad', text: `${bal.overdueN} farmer payouts are past the settlement due date (₹${Math.round(bal.overdue).toLocaleString('en-IN')}).`, href: '/admin/settlements' });
  if (bal.holds) out.push({ level: 'warn', text: `${bal.holds} farmers have payouts on hold.`, href: '/admin/settlements' });
  if (bal.receivables > 0) out.push({ level: 'warn', text: `Businesses owe ₹${Math.round(bal.receivables).toLocaleString('en-IN')} on delivered orders not yet paid.`, href: '/admin/orders' });
  if (cur.gmv && cur.refunds / cur.gmv > 0.015) out.push({ level: 'warn', text: `Refunds borne by the platform are ${(cur.refunds / cur.gmv * 100).toFixed(1)}% of GMV.`, href: '/admin/complaints' });
  if (mk && Number(mk.spent) > Number(mk.budget)) out.push({ level: 'warn', text: `Marketing spend is over its monthly budget.`, href: '/admin/finance/expenses' });
  if (pending[0]?.n) out.push({ level: 'warn', text: `${pending[0].n} expenses are waiting for approval.`, href: '/admin/finance/expenses' });
  if (cur.ebitda < 0) out.push({ level: 'bad', text: `Operating loss in this period (EBITDA ₹${Math.round(cur.ebitda).toLocaleString('en-IN')}).` });
  if (bal.openingCash && bal.ownCash < bal.reserve) out.push({ level: 'bad', text: `Company cash is below the minimum reserve of ₹${bal.reserve.toLocaleString('en-IN')}.` });
  if (!bal.openingCash) out.push({ level: 'warn', text: 'Set the opening bank balance so cash figures are meaningful.', href: '/admin/finance/pnl#assumptions' });
  if (cur.estimatedOrders) out.push({ level: 'warn', text: `${cur.estimatedOrders} orders use standard costs because actual delivery, packing or gateway costs aren't recorded yet.`, href: `/admin/finance/orders?p=${cur.m}` });
  if (!out.some((x) => x.level === 'bad')) out.push({ level: 'ok', text: 'No critical finance alerts.' });
  return out;
}

export const inr = (n: number, dec = 0) => `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: dec, minimumFractionDigits: dec })}`;
export function compact(n: number) {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)}L`;
  return inr(n);
}

/** Options for the filter bar: the last 12 months and the districts farmers are registered in. */
export async function filterOptions() {
  const now = monthKey();
  const months = [{ value: 'last30', label: 'Last 30 days' }, ...Array.from({ length: 12 }, (_, i) => shiftMonth(now, -i)).map((m) => ({ value: m, label: monthLabel(m) + (m === now ? ' (to date)' : '') }))];
  const crops = (await query<{ name: string }>('SELECT name FROM crops ORDER BY name')).map((c) => c.name);
  const districts = (await query<{ district: string }>("SELECT DISTINCT district FROM farmer_profiles WHERE district <> '' ORDER BY district")).map((d) => d.district);
  return { months, districts, crops };
}
export const filtersFrom = (sp: Record<string, string>): Filters => ({
  channel: sp.ch === 'b2c' || sp.ch === 'b2b' ? sp.ch : undefined,
  state: sp.st === 'Telangana' || sp.st === 'Andhra Pradesh' ? sp.st : undefined,
  district: sp.d || undefined,
  crop: sp.crop || undefined,
});

/* ---------- settlements, receivables ---------- */
export async function settlementPanel(p: string) {
  const fs = await getFinanceSettings();
  const [a, b] = periodRange(p);
  const [r] = await query(`
    SELECT (SELECT coalesce(sum(net),0) FROM settlements WHERE status='paid' AND paid_at >= $1::date AND paid_at < $2::date) AS paid,
           (SELECT count(*)::int FROM settlements WHERE status='paid' AND paid_at >= $1::date AND paid_at < $2::date) AS paid_n`, [a, b]);
  const recent = await query(`
    SELECT * FROM (
      SELECT u.name, fp.district, fp.state, st.net AS amount, 'Paid' AS status, st.paid_at AS at, st.utr FROM settlements st
        JOIN users u ON u.id=st.farmer_id LEFT JOIN farmer_profiles fp ON fp.user_id=st.farmer_id WHERE st.status='paid'
      UNION ALL
      SELECT u.name, fp.district, fp.state, d.net, CASE WHEN fp.payout_hold <> '' THEN 'On hold' ELSE 'Due' END, NULL, fp.payout_hold
        FROM (${DUE_SQL} GROUP BY s.farmer_id) d JOIN users u ON u.id=d.farmer_id LEFT JOIN farmer_profiles fp ON fp.user_id=d.farmer_id
    ) x ORDER BY (status='Paid'), at DESC NULLS FIRST, amount DESC LIMIT 8`);
  return { paid: Number(r.paid), paidN: r.paid_n, recent, slaDays: fs.settlement_sla_days };
}

export async function receivables() {
  return query(`
    SELECT o.order_no, coalesce(bp.legal_name, u.name) AS buyer, bp.gstin, o.total, o.delivered_at, o.status,
           greatest(0, (current_date - o.delivered_at::date))::int AS days
      FROM orders o JOIN users u ON u.id=o.buyer_id LEFT JOIN business_profiles bp ON bp.user_id=o.buyer_id
     WHERE u.role='business' AND o.status IN ('delivered','completed') AND o.payment_status='pending'
     ORDER BY o.delivered_at`);
}
