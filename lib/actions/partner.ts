'use server';
import { requireUser } from '../auth';
import { attempt, back, str, int } from '../http';
import { advanceSubOrder } from '../orders';

export async function partnerStep(fd: FormData) {
  const u = await requireUser('partner');
  const to = str(fd, 'to') as 'picked_up' | 'out_for_delivery' | 'delivered';
  if (!['picked_up', 'out_for_delivery', 'delivered'].includes(to)) back('/partner', 'Unknown step.');
  const err = await attempt(() => advanceSubOrder(u, int(fd, 'sub_order_id'), to, str(fd, 'otp')));
  back('/partner', err, to === 'delivered' ? 'Delivered. Thank you!' : 'Updated.');
}
