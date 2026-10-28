import Link from "next/link";
import type { Beer } from "@/lib/types";
import { AssayTag, ClassStamp } from "./Stamps";

export default function BeerList({ beers }: { beers: Beer[] }) {
  return (
    <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {beers.map((b) => (
        <li key={b.slug} className="spec-card flex flex-col p-5">
          <ClassStamp c={b.classification} />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{b.brewery}</p>
          <h2 className="font-display text-2xl font-semibold leading-tight">
            <Link href={`/beer/${b.slug}`} className="hover:text-copper hover:underline underline-offset-4">{b.name}</Link>
          </h2>
          <p className="text-sm italic text-muted">{b.style}{b.abv != null ? ` · ${b.abv}% ABV` : ""}</p>
          <div className="mt-auto pt-4"><AssayTag tests={b.tests} /></div>
        </li>
      ))}
    </ul>
  );
}
