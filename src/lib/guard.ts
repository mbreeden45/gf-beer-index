import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Admin key lives only in ADMIN_SECRET_KEY; there is deliberately no fallback value in code. */
export function isAdmin(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET_KEY;
  const given = req.headers.get("x-admin-key");
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const hits = new Map<string, number[]>();
/** Naive per-instance limiter: `max` hits per `windowMs` per key. */
export function limited(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
