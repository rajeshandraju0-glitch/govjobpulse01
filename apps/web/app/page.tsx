import { prisma, JobStatus } from "@govjobpulse/database";
import { Hero } from "@/components/Hero";
import { JobCard } from "@/components/JobCard";
import { Pagination } from "@/components/Pagination";
import { getPublishedJobs } from "@/lib/jobs";
import { resolvePagination } from "@/lib/pagination";

export const dynamic = "force-dynamic"; // TODO(Phase 7): revisit ISR/SSG caching strategy in the SEO pass

export default async function HomePage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const { page, take, skip } = resolvePagination(searchParams);
  const [{ jobs, total }, totalPublishedJobs] = await Promise.all([
    getPublishedJobs({ skip, take }),
    prisma.job.count({ where: { status: JobStatus.PUBLISHED } }),
  ]);

  return (
    <div>
      <Hero totalPublishedJobs={totalPublishedJobs} />

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
    </div>
  );
}
