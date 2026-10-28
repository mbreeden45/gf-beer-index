import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { CLASS_PAGES, HOME_FAQ } from "@/lib/seo";
import { SITE_NAME, SITE_URL, OG_IMAGES } from "@/lib/site";
import JsonLd from "@/components/JsonLd";
import Directory from "@/components/Directory";
import Sommelier from "@/components/Sommelier";
import SubmitBeer from "@/components/SubmitBeer";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { beers } = await getCatalog();
  const title = `Gluten-Free Beer Index: ${beers.length} Beers Sorted by Real Test Results`;
  const description = `Which beers are really gluten-free? ${beers.length} gluten-free, gluten-reduced and low-gluten beers sorted into four honest classes, with the home-kit test results and sources for each.`;
  return { title: { absolute: title }, description, alternates: { canonical: "/" }, openGraph: { title, description, url: "/", images: OG_IMAGES } };
}

export default async function Home() {
  const { beers, breweries, styles } = await getCatalog();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME },
      {
        "@type": "Dataset",
        name: "Gluten-free and low-gluten beer test results",
        description: `${beers.length} beers classified as 100% NGCI, crafted to remove gluten, naturally low ppm or standard gluten, with home-kit test results and source links.`,
        url: SITE_URL,
        keywords: ["gluten-free beer", "gluten-reduced beer", "coeliac", "celiac", "gluten test results"],
        isAccessibleForFree: true,
      },
      { "@type": "FAQPage", mainEntity: HOME_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };
  const tested = beers.filter((b) => b.tests.length).length;
  const testCount = beers.reduce((n, b) => n + b.tests.length, 0);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-40 sm:px-6">
      <JsonLd data={jsonLd} />
      <nav className="flex items-center justify-between border-b border-rule py-3" aria-label="Site">
        <span className="font-display text-lg font-semibold">GF Beer Index</span>
        <SubmitBeer />
      </nav>
      <header className="border-b-2 border-double border-ink/70 py-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-copper">Field Guide · Vol. 1 · {beers.length} entries · {tested} beers tested · {testCount} test records</p>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
          The Gluten-Free <em className="font-normal text-copper">Beer</em> Index
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Four kinds of beer, sorted honestly — brewed without barley, treated to remove gluten, naturally low in it, and plain old standard — with the receipts for every test reading.
        </p>
      </header>
      <Directory beers={beers} />
      <section aria-labelledby="browse" className="mt-16 border-t border-rule pt-8">
        <h2 id="browse" className="font-display text-3xl font-semibold">Browse the index</h2>
        <ul className="mt-4 flex flex-wrap gap-3">
          {Object.entries(CLASS_PAGES).map(([slug, p]) => (
            <li key={slug}><Link href={`/class/${slug}`} className="border border-copper px-3 py-1.5 font-display text-sm text-copper hover:bg-copper hover:text-paper">{p.h1}</Link></li>
          ))}
        </ul>
        <h3 className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">By style</h3>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {styles.map((g) => <li key={g.slug}><Link href={`/style/${g.slug}`} className="text-pine underline underline-offset-2">{g.name}</Link> <span className="font-mono text-[10px] text-muted">{g.beers.length}</span></li>)}
        </ul>
        <h3 className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">By brewery</h3>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {breweries.map((g) => <li key={g.slug}><Link href={`/brewery/${g.slug}`} className="text-pine underline underline-offset-2">{g.name}</Link> <span className="font-mono text-[10px] text-muted">{g.beers.length}</span></li>)}
        </ul>
      </section>
      <section aria-labelledby="faq" className="mt-16 border-t border-rule pt-8">
        <h2 id="faq" className="font-display text-3xl font-semibold">Gluten-free beer: common questions</h2>
        <dl className="mt-4 max-w-3xl space-y-5">
          {HOME_FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-display text-lg font-semibold">{f.q}</dt>
              <dd className="mt-1 leading-relaxed text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
      <Sommelier />
      <footer className="mt-16 border-t border-rule pt-6 text-sm text-muted">
        <p>
          Facts compiled from public directories (allbeernogluten.com, lowgluten.org). Sensory notes and safety assessments are generated from ingredients and classification, not tasting. Home test kits are qualitative screens with limited sensitivity. This is information, not medical advice — people with coeliac disease should confirm with their clinician and the brewer.
        </p>
      </footer>
    </main>
  );
}
