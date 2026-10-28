import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OG_IMAGES } from "@/lib/site";
import { getCatalog } from "@/lib/catalog";
import { groupSummary } from "@/lib/seo";
import GroupPage from "@/components/GroupPage";

export const revalidate = 3600;
type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getCatalog()).breweries.map((g) => ({ slug: g.slug }));
}

async function load(params: Props["params"]) {
  const { slug } = await params;
  return (await getCatalog()).breweries.find((g) => g.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await load(params);
  if (!g) return {};
  const n = g.beers.length;
  const title = `${g.name}: Gluten Status of ${n} ${n === 1 ? "Beer" : "Beers"}`;
  const description = `${g.name} beers sorted by gluten status with test results and sources: ${groupSummary(g.beers)}.`;
  return { title, description, alternates: { canonical: `/brewery/${g.slug}` }, openGraph: { title, description, url: `/brewery/${g.slug}`, images: OG_IMAGES } };
}

export default async function BreweryPage({ params }: Props) {
  const g = await load(params);
  if (!g) notFound();
  return (
    <GroupPage
      h1={`${g.name} beers and their gluten status`}
      intro={`${g.beers.length === 1 ? "One beer" : `${g.beers.length} beers`} from ${g.name} in the index: ${groupSummary(g.beers)}. Each links to its test results and sources.`}
      path={`/brewery/${g.slug}`}
      crumb={g.name}
      beers={g.beers}
    />
  );
}
