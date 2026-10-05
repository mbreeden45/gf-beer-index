import type { Classification, BeerTest } from "@/lib/types";
import { CLASS_LABEL } from "@/lib/types";
import { Wheat, FlaskConical, Droplets, Beer as BeerIcon } from "lucide-react";

export function ClassStamp({ c }: { c: Classification }) {
  const base = "inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]";
  if (c === "dedicated_ngci")
    return (
      <span className={`${base} bg-pine text-paper ring-1 ring-inset ring-paper/40 outline outline-2 -outline-offset-4 outline-paper/30`} title="Brewed from naturally gluten-free grains in a dedicated facility">
        <Wheat size={12} aria-hidden /> {CLASS_LABEL[c]}
      </span>
    );
  if (c === "crafted_to_remove")
    return (
      <span className="inline-flex overflow-hidden border border-stout" title="Barley beer treated with enzymes to reduce gluten">
        <span className="hazard w-3" aria-hidden />
        <span className={`${base} bg-gold text-stout`}>
          <FlaskConical size={12} aria-hidden /> {CLASS_LABEL[c]}
        </span>
        <span className="hazard w-3" aria-hidden />
      </span>
    );
  if (c === "adjunct_low_ppm")
    return (
      <span className={`${base} border-[1.5px] border-copper text-copper`} title="Barley beer diluted by adjuncts and filtration; not a gluten-free guarantee">
        <Droplets size={12} aria-hidden /> {CLASS_LABEL[c]}
      </span>
    );
  return (
    <span className={`${base} border border-dashed border-muted text-muted`} title="Traditional barley/wheat beer">
      <BeerIcon size={12} aria-hidden /> {CLASS_LABEL[c]}
    </span>
  );
}

export function latestTest(tests: BeerTest[]): BeerTest | undefined {
  return [...tests].sort((a, b) => (b.testedAt ?? "").localeCompare(a.testedAt ?? ""))[0];
}

export function AssayTag({ tests }: { tests: BeerTest[] }) {
  const t = latestTest(tests);
  const reading = !t ? "NO RECORD" : t.result === "numeric" ? `${t.ppm} ppm` : t.result === "negative" ? "NOT DETECTED" : t.result === "positive" ? "DETECTED" : "UNCLEAR";
  const tone = !t ? "text-muted" : t.result === "positive" || (t.ppm ?? 0) >= 20 ? "text-[#a3341b]" : t.result === "inconclusive" ? "text-muted" : "text-pine";
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 border border-dashed border-ink/50 bg-paper-deep px-3 py-2 font-mono text-[11px]">
      <dt className="text-muted">ASSAY</dt>
      <dd className={`font-bold ${tone}`}>{reading}</dd>
      <dt className="text-muted">KIT</dt>
      <dd className="truncate">{t?.kit ?? "—"}</dd>
      <dt className="text-muted">N</dt>
      <dd>{tests.length} test{tests.length === 1 ? "" : "s"} on file</dd>
    </dl>
  );
}
