import { GoogleGenAI } from "@google/genai";
import { getBeers } from "@/lib/data";
import { CLASS_LABEL, type Beer } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
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

function catalogLine(b: Beer) {
  const t = [...b.tests].sort((x, y) => (y.testedAt ?? "").localeCompare(x.testedAt ?? ""))[0];
  const test = t ? `${t.kit}: ${t.ppm != null ? `~${t.ppm}ppm est.` : t.result}` : "no test";
  return `${b.brewery}${b.origin ? ` (${b.origin})` : ""} | ${b.name} | ${b.style} | ${CLASS_LABEL[b.classification]} | ${b.abv ?? "?"}%${b.ibu ? `, ${b.ibu} IBU` : ""} | ${b.grains.join("/") || "grains?"} | ${test} (${b.tests.length} tests)`;
}

function systemPrompt(beers: Beer[]) {
  return `You are the Sommelier for the Gluten-Free Beer Index: a warm, knowledgeable, slightly witty taproom guide for people avoiding gluten.

RULES
- Recommend ONLY beers from the catalog below, by exact brewery and name. If nothing fits, say so and suggest the closest options.
- Four classes: 100% NGCI (brewed from naturally gluten-free grains, no barley), Crafted to Remove (barley beer treated with enzymes; kits can misread it, many celiac organisations advise caution), Naturally Low ppm (barley beer that read negative on home kits; unverified, NOT a safety guarantee), Standard Gluten (not for celiac).
- For anyone who says they have celiac disease, lead with 100% NGCI beers and be candid about the limits of the other classes. Never claim a beer is "safe". Home kits are qualitative screens, and ppm figures are visual estimates, not lab results.
- Quote test evidence from the catalog when relevant (kit, result). Never invent ppm values, ABV, or test results.
- Keep replies concise (under ~180 words), with short lists of 2-4 beers, each with one line on why. Talk about flavour using style, grains and ABV.
- Formatting: plain text with **bold** for beer names only; use "-" for bullets; no italics or other markdown.
- You are not a doctor; for medical questions suggest consulting a clinician. Decline unrelated requests politely.

CATALOG (brewery | name | style | class | ABV | grains | latest test)
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
    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents: msgs,
      config: { systemInstruction: systemPrompt(beers), temperature: 0.7, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } },
    });
    const enc = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) if (chunk.text) controller.enqueue(enc.encode(chunk.text));
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
    const m = /"code":\s*(\d+)[\s\S]*?"status":\s*"([A-Z_]+)"/.exec((e as Error).message);
    return Response.json({ error: "The Sommelier is unavailable right now.", detail: m ? `${m[1]} ${m[2]}` : "upstream error" }, { status: 502 });
  }
}
