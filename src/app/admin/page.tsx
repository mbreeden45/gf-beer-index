"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, X, LogOut } from "lucide-react";
import { CLASS_LABEL, type Classification } from "@/lib/types";

type Sub = { id: string; beer_name: string; brewery: string; style: string | null; abv: string | null; classification: Classification; grain_bill: string | null; reported_ppm: string | null; source_or_proof: string | null; notes: string | null; submitter_email: string | null; created_at: string };
const KEY = "gf_admin_key";

export default function Admin() {
  const [key, setKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async (k: string) => {
    const r = await fetch("/api/admin/submissions", { headers: { "x-admin-key": k }, cache: "no-store" });
    if (r.status === 401) { localStorage.removeItem(KEY); setKey(null); return; }
    const d = await r.json();
    setSubs(d.submissions ?? []);
    setNote(d.disabled ? "No database is configured on this deployment, so submissions can't be stored yet." : "");
  }, []);

  useEffect(() => {
    // Read the stored key after hydration (localStorage is client-only).
    void Promise.resolve().then(() => {
      const k = localStorage.getItem(KEY);
      if (k) { setKey(k); void load(k); }
    });
  }, [load]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/admin/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: input }) });
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? "Wrong passcode."); return; }
    localStorage.setItem(KEY, input);
    setKey(input);
    void load(input);
  }

  async function act(id: string, action: "approve" | "reject") {
    if (action === "reject" && !window.confirm("Reject this submission?")) return;
    const r = await fetch("/api/admin/submissions", { method: "POST", headers: { "content-type": "application/json", "x-admin-key": key ?? "" }, body: JSON.stringify({ id, action }) });
    if (r.ok) setSubs((s) => (s ?? []).filter((x) => x.id !== id));
    else window.alert((await r.json().catch(() => ({}))).error ?? "Action failed.");
  }

  if (!key) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-copper">Field Guide · Editor&apos;s Desk</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Admin</h1>
        <form onSubmit={unlock} className="spec-card mt-6 space-y-3 p-5">
          <label className="block font-mono text-[10px] uppercase tracking-wider text-muted" htmlFor="pass">Enter Admin Passcode</label>
          <input id="pass" type="password" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" className="w-full border border-rule bg-paper px-3 py-2 outline-none focus:border-copper" />
          {err && <p className="text-sm text-[#a3341b]">{err}</p>}
          <button className="w-full bg-stout px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-paper">Unlock Admin</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-end justify-between border-b-2 border-double border-ink/70 pb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-copper">Editor&apos;s Desk</p>
          <h1 className="font-display text-4xl font-semibold">Pending submissions</h1>
        </div>
        <button onClick={() => { localStorage.removeItem(KEY); setKey(null); setSubs(null); }} className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-muted hover:text-copper"><LogOut size={14} /> Log Out</button>
      </div>
      {note && <p className="mt-4 text-sm text-muted">{note}</p>}
      {subs === null ? <p className="mt-6 text-muted">Loading…</p> : subs.length === 0 ? <p className="mt-8 font-display text-xl text-muted">Nothing waiting for review.</p> : (
        <ul className="mt-6 space-y-5">
          {subs.map((s) => (
            <li key={s.id} className="spec-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{s.brewery}</p>
                  <h2 className="font-display text-2xl font-semibold">{s.beer_name}</h2>
                  <p className="text-sm italic text-muted">{s.style || "Style not given"}{s.abv ? ` · ${s.abv}${s.abv.includes("%") ? "" : "%"}` : ""}</p>
                </div>
                <span className="border border-copper px-2 py-1 font-mono text-[10px] font-bold uppercase text-copper">{CLASS_LABEL[s.classification]}</span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="font-mono text-[10px] uppercase text-muted">Grain bill</dt><dd>{s.grain_bill || "—"}</dd></div>
                <div><dt className="font-mono text-[10px] uppercase text-muted">Reported ppm</dt><dd className="font-mono">{s.reported_ppm || "—"}</dd></div>
                <div className="sm:col-span-2"><dt className="font-mono text-[10px] uppercase text-muted">Proof</dt><dd className="break-all">{s.source_or_proof ? <a href={s.source_or_proof} target="_blank" rel="noopener noreferrer" className="text-pine underline">{s.source_or_proof}</a> : "—"}</dd></div>
                <div className="sm:col-span-2"><dt className="font-mono text-[10px] uppercase text-muted">Notes</dt><dd className="whitespace-pre-wrap">{s.notes || "—"}</dd></div>
                <div className="sm:col-span-2 text-xs text-muted">Submitted {new Date(s.created_at).toLocaleString()}{s.submitter_email ? ` by ${s.submitter_email}` : ""}</div>
              </dl>
              <div className="mt-4 flex gap-2">
                <button onClick={() => act(s.id, "approve")} className="inline-flex items-center gap-1 bg-pine px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-paper"><Check size={14} /> Approve</button>
                <button onClick={() => act(s.id, "reject")} className="inline-flex items-center gap-1 border border-[#a3341b] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-[#a3341b]"><X size={14} /> Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
