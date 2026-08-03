// Section 4: "Duplicate detection: compare official_notification_url,
// advertisement_number, and title; skip insertion on match."
//
// Pure comparison logic lives here so it's unit-testable without a
// database. The worker orchestrator is expected to load a page of
// "candidate existing rows" (e.g. jobs from the same source scraped in
// the last N days, or a targeted lookup by officialNotificationUrl) and
// call isDuplicate() against each — see apps/worker's TODO for the
// actual Prisma-backed query, which isn't verified in this sandbox (see
// CLAUDE.md's Prisma network limitation).

import type { ScrapedJob } from "@govjobpulse/types";

export interface ExistingJobKey {
  officialNotificationUrl: string;
  advertisementNumber: string | null;
  title: string;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * True if `candidate` matches any `existing` row on any of the three
 * signals Section 4 specifies. Any single match is enough to flag as a
 * duplicate — these are meant to be strong, low-false-positive signals
 * (an exact URL match, an exact advertisement number match, or an exact
 * normalized title match), not a fuzzy/similarity score.
 */
export function isDuplicate(candidate: ScrapedJob, existing: ExistingJobKey[]): boolean {
  const candidateTitle = normalizeTitle(candidate.title);
  return existing.some((row) => {
    if (row.officialNotificationUrl === candidate.officialNotificationUrl) return true;
    if (
      candidate.advertisementNumber &&
      row.advertisementNumber &&
      row.advertisementNumber === candidate.advertisementNumber
    ) {
      return true;
    }
    if (normalizeTitle(row.title) === candidateTitle) return true;
    return false;
  });
}

/**
 * Partitions a batch of scraped jobs into new vs. duplicate, given the
 * existing rows to compare against. Used by the worker to decide what
 * to INSERT vs. skip+count in ScraperLog.jobsSkippedDuplicate.
 */
export function partitionDuplicates(
  candidates: ScrapedJob[],
  existing: ExistingJobKey[]
): { newJobs: ScrapedJob[]; duplicates: ScrapedJob[] } {
  const newJobs: ScrapedJob[] = [];
  const duplicates: ScrapedJob[] = [];
  for (const c of candidates) {
    (isDuplicate(c, existing) ? duplicates : newJobs).push(c);
  }
  return { newJobs, duplicates };
}
