import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OG_IMAGES } from "@/lib/site";
import { getCatalog } from "@/lib/catalog";
import { CLASS_PAGES } from "@/lib/seo";
import GroupPage from "@/components/GroupPage";

export const revalidate = 3600;
export const dynamicParams = false;
type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return Object.keys(CLASS_PAGES).map((slug) => ({ slug }));
}

async function load(params: Props["params"]) {
  const { slug } = await params;
  const page = CLASS_PAGES[slug];
  if (!page) return null;
  const beers = (await getCatalog()).beers.filter((b) => b.classification === page.cls);
  return { slug, page, beers };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await load(params);
  if (!d) return {};
  const title = `${d.page.title} (${d.beers.length} Listed)`;
  const description = `${d.page.intro.split(". ")[0]}. ${d.beers.length} beers listed with test results and sources.`;
  return { title, description, alternates: { canonical: `/class/${d.slug}` }, openGraph: { title, description, url: `/class/${d.slug}`, images: OG_IMAGES } };
}

export default async function ClassPage({ params }: Props) {
  const d = await load(params);
  if (!d) notFound();
  return <GroupPage h1={d.page.h1} intro={d.page.intro} path={`/class/${d.slug}`} crumb={d.page.h1} beers={d.beers} />;
}
