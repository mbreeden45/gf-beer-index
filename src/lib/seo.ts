import type { Beer, Classification } from "./types";
import { CLASS_LABEL } from "./types";
import { latestTest } from "@/components/Stamps";

export const CLASS_PAGES: Record<string, { cls: Classification; h1: string; title: string; intro: string }> = {
  "dedicated-gluten-free": {
    cls: "dedicated_ngci",
    h1: "100% gluten-free beers",
    title: "100% Gluten-Free Beers",
    intro:
      "These beers are brewed from naturally gluten-free grains such as millet, rice, buckwheat and sorghum, with no barley, wheat or rye in the recipe. Because gluten never enters the brew, this is the lowest-risk category in the index. The remaining risk is cross-contact at the facility, so check with the brewer.",
  },
  "gluten-reduced": {
    cls: "crafted_to_remove",
    h1: "Gluten-reduced beers (crafted to remove gluten)",
    title: "Gluten-Reduced Beers",
    intro:
      "These are barley beers treated with an enzyme such as Brewer's Clarex to break gluten down. Home test kits can under-read treated beer, and many coeliac organisations advise caution, so treat the results here as screens, not guarantees.",
  },
  "naturally-low-ppm": {
    cls: "adjunct_low_ppm",
    h1: "Naturally low-gluten beers",
    title: "Naturally Low-Gluten Beers",
    intro:
      "These barley beers read negative on home test kits, often thanks to adjuncts, dilution and filtration. That is unverified: nothing certifies them, kits have limited sensitivity, and batches vary. They are not a gluten-free guarantee.",
  },
  "standard-gluten": {
    cls: "standard_gluten",
    h1: "Standard gluten beers (not gluten-free)",
    title: "Standard Gluten Beers (Not GF)",
    intro:
      "Conventional barley or wheat beers, listed for comparison and because home tests or estimates found gluten. They are not suitable for coeliac disease.",
  },
};

export const classSlug = (c: Classification) => Object.keys(CLASS_PAGES).find((k) => CLASS_PAGES[k].cls === c)!;

const OPENER: Record<Classification, string> = {
  dedicated_ngci:
    "Brewed from naturally gluten-free grains with no barley, wheat or rye in the recipe, so it sits in the lowest-risk category in this index. Cross-contact at the brewery is still worth checking.",
  crafted_to_remove:
    "Not in the usual sense. It is a barley beer treated with an enzyme to reduce gluten, so it is gluten-reduced rather than gluten-free, and test kits can under-read treated beer.",
  adjunct_low_ppm:
    "Not certified. It is made with barley but read negative on home test kits. That is unverified and is not a safety guarantee.",
  standard_gluten: "No. It is a conventional barley or wheat beer and is not suitable for coeliac disease.",
};

export function testSummary(b: Beer): string {
  const t = latestTest(b.tests);
  if (!t) return `No home-kit or lab result is on file for ${b.name}. Its classification is based on its recipe and brewing method.`;
  const reading = t.ppm != null ? `an estimate of about ${t.ppm} ppm` : t.result === "negative" ? "a negative reading (gluten not detected)" : t.result === "positive" ? "a positive reading (gluten detected)" : "an inconclusive reading";
  const n = b.tests.length;
  return `${n} test${n === 1 ? " is" : "s are"} on file for ${b.name}. The latest, using ${t.kit}${t.testedAt ? ` on ${t.testedAt}` : ""}, gave ${reading}. Home kits are qualitative screens with limited sensitivity, not lab assays.`;
}

export function beerFaq(b: Beer): { q: string; a: string }[] {
  return [
    { q: `Is ${b.name} gluten-free?`, a: `${OPENER[b.classification]} ${b.celiacAssessment}` },
    { q: `Has ${b.name} been tested for gluten?`, a: testSummary(b) },
  ];
}

export const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: "What does gluten-free beer actually mean?",
    a: "It can mean four different things: beer brewed from naturally gluten-free grains such as millet, rice or sorghum; barley beer treated with an enzyme to remove gluten; ordinary barley beer that happens to test low; and standard gluten beer. This index sorts every beer into one of those four classes.",
  },
  {
    q: "Is gluten-reduced beer safe for coeliac disease?",
    a: "Not necessarily. Enzyme-treated barley beer is not gluten-free, and test kits can under-read the broken-down gluten fragments, so many coeliac organisations advise caution. Confirm with your clinician and the brewer.",
  },
  {
    q: "How reliable are the test results here?",
    a: "Each reading comes from a public home-kit test (such as Reveal 3-D or Imutest) with a link to its source. Kits are qualitative screens at a 5 to 20 ppm threshold, not lab assays, so a negative result is a clue rather than a guarantee.",
  },
  {
    q: "Which beers are brewed without barley?",
    a: "Beers in the 100% NGCI class are brewed from naturally gluten-free grains with no barley, wheat or rye. Browse them on the 100% gluten-free beers page.",
  },
];

export function classCounts(beers: Beer[]) {
  const out = {} as Record<Classification, number>;
  for (const c of Object.keys(CLASS_LABEL) as Classification[]) out[c] = beers.filter((b) => b.classification === c).length;
  return out;
}

export function groupSummary(beers: Beer[]): string {
  const c = classCounts(beers);
  const parts = CLASS_ORDER.filter((k) => c[k]).map((k) => `${CLASS_LABEL[k]} (${c[k]})`);
  return parts.join(", ");
}

export const CLASS_ORDER: Classification[] = ["dedicated_ngci", "crafted_to_remove", "adjunct_low_ppm", "standard_gluten"];
export const sortBeers = (beers: Beer[]) =>
  [...beers].sort((a, b) => CLASS_ORDER.indexOf(a.classification) - CLASS_ORDER.indexOf(b.classification) || a.name.localeCompare(b.name));
