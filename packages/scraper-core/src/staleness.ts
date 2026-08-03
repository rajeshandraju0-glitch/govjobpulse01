// Section 4: "Admin panel exposes per-source last successful run and
// staleness, not just pass/fail logs — a source silently failing for a
// week should be visible at a glance."
//
// Pure function over plain data (no Prisma import here) so it's
// unit-testable without a database, and so apps/admin can import it
// without pulling scraper-core's fetch-heavy source modules into a
// Next.js server component bundle unnecessarily.

import type { SourceStaleness, StalenessLevel } from "@govjobpulse/types";

export interface ScraperLogLike {
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  startedAt: Date;
  finishedAt: Date | null;
}

export interface SourceLike {
  slug: string;
  name: string;
}

// Thresholds: the scheduler runs every 30 minutes (Section 4), so a
// healthy source should have a success within the last couple of hours
// even accounting for a missed run or two. Past 24h with no success is
// "stale" — the "silently failing for a week" case the brief calls out
// explicitly should never get this far before someone notices.
const WARNING_THRESHOLD_HOURS = 2;
const STALE_THRESHOLD_HOURS = 24;

function levelFor(hoursSinceLastSuccess: number | null): StalenessLevel {
  if (hoursSinceLastSuccess === null) return "never_run";
  if (hoursSinceLastSuccess <= WARNING_THRESHOLD_HOURS) return "fresh";
  if (hoursSinceLastSuccess <= STALE_THRESHOLD_HOURS) return "warning";
  return "stale";
}

/**
 * Computes staleness for a single source given its full log history
 * (or at least a recent window of it — callers should query with a
 * reasonable `take`/date-range limit, not the entire table, per
 * Section 10's pagination requirement).
 */
export function computeSourceStaleness(
  source: SourceLike,
  logs: ScraperLogLike[],
  now: Date = new Date()
): SourceStaleness {
  const sorted = [...logs].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const lastRun = sorted[0] ?? null;
  const lastSuccess = sorted.find((l) => l.status === "SUCCESS") ?? null;

  const hoursSinceLastSuccess = lastSuccess
    ? (now.getTime() - lastSuccess.startedAt.getTime()) / (1000 * 60 * 60)
    : null;

  return {
    sourceSlug: source.slug,
    sourceName: source.name,
    lastSuccessAt: lastSuccess?.startedAt ?? null,
    lastRunAt: lastRun?.startedAt ?? null,
    lastRunStatus: lastRun?.status ?? null,
    hoursSinceLastSuccess,
    level: levelFor(hoursSinceLastSuccess),
  };
}

export function computeAllStaleness(
  sources: SourceLike[],
  logsBySourceSlug: Map<string, ScraperLogLike[]>,
  now: Date = new Date()
): SourceStaleness[] {
  return sources.map((s) => computeSourceStaleness(s, logsBySourceSlug.get(s.slug) ?? [], now));
}
