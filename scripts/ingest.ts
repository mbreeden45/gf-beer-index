/**
 * Ingestion: allbeernogluten.com (dedicated GF directory), lowgluten.org (kit test posts),
 * smartgurlsolutions.com (attempted via Playwright; often blocked). Facts only — no review
 * text or photos are stored. Sensory/safety copy is generated locally from facts.
 */
import * as cheerio from "cheerio";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { BeerSchema, SeedSchema, type Beer as FullBeer, type BeerTest, type Classification } from "../src/lib/types";

// During ingest the enrichment fields are optional; SeedSchema fills defaults on output.
type Beer = Omit<FullBeer, "origin" | "flavor" | "notes" | "grainsBasis" | "refs"> & Partial<Pick<FullBeer, "origin" | "flavor" | "notes" | "grainsBasis" | "refs">>;
import { flavorFor } from "../src/lib/flavor";
import { celiacAssessment, coldLagering, sensoryProfile } from "../src/lib/profile";

const UA = "Mozilla/5.0 (compatible; gf-beer-index/1.0; fact-extraction, contact via repo)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const GRAIN_WORDS = ["millet", "rice", "buckwheat", "sorghum", "corn", "maize", "barley", "wheat", "oats", "quinoa", "chestnut", "cassava", "amaranth"];

const CACHE = ".cache/ingest";
async function get(url: string): Promise<string | null> {
  mkdirSync(CACHE, { recursive: true });
  const f = `${CACHE}/${slugify(url)}.html`;
  if (existsSync(f)) return readFileSync(f, "utf8");
  try {
    const r = await fetch(url, { headers: { "user-agent": UA } });
    if (!r.ok) return null;
    const t = await r.text();
    writeFileSync(f, t);
    await sleep(300);
    return t;
  } catch {
    return null;
  }
}
const grainsFrom = (t: string) => GRAIN_WORDS.filter((g) => new RegExp(`\\b${g}\\b`, "i").test(t)).map((g) => (g === "maize" ? "corn" : g)).filter((g, i, a) => a.indexOf(g) === i);

type Enrichment = { breweries: Record<string, { origin: string; grains: string[]; notes: string[]; ref: { label: string; url: string } }>; beers: Record<string, { ibu?: number; style?: string; origin?: string; grains?: string[]; notes?: string[]; ref?: { label: string; url: string } }>; merge: Record<string, string> };
const ENRICH: Enrichment = existsSync("data/enrichment.json") ? JSON.parse(readFileSync("data/enrichment.json", "utf8")) : { breweries: {}, beers: {}, merge: {} };

function enrich(b: Beer): Beer {
  const be = ENRICH.breweries[b.brewery];
  const eb = ENRICH.beers[b.slug];
  const style = b.style === "Unspecified" && eb?.style ? eb.style : b.style;
  const grains = b.grains.length ? b.grains : eb?.grains ?? be?.grains ?? [];
  const basis = b.grains.length ? "listing" : eb?.grains ? "reference" : be?.grains?.length ? "brewery-typical" : null;
  return { ...b, style, ibu: b.ibu || eb?.ibu || null, grains, grainsBasis: basis, origin: eb?.origin ?? be?.origin ?? b.origin ?? null, flavor: flavorFor(style),
    notes: [...(be?.notes ?? []), ...(eb?.notes ?? [])], refs: [be?.ref, eb?.ref].filter((r): r is { label: string; url: string } => !!r) };
}

function finish(b: Omit<Beer, "coldLagering" | "sensoryProfile" | "celiacAssessment">): Beer {
  const hasPositiveTest = b.tests.some((t) => t.result === "positive");
  const ctx = { name: b.name, style: b.style, abv: b.abv, classification: b.classification, grains: b.grains, hasPositiveTest };
  return { ...b, coldLagering: coldLagering(b.classification, b.style), sensoryProfile: sensoryProfile(ctx), celiacAssessment: celiacAssessment(ctx) };
}

