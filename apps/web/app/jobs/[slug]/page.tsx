import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getJobBySlug, getRelatedJobs, getAdjacentJobs } from "@/lib/jobs";
import { VerifiedSourceBadge } from "@/components/VerifiedSourceBadge";
import { JobCard } from "@/components/JobCard";
import { JobPostingJsonLd } from "@/components/json-ld/JobPostingJsonLd";
import { BreadcrumbJsonLd } from "@/components/json-ld/BreadcrumbJsonLd";
import { SocialShareButtons } from "@/components/SocialShareButtons";
import { trackJobView } from "@/lib/analytics";
import { headers } from "next/headers";
import { generateSeoTitle, generateSeoDescription } from "@govjobpulse/shared";
import { absoluteUrl } from "@/lib/site";

// NOT RUN in this sandbox — see CLAUDE.md's Prisma/network limitation.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) return {};

  // Manual override always wins; auto-generated (Section 6) is the
  // fallback, never the other way around.
  const title = job.seoTitle ?? generateSeoTitle({
    title: job.title,
    organizationName: job.organization.name,
    vacancies: job.vacancies,
    applicationEnd: job.applicationEnd,
  });
  const description = job.seoDescription ?? generateSeoDescription({
    title: job.title,
    organizationName: job.organization.name,
    vacancies: job.vacancies,
    applicationEnd: job.applicationEnd,
  });

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/jobs/${job.slug}`) },
    openGraph: { title, description, type: "article", url: absoluteUrl(`/jobs/${job.slug}`) },
    twitter: { title, description },
  };
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function JobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job || job.status !== "PUBLISHED") notFound();

  // Section 9: view tracking. Deliberately NOT awaited — a tracking
  // write is not something a real visitor should ever wait on, and a
  // tracking-table failure (e.g. a transient DB blip) must never turn
  // into a broken job page. .catch() here (not try/catch around an
  // await) is what makes this genuinely fire-and-forget rather than
  // just unhandled-promise-rejection-waiting-to-happen.
  const referrer = (await headers()).get("referer");
  trackJobView(job.id, referrer).catch((err) =>
    console.error(`[analytics] Failed to track view for ${job.slug}:`, err)
  );

  const [related, adjacent] = await Promise.all([
    getRelatedJobs(job.categoryId, job.id),
    getAdjacentJobs(job),
  ]);
  const isClosed = job.applicationEnd ? new Date(job.applicationEnd) < new Date() : false;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <BreadcrumbJsonLd
        crumbs={[
          { name: "Home", path: "/" },
          { name: job.category.name, path: `/categories/${job.category.slug}` },
          { name: job.title, path: `/jobs/${job.slug}` },
        ]}
      />
      <JobPostingJsonLd job={job} />

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

      <div className="mt-6">
        <SocialShareButtons jobId={job.id} url={absoluteUrl(`/jobs/${job.slug}`)} title={job.title} />
      </div>

      {(adjacent.previous || adjacent.next) && (
        <nav className="mt-10 flex items-center justify-between border-t border-secondary/10 pt-6 text-sm">
          {adjacent.previous ? (
            <a href={`/jobs/${adjacent.previous.slug}`} className="max-w-[45%] text-primary hover:underline">
              ← {adjacent.previous.title}
            </a>
          ) : (
            <span />
          )}
          {adjacent.next ? (
            <a href={`/jobs/${adjacent.next.slug}`} className="max-w-[45%] text-right text-primary hover:underline">
              {adjacent.next.title} →
            </a>
          ) : (
            <span />
          )}
        </nav>
      )}

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
