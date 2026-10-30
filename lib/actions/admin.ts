'use server';
import { requireUser } from '../auth';
import { one, query, tx } from '../db';
import { attempt, back, str, num, int } from '../http';
import { advanceSubOrder, assignPartner, OrderError } from '../orders';
import { moveStock } from '../inventory';
import { payFarmer, resolveComplaint } from '../money';
import { DEFAULT_SETTINGS, getSettings, saveSetting, type Settings } from '../settings';
import { audit, notify } from '../notify';
import { normalisePhone } from '../auth';

const admin = () => requireUser('admin');

export async function setFarmerStatus(fd: FormData) {
  const a = await admin();
  const id = int(fd, 'farmer_id');
  const status = str(fd, 'status');
  if (!['verified', 'rejected', 'suspended', 'submitted'].includes(status)) back('/admin/farmers', 'Unknown status.');
  const reason = str(fd, 'reason');
  if (status !== 'verified' && !reason) back('/admin/farmers', 'Give a reason so the farmer knows what to fix.');
  await tx(async (q) => {
    const [before] = await q.query('SELECT status FROM farmer_profiles WHERE user_id=$1', [id]);
    await q.query("UPDATE farmer_profiles SET status=$2, status_reason=$3, verified_at = CASE WHEN $2='verified' THEN now() ELSE verified_at END WHERE user_id=$1", [id, status, status === 'verified' ? '' : reason]);
    await audit(q, a.id, 'farmer.status', 'farmer', id, before?.status, status + (reason ? `: ${reason}` : ''));
    await notify(q, id, status === 'verified' ? 'You are verified ✓ · మీరు ధృవీకరించబడ్డారు' : `Account ${status}`, reason, '/farmer');
  });
  back('/admin/farmers', null, `Farmer ${status}.`);
}

export async function setPayoutHold(fd: FormData) {
  const a = await admin();
  const id = int(fd, 'farmer_id');
  const reason = str(fd, 'hold');
  await tx(async (q) => {
    const [before] = await q.query('SELECT payout_hold FROM farmer_profiles WHERE user_id=$1', [id]);
    await q.query('UPDATE farmer_profiles SET payout_hold=$2 WHERE user_id=$1', [id, reason]);
    await audit(q, a.id, 'farmer.payout_hold', 'farmer', id, before?.payout_hold, reason);
    if (reason) await notify(q, id, 'Payout on hold', reason, '/farmer/payments');
  });
  back('/admin/settlements', null, reason ? 'Payout put on hold.' : 'Hold released.');
}

export async function reviewListing(fd: FormData) {
  const a = await admin();
  const id = int(fd, 'listing_id');
  const approve = str(fd, 'decision') === 'approve';
  await tx(async (q) => {
    const [l] = await q.query("UPDATE listings SET status=$2 WHERE id=$1 AND status='pending_review' RETURNING farmer_id", [id, approve ? 'live' : 'rejected']);
    if (!l) return;
    if (approve) await q.query('UPDATE farmer_profiles SET approved_listings = approved_listings + 1 WHERE user_id=$1', [l.farmer_id]);
    await audit(q, a.id, 'listing.review', 'listing', id, 'pending_review', approve ? 'live' : `rejected: ${str(fd, 'reason')}`);
    await notify(q, l.farmer_id, approve ? 'Your crop is live · మీ పంట అమ్మకానికి ఉంది' : 'Listing not approved', str(fd, 'reason'), '/farmer/listings');
  });
  back('/admin/listings', null, approve ? 'Listing approved.' : 'Listing rejected.');
}

export async function adminAdjustStock(fd: FormData) {
  const a = await admin();
  const id = int(fd, 'listing_id');
  const kg = num(fd, 'kg');
  const reason = str(fd, 'reason');
  if (!(kg > 0) || !reason) back('/admin/listings', 'Enter kg and a reason.');
  let ok = false;
  await tx(async (q) => {
    ok = await moveStock(q, id, 'sellable', str(fd, 'to') === 'removed' ? 'removed' : 'spoiled', kg, { reason: `ops: ${reason}`, actorId: a.id });
    if (ok) await audit(q, a.id, 'listing.adjust', 'listing', id, '', { kg, to: str(fd, 'to'), reason });
  });
  back('/admin/listings', ok ? null : 'Not enough sellable stock for that adjustment.', 'Stock adjusted.');
}

export async function adminOrderAction(fd: FormData) {
  const a = await admin();
  const subId = int(fd, 'sub_order_id');
  const action = str(fd, 'action');
  const ret = str(fd, 'back') || '/admin/orders';
  let err: string | null = null;
  if (action === 'assign') err = await attempt(() => assignPartner(a.id, subId, int(fd, 'partner_id') || null));
  else if (['packed', 'picked_up', 'out_for_delivery', 'delivered'].includes(action)) err = await attempt(() => advanceSubOrder(a, subId, action as any));
  else if (action === 'cancel') {
    const reason = str(fd, 'reason');
    if (!reason) back(ret, 'Give a reason to cancel.');
    err = await attempt(async () => {
      const { releaseByOps } = await import('../orders-ops');
      await releaseByOps(a.id, subId, reason);
    });
  } else err = 'Unknown action.';
  back(ret, err, 'Done.');
}

