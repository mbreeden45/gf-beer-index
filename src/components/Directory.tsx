"use client";
import { useMemo, useState } from "react";
import { Search, Pin, PinOff, ChevronDown, ExternalLink, Scale, X } from "lucide-react";
import type { Beer, Classification } from "@/lib/types";
import { CLASS_LABEL } from "@/lib/types";
import { AssayTag, ClassStamp, latestTest } from "./Stamps";

const TABS: { key: string; label: string; match: (c: Classification) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "ngci", label: "100% Dedicated GF", match: (c) => c === "dedicated_ngci" },
  { key: "removed", label: "Gluten-Reduced", match: (c) => c === "crafted_to_remove" },
  { key: "low", label: "Naturally Low ppm (<20 ppm)", match: (c) => c === "adjunct_low_ppm" },
  { key: "standard", label: "Standard Gluten", match: (c) => c === "standard_gluten" },
];

const RISK: Record<Classification, { level: string; note: string }> = {
  dedicated_ngci: { level: "Lowest", note: "No gluten grains in the recipe; residual risk is facility cross-contact." },
  crafted_to_remove: { level: "Variable", note: "Barley base. Enzyme-treated, and kits may under-read fragmented gluten." },
  adjunct_low_ppm: { level: "Unverified low", note: "Often tests low, but batch-to-batch variation is possible and nothing certifies it." },
  standard_gluten: { level: "High", note: "Conventional barley/wheat beer. Not for celiac disease." },
};

