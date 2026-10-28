import Link from "next/link";
import BeerList from "./BeerRow";
import JsonLd from "./JsonLd";
import { Disclaimer, SiteNav } from "./SiteChrome";
import { SITE_URL } from "@/lib/site";
import { sortBeers } from "@/lib/seo";
import type { Beer } from "@/lib/types";

export default function GroupPage({ h1, intro, path, beers, crumb }: { h1: string; intro: string; path: string; beers: Beer[]; crumb: string }) {
  const sorted = sortBeers(beers);
  const url = `${SITE_URL}${path}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Beer Index", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: crumb, item: url },
        ],
      },
      {
        "@type": "CollectionPage",
        name: h1,
        url,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: sorted.length,
          itemListElement: sorted.map((b, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/beer/${b.slug}`, name: b.name })),
        },
      },
    ],
  };
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
      <JsonLd data={jsonLd} />
      <SiteNav />
      <header className="border-b-2 border-double border-ink/70 py-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-copper">{sorted.length} {sorted.length === 1 ? "beer" : "beers"} · <Link href="/" className="underline underline-offset-4">Full index</Link></p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-6xl">{h1}</h1>
        <p className="mt-4 max-w-3xl text-lg text-muted">{intro}</p>
      </header>
      <BeerList beers={sorted} />
      <Disclaimer />
    </main>
  );
}
