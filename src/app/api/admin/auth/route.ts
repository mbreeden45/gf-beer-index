import { clientIp, isAdmin, limited } from "@/lib/guard";

export async function POST(req: Request) {
  if (limited(`auth:${clientIp(req)}`, 8, 10 * 60_000)) return Response.json({ error: "Too many attempts." }, { status: 429 });
  let key = "";
  try { key = String(((await req.json()) as { key?: unknown }).key ?? ""); } catch { /* empty */ }
  const ok = isAdmin(new Request(req.url, { headers: { "x-admin-key": key } }));
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Wrong passcode." }, { status: 401 });
}
