"use client";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

type C = { id: string; display_name: string; comment: string; created_at: string };

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, secs] of steps) if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit);
  return "just now";
}
const adminKey = () => { try { return localStorage.getItem("gf_admin_key"); } catch { return null; } };

export default function BeerComments({ beerId }: { beerId: string }) {
  const [list, setList] = useState<C[] | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/comments?beer_id=${encodeURIComponent(beerId)}`)
      .then((r) => r.json())
      .then((d) => { if (live) { setAdmin(!!adminKey()); setList(d.comments ?? []); setDisabled(!!d.disabled); } })
      .catch(() => live && setList([]));
    return () => { live = false; };
  }, [beerId]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true); setErr("");
    const res = await fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ beer_id: beerId, display_name: name, comment: text, honeypot: trap }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setList((l) => [d.comment, ...(l ?? [])]); setText(""); } else setErr(d.error ?? "Couldn't post your note.");
    setBusy(false);
  }

  async function del(id: string) {
    if (!window.confirm("Are you sure you want to permanently delete this comment?")) return;
    const res = await fetch("/api/comments", { method: "DELETE", headers: { "content-type": "application/json", "x-admin-key": adminKey() ?? "" }, body: JSON.stringify({ comment_id: id }) });
    if (res.ok) setList((l) => (l ?? []).filter((c) => c.id !== id));
    else window.alert("Couldn't delete (is your admin session still valid?).");
  }

  return (
    <div className="border-t border-rule pt-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink">Reader notes {list ? `(${list.length})` : ""}</div>
      {disabled ? (
        <p className="mt-1 text-xs text-muted">Notes aren&apos;t switched on for this site yet.</p>
      ) : (
        <>
          <form onSubmit={post} className="mt-2 space-y-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Display name (optional)" aria-label="Display name"
              className="w-full border border-rule bg-paper px-2 py-1.5 text-xs outline-none focus:border-copper" />
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={2} placeholder="Share what you noticed: how it sat with you, where you found it…" aria-label="Your note"
              className="w-full resize-y border border-rule bg-paper px-2 py-1.5 text-xs outline-none focus:border-copper" />
            <input value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" name="honeypot" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted">{err || "No account needed. Notes are personal experience, not medical advice."}</span>
              <button type="submit" disabled={busy || !text.trim()} className="shrink-0 bg-copper px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-paper disabled:opacity-40">Post Note</button>
            </div>
          </form>
          <ul className="mt-3 space-y-2">
            {list?.map((c) => (
              <li key={c.id} className="border-l-2 border-gold pl-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{c.display_name} <span className="font-normal text-muted">· {ago(c.created_at)}</span></span>
                  {admin && <button onClick={() => del(c.id)} aria-label="Delete comment" className="text-[#a3341b] hover:text-red-700"><Trash2 size={13} /></button>}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-muted">{c.comment}</p>
              </li>
            ))}
            {list && list.length === 0 && <li className="text-xs text-muted">No notes yet. Be the first.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
