import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const beers = sqliteTable("beers", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  brewery: text("brewery").notNull(),
  style: text("style").notNull(),
  abv: real("abv"),
  ibu: real("ibu"),
  classification: text("classification").notNull(),
  grains: text("grains").notNull(), // JSON array
  coldLagering: text("cold_lagering").notNull(),
  sensoryProfile: text("sensory_profile").notNull(),
  celiacAssessment: text("celiac_assessment").notNull(),
  sourceUrl: text("source_url"),
  origin: text("origin"),
  flavor: text("flavor").notNull().default("[]"), // JSON array
  notes: text("notes").notNull().default("[]"), // JSON array
  grainsBasis: text("grains_basis"),
  refs: text("refs").notNull().default("[]"), // JSON array
});

export const beerTests = sqliteTable("beer_tests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  beerSlug: text("beer_slug").notNull(),
  kit: text("kit").notNull(),
  ppm: real("ppm"),
  result: text("result").notNull(),
  resultNote: text("result_note").notNull(),
  testedAt: text("tested_at"),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
});

export const beerSubmissions = sqliteTable("beer_submissions", {
  id: text("id").primaryKey(),
  beerName: text("beer_name").notNull(),
  brewery: text("brewery").notNull(),
  style: text("style"),
  abv: text("abv"),
  classification: text("classification").notNull(), // dedicated_ngci | crafted_to_remove | adjunct_low_ppm
  grainBill: text("grain_bill"),
  reportedPpm: text("reported_ppm"),
  sourceOrProof: text("source_or_proof"),
  notes: text("notes"),
  submitterEmail: text("submitter_email"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  createdAt: text("created_at").notNull(), // ISO-8601
});

export const beerComments = sqliteTable("beer_comments", {
  id: text("id").primaryKey(),
  beerId: text("beer_id").notNull(), // beers.slug
  displayName: text("display_name").notNull().default("Anonymous"),
  comment: text("comment").notNull(),
  isDeleted: integer("is_deleted").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
