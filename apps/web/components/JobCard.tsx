import Link from "next/link";
import { VerifiedSourceBadge } from "./VerifiedSourceBadge";

// Loosely typed on purpose — this renders whatever shape
// lib/jobs.ts's Prisma queries return (with organization/category
// included), and that shape can't be imported precisely without the
// generated Prisma client (see CLAUDE.md's known limitation). Once
// `prisma generate` can run, tighten this to the real generated type.
interface JobCardProps {
  job: {
    slug: string;
    title: string;
    department: string;
    advertisementNumber: string | null;
    vacancies: number | null;
    applicationEnd: Date | null;
    officialNotificationUrl: string;
    organization: { name: string };
    category: { name: string; slug: string };
  };
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function JobCard({ job }: JobCardProps) {
  const lastDate = formatDate(job.applicationEnd);
  const isClosed = job.applicationEnd ? new Date(job.applicationEnd) < new Date() : false;

  return (
    <Link
      href={`/jobs/${job.slug}`}
      className="block rounded-xl border border-secondary/10 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">{job.category.name}</p>
          <h3 className="mt-1 font-display text-lg font-semibold leading-snug text-secondary">
            {job.title}
          </h3>
          <p className="mt-1 text-sm text-secondary/60">
            {job.organization.name} · {job.department}
          </p>
        </div>
        {isClosed && (
          <span className="shrink-0 rounded-full bg-secondary/5 px-2.5 py-1 text-xs font-medium text-secondary/50">
            Applications closed
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-data text-xs text-secondary/70">
        {job.vacancies !== null && <span>{job.vacancies.toLocaleString("en-IN")} vacancies</span>}
        {lastDate && <span>Last date: {lastDate}</span>}
        {job.advertisementNumber && <span>Ref: {job.advertisementNumber}</span>}
      </div>

      <div className="mt-4">
        <VerifiedSourceBadge officialNotificationUrl={job.officialNotificationUrl} />
      </div>
    </Link>
  );
}
