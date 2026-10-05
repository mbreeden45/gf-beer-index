/** Typical sensory descriptors for a beer style (style-level, not a tasting of this beer). */
const RULES: [RegExp, string[]][] = [
  [/imperial stout|russian/i, ["roasty", "dark chocolate", "boozy"]],
  [/stout|porter/i, ["roasty", "cocoa", "coffee"]],
  [/double ipa|imperial ipa/i, ["big hops", "resinous", "bitter"]],
  [/hazy|new england|neipa/i, ["juicy", "tropical", "soft"]],
  [/session ipa/i, ["hoppy", "citrus", "sessionable"]],
  [/ipa/i, ["hoppy", "citrus", "piney"]],
  [/pilsner|pils/i, ["crisp", "grassy hops", "snappy"]],
  [/helles|lager|märzen|marzen|dortmunder|zwickel|premium|pale lager|ice|dry/i, ["clean", "crisp", "easy-drinking"]],
  [/witbier|white|hefeweizen|wheat/i, ["citrusy", "spiced", "soft"]],
  [/tripel|strong|doppelbock|bock/i, ["rich", "malty", "warming"]],
  [/saison|farmhouse/i, ["peppery", "dry", "fruity"]],
  [/gose|sour|gueuze/i, ["tart", "bright", "salty-sour"]],
  [/blonde|golden/i, ["light", "smooth", "lightly sweet"]],
  [/red|amber|brown|copper|winter|pumpkin/i, ["toasty", "caramel", "malty"]],
  [/pale ale|ale/i, ["balanced", "fruity", "hoppy"]],
  [/cider/i, ["apple", "sweet-tart", "fizzy"]],
  [/non-alcoholic|low-alcohol/i, ["light", "dry", "alcohol-free"]],
];
export function flavorFor(style: string): string[] {
  return RULES.find(([re]) => re.test(style))?.[1] ?? [];
}
