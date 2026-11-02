/** Canonical origin used for metadata, sitemap and JSON-LD. Set NEXT_PUBLIC_SITE_URL when a custom domain is attached. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://gf-beer-index.vercel.app").replace(/\/+$/, "");
export const SITE_NAME = "The Gluten-Free Beer Index";

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pages that set their own openGraph replace the root one wholesale, so they re-attach the shared card image. */
export const OG_IMAGES = [{ url: "/opengraph-image", width: 1200, height: 630, alt: "The Gluten-Free Beer Index" }];
