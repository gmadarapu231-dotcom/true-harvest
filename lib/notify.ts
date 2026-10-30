import type { Queryable } from './db';

// In-app inbox (R-12.1). Push and SMS delivery plug in here once FCM and the DLT SMS provider are set up.
export async function notify(q: Queryable, userId: number, title: string, body = '', link = '') {
  await q.query('INSERT INTO notifications (user_id, title, body, link) VALUES ($1,$2,$3,$4)', [userId, title, body, link]);
}

export async function notifyAdmins(q: Queryable, title: string, body = '', link = '') {
  await q.query(
    "INSERT INTO notifications (user_id, title, body, link) SELECT id, $1, $2, $3 FROM users WHERE role = 'admin'",
    [title, body, link],
  );
}

export async function audit(q: Queryable, actorId: number | null, action: string, entity: string, entityId: string | number, before: unknown = '', after: unknown = '') {
  const s = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
  await q.query('INSERT INTO audit_log (actor_id, action, entity, entity_id, before, after) VALUES ($1,$2,$3,$4,$5,$6)', [
    actorId, action, entity, String(entityId), s(before), s(after),
  ]);
}
