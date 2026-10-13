import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedJobs } from "@/lib/jobs";
import { JobCard } from "@/components/JobCard";
import { Pagination } from "@/components/Pagination";
import { resolvePagination } from "@/lib/pagination";
import { qualificationSlugToEnum, QUALIFICATION_LABELS } from "@govjobpulse/types";
import { BreadcrumbJsonLd } from "@/components/json-ld/BreadcrumbJsonLd";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic"; // DB query — render at request time, not build time

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const enumValue = qualificationSlugToEnum(slug);
  if (!enumValue) return {};
  // Fallback to the enum value itself if somehow missing from the label
  // map (shouldn't happen — QUALIFICATION_LABELS and QUALIFICATION_SLUGS
  // share the same key set — but noUncheckedIndexedAccess doesn't know
  // that statically, so a real fallback beats a non-null assertion here).
  const label = QUALIFICATION_LABELS[enumValue] ?? enumValue;
  const title = `${label} Government Jobs`;
  const description = `Verified government job notifications open to ${label} candidates — sourced directly from official notices.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/qualifications/${slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/qualifications/${slug}`) },
  };
}

export default async function QualificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const enumValue = qualificationSlugToEnum(slug);
  if (!enumValue) notFound();
  const label = QUALIFICATION_LABELS[enumValue] ?? enumValue;

  const { page, take, skip } = resolvePagination(resolvedSearchParams);
  const { jobs, total } = await getPublishedJobs({ skip, take, qualification: enumValue });

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <BreadcrumbJsonLd
        crumbs={[
          { name: "Home", path: "/" },
          { name: label, path: `/qualifications/${slug}` },
        ]}
      />
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Qualification</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-secondary">{label} Jobs</h1>

      {jobs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-secondary/20 p-10 text-center text-secondary/50">
          No published jobs for {label} candidates right now. Check back soon.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {jobs.map((job) => (
            <JobCard key={job.slug} job={job} />
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalItems={total} pageSize={take} basePath={`/qualifications/${slug}`} />
    </section>
  );
}
