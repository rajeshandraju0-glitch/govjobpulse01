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

