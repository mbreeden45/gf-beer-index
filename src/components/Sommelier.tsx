"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Wheat } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; status?: string };
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
  const box = useRef<HTMLTextAreaElement>(null);

  // Grow the textarea with its content (up to max-h), like a typical chat box.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input, open]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      // Busy upstream (429/5xx): retry automatically so nobody has to retype.
      const delays = [4000, 8000, 12000];
      let res: Response | null = null;
      for (let attempt = 0; ; attempt++) {
        res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next }) });
        const transient = res.status >= 500; // 429 = quota; retrying only burns more of it
        if (!transient || attempt >= delays.length) break;
        setMsgs([...next, { role: "assistant", content: "", status: `Busy right now. Retrying automatically (${attempt + 1}/${delays.length})…` }]);
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Something went wrong." }));
        setMsgs([...next, { role: "assistant", content: `${err.error ?? "Something went wrong."}${res.status === 429 ? "" : " I tried a few times. Send your message again in a minute."}` }]);
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
                <p className="whitespace-pre-wrap">{m.content ? render(m.content) : <span className="text-muted">{m.status ?? "Pulling a few taps…"}</span>}</p>
              </div>
            ))}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2 border-t border-rule bg-[#fffdf8] p-2">
            <textarea ref={box} rows={1} value={input} maxLength={1000} placeholder="Ask about a beer, style or mood…" aria-label="Your question"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }}
              className="max-h-40 min-w-0 flex-1 resize-none overflow-y-auto border border-rule bg-paper px-3 py-2 text-sm leading-snug outline-none focus:border-copper" />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="h-9 shrink-0 bg-copper px-3 text-paper disabled:opacity-40"><Send size={16} /></button>
          </form>
          <p className="border-t border-rule px-3 py-1.5 text-[10px] text-muted">AI guide, not medical advice. Test kits are screens, not safety guarantees.</p>
        </section>
      )}
    </>
  );
}
