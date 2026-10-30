import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { one, query } from './db';
const RULES = { otpTtlMinutes: 5, sessionDays: 30 };

export type Role = 'consumer' | 'farmer' | 'business' | 'partner' | 'admin';
export interface User {
  id: number;
  phone: string;
  name: string;
  role: Role;
  lang: 'en' | 'te';
  address: string;
  pin: string;
  district: string;
}

const COOKIE = 'fm_session';

export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

// SMS is not wired yet: until SMS_PROVIDER is configured the code is returned so the login screen can show it.
export async function issueOtp(phone: string): Promise<{ demoCode?: string }> {
  const code = String(crypto.randomInt(100000, 1000000));
  await query(
    `INSERT INTO otp_codes (phone, code, attempts, expires_at) VALUES ($1, $2, 0, now() + ($3 || ' minutes')::interval)
     ON CONFLICT (phone) DO UPDATE SET code = EXCLUDED.code, attempts = 0, expires_at = EXCLUDED.expires_at`,
    [phone, code, String(RULES.otpTtlMinutes)],
  );
  if (process.env.SMS_PROVIDER) {
    // TODO: send through the chosen Indian SMS gateway (DLT-registered template) here.
    console.log(`[otp] would send ${code} to ${phone} via ${process.env.SMS_PROVIDER}`);
    return {};
  }
  return { demoCode: code };
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const row = await one<{ code: string; attempts: number; expired: boolean }>(
    'SELECT code, attempts, expires_at < now() AS expired FROM otp_codes WHERE phone=$1',
    [phone],
  );
  if (!row || row.expired || row.attempts >= 5) return false;
  if (row.code !== code.trim()) {
    await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE phone=$1', [phone]);
    return false;
  }
  await query('DELETE FROM otp_codes WHERE phone=$1', [phone]);
  return true;
}

export async function startSession(userId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  await query(`INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)`, [
    token, userId, String(RULES.sessionDays),
  ]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== '1',
    path: '/', maxAge: RULES.sessionDays * 86400,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await query('DELETE FROM sessions WHERE token=$1', [token]);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const u = await one<User>(
    `SELECT u.id, u.phone, u.name, u.role, u.lang, u.address, u.pin, u.district
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token=$1 AND s.expires_at > now() AND u.status = 'active'`,
    [token],
  );
  return u ?? null;
}

export async function requireUser(...roles: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/login');
  if (!u.name) redirect('/onboarding');
  if (roles.length && !roles.includes(u.role)) redirect(homeFor(u.role));
  return u;
}

export function homeFor(role: Role): string {
  return { consumer: '/shop', farmer: '/farmer', business: '/business', partner: '/partner', admin: '/admin' }[role];
}
