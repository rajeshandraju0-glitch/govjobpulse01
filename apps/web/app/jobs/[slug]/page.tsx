import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getJobBySlug, getRelatedJobs } from "@/lib/jobs";
import { VerifiedSourceBadge } from "@/components/VerifiedSourceBadge";
import { JobCard } from "@/components/JobCard";

// NOT RUN in this sandbox — see CLAUDE.md's Prisma/network limitation.
// Basic per-page metadata only; the full Section 6 JSON-LD pass
// (JobPosting schema, breadcrumbs, OG images, etc.) is explicitly
// Phase 7's scope, not fabricated here ahead of that phase.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const job = await getJobBySlug(params.slug);
  if (!job) return {};
  return {
    title: job.seoTitle ?? job.title,
    description: job.seoDescription ?? job.description.slice(0, 155),
  };
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function JobDetailPage({ params }: { params: { slug: string } }) {
  const job = await getJobBySlug(params.slug);
  if (!job || job.status !== "PUBLISHED") notFound();

  const related = await getRelatedJobs(job.categoryId, job.id);
  const isClosed = job.applicationEnd ? new Date(job.applicationEnd) < new Date() : false;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <nav className="text-xs text-secondary/50" aria-label="Breadcrumb">
        <a href="/" className="hover:text-primary">
          Home
        </a>
        {" / "}
        <a href={`/categories/${job.category.slug}`} className="hover:text-primary">
          {job.category.name}
        </a>
      </nav>

      <div className="mt-3 flex items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">{job.category.name}</p>
        {isClosed && (
          <span className="rounded-full bg-secondary/5 px-2.5 py-1 text-xs font-medium text-secondary/50">
            Applications closed
          </span>
        )}
      </div>
      <h1 className="mt-1 font-display text-3xl font-bold text-secondary">{job.title}</h1>
      <p className="mt-2 text-secondary/60">
        {job.organization.name} · {job.department}
      </p>

      <div className="mt-4">
        <VerifiedSourceBadge officialNotificationUrl={job.officialNotificationUrl} sourceName={job.source?.name} />
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 rounded-xl border border-secondary/10 bg-secondary/[0.02] p-5 font-data text-sm sm:grid-cols-3">
        {job.vacancies !== null && (
          <div>
            <dt className="text-secondary/50">Vacancies</dt>
            <dd className="mt-0.5 font-semibold text-secondary">{job.vacancies.toLocaleString("en-IN")}</dd>
          </div>
        )}
        {job.advertisementNumber && (
          <div>
            <dt className="text-secondary/50">Advertisement No.</dt>
            <dd className="mt-0.5 font-semibold text-secondary">{job.advertisementNumber}</dd>
          </div>
        )}
        {formatDate(job.applicationStart) && (
          <div>
            <dt className="text-secondary/50">Applications open</dt>
            <dd className="mt-0.5 font-semibold text-secondary">{formatDate(job.applicationStart)}</dd>
          </div>
        )}
        {formatDate(job.applicationEnd) && (
          <div>
            <dt className="text-secondary/50">Last date</dt>
            <dd className="mt-0.5 font-semibold text-secondary">{formatDate(job.applicationEnd)}</dd>
          </div>
        )}
        {formatDate(job.examDate) && (
          <div>
            <dt className="text-secondary/50">Exam date</dt>
            <dd className="mt-0.5 font-semibold text-secondary">{formatDate(job.examDate)}</dd>
          </div>
        )}
        {job.applicationFee && (
          <div>
            <dt className="text-secondary/50">Application fee</dt>
            <dd className="mt-0.5 font-semibold text-secondary">{job.applicationFee}</dd>
          </div>
        )}
      </dl>

      <section className="prose prose-secondary mt-8 max-w-none">
        <h2 className="font-display text-xl font-semibold text-secondary">About this notification</h2>
        <p className="whitespace-pre-line text-secondary/80">{job.description}</p>

        {job.howToApply && (
          <>
            <h2 className="font-display text-xl font-semibold text-secondary">How to apply</h2>
            <p className="whitespace-pre-line text-secondary/80">{job.howToApply}</p>
          </>
        )}

        {job.selectionProcess && (
          <>
            <h2 className="font-display text-xl font-semibold text-secondary">Selection process</h2>
            <p className="whitespace-pre-line text-secondary/80">{job.selectionProcess}</p>
          </>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={job.officialNotificationUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
        >
          View official notification
        </a>
        {job.officialApplyUrl && (
          <a
            href={job.officialApplyUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="rounded-lg border border-primary px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5"
          >
            Apply now
          </a>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold text-secondary">
            More in {job.category.name}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {related.map((r) => (
              <JobCard key={r.slug} job={r} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
