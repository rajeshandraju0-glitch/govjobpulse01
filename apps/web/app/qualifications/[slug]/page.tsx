import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedJobs } from "@/lib/jobs";
import { JobCard } from "@/components/JobCard";
import { Pagination } from "@/components/Pagination";
import { resolvePagination } from "@/lib/pagination";
import { qualificationSlugToEnum, QUALIFICATION_LABELS } from "@govjobpulse/types";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const enumValue = qualificationSlugToEnum(params.slug);
  if (!enumValue) return {};
  const label = QUALIFICATION_LABELS[enumValue];
  return {
    title: `${label} Government Jobs`,
    description: `Verified government job notifications open to ${label} candidates — sourced directly from official notices.`,
  };
}

export default async function QualificationPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { page?: string };
}) {
  const enumValue = qualificationSlugToEnum(params.slug);
  if (!enumValue) notFound();
  const label = QUALIFICATION_LABELS[enumValue];

  const { page, take, skip } = resolvePagination(searchParams);
  const { jobs, total } = await getPublishedJobs({ skip, take, qualification: enumValue });

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
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

      <Pagination currentPage={page} totalItems={total} pageSize={take} basePath={`/qualifications/${params.slug}`} />
    </section>
  );
}
