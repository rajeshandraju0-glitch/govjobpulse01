import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getState, getPublishedJobs } from "@/lib/jobs";
import { JobCard } from "@/components/JobCard";
import { Pagination } from "@/components/Pagination";
import { resolvePagination } from "@/lib/pagination";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const state = await getState(params.slug);
  if (!state) return {};
  return {
    title: `Government Jobs in ${state.name}`,
    description: `Verified government job notifications in ${state.name} — sourced directly from official notices.`,
  };
}

export default async function StatePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { page?: string };
}) {
  const state = await getState(params.slug);
  if (!state) notFound();

  const { page, take, skip } = resolvePagination(searchParams);
  const { jobs, total } = await getPublishedJobs({ skip, take, stateSlug: params.slug });

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        {state.isUnionTerritory ? "Union Territory" : "State"}
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold text-secondary">Jobs in {state.name}</h1>

      {jobs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-secondary/20 p-10 text-center text-secondary/50">
          No published jobs for {state.name} right now. Check back soon.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {jobs.map((job) => (
            <JobCard key={job.slug} job={job} />
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalItems={total} pageSize={take} basePath={`/states/${params.slug}`} />
    </section>
  );
}
