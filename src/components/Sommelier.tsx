"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Wheat } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; status?: string };
type Profile = "celiac" | "sensitive" | "other";
type Pick = { label: string; benchmark?: string; msg: string };

const PROFILES: { id: Profile; label: string; sub: string; who: string; intro: string }[] = [
  { id: "celiac", label: "Strict Celiac", sub: "Dedicated NGCI only; no barley, no enzyme-reduced", who: "a strict celiac", intro: "I have strict celiac disease and" },
  { id: "sensitive", label: "Gluten Sensitive", sub: "Tolerates low-ppm adjuncts like Modelo or Clarex beers", who: "gluten sensitive", intro: "I'm gluten sensitive and" },
  { id: "other", label: "Ordering for Someone Else", sub: "Help me find a safe choice for a friend", who: "ordering for someone else who needs gluten-free beer", intro: "I'm ordering for a friend who avoids gluten, and they" },
];

const CELIAC_PICKS: Pick[] = [
  { label: "Crisp Lager / Blonde", benchmark: "Holidaily Favorite Blonde", msg: "love crisp lagers and blondes like Holidaily Favorite Blonde. What dedicated NGCI beers match that profile?" },
  { label: "Hoppy West Coast / Hazy IPA", benchmark: "Ghostfish Grapefruit / Watcher", msg: "love hoppy West Coast and hazy IPAs like Ghostfish Grapefruit and Watcher. What dedicated NGCI beers match that profile?" },
  { label: "Dark Stout / Porter", benchmark: "Ground Breaker Dark Ale", msg: "love dark stouts and porters like Ground Breaker Dark Ale. What dedicated NGCI beers match that profile?" },
  { label: "Cider / Tart Sour", msg: "love ciders and tart sours. What dedicated NGCI options match that profile?" },
];
const OTHER_PICKS: Pick[] = [
  { label: "Mexican / Crisp Adjunct Lager", benchmark: "Modelo Especial / Corona", msg: "usually drink Mexican lagers like Modelo Especial or Corona. What other low-ppm or gluten-safe beers should I try?" },
  { label: "Gluten-Reduced Craft IPA", benchmark: "Stone Delicious IPA", msg: "usually drink gluten-reduced craft IPAs like Stone Delicious IPA. What similar beers should I try?" },
  { label: "Dedicated NGCI Craft", benchmark: "Ghostfish", msg: "enjoy dedicated NGCI craft beer like Ghostfish. What else in the catalog should I try?" },
  { label: "Session / Golden Ale", benchmark: "Kona Big Wave profile", msg: "enjoy session golden ales like Kona Big Wave. What similar beers should I try?" },
];

export default function Sommelier() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [toleranceProfile, setToleranceProfile] = useState<Profile | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Grow the textarea with its content (up to max-h), like a typical chat box.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input, open]);

  // Full-screen on phones: lock page scroll and let the system back gesture close the sheet.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    history.pushState({ sommelier: true }, "");
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("popstate", onPop);
    };
  }, [open]);

  const close = () => { if (history.state?.sommelier) history.back(); else setOpen(false); };

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
        setMsgs([...next, { role: "assistant", content: res.status === 429 ? "Taproom Sommelier is catching its breath. Please try again in a minute." : `${err.error ?? "Something went wrong."} I tried a few times. Send your message again in a minute.` }]);
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
        <section aria-label="Ask the Sommelier" className="spec-card slide-up fixed inset-0 z-50 flex h-dvh flex-col max-sm:border-0 max-sm:shadow-none sm:inset-auto sm:right-5 sm:bottom-5 sm:h-auto sm:max-h-[80vh] sm:w-[26rem]">
          <header className="chalk flex items-center justify-between px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-paper">
            <div className="flex items-center gap-2"><Wheat size={16} className="text-gold" aria-hidden /><span className="font-display text-lg">The Sommelier</span></div>
            <button onClick={close} aria-label="Close" className="flex items-center gap-1.5 text-sm"><span className="sm:hidden">Back to the index</span><X size={18} /></button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm leading-relaxed">
            {msgs.length === 0 && (() => {
              const prof = PROFILES.find((x) => x.id === toleranceProfile);
              const chip = "block w-full border border-rule bg-paper px-3 py-2 text-left hover:border-copper hover:text-copper disabled:opacity-50";
              return (
                <div className="border border-rule bg-paper-deep p-4">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Tasting Intake: Step {step} of 2</p>
                  {step === 1 || !prof ? (
                    <>
                      <h2 className="mt-1 font-display text-lg leading-snug">Welcome to the taproom. To calibrate recommendations, what is your tolerance profile?</h2>
                      <div className="mt-3 space-y-2">
                        {PROFILES.map((x) => (
                          <button key={x.id} onClick={() => { setToleranceProfile(x.id); setStep(2); }} className={chip}>
                            <span className="block font-semibold">{x.label}</span>
                            <span className="block text-xs text-muted">{x.sub}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="mt-1 font-display text-lg leading-snug">What style or benchmark beer do you usually enjoy?</h2>
                      <div className="mt-3 space-y-2">
                        {(prof.id === "celiac" ? CELIAC_PICKS : OTHER_PICKS).map((x) => (
                          <button key={x.label} disabled={busy} onClick={() => send(`${prof.intro} ${x.msg}`)} className={chip}>
                            <span className="block font-semibold">{x.label}</span>
                            {x.benchmark && <span className="block font-mono text-xs text-muted">{x.benchmark}</span>}
                          </button>
                        ))}
                      </div>
                      <button disabled={busy} onClick={() => send(`I am ${prof.who}. What are the best options for me in the catalog?`)} className="mt-3 text-xs text-muted underline hover:text-copper">Skip and just recommend top picks</button>
                    </>
                  )}
                </div>
              );
            })()}
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
              className="max-h-40 min-w-0 flex-1 resize-none overflow-y-auto border border-rule bg-paper px-3 py-2 text-base leading-snug md:text-sm outline-none focus:border-copper" />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="h-9 shrink-0 bg-copper px-3 text-paper disabled:opacity-40"><Send size={16} /></button>
          </form>
          <p className="border-t border-rule px-3 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5 text-[10px] text-muted">AI guide, not medical advice. Test kits are screens, not safety guarantees.</p>
        </section>
      )}
    </>
  );
}
