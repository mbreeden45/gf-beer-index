// Idempotent migrations (kept in sync with schema.*.ts). Run via scripts/seed.ts.
export const SQLITE_DDL = [
  `CREATE TABLE IF NOT EXISTS beers (slug TEXT PRIMARY KEY, name TEXT NOT NULL, brewery TEXT NOT NULL, style TEXT NOT NULL, abv REAL, ibu REAL, classification TEXT NOT NULL, grains TEXT NOT NULL, cold_lagering TEXT NOT NULL, sensory_profile TEXT NOT NULL, celiac_assessment TEXT NOT NULL, source_url TEXT, origin TEXT, flavor TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '[]', grains_basis TEXT, refs TEXT NOT NULL DEFAULT '[]')`,
  `CREATE TABLE IF NOT EXISTS beer_tests (id INTEGER PRIMARY KEY AUTOINCREMENT, beer_slug TEXT NOT NULL, kit TEXT NOT NULL, ppm REAL, result TEXT NOT NULL, result_note TEXT NOT NULL, tested_at TEXT, source_name TEXT NOT NULL, source_url TEXT NOT NULL)`,
];
export const DROP = ["DROP TABLE IF EXISTS beer_tests", "DROP TABLE IF EXISTS beers"];
export const PG_DDL = SQLITE_DDL.map((s) => s.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY"));
