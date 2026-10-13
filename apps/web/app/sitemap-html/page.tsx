import type { Metadata } from "next";
import Link from "next/link";
import { getAllCategories, getAllStates } from "@/lib/jobs";
import { QUALIFICATION_SLUGS, QUALIFICATION_LABELS } from "@govjobpulse/types";

export const dynamic = "force-dynamic"; // DB query — render at request time, not build time

export const metadata: Metadata = {
  title: "Sitemap",
  description: "All categories, states, and qualification pages on GovJobPulse.",
};

export default async function HtmlSitemapPage() {
  const [categories, states] = await Promise.all([getAllCategories(), getAllStates()]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-secondary">Sitemap</h1>
      <p className="mt-2 text-sm text-secondary/60">
        Every category, state, and qualification page on GovJobPulse. Looking for the machine-readable
        version? See <a href="/sitemap.xml" className="text-primary hover:underline">sitemap.xml</a>.
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-3">
        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-secondary/50">
            Categories
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/categories/${c.slug}`} className="text-primary hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-secondary/50">
            States &amp; UTs
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {states.map((s) => (
              <li key={s.slug}>
                <Link href={`/states/${s.slug}`} className="text-primary hover:underline">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-secondary/50">
            Qualifications
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {Object.entries(QUALIFICATION_SLUGS).map(([enumValue, slug]) => (
              <li key={slug}>
                <Link href={`/qualifications/${slug}`} className="text-primary hover:underline">
                  {QUALIFICATION_LABELS[enumValue]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
