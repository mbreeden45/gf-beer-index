import { revalidatePath } from "next/cache";
import { StoreUnavailable, withDb } from "@/lib/store";
import { isAdmin } from "@/lib/guard";
import { celiacAssessment, coldLagering, sensoryProfile } from "@/lib/profile";
import { flavorFor } from "@/lib/flavor";

export const runtime = "nodejs";
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const GRAINS = ["millet", "rice", "buckwheat", "sorghum", "corn", "barley", "wheat", "oats", "quinoa", "chestnut", "cassava", "amaranth", "teff"];

export async function GET(req: Request) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const rows = await withDb((q) => q.all(`SELECT * FROM beer_submissions WHERE status = 'pending' ORDER BY created_at ASC`));
    return Response.json({ submissions: rows }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof StoreUnavailable) return Response.json({ submissions: [], disabled: true });
    return Response.json({ error: "Couldn't load submissions." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  let body: { id?: string; action?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  if (!body.id || (body.action !== "approve" && body.action !== "reject")) return Response.json({ error: "id and action (approve|reject) required." }, { status: 400 });

  try {
    return await withDb(async (q) => {
      const [sub] = await q.all(`SELECT * FROM beer_submissions WHERE id = ? AND status = 'pending'`, [body.id]);
      if (!sub) return Response.json({ error: "Not found or already handled." }, { status: 404 });
      if (body.action === "reject") {
        await q.run(`UPDATE beer_submissions SET status = 'rejected' WHERE id = ?`, [body.id]);
        return Response.json({ ok: true });
      }

      const str = (k: string) => (typeof sub[k] === "string" ? (sub[k] as string) : "");
      const classification = str("classification") as "dedicated_ngci" | "crafted_to_remove" | "adjunct_low_ppm";
      const name = str("beer_name"), brewery = str("brewery");
      const style = str("style") || "Unspecified";
      const abvNum = parseFloat(str("abv"));
      const abv = Number.isFinite(abvNum) ? abvNum : null;
      const bill = str("grain_bill").toLowerCase();
      const grains = GRAINS.filter((g) => new RegExp(`\\b${g}\\b`).test(bill));
      const proof = /^https?:\/\//i.test(str("source_or_proof")) ? str("source_or_proof") : null;
      const ctx = { name, style, abv, classification, grains };
      let slug = slugify(`${brewery}-${name}`) || `beer-${Date.now()}`;
      if ((await q.all(`SELECT slug FROM beers WHERE slug = ?`, [slug])).length) slug = `${slug}-${Date.now().toString(36)}`;

      await q.run(
        `INSERT INTO beers (slug, name, brewery, style, abv, ibu, classification, grains, cold_lagering, sensory_profile, celiac_assessment, source_url, origin, flavor, notes, grains_basis, refs) VALUES (?,?,?,?,?,NULL,?,?,?,?,?,?,NULL,?,?,?,?)`,
        [slug, name, brewery, style, abv, classification, JSON.stringify(grains), coldLagering(classification, style), sensoryProfile(ctx), celiacAssessment(ctx), proof,
          JSON.stringify(flavorFor(style)), JSON.stringify(["Community submitted; reviewed by the index editor."]), grains.length ? "listing" : null, "[]"],
      );
      if (proof && str("reported_ppm")) {
        const ppm = parseFloat(str("reported_ppm"));
        await q.run(
          `INSERT INTO beer_tests (beer_slug, kit, ppm, result, result_note, tested_at, source_name, source_url) VALUES (?,?,?,?,?,NULL,?,?)`,
          [slug, "Community-reported", Number.isFinite(ppm) ? ppm : null, Number.isFinite(ppm) ? "numeric" : "inconclusive", `Reported by a reader: "${str("reported_ppm").slice(0, 80)}". Not independently verified.`, "Community submission", proof],
        );
      }
      await q.run(`UPDATE beer_submissions SET status = 'approved' WHERE id = ?`, [body.id]);
      revalidatePath("/");
      return Response.json({ ok: true, slug });
    });
  } catch (e) {
    if (e instanceof StoreUnavailable) return Response.json({ error: "No database configured." }, { status: 503 });
    console.error("admin action failed:", (e as Error).message);
    return Response.json({ error: "Action failed." }, { status: 500 });
  }
}
