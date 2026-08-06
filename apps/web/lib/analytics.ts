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
    take: limit,
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
    take: limit,
  });
}

export async function getMostSharedJobs(sinceDays = 30, limit = 10) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
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
    .map((g) => ({ job: jobById.get(g.jobId), shareCount: g._count.jobId }))
    .filter((r): r is { job: NonNullable<typeof r.job>; shareCount: number } => Boolean(r.job));
}

// "Top categories"/"top states" — now based on real view counts
// (JobView joined through Job), which is a more accurate "top" than
// Phase 7's getPopularCategories() (raw published-job counts, kept as
// a simpler fallback for pages that don't need view-weighted ranking).
export async function getTopCategoriesByViews(sinceDays = 30, limit = 10) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const views = await prisma.jobView.findMany({
    where: { viewedAt: { gte: since } },
    select: { job: { select: { category: { select: { id: true, name: true, slug: true } } } } },
  });

  const counts = new Map<string, { name: string; slug: string; count: number }>();
  for (const v of views) {
    const cat = v.job.category;
    const existing = counts.get(cat.id);
    counts.set(cat.id, { name: cat.name, slug: cat.slug, count: (existing?.count ?? 0) + 1 });
  }

  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export async function getTopStatesByViews(sinceDays = 30, limit = 10) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const views = await prisma.jobView.findMany({
    where: { viewedAt: { gte: since } },
    select: { job: { select: { states: { select: { state: { select: { id: true, name: true, slug: true } } } } } } },
  });

  const counts = new Map<string, { name: string; slug: string; count: number }>();
  for (const v of views) {
    for (const js of v.job.states) {
      const existing = counts.get(js.state.id);
      counts.set(js.state.id, { name: js.state.name, slug: js.state.slug, count: (existing?.count ?? 0) + 1 });
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