// ---------- allbeernogluten.com ----------
async function allBeerNoGluten(): Promise<Beer[]> {
  const url = "https://allbeernogluten.com/beers";
  const html = await get(url);
  if (!html) return console.warn("allbeernogluten: unreachable"), [];
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"(.*?)"\]\)<\/script>/gs)].map((m) => { try { return JSON.parse(`"${m[1]}"`) as string; } catch { return ""; } });
  const s = chunks.join("");
  const marks = [...s.matchAll(/"name":"([^"]+)","slug":"([a-z0-9-]+)","coverImage"/g)];
  const out: Beer[] = [];
  marks.forEach((m, i) => {
    const seg = s.slice(m.index!, marks[i + 1]?.index ?? s.length);
    const style = /"style":"([^"]*)"/.exec(seg)?.[1] || "Unspecified";
    const abv = /"abv":([\d.]+)/.exec(seg)?.[1];
    const ibu = /"ibu":([\d.]+)/.exec(seg)?.[1];
    const brewery = /"brewery":\{[^}]*?\},?[^]*?"name":"([^"]+)"/.exec(seg)?.[1] ?? /"brewery":\{"sys":\{[^}]*\},"name":"([^"]+)"/.exec(seg)?.[1];
    if (!brewery) return;
    const desc = /"value":"([^"]*)"/.exec(seg)?.[1] ?? "";
    const factsText = `${m[1]} ${style} ${desc}`;
    const removed = /clarex|enzyme|gluten[- ]removed|crafted to remove|\bbarley\b/i.test(desc) && !/gluten[- ]free grains|naturally gluten/i.test(desc);
    const classification: Classification = removed ? "crafted_to_remove" : "dedicated_ngci";
    let grains = grainsFrom(factsText);
    if (classification === "dedicated_ngci") grains = grains.filter((g) => !["barley", "wheat"].includes(g));
    const parsed = BeerSchema.safeParse(finish({
      slug: slugify(m[2]), name: m[1], brewery, style, abv: abv ? +abv : null, ibu: ibu ? +ibu : null,
      classification, grains, sourceUrl: url, tests: [],
    }));
    if (parsed.success) out.push(parsed.data); else console.warn("skip", m[1], parsed.error.issues[0]?.message);
  });
  console.log(`allbeernogluten: ${out.length} beers`);
  return out;
}

