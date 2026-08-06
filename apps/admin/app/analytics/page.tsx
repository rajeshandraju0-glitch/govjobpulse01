// Section 9's tracking data, surfaced for internal visibility. Queries
// written directly here rather than importing apps/web's lib/analytics.ts
// — apps/* directories are app-local, not shared packages, so an
// app-to-app import would be a non-standard coupling for this
// monorepo's structure (packages/* is the shared-code boundary). Some
// duplication with apps/web's aggregation logic as a result; worth
// extracting to a shared package if a third consumer ever needs the
// same queries.

import { prisma } from "@govjobpulse/database";

export const metadata = { title: "Analytics — GovJobPulse Admin" };
export const dynamic = "force-dynamic";

const SINCE_DAYS = 30;

async function getMostViewedJobs(limit = 10) {
  const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000);
  const grouped = await prisma.jobView.groupBy({
    by: ["jobId"],
    where: { viewedAt: { gte: since } },
    _count: { jobId: true },
    orderBy: { _count: { jobId: "desc" } },
    take: limit,
  });
  const jobs = await prisma.job.findMany({
    where: { id: { in: grouped.map((g) => g.jobId) } },
    select: { id: true, title: true, slug: true },
  });
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  return grouped
    .map((g) => ({ job: jobById.get(g.jobId), count: g._count.jobId }))
    .filter((r): r is { job: NonNullable<typeof r.job>; count: number } => Boolean(r.job));
}

async function getMostSharedJobs(limit = 10) {
  const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000);
  const grouped = await prisma.shareEvent.groupBy({
    by: ["jobId"],
    where: { sharedAt: { gte: since } },
    _count: { jobId: true },
    orderBy: { _count: { jobId: "desc" } },
    take: limit,
  });
  const jobs = await prisma.job.findMany({
    where: { id: { in: grouped.map((g) => g.jobId) } },
    select: { id: true, title: true, slug: true },
  });
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  return grouped
    .map((g) => ({ job: jobById.get(g.jobId), count: g._count.jobId }))
    .filter((r): r is { job: NonNullable<typeof r.job>; count: number } => Boolean(r.job));
}

async function getMostSearchedKeywords(limit = 10) {
  const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000);
  return prisma.searchQuery.groupBy({
    by: ["query"],
    where: { searchedAt: { gte: since } },
    _count: { query: true },
    orderBy: { _count: { query: "desc" } },
    take: limit,
  });
}

export default async function AnalyticsPage() {
  const [mostViewed, mostShared, mostSearched] = await Promise.all([
    getMostViewedJobs(),
    getMostSharedJobs(),
    getMostSearchedKeywords(),
  ]);

  return (
    <div>
      <h1>Analytics</h1>
      <p className="page-subtitle">
        First-party tracking only (Section 9 — no external analytics integration). Last {SINCE_DAYS}{" "}
        days. &ldquo;Most bookmarked&rdquo; isn&apos;t shown — bookmarking needs a logged-in user,
        and there&apos;s no auth system until Phase 14, so no bookmark can exist to count yet.
      </p>

      <div style={{ display: "grid", gap: "2rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <AnalyticsTable
          title="Most viewed jobs"
          rows={mostViewed.map((r) => ({ label: r.job.title, value: r.count }))}
        />
        <AnalyticsTable
          title="Most shared jobs"
          rows={mostShared.map((r) => ({ label: r.job.title, value: r.count }))}
        />
        <AnalyticsTable
          title="Most searched keywords"
          rows={mostSearched.map((r) => ({ label: r.query, value: r._count.query }))}
        />
      </div>
    </div>
  );
}

function AnalyticsTable({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  return (
    <section>
      <h2 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.75rem" }}>{title}</h2>
      {rows.length === 0 ? (
        <div className="empty-state">No data yet.</div>
      ) : (
        <table>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{row.label}</td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
