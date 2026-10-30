import { one } from '@/lib/db';

export async function GET() {
  const ok = await one<{ ok: number }>('SELECT 1 AS ok').catch(() => null);
  return Response.json({ status: ok ? 'ok' : 'db_unavailable' }, { status: ok ? 200 : 503 });
}
