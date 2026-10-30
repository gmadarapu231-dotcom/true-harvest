import AdminNav from '@/components/AdminNav';
import { PageHead } from '@/components/ui';
import FinanceNav from '../FinanceNav';
import { requireFinance } from '../guard';
import { PRESETS } from './model';
import Simulator from './Simulator';

export const metadata = { title: 'Profit simulator · Finance' };

export default async function SimulatorPage() {
  const { role } = await requireFinance('simulator');
  return (
    <main className="wrap">
      <AdminNav current="/admin/finance" />
      <FinanceNav current="/admin/finance/simulator" role={role} />
      <PageHead title="Profit simulator" sub="Change the assumptions to see the monthly result. Illustrative, before depreciation, interest and tax." />
      <Simulator start={PRESETS.plan.a} />
    </main>
  );
}
