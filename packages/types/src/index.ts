// GovJobPulse shared types.

// The normalized shape every per-source scraper (Section 4) produces,
// before it's mapped into a Prisma Job.create() input. Deliberately
// looser/more nullable than the Job model — scraper extraction is
// imperfect by nature, and unfilled fields are exactly what the human
// reviewer (draft -> reviewed) is supposed to fill in, per Section 4's
// moderation gate. This is the DTO scraper-core exports; database-shaped
// mapping happens in the worker app, which is the only place that
// imports @govjobpulse/database.
export interface ScrapedJob {
  title: string;
  departmentRaw: string;
  organizationRaw: string;
  advertisementNumber: string | null;
  vacancies: number | null;
  applicationStart: Date | null;
  applicationEnd: Date | null;
  officialNotificationUrl: string;
  officialApplyUrl: string | null;
  officialWebsite: string;
  description: string;
  sourceSlug: string;
}

// Phase 4: the general interface every per-source scraper implements,
// now that ISRO (Phase 3) proved the shape out. New sources register a
// module matching this shape rather than the worker special-casing each
// one — see packages/scraper-core/src/registry.ts.
export interface ScraperSourceMeta {
  slug: string;
  name: string;
  baseUrl: string;
  /**
   * Best-guess Category.slug for jobs from this source (e.g. "central"
   * for a central government body). Jobs are still created as DRAFT per
   * Section 4's moderation gate, so a wrong guess here is corrected by
   * the human reviewer before publish — this just avoids leaving every
   * scraped job with no category at all pending review.
   */
  defaultCategorySlug: string;
}

export interface ScraperModule {
  source: ScraperSourceMeta;
  /** Path checked against robots.txt — usually the listing page path. */
  robotsCheckPath: string;
  run(fetchImpl?: typeof fetch): Promise<ScrapedJob[]>;
}

// Phase 4: per-source staleness for the admin view (Section 4: "Admin
// panel exposes per-source last successful run and staleness, not just
// pass/fail logs"). Pure data shape — computed by
// packages/scraper-core/src/staleness.ts from ScraperLog rows, rendered
// by apps/admin.
export type StalenessLevel = "fresh" | "warning" | "stale" | "never_run";

export interface SourceStaleness {
  sourceSlug: string;
  sourceName: string;
  lastSuccessAt: Date | null;
  lastRunAt: Date | null;
  lastRunStatus: "SUCCESS" | "FAILED" | "PARTIAL" | null;
  hoursSinceLastSuccess: number | null;
  level: StalenessLevel;
}

// Human-readable slugs for QualificationLevel (Prisma enum, generated
// separately in packages/database) — used to build qualification pages
// (Section 3) without introducing a Qualification database table, which
// Section 3 doesn't list as a supporting table. Kept here rather than in
// packages/database so apps that don't depend on Prisma (or can't
// generate it, per this sandbox's known limitation) can still import
// the mapping.
export const QUALIFICATION_SLUGS: Record<string, string> = {
  TENTH: "10th",
  TWELFTH: "12th",
  ITI: "iti",
  DIPLOMA: "diploma",
  GRADUATE: "graduate",
  POST_GRADUATE: "pg",
  B_TECH: "b-tech",
  M_TECH: "m-tech",
  MBA: "mba",
  LLB: "llb",
  MBBS: "mbbs",
  PHD: "phd",
};

export const QUALIFICATION_LABELS: Record<string, string> = {
  TENTH: "10th Pass",
  TWELFTH: "12th Pass",
  ITI: "ITI",
  DIPLOMA: "Diploma",
  GRADUATE: "Graduate",
  POST_GRADUATE: "Post Graduate",
  B_TECH: "B.Tech",
  M_TECH: "M.Tech",
  MBA: "MBA",
  LLB: "LLB",
  MBBS: "MBBS",
  PHD: "PhD",
};

export function qualificationSlugToEnum(slug: string): string | undefined {
  return Object.entries(QUALIFICATION_SLUGS).find(([, s]) => s === slug)?.[0];
}



