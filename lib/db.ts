import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// One query interface over two drivers:
//  - DATABASE_URL set  -> real PostgreSQL through `pg` (staging/production)
//  - DATABASE_URL unset -> embedded PGlite (Postgres compiled to WASM) in ~/.farmora for zero-setup local dev
export type Row = Record<string, any>;
export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}
interface Driver extends Queryable {
  exec(sql: string): Promise<void>;
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
}

async function makePg(url: string): Promise<Driver> {
  const pg = (await import('pg')).default;
  pg.types.setTypeParser(1700, (v: string) => parseFloat(v)); // numeric -> number
  pg.types.setTypeParser(20, (v: string) => parseInt(v, 10)); // bigint (count) -> number
  pg.types.setTypeParser(1082, (v: string) => v); // date -> 'YYYY-MM-DD'
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return {
    async query(sql, params = []) {
      return (await pool.query(sql, params as any[])).rows;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: async (s, p = []) => (await client.query(s, p as any[])).rows });
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function makePglite(): Promise<Driver> {
  const { PGlite } = await import('@electric-sql/pglite');
  // Kept outside the project folder so the dev server's file watcher doesn't reload on every write.
  const dir = process.env.PGLITE_DIR || path.join(os.homedir(), '.farmora', 'pglite');
  fs.mkdirSync(dir, { recursive: true });
  const db = await PGlite.create(dir, {
    parsers: { 1700: (v: string) => parseFloat(v), 20: (v: string) => parseInt(v, 10), 1082: (v: string) => v },
  });
  // PGlite is a single connection with its own queue, so transactions never interleave.
  // Inside tx() always use the `q` it hands you, never the module-level query(), or it will wait on itself.
  return {
    async query(sql, params = []) {
      return (await db.query(sql, params as any[])).rows as any[];
    },
    async exec(sql) {
      await db.exec(sql);
    },
    tx(fn) {
      return db.transaction((t) => fn({ query: async (s, p = []) => (await t.query(s, p as any[])).rows as any[] }));
    },
  };
}

const g = globalThis as unknown as { __farmoraDb?: Promise<Driver> };

async function init(): Promise<Driver> {
  const driver = process.env.DATABASE_URL ? await makePg(process.env.DATABASE_URL) : await makePglite();
  const schema = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  await driver.exec(schema);
  const { seedIfEmpty } = await import('./seed');
  await seedIfEmpty(driver);
  return driver;
}

function driver(): Promise<Driver> {
  if (!g.__farmoraDb) g.__farmoraDb = init().catch((e) => { g.__farmoraDb = undefined; throw e; });
  return g.__farmoraDb;
}

export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await driver()).query<T>(sql, params);
}
export async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await query<T>(sql, params))[0];
}
export async function tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  return (await driver()).tx(fn);
}
