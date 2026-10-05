// Idempotent migrations (kept in sync with schema.*.ts). Run via scripts/seed.ts.
export const SQLITE_DDL = [
  `CREATE TABLE IF NOT EXISTS beers (slug TEXT PRIMARY KEY, name TEXT NOT NULL, brewery TEXT NOT NULL, style TEXT NOT NULL, abv REAL, ibu REAL, classification TEXT NOT NULL, grains TEXT NOT NULL, cold_lagering TEXT NOT NULL, sensory_profile TEXT NOT NULL, celiac_assessment TEXT NOT NULL, source_url TEXT, origin TEXT, flavor TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '[]', grains_basis TEXT, refs TEXT NOT NULL DEFAULT '[]')`,
  `CREATE TABLE IF NOT EXISTS beer_tests (id INTEGER PRIMARY KEY AUTOINCREMENT, beer_slug TEXT NOT NULL, kit TEXT NOT NULL, ppm REAL, result TEXT NOT NULL, result_note TEXT NOT NULL, tested_at TEXT, source_name TEXT NOT NULL, source_url TEXT NOT NULL)`,
];
export const DROP = ["DROP TABLE IF EXISTS beer_tests", "DROP TABLE IF EXISTS beers"];
export const PG_DDL = SQLITE_DDL.map((s) => s.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY"));

// Community tables. Kept out of DROP so reseeding the directory never wipes submissions or comments.
export const COMMUNITY_DDL = [
  `CREATE TABLE IF NOT EXISTS beer_submissions (id TEXT PRIMARY KEY, beer_name TEXT NOT NULL, brewery TEXT NOT NULL, style TEXT, abv TEXT, classification TEXT NOT NULL, grain_bill TEXT, reported_ppm TEXT, source_or_proof TEXT, notes TEXT, submitter_email TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS beer_comments (id TEXT PRIMARY KEY, beer_id TEXT NOT NULL, display_name TEXT NOT NULL DEFAULT 'Anonymous', comment TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS beer_comments_beer_idx ON beer_comments (beer_id, created_at)`,
];
