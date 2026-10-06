import { readFileSync, mkdirSync } from "node:fs";
import { SeedSchema } from "../src/lib/types";
import * as sqliteSchema from "../src/db/schema.sqlite";
import * as pgSchema from "../src/db/schema.pg";
import { DROP, PG_DDL, SQLITE_DDL } from "../src/db/ddl";

const seed = SeedSchema.parse(JSON.parse(readFileSync("data/seed-beers.json", "utf8")));
const beerRows = seed.map((b) => { const { tests: _omit, grains, flavor, notes, refs, ...rest } = b; void _omit; return { ...rest, grains: JSON.stringify(grains), flavor: JSON.stringify(flavor), notes: JSON.stringify(notes), refs: JSON.stringify(refs) }; });
const testRows = seed.flatMap((b) => b.tests.map((t) => ({ beerSlug: b.slug, ...t })));
const chunk = <T,>(a: T[], n = 200) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function main() {
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(process.env.DATABASE_URL, { prepare: false });
    const db = drizzle(client);
    for (const s of [...DROP, ...PG_DDL]) await client.unsafe(s);
    await db.delete(pgSchema.beerTests);
    await db.delete(pgSchema.beers);
    for (const c of chunk(beerRows)) await db.insert(pgSchema.beers).values(c);
    for (const c of chunk(testRows)) await db.insert(pgSchema.beerTests).values(c);
    // Supabase exposes public tables via its REST API; RLS with no policies blocks that. The app connects as the owner role, which bypasses RLS.
    for (const t of ["beers", "beer_tests", "beer_submissions", "beer_comments"]) await client.unsafe(`ALTER TABLE IF EXISTS ${t} ENABLE ROW LEVEL SECURITY`);
    await client.end();
    console.log(`Postgres seeded: ${beerRows.length} beers, ${testRows.length} tests`);
  } else {
    const { default: Database } = await import("better-sqlite3");
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    mkdirSync("data", { recursive: true });
    const sqlite = new Database("data/beers.db");
    for (const s of [...DROP, ...SQLITE_DDL]) sqlite.exec(s);
    const db = drizzle(sqlite);
    db.delete(sqliteSchema.beerTests).run();
    db.delete(sqliteSchema.beers).run();
    for (const c of chunk(beerRows)) db.insert(sqliteSchema.beers).values(c).run();
    for (const c of chunk(testRows)) db.insert(sqliteSchema.beerTests).values(c).run();
    sqlite.close();
    console.log(`SQLite seeded (data/beers.db): ${beerRows.length} beers, ${testRows.length} tests`);
  }
}
main();
