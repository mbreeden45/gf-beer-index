/**
 * Ingestion: allbeernogluten.com (dedicated GF directory), lowgluten.org (kit test posts),
 * smartgurlsolutions.com (attempted via Playwright; often blocked). Facts only — no review
 * text or photos are stored. Sensory/safety copy is generated locally from facts.
 */
import * as cheerio from "cheerio";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { BeerSchema, SeedSchema, type Beer, type BeerTest, type Classification } from "../src/lib/types";
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
    const kit = field(body, "Test Kit", rest("Test Kit")) ?? "";
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
      resultNote: `Kit reported ${result}${result === "negative" && /above (\d+) ppm/i.test(lead) ? ` (no gluten indicated above ${/above (\d+) ppm/i.exec(lead)![1]} ppm)` : ""}${ppmMatch ? ` (page cites ${ppmMatch[1]} ppm)` : "; qualitative strip result, no ppm value"}.`,
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
    const rows = await page.$$eval("table tbody tr", (trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => (td.textContent ?? "").replace(/\s+/g, " ").trim())));
    await browser.close();
    const out: Beer[] = [];
    for (const [name, producer, style, , reveal, , abvRaw] of rows) {
      if (!name || !reveal) continue;
      const lower = reveal.toLowerCase();
      const result: BeerTest["result"] = /positive/.test(lower) ? "positive" : /negative/.test(lower) ? "negative" : "inconclusive";
      const abv = parseFloat(abvRaw ?? "");
      const test: BeerTest = {
        kit: "Reveal 3-D (gliadin) @ 5 ppm", ppm: null, result,
        resultNote: `Table entry: "${reveal}". Qualitative threshold test at 5 ppm, home-run, not a lab assay.`,
        testedAt: null, sourceName: "smartgurlsolutions.com", sourceUrl: src,
      };
      out.push(BeerSchema.parse(finish({
        slug: slugify(`${producer}-${name}`), name, brewery: producer || "Unknown", style: style || "Unspecified",
        abv: Number.isFinite(abv) ? abv : null, ibu: null, grains: [],
        classification: result === "negative" ? "adjunct_low_ppm" : "standard_gluten", sourceUrl: src, tests: [test],
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
  const ALIAS: Record<string, string> = { "estrella-daura": "estrella-damm-daura", "gambrinus": "gambrinus-premium", "budweiser-us": "budweiser", "budweiser-czech-original": "budweiser-original", "bohemia-pilser": "bohemia-pilsner", "atlas-premium": "balboa-premium-classic-lager" };
  for (const row of table) {
    const ns = ALIAS[slugify(row.name)] ?? slugify(row.name);
    const hit = [...merged.values()].find((v) => slugify(v.name) === ns) ?? [...merged.values()].find((v) => ns.length >= 5 && (slugify(v.name).startsWith(ns) || ns.startsWith(slugify(v.name))));
    if (hit) hit.tests.push(...row.tests);
    else merged.set(ns, { slug: ns, name: row.name, brewery: "Brewer not stated", style: "Unspecified", abv: null, ibu: null, grains: [], classification: "adjunct_low_ppm", sourceUrl: "https://www.lowgluten.org/gluten-test-results/", tests: row.tests, coldLagering: "", sensoryProfile: "", celiacAssessment: "" });
  }
  const isNeg = (t: BeerTest) => t.result === "negative" || (t.result === "numeric" && (t.ppm ?? 99) < 20);
  const isPos = (t: BeerTest) => t.result === "positive" || (t.result === "numeric" && (t.ppm ?? 0) >= 20);
  const reconcile = (b: Beer): Beer => {
    if (b.classification === "crafted_to_remove" || b.classification === "dedicated_ngci" || !b.tests.length) return b;
    const pos = b.tests.some(isPos);
    const neg = b.tests.every(isNeg);
    return { ...b, classification: pos ? "standard_gluten" : neg ? "adjunct_low_ppm" : b.classification };
  };
  const all = SeedSchema.parse([...merged.values()].map((b) => finish(reconcile(b))).sort((x, y) => x.brewery.localeCompare(y.brewery) || x.name.localeCompare(y.name)));
  mkdirSync("data", { recursive: true });
  writeFileSync("data/seed-beers.json", JSON.stringify(all, null, 2));
  console.log(`wrote data/seed-beers.json: ${all.length} beers`);
}
main();