// ---------- lowgluten.org ----------
const field = (t: string, label: string, next: string[]) => {
  const m = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=(?:${next.join("|")}):|$)`, "i").exec(t);
  return m?.[1].replace(/\s+/g, " ").trim();
};
async function lowGluten(): Promise<Beer[]> {
  const links = new Set<string>();
  for (let p = 1; p <= 15; p++) {
    const h = await get(`https://www.lowgluten.org/category/tests/page/${p}/`);
    if (!h) break;
    const $ = cheerio.load(h);
    $("article a[href], h2 a[href], h1 a[href]").each((_, a) => {
      const href = $(a).attr("href") ?? "";
      if (/^https:\/\/www\.lowgluten\.org\/[a-z0-9-]+\/$/.test(href) && !/(poll|merry|thank|kits|category|about|contact|facts|imprint|contribute)/.test(href)) links.add(href);
    });
    await sleep(300);
  }
  console.log(`lowgluten: ${links.size} candidate posts`);
  const beers = new Map<string, Beer>();
  const labels = ["Beer", "Producer", "Originating country", "Brewing location", "Bottle size", "Alcohol by volume", "Ingredients", "Miscellaneous", "Test Kit", "Preparation", "Test result"];
  for (const url of links) {
    const h = await get(url);
    if (!h) continue;
    const $ = cheerio.load(h);
    const body = $(".entry-content, .post-content, article").first().text().replace(/ /g, " ").replace(/\s+/g, " ");
    if (!/Test Kit:/i.test(body) || !/Beer:/i.test(body)) continue;
    const rest = (l: string) => labels.filter((x) => x !== l);
    const name = field(body, "Beer", rest("Beer"))?.split(/Beer:\s*/i).pop()?.trim();
    const producer = field(body, "Producer", rest("Producer")) ?? "Unknown";
    const kitRaw = field(body, "Test Kit", rest("Test Kit")) ?? "";
    const kit = kitRaw.replace(/^Gluten Tox/i, "GlutenTox").match(/^(GlutenTox Home Kit|GlutenTox Pro|Imutest Gluten-in-Food Kit|EZ Gluten|Reveal 3-D)/i)?.[1] ?? kitRaw.split(/\s+(?=[A-Z][a-z]+ tested|I tested)/)[0];
    const thr = /thresholds? of (\d+(?: and \d+)?) ppm/i.exec(kitRaw + " " + body)?.[1];
    const resultRaw = field(body, "Test result", rest("Test result")) ?? "";
    if (!name || !kit) continue;
    const abv = parseFloat(/([\d.,]+)\s*%/.exec(field(body, "Alcohol by volume", rest("Alcohol by volume")) ?? "")?.[1]?.replace(",", ".") ?? "");
    const ingredients = field(body, "Ingredients", rest("Ingredients")) ?? "";
    const removedTreat = /clarex|prolyl endopeptidase|\bPEP\b|gluten[- ]removed|remove gluten/i.test(`${body.slice(0, 3000)}`);
    const lead = resultRaw.slice(0, 170);
    const result: BeerTest["result"] = /(no indication|no gluten|not detect|negative|no (clear|visible|pink)|seems to be no|test result is not positive)/i.test(lead) ? "negative" : /(positive|indication of the presence|faint|visible pink)/i.test(lead) ? "positive" : "inconclusive";
    const ppmMatch = /(?:measured|result|reading|tested at|shows?)[^.]{0,40}?(\d+(?:\.\d+)?)\s*ppm/i.exec(lead);
    const dateStr = $("time").first().attr("datetime") ?? /On (\d\d)\/(\d\d)\/(\d{4})/.exec($("body").text())?.slice(1).reverse().join("-") ?? null;
    const test: BeerTest = {
      kit: kit.slice(0, 80), ppm: ppmMatch ? +ppmMatch[1] : null, result: ppmMatch ? "numeric" : result,
      resultNote: `${thr ? `Tested at the ${thr} ppm threshold. ` : ""}Kit reported ${result}${result === "negative" && /above (\d+) ppm/i.test(lead) ? ` (no gluten indicated above ${/above (\d+) ppm/i.exec(lead)![1]} ppm)` : ""}${ppmMatch ? ` (page cites ${ppmMatch[1]} ppm)` : "; qualitative strip result, no ppm value"}.`,
      testedAt: dateStr ? dateStr.slice(0, 10) : null, sourceName: "lowgluten.org", sourceUrl: url,
    };
    const slug = slugify(`${producer}-${name}`);
    const grains = grainsFrom(ingredients);
    const prev = beers.get(slug);
    if (prev) { prev.tests.push(test); continue; }
    beers.set(slug, { slug, name, brewery: producer, style: "Unspecified", abv: Number.isFinite(abv) ? abv : null, ibu: null,
      classification: removedTreat ? "crafted_to_remove" : "adjunct_low_ppm", grains, sourceUrl: url, tests: [test], coldLagering: "", sensoryProfile: "", celiacAssessment: "" });
  }
  const out = [...beers.values()].map((b) => {
    const anyPos = b.tests.some((t) => t.result === "positive") ;
    const allNeg = b.tests.every((t) => t.result === "negative" || (t.result === "numeric" && (t.ppm ?? 99) < 20));
    const c: Classification = b.classification === "crafted_to_remove" ? "crafted_to_remove" : allNeg && !anyPos ? "adjunct_low_ppm" : "standard_gluten";
    const lager = /lager|pils/i.test(b.name) ? "Lager" : "Unspecified";
    return BeerSchema.parse(finish({ ...b, classification: c, style: lager }));
  });
  console.log(`lowgluten: ${out.length} beers`);
  return out;
}

