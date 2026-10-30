import type { Queryable } from './db';

// Quantity buckets (SRS section 9). 'sellable' is derived from the others, never stored.
export type Bucket = 'sellable' | 'reserved' | 'confirmed' | 'delivered' | 'rejected' | 'spoiled' | 'removed';
const COL: Record<Exclude<Bucket, 'sellable'>, string> = {
  reserved: 'reserved_kg', confirmed: 'confirmed_kg', delivered: 'delivered_kg',
  rejected: 'rejected_kg', spoiled: 'spoiled_kg', removed: 'removed_kg',
};
export const SELLABLE_SQL = '(l.listed_kg - l.reserved_kg - l.confirmed_kg - l.delivered_kg - l.rejected_kg - l.spoiled_kg - l.removed_kg)';
const SELLABLE_BARE = SELLABLE_SQL.replaceAll('l.', '');

export class StockError extends Error {
  constructor(message: string, public listingIds: number[] = []) { super(message); }
}

/**
 * Move kg between two buckets of one listing in a single conditional UPDATE, so two buyers can never
 * take the same kilogram: the row lock taken by UPDATE serialises concurrent moves and the WHERE clause
 * re-checks availability after the lock. Returns false (and changes nothing) if the source bucket is short.
 */
export async function moveStock(
  q: Queryable, listingId: number, from: Bucket, to: Bucket, kg: number,
  opts: { reason?: string; actorId?: number | null; orderLineId?: number | null } = {},
): Promise<boolean> {
  if (!(kg > 0)) return true;
  const sets: string[] = [];
  let guard: string;
  if (from === 'sellable') guard = `${SELLABLE_BARE} >= $2`;
  else { sets.push(`${COL[from]} = ${COL[from]} - $2`); guard = `${COL[from]} >= $2`; }
  if (to !== 'sellable') sets.push(`${COL[to]} = ${COL[to]} + $2`);
  if (!sets.length) return true;
  const rows = await q.query(`UPDATE listings SET ${sets.join(', ')} WHERE id = $1 AND ${guard} RETURNING id`, [listingId, kg]);
  if (!rows.length) return false;
  await q.query(
    'INSERT INTO inventory_movements (listing_id, order_line_id, from_bucket, to_bucket, kg, reason, actor_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [listingId, opts.orderLineId ?? null, from, to, kg, opts.reason ?? '', opts.actorId ?? null],
  );
  return true;
}

/** Farmer adds stock (+) or removes unsold stock (-). Removal can never cut into reserved or confirmed kg (R-9.5). */
export async function adjustStock(q: Queryable, listingId: number, deltaKg: number, actorId: number, reason: string) {
  if (deltaKg > 0) {
    await q.query('UPDATE listings SET listed_kg = listed_kg + $2 WHERE id = $1', [listingId, deltaKg]);
    await q.query(
      "INSERT INTO inventory_movements (listing_id, from_bucket, to_bucket, kg, reason, actor_id) VALUES ($1,'new','sellable',$2,$3,$4)",
      [listingId, deltaKg, reason, actorId],
    );
    return true;
  }
  return moveStock(q, listingId, 'sellable', 'removed', -deltaKg, { reason, actorId });
}
