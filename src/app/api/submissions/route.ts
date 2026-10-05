import { z } from "zod";
import { Resend } from "resend";
import { randomUUID } from "node:crypto";
import { StoreUnavailable, withDb } from "@/lib/store";
import { clientIp, limited } from "@/lib/guard";

export const runtime = "nodejs";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opt = (max: number) => z.preprocess(blank, z.string().trim().max(max).optional());

const Submission = z.object({
  website: z.string().max(0).optional(), // honeypot: real people leave this empty
  beer_name: z.string().trim().min(1).max(120),
  brewery: z.string().trim().min(1).max(120),
  style: opt(80),
  abv: z.preprocess(blank, z.string().trim().regex(/^\d{1,2}(\.\d{1,2})?%?$/, "ABV looks off").optional()),
  classification: z.enum(["dedicated_ngci", "crafted_to_remove", "adjunct_low_ppm"]),
  grain_bill: opt(300),
  reported_ppm: opt(60),
  source_or_proof: z.preprocess(blank, z.string().trim().url().max(500).refine((u) => /^https?:\/\//i.test(u), "Use an http(s) link").optional()),
  notes: opt(1500),
  submitter_email: z.preprocess(blank, z.string().trim().email().max(200).optional()),
});

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (typeof body === "object" && body && typeof (body as { website?: unknown }).website === "string" && (body as { website: string }).website.length > 0) {
    return Response.json({ error: "Rejected." }, { status: 400 });
  }
  if (limited(`sub:${clientIp(req)}`, 5, 10 * 60_000)) return Response.json({ error: "Too many submissions. Try again later." }, { status: 429 });

  const parsed = Submission.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid submission." }, { status: 400 });
  const s = parsed.data;
  const id = randomUUID();

  try {
    await withDb((q) => q.run(
      `INSERT INTO beer_submissions (id, beer_name, brewery, style, abv, classification, grain_bill, reported_ppm, source_or_proof, notes, submitter_email, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?)`,
      [id, s.beer_name, s.brewery, s.style ?? null, s.abv ?? null, s.classification, s.grain_bill ?? null, s.reported_ppm ?? null, s.source_or_proof ?? null, s.notes ?? null, s.submitter_email ?? null, new Date().toISOString()],
    ));
  } catch (e) {
    if (e instanceof StoreUnavailable) return Response.json({ error: "Submissions aren't switched on for this site yet." }, { status: 503 });
    console.error("submission insert failed:", (e as Error).message);
    return Response.json({ error: "Couldn't save your submission." }, { status: 500 });
  }

  // Email is best-effort: a failed notification must never lose or fail the submission.
  if (process.env.RESEND_API_KEY && process.env.ADMIN_NOTIFICATION_EMAIL) {
    try {
      const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
      const text = [
        `Beer: ${s.beer_name}`, `Brewery: ${s.brewery}`, `Style: ${s.style ?? "-"}`, `Classification: ${s.classification}`,
        `Reported ppm: ${s.reported_ppm ?? "-"}`, `Source: ${s.source_or_proof ?? "-"}`, `Notes: ${s.notes ?? "-"}`,
        `Submitter: ${s.submitter_email ?? "-"}`, "", `Review: ${origin}/admin`,
      ].join("\n");
      const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.RESEND_FROM ?? "GF Beer Index <onboarding@resend.dev>",
        to: process.env.ADMIN_NOTIFICATION_EMAIL,
        subject: `New Beer Submission: ${s.beer_name} by ${s.brewery}`.replace(/[\r\n]+/g, " "),
        text,
      });
      if (error) console.error("resend error:", error.message);
    } catch (e) {
      console.error("resend failed:", (e as Error).message);
    }
  }
  return Response.json({ ok: true });
}
