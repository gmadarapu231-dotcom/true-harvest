import { cookies } from 'next/headers';
import type { CartLine } from './orders';

// The cart lives in a cookie: adding to cart never reserves stock (R-5.2); reservation happens at Place order.
const KEY = 'fm_cart';

export async function readCart(): Promise<CartLine[]> {
  try {
    const raw = (await cookies()).get(KEY)?.value;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((l) => Number.isInteger(l.listingId) && l.packKg > 0 && Number.isInteger(l.count) && l.count > 0).slice(0, 40)
      : [];
  } catch {
    return [];
  }
}

export async function writeCart(lines: CartLine[]) {
  (await cookies()).set(KEY, JSON.stringify(lines), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7 * 86400 });
}
