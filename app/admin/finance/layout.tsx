import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { ensureFinanceSchema, financeRole, SECTION_ROLES } from '@/lib/finance';
import AdminNav from '@/components/AdminNav';
import FinanceSidebar from './FinanceSidebar';
import './finance.css';

export default async function FinanceLayout({ children }: { children: ReactNode }) {
  const user = await requireUser('admin');
  await ensureFinanceSchema();
  const role = await financeRole(user.id);
  const allowed = Object.entries(SECTION_ROLES).filter(([, roles]) => roles.includes(role)).map(([s]) => s);
  return (
    <main className="wrap fin">
      <AdminNav current="/admin/finance" />
      <div className="fin-shell">
        <FinanceSidebar allowed={allowed} />
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </main>
  );
}
