/**
 * Database access for the safety section.
 *
 *  - DATABASE_URL set  → real Postgres (Supabase, Railway, Neon, …)
 *  - DATABASE_URL unset → embedded Postgres (PGlite) stored in ./.data/pg,
 *    so development needs no setup. Single-process only — not for production.
 *
 * Both speak the same SQL, so nothing above this file cares which is in use.
 */
import path from "node:path";
import fs from "node:fs";
import { SCHEMA_SQL } from "./schema";
import { seedDefaults } from "./seed";

export type Row = Record<string, unknown>;
export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}
export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
}

async function openPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const pool = new Pool({
    connectionString: url,
    max: 5,
    ssl: local || process.env.DATABASE_SSL === "off" ? undefined : { rejectUnauthorized: false },
  });
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pool.query(sql, params)).rows as T[];
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn({
          async query<T>(sql: string, params: unknown[] = []) {
            return (await client.query(sql, params)).rows as T[];
          },
        });
        await client.query("COMMIT");
        return out;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

async function openEmbedded(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.SAFETY_DATA_DIR ?? path.join(process.cwd(), ".data", "pg");
  fs.mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir);
  await pg.waitReady;
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pg.query(sql, params)).rows as T[];
    },
    async exec(sql) {
      await pg.exec(sql);
    },
    async tx(fn) {
      return (await pg.transaction(async (t) =>
        fn({
          async query<T>(sql: string, params: unknown[] = []) {
            return (await t.query(sql, params)).rows as T[];
          },
        })
      )) as Awaited<ReturnType<typeof fn>>;
    },
  };
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  const db = url ? await openPostgres(url) : await openEmbedded();
  if (!url) console.warn("[safety] DATABASE_URL not set — using embedded dev database in ./.data/pg");
  await db.exec(SCHEMA_SQL);
  await seedDefaults(db);
  return db;
}

// One connection per server process, surviving dev hot-reloads.
const holder = globalThis as unknown as { __safetyDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!holder.__safetyDb) {
    holder.__safetyDb = open().catch((err) => {
      holder.__safetyDb = undefined;
      throw err;
    });
  }
  return holder.__safetyDb;
}

/** ISO-8601 UTC text for a timestamptz column, identical on both drivers. */
export const ts = (col: string) =>
  `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
/** YYYY-MM-DD text for a date expression. */
export const d = (col: string) => `to_char(${col}, 'YYYY-MM-DD')`;
