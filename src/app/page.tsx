import { getBeers } from "@/lib/data";
import Directory from "@/components/Directory";
import Sommelier from "@/components/Sommelier";

export const revalidate = 3600;

export default async function Home() {
  const beers = await getBeers();
  const tested = beers.filter((b) => b.tests.length).length;
  const testCount = beers.reduce((n, b) => n + b.tests.length, 0);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-40 sm:px-6">
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
      <Sommelier />
      <footer className="mt-16 border-t border-rule pt-6 text-sm text-muted">
        <p>
          Facts compiled from public directories (allbeernogluten.com, lowgluten.org). Sensory notes and safety assessments are generated from ingredients and classification, not tasting. Home test kits are qualitative screens with limited sensitivity. This is information, not medical advice — people with coeliac disease should confirm with their clinician and the brewer.
        </p>
      </footer>
    </main>
  );
}
