import { prisma, JobStatus } from "@govjobpulse/database";
import { Hero } from "@/components/Hero";
import { JobCard } from "@/components/JobCard";
import { Pagination } from "@/components/Pagination";
import { getPublishedJobs, getPopularCategories } from "@/lib/jobs";
import { resolvePagination } from "@/lib/pagination";
import { FaqSection } from "@/components/json-ld/FaqSection";
import Link from "next/link";

export const dynamic = "force-dynamic"; // TODO(Phase 7 follow-up): revisit ISR/SSG caching strategy now that SEO infra exists

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { page, take, skip } = resolvePagination(resolvedSearchParams);
  const [{ jobs, total }, totalPublishedJobs, popularCategories] = await Promise.all([
    getPublishedJobs({ skip, take }),
    prisma.job.count({ where: { status: JobStatus.PUBLISHED } }),
    getPopularCategories(),
  ]);

  return (
    <div>
      <Hero totalPublishedJobs={totalPublishedJobs} />

      {popularCategories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-12">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-secondary/50">
            Popular categories
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {popularCategories.map((c) => (
              <Link
                key={c.slug}
                href={`/categories/${c.slug}`}
                className="rounded-full border border-secondary/10 px-4 py-1.5 text-sm text-secondary/70 transition-colors hover:border-primary hover:text-primary"
              >
                {c.name}{" "}
                <span className="font-data text-secondary/40">({c._count.jobs})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-display text-2xl font-semibold text-secondary">Latest notifications</h2>
        <p className="mt-1 text-sm text-secondary/60">
          Every listing below links to its official notification — verify details there before
          applying.
        </p>

        {jobs.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-secondary/20 p-10 text-center text-secondary/50">
            No published jobs yet. Once the moderation queue (Phase 9) promotes reviewed scraper
            drafts, they&apos;ll appear here.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
          </div>
        )}

        <Pagination currentPage={page} totalItems={total} pageSize={take} basePath="/" />
      </section>

      <FaqSection />
    </div>
  );
}
