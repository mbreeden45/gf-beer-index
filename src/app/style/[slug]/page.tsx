import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OG_IMAGES } from "@/lib/site";
import { getCatalog } from "@/lib/catalog";
import { classCounts, groupSummary } from "@/lib/seo";
import GroupPage from "@/components/GroupPage";

export const revalidate = 3600;
type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getCatalog()).styles.map((g) => ({ slug: g.slug }));
}

async function load(params: Props["params"]) {
  const { slug } = await params;
  return (await getCatalog()).styles.find((g) => g.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await load(params);
  if (!g) return {};
  const c = classCounts(g.beers);
  const hasGf = c.dedicated_ngci + c.adjunct_low_ppm + c.crafted_to_remove > 0;
  const title = hasGf ? `Gluten-Free & Low-Gluten ${g.name} Beers (${g.beers.length} Compared)` : `${g.name} Beers and Their Gluten Status`;
  const description = `${g.name} beers compared by gluten status and test results: ${groupSummary(g.beers)}.`;
  return { title, description, alternates: { canonical: `/style/${g.slug}` }, openGraph: { title, description, url: `/style/${g.slug}`, images: OG_IMAGES } };
}

export default async function StylePage({ params }: Props) {
  const g = await load(params);
  if (!g) notFound();
  const c = classCounts(g.beers);
  const gf = c.dedicated_ngci > 0;
  return (
    <GroupPage
      h1={gf ? `Gluten-free ${g.name} beers` : `${g.name} beers and their gluten status`}
      intro={`${g.beers.length} ${g.name} ${g.beers.length === 1 ? "beer" : "beers"} in the index: ${groupSummary(g.beers)}. ${gf ? "Beers brewed without barley are listed first; the rest are included so you can compare." : "Each is labelled by how it was brewed and what home tests found."}`}
      path={`/style/${g.slug}`}
      crumb={g.name}
      beers={g.beers}
    />
  );
}
