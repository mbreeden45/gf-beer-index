import { z } from "zod";
import { randomUUID } from "node:crypto";
import { StoreUnavailable, withDb } from "@/lib/store";
import { clientIp, isAdmin, limited } from "@/lib/guard";

export const runtime = "nodejs";
const SLUG = /^[a-z0-9-]{1,200}$/;

export async function GET(req: Request) {
  const beerId = new URL(req.url).searchParams.get("beer_id") ?? "";
  if (!SLUG.test(beerId)) return Response.json({ error: "Bad beer_id." }, { status: 400 });
  try {
    const rows = await withDb((q) => q.all(
      `SELECT id, display_name, comment, created_at FROM beer_comments WHERE beer_id = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT 100`, [beerId]));
    return Response.json({ comments: rows }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof StoreUnavailable) return Response.json({ comments: [], disabled: true });
    return Response.json({ error: "Couldn't load notes." }, { status: 500 });
  }
}

const Post = z.object({
  beer_id: z.string().regex(SLUG),
  display_name: z.string().trim().max(40).optional(),
  comment: z.string().trim().min(1).max(1000),
  honeypot: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (typeof body === "object" && body && typeof (body as { honeypot?: unknown }).honeypot === "string" && (body as { honeypot: string }).honeypot.length > 0) {
    return Response.json({ error: "Rejected." }, { status: 400 });
  }
  if (limited(`cmt:${clientIp(req)}`, 6, 60_000)) return Response.json({ error: "Slow down a little." }, { status: 429 });
  const p = Post.safeParse(body);
  if (!p.success) return Response.json({ error: "Write a note (up to 1000 characters)." }, { status: 400 });
  const { beer_id, comment } = p.data;
  const display_name = p.data.display_name || "Anonymous";
  const id = randomUUID();
  const created_at = new Date().toISOString();
  try {
    await withDb((q) => q.run(`INSERT INTO beer_comments (id, beer_id, display_name, comment, is_deleted, created_at) VALUES (?,?,?,?,0,?)`, [id, beer_id, display_name, comment, created_at]));
    return Response.json({ ok: true, comment: { id, display_name, comment, created_at } });
  } catch (e) {
    if (e instanceof StoreUnavailable) return Response.json({ error: "Notes aren't switched on for this site yet." }, { status: 503 });
    return Response.json({ error: "Couldn't post your note." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  let id = "";
  try { id = String(((await req.json()) as { comment_id?: unknown }).comment_id ?? ""); } catch { /* handled below */ }
  if (!id) return Response.json({ error: "comment_id required." }, { status: 400 });
  try {
    await withDb((q) => q.run(`UPDATE beer_comments SET is_deleted = 1 WHERE id = ?`, [id]));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Couldn't delete." }, { status: 500 });
  }
}
