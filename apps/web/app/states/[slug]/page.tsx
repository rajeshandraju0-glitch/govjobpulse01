import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getState, getPublishedJobs } from "@/lib/jobs";
import { JobCard } from "@/components/JobCard";
import { Pagination } from "@/components/Pagination";
import { resolvePagination } from "@/lib/pagination";
import { BreadcrumbJsonLd } from "@/components/json-ld/BreadcrumbJsonLd";
import { absoluteUrl } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const state = await getState(slug);
  if (!state) return {};
  const title = `Government Jobs in ${state.name}`;
  const description = `Verified government job notifications in ${state.name} — sourced directly from official notices.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/states/${slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/states/${slug}`) },
  };
}

export default async function StatePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const state = await getState(slug);
  if (!state) notFound();

  const { page, take, skip } = resolvePagination(resolvedSearchParams);
  const { jobs, total } = await getPublishedJobs({ skip, take, stateSlug: slug });

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <BreadcrumbJsonLd
        crumbs={[
          { name: "Home", path: "/" },
          { name: state.name, path: `/states/${slug}` },
        ]}
      />
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

      <Pagination currentPage={page} totalItems={total} pageSize={take} basePath={`/states/${slug}`} />
    </section>
  );
}
