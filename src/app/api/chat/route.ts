import { GoogleGenAI } from "@google/genai";
import { getBeers } from "@/lib/data";
import { CLASS_LABEL, type Beer } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Newest models are often capacity-limited; fall through the list on 429/5xx.
const MODELS = [process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.8-flash"].filter((m, i, a): m is string => !!m && a.indexOf(m) === i);
const MAX_MESSAGES = 5; // last 3 user turns (plus the 2 replies between them)
const MAX_CHARS = 1200;

// Naive per-instance rate limit: 12 requests / minute / IP.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 12;
}

const CLS: Record<Beer["classification"], string> = { dedicated_ngci: "NGCI", crafted_to_remove: "CTR", adjunct_low_ppm: "LOW", standard_gluten: "STD" };

// Compact on purpose: only a few retrieved beers ride along, so tokens stay low for rate limits.
function catalogLine(b: Beer) {
  const t = [...b.tests].sort((x, y) => (y.testedAt ?? "").localeCompare(x.testedAt ?? ""))[0];
  const test = t ? (t.ppm != null ? `~${t.ppm}ppm` : t.result === "inconclusive" ? "unclear" : t.result) : "-";
  return [b.brewery.split(/[(/]/)[0].trim(), b.name, b.style, CLS[b.classification], b.abv != null ? `${b.abv}%` : "", b.grains.join("+"), test].join("|");
}

const STOP = new Set(["the", "and", "for", "with", "any", "can", "you", "are", "what", "which", "beer", "beers", "gluten", "free", "recommend", "have", "about", "like", "good", "best", "something"]);

// Basic keyword retrieval over name/brewery/style/grains/class; returns the top 3-5 matches.
function retrieve(query: string, beers: Beer[]) {
  const words = (query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !STOP.has(w));
  if (!words.length) return [];
  const scored = beers
    .map((b) => {
      const name = `${b.name} ${b.brewery}`.toLowerCase();
      const meta = `${b.style} ${b.grains.join(" ")} ${CLASS_LABEL[b.classification]}`.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (name.includes(w)) score += 3;
        else if (meta.includes(w)) score += 1;
      }
      return { b, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
  return scored.slice(0, 5).map((x) => x.b);
}

const SYSTEM = `You are the Taproom Sommelier and Celiac Safety Advisor for the Gluten-Free Beer Index: a warm, knowledgeable, slightly witty guide for people avoiding gluten.

TAXONOMY
- NGCI: brewed from naturally gluten-free grains (millet, rice, sorghum), no barley. The safest category for celiacs.
- Enzyme-reduced / Crafted to Remove (e.g. Clarex-treated): barley beer where enzymes break down gluten. Test kits can misread it and many celiac organisations advise caution.
- Low-ppm lagers (e.g. Modelo, Corona): barley beers that read low or negative on home kits. Unverified, not a safety guarantee.

SAFETY RULES
- Warn celiacs against barley-based and enzyme-reduced beers; lead with NGCI options.
- For sensitive drinkers, give practical ppm estimates (<20 ppm is the usual gluten-free threshold) and say clearly they are estimates from home kits, not lab results.
- Never call a beer "safe". Never invent ppm, ABV or test results; use only the matched beers below, by exact brewery and name. If none match, say so and suggest the closest style.
- You are not a doctor; suggest consulting a clinician for medical questions. Decline unrelated requests politely.

STYLE
Concise (under ~180 words), 2-4 beers in short "-" lists with one line each. Plain text, **bold** for beer names only.`;

function systemPrompt(matches: Beer[]) {
  return matches.length ? `${SYSTEM}\n\nMATCHED BEERS (brewery|name|style|class|ABV|grains|latest test; NGCI=100% NGCI, CTR=Crafted to Remove, LOW=Naturally Low ppm, STD=Standard)\n${matches.map(catalogLine).join("\n")}` : SYSTEM;
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "Sommelier is not configured." }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return Response.json({ error: "Easy there — try again in a minute." }, { status: 429 });

  let body: { messages?: { role?: string; content?: string }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const msgs = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content!.slice(0, MAX_CHARS) }] }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return Response.json({ error: "Send a question." }, { status: 400 });

  const ai = new GoogleGenAI({ apiKey });
  const lastUser = msgs[msgs.length - 1].parts[0].text;
  const matches = retrieve(lastUser, await getBeers());
  try {
    const start = (model: string) =>
      ai.models.generateContentStream({
        model,
        contents: msgs,
        config: { systemInstruction: systemPrompt(matches), temperature: 0.7, maxOutputTokens: 700, abortSignal: AbortSignal.timeout(15_000) },
      });
    let stream;
    for (let attempt = 0; ; attempt++) {
      try {
        stream = await start(MODELS[attempt % MODELS.length]);
        break;
      } catch (err) {
        const st = (err as { status?: number }).status;
        if (attempt >= MODELS.length || (st && st < 500)) throw err; // never retry 429: it only burns more free-tier quota
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    const enc = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              // Skip "thought" parts so internal reasoning never reaches the user.
              const parts = chunk.candidates?.[0]?.content?.parts ?? [];
              for (const part of parts) if (part.text && !part.thought) controller.enqueue(enc.encode(part.text));
            }
          } catch {
            controller.enqueue(enc.encode("\n\n(The Sommelier lost the thread — please ask again.)"));
          }
          controller.close();
        },
      }),
      { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } },
    );
  } catch (e) {
    console.error("gemini error:", (e as Error).message);
    const status = (e as { status?: number }).status;
    if (status === 429) {
      return Response.json({ error: "Taproom Sommelier is catching its breath. Please try again in a minute.", detail: "upstream 429" }, { status: 429 });
    }
    return Response.json({ error: "The Sommelier is unavailable right now.", detail: status ? `upstream ${status}` : "upstream error" }, { status: 502 });
  }
}
