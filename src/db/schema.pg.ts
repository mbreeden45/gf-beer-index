import { pgTable, text, real, serial } from "drizzle-orm/pg-core";

export const beers = pgTable("beers", {
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
});

export const beerTests = pgTable("beer_tests", {
  id: serial("id").primaryKey(),
  beerSlug: text("beer_slug").notNull(),
  kit: text("kit").notNull(),
  ppm: real("ppm"),
  result: text("result").notNull(),
  resultNote: text("result_note").notNull(),
  testedAt: text("tested_at"),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
});
