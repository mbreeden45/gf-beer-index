"use client";
import { useState } from "react";
import { PlusCircle, X } from "lucide-react";

const F = "w-full border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-copper";
const L = "block font-mono text-[10px] uppercase tracking-wider text-muted";

export default function SubmitBeer() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy"); setErr("");
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const res = await fetch("/api/submissions", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ website: f.website, beer_name: f.beer_name, brewery: f.brewery, style: f.style, abv: f.abv, classification: f.classification, grain_bill: f.grain_bill, reported_ppm: f.reported_ppm, source_or_proof: f.source_or_proof, notes: f.notes, submitter_email: f.submitter_email }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setState("done"); else { setState("idle"); setErr(d.error ?? "Something went wrong."); }
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setState("idle"); setErr(""); }} className="inline-flex items-center gap-2 border-2 border-stout bg-gold px-4 py-2 font-display text-sm font-semibold text-stout shadow-[3px_3px_0_var(--stout)] transition-transform hover:-translate-y-0.5">
        <PlusCircle size={16} aria-hidden /> Submit a Beer
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stout/60 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Submit a beer" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="spec-card slide-up my-auto w-full max-w-xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-copper">Field Guide · Correspondence</p>
                <h2 className="font-display text-3xl font-semibold leading-tight">Submit a Beer</h2>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close"><X size={20} /></button>
            </div>
            {state === "done" ? (
              <div className="py-8 text-center">
                <p className="font-display text-2xl">Thank you, noted.</p>
                <p className="mt-2 text-sm text-muted">Your submission is in the review pile. Entries are checked before they appear in the index.</p>
                <button onClick={() => setOpen(false)} className="mt-5 bg-copper px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-paper">Close</button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
                <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
                <label className="sm:col-span-1"><span className={L}>Beer name *</span><input name="beer_name" required maxLength={120} className={F} /></label>
                <label><span className={L}>Brewery *</span><input name="brewery" required maxLength={120} className={F} /></label>
                <label><span className={L}>Style</span><input name="style" maxLength={80} placeholder="e.g. Hazy IPA" className={F} /></label>
                <label><span className={L}>ABV %</span><input name="abv" inputMode="decimal" placeholder="e.g. 5.5" className={F} /></label>
                <label className="sm:col-span-2"><span className={L}>Classification *</span>
                  <select name="classification" required defaultValue="" className={F}>
                    <option value="" disabled>Choose one…</option>
                    <option value="dedicated_ngci">100% NGCI: brewed from naturally gluten-free grains</option>
                    <option value="crafted_to_remove">Crafted to Remove: barley beer treated with enzymes</option>
                    <option value="adjunct_low_ppm">Naturally Low ppm: barley beer that tests low</option>
                  </select>
                </label>
                <label className="sm:col-span-2"><span className={L}>Grain bill</span><input name="grain_bill" maxLength={300} placeholder="e.g. millet, rice, buckwheat" className={F} /></label>
                <label><span className={L}>Reported ppm</span><input name="reported_ppm" maxLength={60} placeholder="e.g. <5 ppm, or 'negative'" className={F} /></label>
                <label><span className={L}>Proof URL</span><input name="source_or_proof" type="url" maxLength={500} placeholder="https://…" className={F} /></label>
                <label className="sm:col-span-2"><span className={L}>Notes</span><textarea name="notes" rows={3} maxLength={1500} className={F} /></label>
                <label className="sm:col-span-2"><span className={L}>Your email (optional, only used if we have a question)</span><input name="submitter_email" type="email" maxLength={200} className={F} /></label>
                {err && <p className="text-sm text-[#a3341b] sm:col-span-2">{err}</p>}
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <button type="button" onClick={() => setOpen(false)} className="border border-rule px-4 py-2 text-sm">Cancel</button>
                  <button type="submit" disabled={state === "busy"} className="bg-copper px-5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-paper disabled:opacity-50">{state === "busy" ? "Sending…" : "Send for review"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
