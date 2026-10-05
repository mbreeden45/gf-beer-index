import type { Classification } from "./types";

type P = {
  name: string;
  style: string;
  abv: number | null;
  classification: Classification;
  grains: string[];
  hasPositiveTest?: boolean;
};

const fmtGrains = (g: string[]) =>
  g.length ? g.join(", ") : "grains not itemised by the source";

/** Original, template-generated copy derived only from objective fields. */
export function sensoryProfile(p: P): string {
  const strength =
    p.abv == null ? "an unstated strength" : p.abv >= 6.5 ? "a robust " + p.abv + "% ABV" : p.abv >= 4.8 ? "a mid-weight " + p.abv + "% ABV" : "a light " + p.abv + "% ABV";
  const base: Record<Classification, string> = {
    dedicated_ngci: `Built on ${fmtGrains(p.grains)} rather than barley, this ${p.style} leans on the grain's natural character instead of a wheat-style malt backbone.`,
    crafted_to_remove: `A barley-malt ${p.style} where the grain bill keeps a familiar malt-forward structure before enzymatic treatment.`,
    adjunct_low_ppm: `A ${p.style} brewed with ${fmtGrains(p.grains)}, which typically gives a lighter, crisper body than an all-malt recipe.`,
    standard_gluten: `A conventional ${p.style} brewed with ${fmtGrains(p.grains)}, so expect the full malt body of a traditional recipe.`,
  };
  return `${base[p.classification]} It carries ${strength}.`;
}

export function celiacAssessment(p: P): string {
  switch (p.classification) {
    case "dedicated_ngci":
      return "Brewed from naturally gluten-free grains, so there is no barley or wheat in the recipe to remove. Check the brewery's own facility statement if you need confirmation about cross-contact.";
    case "crafted_to_remove":
      return "Made from barley and treated with an enzyme to cut gluten fragments, and the test kits used on such beers can misread broken-down gluten. Many celiac organisations advise caution with this category.";
    case "adjunct_low_ppm":
      if (!p.grains.some((g) => ["corn", "rice", "cassava"].includes(g)) && !p.hasPositiveTest)
        return "Kit results on file read negative despite an all-barley recipe, which may reflect kit sensitivity limits rather than true absence of gluten. Treat as unverified for celiac use.";
      return p.hasPositiveTest
        ? "Corn or rice adjuncts and filtration lower gluten in this style, but at least one kit on file read positive. Treat it as unverified for celiac use."
        : "Heavy adjunct use and filtration tend to lower prolamin, and kit results on file read negative. Home kits are screening tools with limited sensitivity, so this is not a safety guarantee.";
    default:
      return p.hasPositiveTest
        ? "Barley or wheat-based, and a kit on file read positive for gluten. Not suitable for celiac disease."
        : "Traditional barley or wheat recipe with no gluten reduction. Not suitable for celiac disease.";
  }
}

export function coldLagering(c: Classification, style: string): string {
  const lager = /lager|pils|helles|bock/i.test(style);
  switch (c) {
    case "dedicated_ngci":
      return "Not applicable: no gluten-bearing grains to settle out; fermentation is of GF grains.";
    case "crafted_to_remove":
      return "Enzyme (e.g. prolyl endopeptidase) added during fermentation, then cold conditioning to drop out protein haze.";
    case "adjunct_low_ppm":
      return lager
        ? "Extended cold lagering and fine filtration strip much of the protein, alongside a high adjunct share."
        : "Cold conditioning and filtration; the adjunct share does most of the dilution.";
    default:
      return lager
        ? "Standard lagering with no gluten-targeted treatment."
        : "No gluten-targeted treatment documented.";
  }
}
