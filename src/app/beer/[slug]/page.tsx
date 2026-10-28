import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getCatalog } from "@/lib/catalog";
import { SITE_URL, slugify, OG_IMAGES } from "@/lib/site";
import { beerFaq, classSlug } from "@/lib/seo";
import { CLASS_LABEL } from "@/lib/types";
import { AssayTag, ClassStamp } from "@/components/Stamps";
import BeerComments from "@/components/BeerComments";
import BeerList from "@/components/BeerRow";
import JsonLd from "@/components/JsonLd";
import { Disclaimer, SiteNav } from "@/components/SiteChrome";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const { beers } = await getCatalog();
  return beers.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = (await getCatalog()).bySlug.get(slug);
  if (!b) return {};
  const title = `Is ${b.name} gluten-free? (${b.brewery})`;
  const description = `${b.name} by ${b.brewery} is a ${b.style}${b.abv != null ? ` at ${b.abv}% ABV` : ""} classed as ${CLASS_LABEL[b.classification]}. ${b.tests.length ? `${b.tests.length} test result${b.tests.length === 1 ? "" : "s"} on file with sources.` : "No test result on file."} ${b.celiacAssessment}`.slice(0, 300);
  return {
    title,
    description,
    alternates: { canonical: `/beer/${b.slug}` },
    openGraph: { type: "article", title, description, url: `/beer/${b.slug}`, images: OG_IMAGES },
  };
}

export default async function BeerPage({ params }: Props) {
  const { slug } = await params;
  const cat = await getCatalog();
  const b = cat.bySlug.get(slug);
  if (!b) notFound();

  const faq = beerFaq(b);
  const brewerySlug = slugify(b.brewery);
  const styleSlug = slugify(b.style);
  const related = [
    ...(cat.breweries.find((g) => g.slug === brewerySlug)?.beers ?? []),
    ...(cat.styles.find((g) => g.slug === styleSlug)?.beers ?? []),
  ].filter((r, i, a) => r.slug !== b.slug && a.findIndex((x) => x.slug === r.slug) === i).slice(0, 6);

  const url = `${SITE_URL}/beer/${b.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Beer Index", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: CLASS_LABEL[b.classification], item: `${SITE_URL}/class/${classSlug(b.classification)}` },
          { "@type": "ListItem", position: 3, name: b.name, item: url },
        ],
      },
      {
        "@type": "Product",
        "@id": `${url}#beer`,
        name: b.name,
        brand: { "@type": "Brand", name: b.brewery },
        category: b.style,
        description: b.sensoryProfile,
        url,
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-24 sm:px-6">
      <JsonLd data={jsonLd} />
      <SiteNav />
      <nav aria-label="Breadcrumb" className="mt-4 font-mono text-xs text-muted">
        <Link href="/" className="underline underline-offset-2">Index</Link> / <Link href={`/class/${classSlug(b.classification)}`} className="underline underline-offset-2">{CLASS_LABEL[b.classification]}</Link>
      </nav>

      <article className="mt-6">
        <ClassStamp c={b.classification} />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          <Link href={`/brewery/${brewerySlug}`} className="hover:text-copper hover:underline underline-offset-4">{b.brewery}</Link>
        </p>
        <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">Is {b.name} gluten-free?</h1>
        <p className="mt-2 text-lg italic text-muted">
          <Link href={`/style/${styleSlug}`} className="hover:text-copper hover:underline underline-offset-4">{b.style}</Link>
          {b.origin ? <span className="not-italic"> · {b.origin}</span> : null}
        </p>

        <p className="mt-5 border-l-2 border-gold pl-3 text-base leading-relaxed">{faq[0].a}</p>

        <dl className="mt-6 grid max-w-sm grid-cols-2 divide-x divide-rule border-y border-rule font-mono">
          <div className="py-2 pr-3"><dt className="text-[10px] text-muted">ABV</dt><dd className="text-lg font-bold">{b.abv != null ? `${b.abv}%` : "—"}</dd></div>
          <div className="py-2 pl-3"><dt className="text-[10px] text-muted">IBU</dt><dd className="text-lg font-bold">{b.ibu ?? "—"}</dd></div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {b.grains.length ? b.grains.map((g) => (
            <span key={g} className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase ${b.grainsBasis === "brewery-typical" ? "border-dashed" : ""} ${["barley", "wheat"].includes(g) ? "border-copper/60 text-copper" : "border-pine/60 text-pine"}`}>{g}</span>
          )) : <span className="font-mono text-[10px] uppercase text-muted">grain bill not itemised</span>}
        </div>
        {b.grainsBasis === "brewery-typical" && <p className="mt-2 text-xs text-muted">Dashed grain tags show this brewery&apos;s typical base, not a confirmed recipe.</p>}

        {b.flavor.length > 0 && <p className="mt-4 font-display text-base italic text-copper">{b.flavor.join(" · ")}</p>}
        <p className="mt-2 leading-relaxed">{b.sensoryProfile}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{b.coldLagering}</p>

        <section className="mt-10" aria-labelledby="tests">
          <h2 id="tests" className="font-display text-2xl font-semibold">Gluten test results for {b.name}</h2>
          <p className="mt-2 leading-relaxed">{faq[1].a}</p>
          <div className="mt-4 max-w-md"><AssayTag tests={b.tests} /></div>
          <div className="mt-4 space-y-3">
            {b.tests.map((t, i) => (
              <div key={i} className="border border-dashed border-ink/40 bg-paper-deep p-3 font-mono text-[11px] leading-relaxed">
                <div><span className="text-muted">KIT </span>{t.kit}</div>
                <div><span className="text-muted">READING </span><b>{t.ppm != null ? `~${t.ppm} ppm est.` : t.result.toUpperCase()}</b>{t.ppm != null && t.result !== "numeric" && <span className="text-muted"> ({t.result})</span>}</div>
                <div><span className="text-muted">DATE </span>{t.testedAt ?? "not stated"}</div>
                <div className="font-sans text-xs text-muted">{t.resultNote}</div>
                <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-pine underline underline-offset-2">{t.sourceName} <ExternalLink size={11} aria-hidden /></a>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="assessment">
          <h2 id="assessment" className="font-display text-2xl font-semibold">What it means for coeliac and gluten-sensitive drinkers</h2>
          <p className="mt-2 leading-relaxed">{b.celiacAssessment}</p>
          <p className="mt-2 text-sm text-muted">Information, not medical advice. Confirm with your clinician and the brewer.</p>
        </section>

        {(b.notes.length > 0 || b.refs.length > 0 || b.sourceUrl) && (
          <section className="mt-8 text-sm text-muted">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink">Field notes</h2>
            {b.notes.length > 0 && <ul className="mt-1 list-disc pl-5">{b.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            {b.refs.map((r) => (
              <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 mr-3 inline-flex items-center gap-1 text-pine underline underline-offset-2">{r.label} <ExternalLink size={10} aria-hidden /></a>
            ))}
            {b.sourceUrl && <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-pine underline underline-offset-2">Listing source <ExternalLink size={10} aria-hidden /></a>}
          </section>
        )}

        <section className="mt-10" aria-labelledby="notes">
          <h2 id="notes" className="font-display text-2xl font-semibold">Reader notes</h2>
          <div className="mt-3"><BeerComments beerId={b.slug} /></div>
        </section>
      </article>

      {related.length > 0 && (
        <section className="mt-14" aria-labelledby="related">
          <h2 id="related" className="font-display text-2xl font-semibold">More from {b.brewery} and other {b.style} beers</h2>
          <BeerList beers={related} />
        </section>
      )}
      <Disclaimer />
    </main>
  );
}
