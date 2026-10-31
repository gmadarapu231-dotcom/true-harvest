import { PageHead } from '@/components/ui';
import { requireFinance } from '../guard';
import { PRESETS } from './model';
import Simulator from './Simulator';

export const metadata = { title: 'Profit simulator · Finance' };

export default async function SimulatorPage() {
  await requireFinance('simulator');
  return (
    <>
      <PageHead title="Profit simulator" sub="Change the assumptions to see the monthly result. Illustrative, before depreciation, interest and tax." />
      <Simulator start={PRESETS.plan.a} />
    </>
  );
}
