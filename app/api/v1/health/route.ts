import { one } from '@/lib/db';

// Liveness for the host's health check: answers 200 while the server runs, and reports the database separately so a
// bad connection string shows up here instead of failing the deploy with nothing to read.
export async function GET() {
  const db = await one<{ ok: number }>('SELECT 1 AS ok').then(() => 'ok', (e: { code?: string; message?: string }) => {
    const reason = e.code ?? e.message?.split('\n')[0]?.replace(/postgres(ql)?:\/\/\S+/g, '[url]') ?? 'unknown';
    return `error: ${reason}`;
  });
  return Response.json({ status: 'ok', database: db, driver: process.env.DATABASE_URL ? 'postgres' : 'embedded' });
}
