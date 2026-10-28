import "server-only";
import { getBeers } from "./data";
import { slugify } from "./site";
import type { Beer } from "./types";

export type Group = { slug: string; name: string; beers: Beer[] };
export type Catalog = { beers: Beer[]; bySlug: Map<string, Beer>; breweries: Group[]; styles: Group[] };

function group(beers: Beer[], key: (b: Beer) => string): Group[] {
  const m = new Map<string, Group>();
  for (const b of beers) {
    const name = key(b);
    const slug = slugify(name);
    if (!slug) continue;
    const g = m.get(slug) ?? { slug, name, beers: [] };
    g.beers.push(b);
    m.set(slug, g);
  }
  return [...m.values()].sort((a, b) => b.beers.length - a.beers.length || a.name.localeCompare(b.name));
}

async function build(): Promise<Catalog> {
  const beers = await getBeers();
  return {
    beers,
    bySlug: new Map(beers.map((b) => [b.slug, b])),
    breweries: group(beers, (b) => b.brewery),
    styles: group(beers, (b) => b.style),
  };
}

// Many static pages call this during one build; share a single read instead of one DB round trip each.
let memo: { at: number; p: Promise<Catalog> } | null = null;
export function getCatalog(): Promise<Catalog> {
  if (memo && Date.now() - memo.at < 60_000) return memo.p;
  const p = build();
  memo = { at: Date.now(), p };
  p.catch(() => { if (memo?.p === p) memo = null; });
  return p;
}
