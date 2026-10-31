import { currentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { DUE_SQL } from '@/lib/money';
import { canSee, financeRole, filtersFrom, monthKey, monthStatement, ordersForMonth, periodFrom, periodRange, receivables, shiftMonth } from '@/lib/finance';

// CSV downloads for the finance pages (FRD 15). A UTF-8 BOM makes Excel read ₹ and Telugu names correctly.
const REPORTS: Record<string, 'orders' | 'pnl' | 'settlements' | 'receivables'> = { orders: 'orders', pnl: 'pnl', settlements: 'settlements', receivables: 'receivables' };

function csv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== 'admin') return new Response('Sign in as an admin.', { status: 401 });
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams);
  const report = REPORTS[sp.report ?? ''];
  if (!report) return new Response('Unknown report.', { status: 400 });
  const role = await financeRole(user.id);
  const section = report === 'orders' ? 'orders' : report;
  if (!canSee(role, section)) return new Response('Your finance role does not include this report.', { status: 403 });
  const p = periodFrom(sp), f = filtersFrom(sp);
  let rows: (string | number | null)[][] = [];
  if (report === 'orders') {
    const os = await ordersForMonth(p, f);
    rows = [['Order', 'Completed', 'Channel', 'State', 'District', 'Farmers', 'Crops', 'Kg', 'GMV', 'Farmer payout', 'Commission', 'Delivery fee', 'Packing/grading fee', 'Revenue', 'Delivery cost', 'Packing cost', 'Gateway fee', 'Refunds borne', 'Variable cost', 'Contribution', 'Standard costs used'],
      ...os.map((o) => [o.order_no, String(o.completed_at).slice(0, 10), o.channel.toUpperCase(), o.state, o.district, o.farmers, o.crops, o.kg, o.gmv, o.payout, o.commission, o.delivery_fee, o.service_fee, o.revenue, o.partner_cost, o.packing_cost, o.gateway_fee, o.refund_cost, o.variable, o.contribution, o.estimated.join(' ')])];
  } else if (report === 'pnl') {
    const end = /^\d{4}-\d{2}$/.test(p) ? p : monthKey();
    const ms = await Promise.all(Array.from({ length: 6 }, (_, i) => monthStatement(shiftMonth(end, i - 5), f)));
    const line = (label: string, fn: (m: (typeof ms)[number]) => number) => [label, ...ms.map((m) => Math.round(fn(m) * 100) / 100)];
    rows = [['', ...ms.map((m) => m.m)], line('GMV (memo)', (m) => m.gmv), line('Commission revenue', (m) => m.commission), line('Delivery fees', (m) => m.deliveryFees), line('Packing and grading fees', (m) => m.serviceFees),
      line('Platform revenue', (m) => m.revenue), line('Variable costs', (m) => -m.variable), line('Contribution', (m) => m.contribution),
      ...(['Technology', 'Employees', 'Marketing', 'Operations', 'Administration'] as const).map((c) => line(`${c} expenses`, (m) => -m.opex[c])),
      line('EBITDA', (m) => m.ebitda), line('Depreciation', (m) => -m.depreciation), line('Profit before tax', (m) => m.pbt), line('Income tax', (m) => -m.tax), line('Net profit after tax', (m) => m.npat)];
  } else if (report === 'settlements') {
    const [a, b] = periodRange(p);
    const due = await query(`SELECT u.name, d.* FROM (${DUE_SQL} GROUP BY s.farmer_id) d JOIN users u ON u.id=d.farmer_id`);
    const paid = await query("SELECT u.name, st.* FROM settlements st JOIN users u ON u.id=st.farmer_id WHERE st.status='paid' AND st.paid_at >= $1::date AND st.paid_at < $2::date ORDER BY st.paid_at", [a, b]);
    rows = [['Farmer', 'Status', 'Paid on', 'Sub-orders', 'Gross', 'Commission', 'Deductions', 'Net', 'UTR'],
      ...due.map((d) => [d.name, 'Due', '', d.sub_orders, d.gross, d.commission, d.deductions, d.net, '']),
      ...paid.map((s) => [s.name, 'Paid', String(s.paid_at).slice(0, 10), s.sub_order_count, s.gross, s.commission, s.deductions, s.net, s.utr])];
  } else {
    const rs = await receivables();
    rows = [['Order', 'Business', 'GSTIN', 'Delivered', 'Amount', 'Days outstanding'], ...rs.map((r) => [r.order_no, r.buyer, r.gstin, String(r.delivered_at).slice(0, 10), r.total, r.days])];
  }
  return new Response(csv(rows), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="finance-${report}-${p}.csv"`, 'Cache-Control': 'no-store' },
  });
}
