import "server-only";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { COMMUNITY_DDL, PG_DDL, SQLITE_DDL } from "@/db/ddl";

type Row = Record<string, unknown>;
type Q = { all: (sql: string, params?: unknown[]) => Promise<Row[]>; run: (sql: string, params?: unknown[]) => Promise<void> };

export class StoreUnavailable extends Error {}

const toPg = (sql: string) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };
let ready = false;

/** Postgres when DATABASE_URL is set; local SQLite in dev; unavailable on serverless without a database. */
export async function withDb<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import("postgres");
    const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
    const q: Q = {
      all: async (sql, params = []) => [...(await client.unsafe(toPg(sql), params as never[]))] as Row[],
      run: async (sql, params = []) => { await client.unsafe(toPg(sql), params as never[]); },
    };
    try {
      if (!ready) { for (const s of [...PG_DDL, ...COMMUNITY_DDL]) await client.unsafe(s); ready = true; }
      return await fn(q);
    } finally {
      await client.end();
    }
  }
  if (process.env.VERCEL) throw new StoreUnavailable("No database configured on this deployment.");
  const { default: Database } = await import("better-sqlite3");
  mkdirSync("data", { recursive: true });
  const file = path.join(process.cwd(), "data/beers.db");
  const db = new Database(file);
  const q: Q = {
    all: async (sql, params = []) => db.prepare(sql).all(...(params as never[])) as Row[],
    run: async (sql, params = []) => { db.prepare(sql).run(...(params as never[])); },
  };
  try {
    if (!ready || !existsSync(file)) { for (const s of [...SQLITE_DDL, ...COMMUNITY_DDL]) db.exec(s); ready = true; }
    return await fn(q);
  } finally {
    db.close();
  }
}