export default function Directory({ beers }: { beers: Beer[] }) {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const shown = useMemo(() => {
    const t = TABS.find((x) => x.key === tab)!;
    const n = q.trim().toLowerCase();
    return beers.filter((b) => t.match(b.classification) && (!n || `${b.name} ${b.brewery} ${b.style}`.toLowerCase().includes(n)));
  }, [beers, tab, q]);

  const counts = (m: (c: Classification) => boolean) => beers.filter((b) => m(b.classification)).length;
  const togglePin = (slug: string) => setPinned((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : p.length >= 3 ? p : [...p, slug]));
  const pinnedBeers = pinned.map((s) => beers.find((b) => b.slug === s)!).filter(Boolean);

  return (
    <>
      <section aria-label="Filters" className="sticky top-0 z-20 -mx-4 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="chalk flex flex-wrap gap-1 p-1.5" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 font-display text-sm tracking-wide transition-colors sm:text-base ${tab === t.key ? "bg-paper text-stout" : "text-paper/75 hover:text-paper"}`}>
              {t.label} <span className="ml-1 font-mono text-[10px] opacity-70">{counts(t.match)}</span>
            </button>
          ))}
        </div>
        <label className="relative mt-3 block">
          <span className="sr-only">Search beers</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by beer, brewery or style…"
            className="w-full border border-rule bg-[#fffdf8] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-copper focus:ring-1 focus:ring-copper" />
        </label>
      </section>

      <p className="mt-4 font-mono text-xs text-muted" aria-live="polite">{shown.length} of {beers.length} entries</p>

      <ul className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((b) => {
          const isOpen = open === b.slug;
          const isPinned = pinned.includes(b.slug);
          return (
            <li key={b.slug} className="spec-card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <ClassStamp c={b.classification} />
                <button onClick={() => togglePin(b.slug)} aria-pressed={isPinned} aria-label={isPinned ? `Unpin ${b.name}` : `Pin ${b.name} to compare`}
                  disabled={!isPinned && pinned.length >= 3}
                  className={`shrink-0 border p-1.5 ${isPinned ? "border-copper bg-copper text-paper" : "border-rule text-muted hover:border-copper hover:text-copper disabled:opacity-30"}`}>
                  {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                </button>
              </div>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{b.brewery}</p>
              <h2 className="font-display text-2xl font-semibold leading-tight">{b.name}</h2>
              <p className="text-sm italic text-muted">{b.style}{b.origin ? <span className="not-italic"> · {b.origin}</span> : null}</p>

              <dl className="mt-4 grid grid-cols-2 divide-x divide-rule border-y border-rule font-mono">
                <div className="py-2 pr-3"><dt className="text-[10px] text-muted">ABV</dt><dd className="text-lg font-bold">{b.abv != null ? `${b.abv}%` : "—"}</dd></div>
                <div className="py-2 pl-3"><dt className="text-[10px] text-muted">IBU</dt><dd className="text-lg font-bold">{b.ibu ?? "—"}</dd></div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {b.grains.length ? b.grains.map((g) => (
                  <span key={g} title={b.grainsBasis === "brewery-typical" ? "Typical of this brewery's grain base; not confirmed for this exact beer" : undefined}
                    className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase ${b.grainsBasis === "brewery-typical" ? "border-dashed" : ""} ${["barley", "wheat"].includes(g) ? "border-copper/60 text-copper" : "border-pine/60 text-pine"}`}>{g}</span>
                )) : <span className="font-mono text-[10px] uppercase text-muted">grain bill not itemised</span>}
              </div>

              {b.flavor.length > 0 && (
                <p className="mt-3 font-display text-sm italic text-copper">{b.flavor.join(" · ")}</p>
              )}
              <p className="mt-2 text-sm leading-relaxed">{b.sensoryProfile}</p>
              <p className="mt-2 border-l-2 border-gold pl-3 text-sm leading-relaxed text-muted">{b.celiacAssessment}</p>

              <div className="mt-auto pt-4">
                <AssayTag tests={b.tests} />
                <button onClick={() => setOpen(isOpen ? null : b.slug)} aria-expanded={isOpen}
                  className="mt-3 flex w-full items-center justify-between border-t border-rule pt-3 font-mono text-[11px] uppercase tracking-wider text-copper hover:text-stout">
                  Test provenance <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="slide-up mt-2 space-y-3">
                    {b.tests.length === 0 && <p className="text-sm text-muted">No lab or kit result on file. Classification is based on recipe and brewing method{b.sourceUrl ? "" : ", as publicly documented by the brewer"}.</p>}
                    {b.tests.map((t, i) => (
                      <div key={i} className="border border-dashed border-ink/40 bg-paper-deep p-3 font-mono text-[11px] leading-relaxed">
                        <div><span className="text-muted">KIT </span>{t.kit}</div>
                        <div><span className="text-muted">READING </span><b>{t.ppm != null ? `~${t.ppm} ppm est.` : t.result.toUpperCase()}</b>{t.ppm != null && t.result !== "numeric" && <span className="text-muted"> ({t.result})</span>}</div>
                        <div><span className="text-muted">DATE </span>{t.testedAt ?? "not stated"}</div>
                        <div className="font-sans text-xs text-muted">{t.resultNote}</div>
                        <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-pine underline underline-offset-2">
                          {t.sourceName} <ExternalLink size={11} />
                        </a>
                      </div>
                    ))}
                    {(b.notes.length > 0 || b.refs.length > 0 || b.grainsBasis === "brewery-typical") && (
                      <div className="border-t border-rule pt-3 text-xs text-muted">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-ink">Field notes</div>
                        {b.grainsBasis === "brewery-typical" && <p className="mt-1">Grain tags (dashed) show this brewery&apos;s typical base, not a confirmed recipe.</p>}
                        {b.notes.length > 0 && <ul className="mt-1 list-disc pl-4">{b.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
                        {b.refs.map((r) => (
                          <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 mr-3 inline-flex items-center gap-1 text-pine underline underline-offset-2">{r.label} <ExternalLink size={10} /></a>
                        ))}
                      </div>
                    )}
                    {b.sourceUrl && <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[11px] text-pine underline underline-offset-2">Listing source <ExternalLink size={11} /></a>}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="mt-10 text-center font-display text-xl text-muted">Nothing on tap for that search.</p>}

      {pinned.length > 0 && (
        <aside aria-label="Compare" className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-copper bg-stout text-paper">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
            <Scale size={18} className="text-gold" aria-hidden />
            <div className="flex flex-1 flex-wrap gap-2">
              {pinnedBeers.map((b) => (
                <span key={b.slug} className="flex items-center gap-1 border border-paper/30 px-2 py-1 text-xs">
                  {b.brewery} {b.name}
                  <button onClick={() => togglePin(b.slug)} aria-label={`Remove ${b.name}`}><X size={12} /></button>
                </span>
              ))}
              <span className="self-center font-mono text-[10px] text-paper/50">{pinned.length}/3 pinned</span>
            </div>
            <button onClick={() => setCompareOpen((o) => !o)} className="bg-copper px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-paper">
              {compareOpen ? "Hide" : "Compare"}
            </button>
          </div>
          {compareOpen && (
            <div className="slide-up max-h-[60vh] overflow-auto border-t border-paper/20 bg-paper text-ink">
              <table className="mx-auto w-full max-w-7xl min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-36 p-3" />
                    {pinnedBeers.map((b) => (
                      <th key={b.slug} className="p-3 text-left align-top">
                        <div className="font-mono text-[10px] uppercase text-muted">{b.brewery}</div>
                        <div className="font-display text-lg">{b.name}</div>
                        <div className="mt-1"><ClassStamp c={b.classification} /></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="[&_td]:border-t [&_td]:border-rule [&_td]:p-3 [&_td]:align-top [&_th]:border-t [&_th]:border-rule [&_th]:p-3 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:uppercase [&_th]:text-muted">
                  <tr><th>ABV / IBU</th>{pinnedBeers.map((b) => <td key={b.slug} className="font-mono">{b.abv ?? "—"}% / {b.ibu ?? "—"}</td>)}</tr>
                  <tr><th>Grain base</th>{pinnedBeers.map((b) => <td key={b.slug}>{b.grains.join(", ") || "not itemised"}</td>)}</tr>
                  <tr><th>Cold-lagering / process</th>{pinnedBeers.map((b) => <td key={b.slug}>{b.coldLagering}</td>)}</tr>
                  <tr><th>Latest test</th>{pinnedBeers.map((b) => { const t = latestTest(b.tests); return <td key={b.slug} className="font-mono text-xs">{t ? `${t.ppm != null ? t.ppm + " ppm" : t.result} · ${t.kit}` : "none on file"}</td>; })}</tr>
                  <tr><th>Realistic ppm risk</th>{pinnedBeers.map((b) => <td key={b.slug}><b>{RISK[b.classification].level}</b><div className="text-xs text-muted">{RISK[b.classification].note}</div></td>)}</tr>
                  <tr><th>Class</th>{pinnedBeers.map((b) => <td key={b.slug} className="text-xs">{CLASS_LABEL[b.classification]}</td>)}</tr>
                </tbody>
              </table>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
