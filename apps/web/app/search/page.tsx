import type { Metadata } from "next";
import { searchJobs } from "@/lib/jobs";
import { resolvePagination } from "@/lib/pagination";
import { JobCard } from "@/components/JobCard";
import { Pagination } from "@/components/Pagination";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim();
  return {
    title: q ? `"${q}" — Search Results` : "Search",
    // Search results pages are intentionally not indexed — they're
    // near-duplicates of category/listing pages with a query param, and
    // indexing every possible query string is thin/duplicate content
    // that works against, not for, Section 6's SEO goals.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const q = resolvedSearchParams.q?.trim() ?? "";
  const { page, take, skip } = resolvePagination(resolvedSearchParams);
  const { jobs, total } = q ? await searchJobs({ query: q, skip, take }) : { jobs: [], total: 0 };

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold text-secondary">
        {q ? (
          <>
            Search results for <span className="text-primary">&ldquo;{q}&rdquo;</span>
          </>
        ) : (
          "Search"
        )}
      </h1>
      {q && (
        <p className="mt-1 text-sm text-secondary/60">
          {total} result{total === 1 ? "" : "s"}
        </p>
      )}

      {!q ? (
        <p className="mt-8 text-secondary/50">Enter a search term to find job notifications.</p>
      ) : jobs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-secondary/20 p-10 text-center text-secondary/50">
          No published jobs match &ldquo;{q}&rdquo;. Try a different post name, department, or
          organisation.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {jobs.map((job) => (
            <JobCard key={job.slug} job={job} />
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalItems={total} pageSize={take} basePath="/search" extraParams={{ q }} />
    </section>
  );
}
