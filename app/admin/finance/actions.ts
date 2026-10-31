'use server';
import { requireUser } from '@/lib/auth';
import { query, tx } from '@/lib/db';
import { back, int, num, str } from '@/lib/http';
import { audit } from '@/lib/notify';
import { CATEGORIES, DEFAULT_FINANCE_SETTINGS, canSee, financeRole, getFinanceSettings, saveFinanceSetting, type FinanceSettings } from '@/lib/finance';

async function finance(section: 'expenses' | 'pnl' | 'roles') {
  const u = await requireUser('admin');
  const role = await financeRole(u.id);
  if (!canSee(role, section)) back('/admin/finance', 'Your finance role does not allow this.');
  return u;
}

export async function addExpense(fd: FormData) {
  const u = await finance('expenses');
  const category = str(fd, 'category');
  const amount = num(fd, 'amount'), gst = num(fd, 'gst') || 0;
  if (!(CATEGORIES as readonly string[]).includes(category)) back('/admin/finance/expenses', 'Pick a category.');
  if (!str(fd, 'item') || !(amount > 0)) back('/admin/finance/expenses', 'Enter what the expense was for and an amount above zero.');
  if (gst < 0) back('/admin/finance/expenses', 'GST cannot be negative.');
  await tx(async (q) => {
    const [e] = await q.query(
      `INSERT INTO finance_expenses (spent_on, category, item, vendor, amount, gst, payment_method, invoice_no, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [str(fd, 'spent_on') || new Date().toISOString().slice(0, 10), category, str(fd, 'item'), str(fd, 'vendor'), amount, gst, str(fd, 'payment_method') || 'Bank transfer', str(fd, 'invoice_no'), u.id]);
    await audit(q, u.id, 'expense.create', 'finance_expense', e.id, '', { category, amount, gst });
  });
  back('/admin/finance/expenses', null, 'Expense recorded. It reaches the P&L once approved.');
}

export async function decideExpense(fd: FormData) {
  const u = await finance('expenses');
  const id = int(fd, 'id');
  const status = str(fd, 'status') === 'approved' ? 'approved' : 'rejected';
  await tx(async (q) => {
    const [e] = await q.query('SELECT status, created_by FROM finance_expenses WHERE id=$1', [id]);
    if (!e || e.status !== 'pending') return;
    await q.query('UPDATE finance_expenses SET status=$2, approved_by=$3, paid_at = CASE WHEN $2=\'approved\' THEN coalesce(paid_at, spent_on) END WHERE id=$1', [id, status, u.id]);
    await audit(q, u.id, `expense.${status}`, 'finance_expense', id, 'pending', status);
  });
  back('/admin/finance/expenses', null, status === 'approved' ? 'Approved.' : 'Rejected.');
}

export async function saveBudgets(fd: FormData) {
  const u = await finance('expenses');
  await tx(async (q) => {
    for (const c of CATEGORIES) {
      const v = num(fd, `budget_${c}`);
      if (!(v >= 0)) continue;
      const [b] = await q.query('SELECT monthly FROM finance_budgets WHERE category=$1', [c]);
      if (Number(b?.monthly) === v) continue;
      await q.query('INSERT INTO finance_budgets (category, monthly) VALUES ($1,$2) ON CONFLICT (category) DO UPDATE SET monthly=EXCLUDED.monthly', [c, v]);
      await audit(q, u.id, 'budget.update', 'finance_budget', c, b?.monthly ?? '', v);
    }
  });
  back('/admin/finance/expenses', null, 'Budgets saved.');
}

export async function saveFinanceSettings(fd: FormData) {
  const u = await finance('pnl');
  const before = await getFinanceSettings();
  await tx(async (q) => {
    for (const key of Object.keys(DEFAULT_FINANCE_SETTINGS) as (keyof FinanceSettings)[]) {
      if (!fd.has(key)) continue;
      const v = typeof DEFAULT_FINANCE_SETTINGS[key] === 'number' ? num(fd, key) : str(fd, key);
      if (typeof v === 'number' && !(v >= 0)) continue;
      if (key === 'opening_cash_date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) continue;
      if (JSON.stringify(v) === JSON.stringify(before[key])) continue;
      await saveFinanceSetting(q, key, v);
      await audit(q, u.id, 'finance_setting.update', 'finance_setting', key, before[key], v);
    }
  });
  back('/admin/finance/pnl', null, 'Finance assumptions saved.');
}

export async function setFinanceRole(fd: FormData) {
  const u = await finance('roles');
  const id = int(fd, 'user_id');
  const role = str(fd, 'role');
  if (!['founder', 'finance', 'ops', 'sales'].includes(role)) back('/admin/finance/pnl', 'Unknown role.');
  const [target] = await query("SELECT id FROM users WHERE id=$1 AND role='admin'", [id]);
  if (!target) back('/admin/finance/pnl', 'Finance roles apply to admin staff only.');
  if (id === u.id && role !== 'founder') back('/admin/finance/pnl', 'You cannot remove your own founder access.');
  await tx(async (q) => {
    await q.query(`INSERT INTO finance_roles (user_id, role, granted_by) VALUES ($1,$2,$3)
                   ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role, granted_by=EXCLUDED.granted_by, granted_at=now()`, [id, role, u.id]);
    await audit(q, u.id, 'finance_role.set', 'user', id, '', role);
  });
  back('/admin/finance/pnl', null, 'Finance access updated.');
}
