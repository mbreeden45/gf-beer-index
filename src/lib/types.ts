import { z } from "zod";

export const CLASSIFICATIONS = [
  "dedicated_ngci",
  "crafted_to_remove",
  "adjunct_low_ppm",
  "standard_gluten",
] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const TestSchema = z.object({
  kit: z.string().min(1),
  ppm: z.number().nonnegative().nullable(),
  result: z.enum(["negative", "positive", "inconclusive", "numeric"]),
  resultNote: z.string().max(400).default(""),
  testedAt: z.string().nullable(),
  sourceName: z.string().min(1),
  sourceUrl: z.string().url(),
});
export type BeerTest = z.infer<typeof TestSchema>;

export const BeerSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  brewery: z.string().min(1),
  style: z.string().min(1),
  abv: z.number().min(0).max(30).nullable(),
  ibu: z.number().min(0).max(200).nullable(),
  classification: z.enum(CLASSIFICATIONS),
  grains: z.array(z.string()),
  coldLagering: z.string(),
  sensoryProfile: z.string(),
  celiacAssessment: z.string(),
  sourceUrl: z.string().url().nullable(),
  origin: z.string().nullable().default(null),
  flavor: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
  grainsBasis: z.enum(["listing", "brewery-typical", "reference"]).nullable().default(null),
  refs: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
  tests: z.array(TestSchema),
});
export type Beer = z.output<typeof BeerSchema>;
export const SeedSchema = z.array(BeerSchema);

export const CLASS_LABEL: Record<Classification, string> = {
  dedicated_ngci: "100% NGCI",
  crafted_to_remove: "Crafted to Remove",
  adjunct_low_ppm: "Naturally Low ppm",
  standard_gluten: "Standard Gluten",
};