// ---------- lowgluten.org summary table (Imutest spot-intensity estimates + GlutenTox thresholds) ----------
type TableRow = { name: string; tests: BeerTest[] };
async function lowGlutenTable(): Promise<TableRow[]> {
  const src = "https://www.lowgluten.org/gluten-test-results/";
  const html = await get(src);
  if (!html) return console.warn("lowgluten table: unreachable"), [];
  const $ = cheerio.load(html);
  const rows: TableRow[] = [];
  $("table tr").each((_, tr) => {
    const td = $(tr).find("td").map((__, c) => $(c).text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()).get();
    if (td.length < 3 || !td[0]) return;
    const tests: BeerTest[] = [];
    for (const m of td[1].matchAll(/(\d+(?:\.\d+)?)(?:\/(\d+))?\s*\((negative|positive)\)/gi)) {
      const ppm = +m[1];
      tests.push({ kit: "Imutest Gluten-in-Food Kit", ppm, result: "numeric", testedAt: null, sourceName: "lowgluten.org (results table)", sourceUrl: src,
        resultNote: `Spot-intensity estimate${m[2] ? ` (range ${m[1]}–${m[2]} ppm)` : ""}, read as ${m[3].toLowerCase()}. A visual estimate, not a lab assay.` });
    }
    for (const m of td[2].matchAll(/(\d+)\s*\((negative|positive)\)/gi)) {
      tests.push({ kit: "GlutenTox Home Kit", ppm: null, result: m[2].toLowerCase() as "negative" | "positive", testedAt: null, sourceName: "lowgluten.org (results table)", sourceUrl: src,
        resultNote: `Threshold test at ${m[1]} ppm: ${m[2].toLowerCase() === "negative" ? `no gluten indicated above ${m[1]} ppm` : `gluten indicated at the ${m[1]} ppm threshold`}.` });
    }
    if (tests.length) rows.push({ name: td[0], tests });
  });
  console.log(`lowgluten table: ${rows.length} rows`);
  return rows;
}

