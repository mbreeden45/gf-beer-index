import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";
import { CLASS_PAGES } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { beers, breweries, styles } = await getCatalog();
  return [
    { url: SITE_URL, priority: 1 },
    ...Object.keys(CLASS_PAGES).map((s) => ({ url: `${SITE_URL}/class/${s}`, priority: 0.8 })),
    ...styles.map((g) => ({ url: `${SITE_URL}/style/${g.slug}`, priority: 0.6 })),
    ...breweries.map((g) => ({ url: `${SITE_URL}/brewery/${g.slug}`, priority: 0.5 })),
    ...beers.map((b) => ({ url: `${SITE_URL}/beer/${b.slug}`, priority: 0.7 })),
  ];
}