export async function resolveComplaintAction(fd: FormData) {
  const a = await admin();
  const err = await attempt(() => resolveComplaint(a.id, int(fd, 'complaint_id'), {
    status: str(fd, 'status') === 'rejected' ? 'rejected' : 'resolved',
    refund: num(fd, 'refund') || 0,
    fault: ['farmer', 'partner', 'platform', 'none'].includes(str(fd, 'fault')) ? str(fd, 'fault') : 'none',
    resolution: str(fd, 'resolution') || 'Reviewed by operations.',
  }));
  back('/admin/complaints', err, 'Complaint closed.');
}

export async function payFarmerAction(fd: FormData) {
  const a = await admin();
  const utr = str(fd, 'utr');
  if (utr.length < 6) back('/admin/settlements', 'Enter the bank UTR / reference number.');
  const err = await attempt(() => payFarmer(a.id, int(fd, 'farmer_id'), utr));
  back('/admin/settlements', err, 'Payment recorded and the farmer notified.');
}

export async function addMandiPrice(fd: FormData) {
  const a = await admin();
  const [min, max, modal] = [num(fd, 'min_price'), num(fd, 'max_price'), num(fd, 'modal_price')];
  if (!(min > 0 && max >= min && modal >= min && modal <= max)) back('/admin/mandi', 'Prices must satisfy min ≤ modal ≤ max.');
  await tx(async (q) => {
    await q.query(
      `INSERT INTO mandi_prices (crop_id, market, date, min_price, max_price, modal_price) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (crop_id, market, date) DO UPDATE SET min_price=EXCLUDED.min_price, max_price=EXCLUDED.max_price, modal_price=EXCLUDED.modal_price`,
      [int(fd, 'crop_id'), str(fd, 'market'), str(fd, 'date') || new Date().toISOString().slice(0, 10), min, max, modal]);
    await audit(q, a.id, 'mandi.upsert', 'mandi_price', `${int(fd, 'crop_id')}/${str(fd, 'market')}`, '', { min, max, modal });
  });
  back('/admin/mandi', null, 'Price saved.');
}

export async function saveSettingsAction(fd: FormData) {
  const a = await admin();
  const before = await getSettings();
  await tx(async (q) => {
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const def = DEFAULT_SETTINGS[key];
      let v: unknown;
      if (typeof def === 'boolean') v = fd.get(key) === 'on';
      else if (typeof def === 'number') { v = parseFloat(str(fd, key)); if (!Number.isFinite(v as number) || (v as number) < 0) continue; }
      else v = str(fd, key);
      if (JSON.stringify(v) !== JSON.stringify(before[key])) {
        await saveSetting(q, key, v);
        await audit(q, a.id, 'setting.update', 'setting', key, before[key], v);
      }
    }
  });
  back('/admin/settings', null, 'Rules saved. New orders use them; past orders keep the rules they were placed under.');
}

export async function accountAction(fd: FormData) {
  const a = await admin();
  const id = int(fd, 'user_id');
  const action = str(fd, 'action');
  await tx(async (q) => {
    if (action === 'verify_business' || action === 'reject_business') {
      const st = action === 'verify_business' ? 'verified' : 'rejected';
      await q.query('UPDATE business_profiles SET status=$2 WHERE user_id=$1', [id, st]);
      await audit(q, a.id, 'business.status', 'business', id, '', st);
      await notify(q, id, `Business account ${st}`, '', '/business');
    } else if (action === 'block' || action === 'unblock') {
      await q.query('UPDATE users SET status=$2 WHERE id=$1 AND role <> $3', [id, action === 'block' ? 'blocked' : 'active', 'admin']);
      if (action === 'block') await q.query('DELETE FROM sessions WHERE user_id=$1', [id]);
      await audit(q, a.id, `user.${action}`, 'user', id);
    }
  });
  back('/admin/accounts', null, 'Updated.');
}

export async function createStaff(fd: FormData) {
  const a = await admin();
  const phone = normalisePhone(str(fd, 'phone'));
  const role = str(fd, 'role') === 'admin' ? 'admin' : 'partner';
  if (!phone || !str(fd, 'name')) back('/admin/accounts', 'Enter a name and a valid mobile number.');
  const exists = await one('SELECT 1 FROM users WHERE phone=$1', [phone]);
  if (exists) back('/admin/accounts', 'That number already has an account.');
  await tx(async (q) => {
    const [u] = await q.query('INSERT INTO users (phone, name, role, consent_at) VALUES ($1,$2,$3, now()) RETURNING id', [phone, str(fd, 'name'), role]);
    await audit(q, a.id, 'staff.create', 'user', u.id, '', role);
  });
  back('/admin/accounts', null, `${role === 'partner' ? 'Delivery partner' : 'Admin'} added. They log in with OTP.`);
}

void OrderError; void query;
