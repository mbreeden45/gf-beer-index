import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { SeedSchema, type Beer } from "./types";
import * as pgSchema from "@/db/schema.pg";
import * as sqliteSchema from "@/db/schema.sqlite";

type Row = typeof sqliteSchema.beers.$inferSelect;
type TRow = typeof sqliteSchema.beerTests.$inferSelect;

function assemble(rows: Row[], tests: TRow[]): Beer[] {
  return rows.map((r) => ({
    ...r,
    classification: r.classification as Beer["classification"],
    grains: JSON.parse(r.grains) as string[],
    tests: tests.filter((t) => t.beerSlug === r.slug).map((t) => ({
      kit: t.kit, ppm: t.ppm, result: t.result as Beer["tests"][number]["result"], resultNote: t.resultNote,
      testedAt: t.testedAt, sourceName: t.sourceName, sourceUrl: t.sourceUrl,
    })),
  }));
}

function fromSeed(): Beer[] {
  return SeedSchema.parse(JSON.parse(readFileSync(path.join(process.cwd(), "data/seed-beers.json"), "utf8")));
}

/** Postgres (DATABASE_URL) -> local SQLite (data/beers.db) -> bundled seed JSON (e.g. serverless). */
export async function getBeers(): Promise<Beer[]> {
  try {
    if (process.env.DATABASE_URL) {
      const { default: postgres } = await import("postgres");
      const { drizzle } = await import("drizzle-orm/postgres-js");
      const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
      const db = drizzle(client, { schema: pgSchema });
      const [b, t] = await Promise.all([db.select().from(pgSchema.beers), db.select().from(pgSchema.beerTests)]);
      await client.end();
      if (b.length) return assemble(b, t);
    }
    const file = path.join(process.cwd(), "data/beers.db");
    if (existsSync(file)) {
      const { default: Database } = await import("better-sqlite3");
      const { drizzle } = await import("drizzle-orm/better-sqlite3");
      const sqlite = new Database(file, { readonly: true });
      const db = drizzle(sqlite, { schema: sqliteSchema });
      const b = db.select().from(sqliteSchema.beers).all();
      const t = db.select().from(sqliteSchema.beerTests).all();
      sqlite.close();
      if (b.length) return assemble(b, t);
    }
  } catch (e) {
    console.error("DB read failed, using seed JSON:", (e as Error).message);
  }
  return fromSeed();
}
