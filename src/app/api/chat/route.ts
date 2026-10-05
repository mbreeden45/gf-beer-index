import { GoogleGenAI } from "@google/genai";
import { getBeers } from "@/lib/data";
import { CLASS_LABEL, type Beer } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Newest models are often capacity-limited; fall through the list on 429/5xx.
const MODELS = [process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.8-flash"].filter((m, i, a): m is string => !!m && a.indexOf(m) === i);
const MAX_MESSAGES = 16;
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

// Compact on purpose: the whole catalog rides along on every request, so tokens matter for rate limits.
function catalogLine(b: Beer) {
  const t = [...b.tests].sort((x, y) => (y.testedAt ?? "").localeCompare(x.testedAt ?? ""))[0];
  const test = t ? (t.ppm != null ? `~${t.ppm}ppm` : t.result === "inconclusive" ? "unclear" : t.result) : "-";
  const where = b.origin?.split(",").pop()?.trim() ?? "";
  return [b.brewery.split(/[(/]/)[0].trim(), b.name, b.style, CLS[b.classification], b.abv != null ? `${b.abv}%` : "", b.ibu ? `${b.ibu}IBU` : "", b.grains.join("+"), test, where].join("|");
}

function systemPrompt(beers: Beer[]) {
  return `You are the Sommelier for the Gluten-Free Beer Index: a warm, knowledgeable, slightly witty taproom guide for people avoiding gluten.

RULES
- Recommend ONLY beers from the catalog below, by exact brewery and name. If nothing fits, say so and suggest the closest options.
- Class codes: NGCI = 100% NGCI, CTR = Crafted to Remove, LOW = Naturally Low ppm, STD = Standard Gluten. In plain words: 100% NGCI (brewed from naturally gluten-free grains, no barley), Crafted to Remove (barley beer treated with enzymes; kits can misread it, many celiac organisations advise caution), Naturally Low ppm (barley beer that read negative on home kits; unverified, NOT a safety guarantee), Standard Gluten (not for celiac).
- For anyone who says they have celiac disease, lead with 100% NGCI beers and be candid about the limits of the other classes. Never claim a beer is "safe". Home kits are qualitative screens, and ppm figures are visual estimates, not lab results.
- Quote test evidence from the catalog when relevant (kit, result). Never invent ppm values, ABV, or test results.
- Keep replies concise (under ~180 words), with short lists of 2-4 beers, each with one line on why. Talk about flavour using style, grains and ABV.
- Formatting: plain text with **bold** for beer names only; use "-" for bullets; no italics or other markdown.
- You are not a doctor; for medical questions suggest consulting a clinician. Decline unrelated requests politely.

CATALOG (brewery|name|style|class|ABV|IBU|grains|latest test|country)
${beers.map(catalogLine).join("\n")}`;
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
  const beers = await getBeers();
  try {
    const start = (model: string) =>
      ai.models.generateContentStream({
        model,
        contents: msgs,
        config: { systemInstruction: systemPrompt(beers), temperature: 0.7, maxOutputTokens: 700, abortSignal: AbortSignal.timeout(15_000) },
      });
    let stream;
    for (let attempt = 0; ; attempt++) {
      try {
        stream = await start(MODELS[attempt % MODELS.length]);
        break;
      } catch (err) {
        const st = (err as { status?: number }).status;
        if (attempt >= MODELS.length || (st && st < 500 && st !== 429)) throw err;
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
    if (status === 429) return Response.json({ error: "The Sommelier is swamped right now. Give it a minute and ask again.", detail: "upstream 429" }, { status: 503 });
    return Response.json({ error: "The Sommelier is unavailable right now.", detail: status ? `upstream ${status}` : "upstream error" }, { status: 502 });
  }
}
