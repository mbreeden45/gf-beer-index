import Link from "next/link";
import { CLASS_PAGES } from "@/lib/seo";

export function SiteNav() {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule py-3" aria-label="Site">
      <Link href="/" className="font-display text-lg font-semibold">GF Beer Index</Link>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted">
        {Object.entries(CLASS_PAGES).map(([slug, p]) => (
          <li key={slug}><Link href={`/class/${slug}`} className="hover:text-copper hover:underline underline-offset-4">{p.cls === "dedicated_ngci" ? "100% GF" : p.cls === "crafted_to_remove" ? "Gluten-reduced" : p.cls === "adjunct_low_ppm" ? "Low ppm" : "Standard"}</Link></li>
        ))}
      </ul>
    </nav>
  );
}

export function Disclaimer() {
  return (
    <footer className="mt-16 border-t border-rule pt-6 text-sm text-muted">
      <p>
        Facts compiled from public directories (allbeernogluten.com, lowgluten.org). Sensory notes and safety assessments are generated from ingredients and classification, not tasting. Home test kits are qualitative screens with limited sensitivity. This is information, not medical advice — people with coeliac disease should confirm with their clinician and the brewer.
      </p>
      <p className="mt-3"><Link href="/" className="text-pine underline underline-offset-2">Back to the full index</Link></p>
    </footer>
  );
}