// ---------- smartgurlsolutions.com (Playwright; plain HTTP is blocked by mod_security) ----------
async function smartGurl(): Promise<Beer[]> {
  const src = "https://smartgurlsolutions.com/beer-low-gluten-test/test-outcomes/";
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const page = await (await browser.newContext({ userAgent: UA })).newPage();
    await page.goto(src, { timeout: 30000 });
    await page.selectOption("select[name$='_length']", "100").catch(() => undefined);
    const raw = await page.$$eval("table tbody tr", (trs) => trs.map((tr) => ({
      cells: [...tr.querySelectorAll("td")].map((td) => (td.textContent ?? "").replace(/\s+/g, " ").trim()),
      href: tr.querySelector("td a")?.getAttribute("href") ?? null,
    })));
    const rows = raw.map((r) => r.cells);
    // Prefer each beer's own post: strip preview params/stray quotes, then confirm the page loads in the browser.
    const clean = (h: string | null) => (h ? h.replace(/\?preview=true[^#]*/, "").replace(/\/?"?(#.*?)?"?$/, (_m, hash) => `/${hash ? hash.replace(/"$/, "") : ""}`).replace(/\/\/+$/, "/") : null);
    const okCache = new Map<string, boolean>();
    const verify = async (u: string) => {
      const base = u.split("#")[0];
      if (!okCache.has(base)) okCache.set(base, await page.goto(base, { timeout: 20000 }).then((r) => (r?.status() ?? 500) < 400).catch(() => false));
      return okCache.get(base)!;
    };
    const links: (string | null)[] = [];
    for (const r of raw) { const c = clean(r.href); links.push(c && /^https:\/\/smartgurlsolutions\.com\//.test(c) && (await verify(c)) ? c : null); }
    await browser.close();
    const out: Beer[] = [];
    for (const [i, [name, producer, style, , reveal, , abvRaw]] of rows.entries()) {
      if (!name || !reveal) continue;
      const post = links[i];
      const dateM = post ? /\/(\d{4})\/(\d\d)\/(\d\d)\//.exec(post) : null;
      const lower = reveal.toLowerCase();
      const result: BeerTest["result"] = /positive/.test(lower) ? "positive" : /negative/.test(lower) ? "negative" : "inconclusive";
      const abv = parseFloat(abvRaw ?? "");
      const test: BeerTest = {
        kit: "Reveal 3-D (gliadin) @ 5 ppm", ppm: null, result,
        resultNote: `Table entry: "${reveal}". Qualitative threshold test at 5 ppm, home-run, not a lab assay.`,
        testedAt: dateM ? `${dateM[1]}-${dateM[2]}-${dateM[3]}` : null, sourceName: "smartgurlsolutions.com", sourceUrl: post ?? src,
      };
      out.push(BeerSchema.parse(finish({
        slug: slugify(`${producer}-${name}`), name, brewery: producer || "Unknown", style: style || "Unspecified",
        abv: Number.isFinite(abv) ? abv : null, ibu: null, grains: [],
        classification: result === "negative" ? "adjunct_low_ppm" : "standard_gluten", sourceUrl: post ?? src, tests: [test],
      })));
    }
    console.log(`smartgurlsolutions: ${out.length} beers`);
    return out;
  } catch (e) {
    console.log("smartgurlsolutions: skipped —", (e as Error).message.split("\n")[0]);
    return [];
  }
}

async function main() {
  const curatedPath = "data/curated-beers.json";
  const curated = existsSync(curatedPath) ? (JSON.parse(readFileSync(curatedPath, "utf8")) as Omit<Beer, "coldLagering" | "sensoryProfile" | "celiacAssessment">[]).map((b) => BeerSchema.parse(finish({ ...b, tests: b.tests ?? [] }))) : [];
  const [a, l, s] = [await allBeerNoGluten(), await lowGluten(), await smartGurl()];
  const table = await lowGlutenTable();
  const merged = new Map<string, Beer>();
  for (const b of [...curated, ...a, ...l, ...s]) {
    let k = slugify(`${b.brewery}-${b.name}`);
    const nameSlug = slugify(b.name);
    if (!merged.has(k) && nameSlug.length >= 6) k = [...merged.entries()].find(([, v]) => slugify(v.name) === nameSlug)?.[0] ?? k;
    const prev = merged.get(k);
    if (!prev) merged.set(k, { ...b, slug: k });
    else merged.set(k, { ...prev, style: prev.style === "Unspecified" ? b.style : prev.style, tests: [...prev.tests, ...b.tests], abv: prev.abv ?? b.abv, ibu: prev.ibu ?? b.ibu, grains: [...new Set([...prev.grains, ...b.grains])] });
  }
  const ALIAS: Record<string, string> = { "estrella-daura": "estrella-damm-daura", "gambrinus": "gambrinus-premium", "budweiser-us": "budweiser", "budweiser-czech-original": "budweiser-original", "bohemia-pilser": "bohemia-pilsner", "atlas-premium": "balboa-premium-classic-lager",
    "augustiner-edelstoff": "augustiner-helles-augustiner-edelstoff", "lobethal-bohemian-philsner": "bohemian-philsner", "lost-grounded-keller-pils": "keller-pils",
    "stockade-duel-hoppy": "duel-hoppy-lager", "tuborg-christmasbeer": "tuborg-julebryg", "weihenstephaner-helles": "weihenstephaner-original-helles", "zillertal-marzen": "zillertaler-marzen" };
  // Facts for table rows with no matching beer, taken from each beer's own lowgluten.org post.
  const P = (x: string) => `https://www.lowgluten.org/${x}/`;
  const FACTS: Record<string, { brewery: string; style: string; abv: number | null; grains: string[]; url: string }> = {
    bintang: { brewery: "Bintang Indonesia Tbk", style: "Pilsner", abv: 4.7, grains: ["barley"], url: P("bintang-gluten-test") },
    "kirin-hard-cidre": { brewery: "Kirin", style: "Hard Cider", abv: 4.5, grains: [], url: P("kirin-hard-cidre-gluten-test") },
    "kirin-ichiban-shibori": { brewery: "Kirin", style: "Lager", abv: 5, grains: [], url: P("kirin-ichiban-shibori") },
    "kirin-nodogoshi-nama": { brewery: "Kirin", style: "Happoshu (malt-reduced)", abv: 5, grains: [], url: P("kirin-nodogoshi-nama") },
    "lapin-kulta": { brewery: "Hartwall", style: "Lager", abv: 5.2, grains: ["barley"], url: P("karhu-53-lapin-kulta-gluten-test") },
    "panama-lager": { brewery: "Panama (brewer not stated)", style: "Lager", abv: null, grains: [], url: P("panama-balboa-soberana-gluten-test") },
    soberana: { brewery: "Panama (brewer not stated)", style: "Lager", abv: null, grains: [], url: P("panama-balboa-soberana-gluten-test") },
  };
  for (const row of table) {
    const ns = ALIAS[slugify(row.name)] ?? slugify(row.name);
    const hit = [...merged.values()].find((v) => slugify(v.name) === ns) ?? [...merged.values()].find((v) => ns.length >= 5 && (slugify(v.name).startsWith(ns) || ns.startsWith(slugify(v.name))));
    if (hit) {
      // Detailed per-beer posts are the preferred source; the summary table only enriches them.
      const posts = hit.tests.filter((t) => t.sourceName === "lowgluten.org");
      for (const t of row.tests) {
        const same = posts.filter((x) => x.kit === t.kit);
        if (!same.length && !posts.length) hit.tests.push(t);
        else if (t.kit.startsWith("Imutest") && same.length === 1 && t.ppm != null && same[0].ppm == null) {
          same[0].ppm = t.ppm;
          same[0].resultNote += ` Spot-intensity estimate: ${t.ppm} ppm (visual, not a lab assay).`;
        }
      }
    }
    else { const f = FACTS[ns]; merged.set(ns, { slug: ns, name: row.name, brewery: f?.brewery ?? "Brewer not stated", style: f?.style ?? "Unspecified", abv: f?.abv ?? null, ibu: null, grains: f?.grains ?? [], classification: "adjunct_low_ppm", sourceUrl: f?.url ?? "https://www.lowgluten.org/gluten-test-results/", tests: f ? row.tests.map((t) => ({ ...t, sourceUrl: f.url, sourceName: "lowgluten.org" })) : row.tests, coldLagering: "", sensoryProfile: "", celiacAssessment: "" }); }
  }
  const isNeg = (t: BeerTest) => t.result === "negative" || (t.result === "numeric" && (t.ppm ?? 99) < 20);
  const isPos = (t: BeerTest) => t.result === "positive" || (t.result === "numeric" && (t.ppm ?? 0) >= 20);
  for (const [from, to] of Object.entries(ENRICH.merge)) {
    const f = merged.get(from), t = merged.get(to);
    if (f && t) { t.tests.push(...f.tests); t.grains = [...new Set([...t.grains, ...f.grains])]; t.abv = t.abv ?? f.abv; merged.delete(from); }
  }
  const reconcile = (b: Beer): Beer => {
    if (b.classification === "crafted_to_remove" || b.classification === "dedicated_ngci" || !b.tests.length) return b;
    const pos = b.tests.some(isPos);
    const neg = b.tests.every(isNeg);
    return { ...b, classification: pos ? "standard_gluten" : neg ? "adjunct_low_ppm" : b.classification };
  };
  const all = SeedSchema.parse([...merged.values()].map((b) => finish(enrich(reconcile(b)))).sort((x, y) => x.brewery.localeCompare(y.brewery) || x.name.localeCompare(y.name)));
  mkdirSync("data", { recursive: true });
  writeFileSync("data/seed-beers.json", JSON.stringify(all, null, 2));
  console.log(`wrote data/seed-beers.json: ${all.length} beers`);
}
main();
