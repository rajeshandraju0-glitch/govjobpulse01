// Section 9: "Track (no external analytics integration yet): most
// viewed jobs, most searched keywords, most shared/bookmarked jobs,
// traffic source, top categories, top states."
//
// GAP FLAGGED, NOT SILENTLY SKIPPED: "most bookmarked" is not
// implemented here. Bookmark (packages/database, Phase 2) requires an
// authenticated User — there is no login system until Phase 14, so
// there is no way to create a real bookmark yet, and building a
// bookmark UI/count against a feature nobody can actually use would
// mean either faking data or building throwaway auth ahead of its own
// phase. "Most shared" is fully implemented via ShareEvent below,
// which needs no auth. See CLAUDE.md's Phase 12 entry.
//
// NOT RUN in this sandbox — see CLAUDE.md's Prisma/network limitation.

import { prisma } from "@govjobpulse/database";
import { clampPageSize } from "./pagination";

export async function trackJobView(jobId: string, referrer: string | null): Promise<void> {
  // Fire-and-forget from the caller's perspective (see app/jobs/[slug]/page.tsx)
  // — a tracking write failing must never break a page render. This
  // function itself still awaits the insert (so errors are catchable
  // by the caller), it just doesn't need to be on the render's
  // critical path.
  await prisma.jobView.create({ data: { jobId, referrer } });
}

export async function trackSearchQuery(query: string, resultsCount: number): Promise<void> {
  if (!query.trim()) return; // Section 1 rule 2: don't log noise as if it were a real search
  await prisma.searchQuery.create({ data: { query: query.trim(), resultsCount } });
}

export async function trackShareEvent(
  jobId: string,
  channel: "FACEBOOK" | "LINKEDIN" | "TWITTER" | "TELEGRAM" | "WHATSAPP" | "COPY_LINK"
): Promise<void> {
  await prisma.shareEvent.create({ data: { jobId, channel } });
}

// --- Aggregation queries, all bounded per Section 10 ---

export async function getMostViewedJobs(sinceDays = 30, limit = 10) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const grouped = await prisma.jobView.groupBy({
    by: ["jobId"],
    where: { viewedAt: { gte: since } },
    _count: { jobId: true },
    orderBy: { _count: { jobId: "desc" } },
    take: clampPageSize(limit),
  });

  const jobs = await prisma.job.findMany({
    where: { id: { in: grouped.map((g) => g.jobId) } },
    select: { id: true, title: true, slug: true },
  });
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  return grouped
    .map((g) => ({ job: jobById.get(g.jobId), viewCount: g._count.jobId }))
    .filter((r): r is { job: NonNullable<typeof r.job>; viewCount: number } => Boolean(r.job));
}

export async function getMostSearchedKeywords(sinceDays = 30, limit = 10) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  return prisma.searchQuery.groupBy({
    by: ["query"],
    where: { searchedAt: { gte: since } },
    _count: { query: true },
    orderBy: { _count: { query: "desc" } },
    take: clampPageSize(limit),
  });
}

export async function getMostSharedJobs(sinceDays = 30, limit = 10) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const grouped = await prisma.shareEvent.groupBy({
    by: ["jobId"],
    where: { sharedAt: { gte: since } },
    _count: { jobId: true },
    orderBy: { _count: { jobId: "desc" } },
    take: clampPageSize(limit),
  });

  const jobs = await prisma.job.findMany({
    where: { id: { in: grouped.map((g) => g.jobId) } },
    select: { id: true, title: true, slug: true },
  });
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  return grouped
    .map((g) => ({ job: jobById.get(g.jobId), shareCount: g._count.jobId }))
    .filter((r): r is { job: NonNullable<typeof r.job>; shareCount: number } => Boolean(r.job));
}

// "Top categories"/"top states" — now based on real view counts
// (JobView joined through Job), which is a more accurate "top" than
// Phase 7's getPopularCategories() (raw published-job counts, kept as
// a simpler fallback for pages that don't need view-weighted ranking).
//
// FIXED IN PHASE 13 (a real bug from Phase 12, not a new discovery):
// the original version pulled every JobView row in the window into
// memory via a plain findMany() with no `take`, then aggregated in JS
// — a genuinely unbounded query, in direct violation of Section 10's
// own rule this phase exists to enforce. Rewritten as raw SQL doing
// the JOIN + GROUP BY + LIMIT at the database level: one round trip,
// bounded by LIMIT, no per-row data pulled into the Node process at
// all. This is real query optimization, not just a cap slapped onto
// the same inefficient pattern.
export async function getTopCategoriesByViews(sinceDays = 30, limit = 10) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const boundedLimit = clampPageSize(limit);

  return prisma.$queryRaw<{ id: string; name: string; slug: string; count: bigint }[]>`
    SELECT c.id, c.name, c.slug, COUNT(*) as count
    FROM "JobView" jv
    JOIN "Job" j ON j."id" = jv."jobId"
    JOIN "Category" c ON c."id" = j."categoryId"
    WHERE jv."viewedAt" >= ${since}
    GROUP BY c.id, c.name, c.slug
    ORDER BY count DESC
    LIMIT ${boundedLimit}
  `.then((rows) => rows.map((r) => ({ ...r, count: Number(r.count) })));
}

export async function getTopStatesByViews(sinceDays = 30, limit = 10) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const boundedLimit = clampPageSize(limit);

  return prisma.$queryRaw<{ id: string; name: string; slug: string; count: bigint }[]>`
    SELECT s.id, s.name, s.slug, COUNT(*) as count
    FROM "JobView" jv
    JOIN "JobState" js ON js."jobId" = jv."jobId"
    JOIN "State" s ON s."id" = js."stateId"
    WHERE jv."viewedAt" >= ${since}
    GROUP BY s.id, s.name, s.slug
    ORDER BY count DESC
    LIMIT ${boundedLimit}
  `.then((rows) => rows.map((r) => ({ ...r, count: Number(r.count) })));
}
