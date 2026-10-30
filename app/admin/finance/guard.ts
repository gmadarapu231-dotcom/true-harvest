import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { canSee, ensureFinanceSchema, financeRole, SECTION_ROLES } from '@/lib/finance';

/** Admin login plus the finance role for this section (FRD 13). Sends the user to a page their role allows. */
export async function requireFinance(section: keyof typeof SECTION_ROLES) {
  const user = await requireUser('admin');
  await ensureFinanceSchema();
  const role = await financeRole(user.id);
  if (!canSee(role, section)) redirect(canSee(role, 'orders') ? '/admin/finance/orders' : '/admin');
  return { user, role };
}
