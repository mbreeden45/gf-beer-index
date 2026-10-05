"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Wheat } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };
const SUGGESTIONS = [
  "I have celiac and love hoppy IPAs",
  "Something light for a hot day",
  "Best dark beer without barley?",
  "Is Modelo Especial okay for me?",
];

export default function Sommelier() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next }) });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Something went wrong." }));
        setMsgs([...next, { role: "assistant", content: err.error ?? "Something went wrong." }]);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", content: acc }]);
      }
    } catch {
      setMsgs([...next, { role: "assistant", content: "Couldn't reach the Sommelier. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  // Minimal **bold** rendering; everything else stays plain text.
  const render = (t: string) => t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 border-2 border-stout bg-gold px-4 py-3 font-display text-base font-semibold text-stout shadow-[4px_4px_0_var(--stout)] transition-transform hover:-translate-y-0.5 [body:has(aside[aria-label=Compare])_&]:bottom-20">
          <MessageCircle size={18} aria-hidden /> Ask the Sommelier
        </button>
      )}
      {open && (
        <section aria-label="Ask the Sommelier" className="spec-card slide-up fixed inset-x-3 bottom-3 z-50 flex max-h-[80vh] flex-col sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[26rem]">
          <header className="chalk flex items-center justify-between px-4 py-3 text-paper">
            <div className="flex items-center gap-2"><Wheat size={16} className="text-gold" aria-hidden /><span className="font-display text-lg">The Sommelier</span></div>
            <button onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm leading-relaxed">
            {msgs.length === 0 && (
              <div>
                <p className="text-muted">Tell me what you like and how careful you need to be. I only pour from this index, and I&apos;ll always say how solid the evidence is.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="border border-rule bg-paper-deep px-2.5 py-1.5 text-left text-xs hover:border-copper hover:text-copper">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-8 border border-rule bg-paper-deep p-3" : "border-l-2 border-gold pl-3"}>
                <p className="whitespace-pre-wrap">{m.content ? render(m.content) : <span className="text-muted">Pulling a few taps…</span>}</p>
              </div>
            ))}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex border-t border-rule">
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Ask about a beer, style or mood…" aria-label="Your question"
              className="min-w-0 flex-1 bg-[#fffdf8] px-3 py-3 text-sm outline-none" />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="bg-copper px-4 text-paper disabled:opacity-40"><Send size={16} /></button>
          </form>
          <p className="border-t border-rule px-3 py-1.5 text-[10px] text-muted">AI guide, not medical advice. Test kits are screens, not safety guarantees.</p>
        </section>
      )}
    </>
  );
}
