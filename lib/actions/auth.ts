'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { query, one, tx } from '../db';
import { issueOtp, verifyOtp, normalisePhone, startSession, endSession, currentUser, homeFor, type Role } from '../auth';
import { back, str, num } from '../http';
import { BUSINESS_TYPES } from '../config';

const SIGNUP_ROLES: Role[] = ['consumer', 'farmer', 'business'];

export async function requestOtp(fd: FormData) {
  const phone = normalisePhone(str(fd, 'phone'));
  const role = str(fd, 'role') as Role;
  if (!phone) back('/login', 'Enter a valid 10-digit Indian mobile number.');
  // Rate limit: 5 OTPs per phone per hour (R-14.1).
  const row = await one<{ sent_count: number; fresh: boolean }>(
    "SELECT sent_count, window_start > now() - interval '1 hour' AS fresh FROM otp_codes WHERE phone=$1", [phone]);
  if (row?.fresh && row.sent_count >= 5) back('/login', 'Too many codes requested. Try again in an hour.');
  const { demoCode } = await issueOtp(phone);
  if (row?.fresh) await query('UPDATE otp_codes SET sent_count = $2 WHERE phone=$1', [phone, row.sent_count + 1]);
  else await query('UPDATE otp_codes SET sent_count = 1, window_start = now() WHERE phone=$1', [phone]);
  const qs = new URLSearchParams({ phone, role: SIGNUP_ROLES.includes(role) ? role : 'consumer' });
  if (demoCode) qs.set('demo', demoCode);
  redirect(`/login?${qs}`);
}

export async function confirmOtp(fd: FormData) {
  const phone = normalisePhone(str(fd, 'phone'));
  const role = (SIGNUP_ROLES.includes(str(fd, 'role') as Role) ? str(fd, 'role') : 'consumer') as Role;
  if (!phone) back('/login', 'Enter a valid mobile number.');
  if (!(await verifyOtp(phone, str(fd, 'code')))) back(`/login?phone=${phone}&role=${role}`, 'That code is wrong or has expired.');
  let user = await one<{ id: number; role: Role; name: string; status: string }>('SELECT id, role, name, status FROM users WHERE phone=$1', [phone]);
  if (user?.status === 'blocked') back('/login', 'This account is blocked. Please contact support.');
  if (!user) {
    const lang = (await cookies()).get('fm_lang')?.value === 'te' || role === 'farmer' ? 'te' : 'en'; // Telugu default for farmers (R-4.1)
    user = (await one('INSERT INTO users (phone, role, lang) VALUES ($1,$2,$3) RETURNING id, role, name, status', [phone, role, lang]))!;
  }
  await startSession(user.id);
  redirect(user.name ? homeFor(user.role) : '/onboarding');
}

export async function logout() {
  await endSession();
  redirect('/');
}

export async function setLang(fd: FormData) {
  const lang = str(fd, 'lang') === 'te' ? 'te' : 'en';
  (await cookies()).set('fm_lang', lang, { path: '/', maxAge: 365 * 86400, sameSite: 'lax' });
  const u = await currentUser();
  if (u) await query('UPDATE users SET lang=$2 WHERE id=$1', [u.id, lang]);
  const to = str(fd, 'back');
  redirect(to.startsWith('/') ? to : '/');
}

export async function onboard(fd: FormData) {
  const u = await currentUser();
  if (!u) redirect('/login');
  const name = str(fd, 'name');
  if (name.length < 2) back('/onboarding', 'Please enter your name.');
  if (!fd.get('consent')) back('/onboarding', 'Please agree to the privacy terms to continue.');
  await tx(async (q) => {
    await q.query('UPDATE users SET name=$2, address=$3, pin=$4, district=$5, consent_at=now() WHERE id=$1',
      [u.id, name, str(fd, 'address'), str(fd, 'pin'), str(fd, 'district')]);
    if (u.role === 'farmer') {
      const state = str(fd, 'state') === 'Andhra Pradesh' ? 'Andhra Pradesh' : 'Telangana';
      const acres = num(fd, 'farm_size_acres');
      await q.query(
        `INSERT INTO farmer_profiles (user_id, village, mandal, district, state, pin, farm_size_acres, main_crops, farmer_type, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'registered') ON CONFLICT (user_id) DO NOTHING`,
        [u.id, str(fd, 'village'), str(fd, 'mandal'), str(fd, 'district'), state, str(fd, 'pin'), Number.isFinite(acres) ? acres : 0,
         str(fd, 'main_crops'), str(fd, 'farmer_type') === 'fpo_member' ? 'fpo_member' : 'individual'],
      );
    }
    if (u.role === 'business') {
      const type = BUSINESS_TYPES.includes(str(fd, 'business_type')) ? str(fd, 'business_type') : 'other';
      const gstin = str(fd, 'gstin').toUpperCase();
      if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw new Error('GSTIN format looks wrong');
      await q.query(
        'INSERT INTO business_profiles (user_id, legal_name, business_type, gstin, receiving_hours) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id) DO NOTHING',
        [u.id, str(fd, 'legal_name') || name, type, gstin, str(fd, 'receiving_hours')],
      );
    }
  }).catch((e) => back('/onboarding', e.message.includes('GSTIN') ? 'GSTIN format looks wrong. Leave it blank if you do not have one.' : 'Could not save. Please try again.'));
  redirect(u.role === 'farmer' ? '/farmer/profile?ok=' + encodeURIComponent('Welcome! Add your ID and bank details so we can verify you.') : homeFor(u.role));
}

export async function markAllRead() {
  const u = await currentUser();
  if (u) await query('UPDATE notifications SET read_at = now() WHERE user_id=$1 AND read_at IS NULL', [u.id]);
  redirect('/notifications');
}

export async function saveAddress(fd: FormData) {
  const u = await currentUser();
  if (!u) redirect('/login');
  await query('UPDATE users SET name=$2, address=$3, pin=$4 WHERE id=$1', [u.id, str(fd, 'name') || u.name, str(fd, 'address'), str(fd, 'pin')]);
  back('/profile', null, 'Saved.');
}
