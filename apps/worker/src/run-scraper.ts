// Phase 4: generalized from Phase 3's ISRO-only runner. Works for any
// ScraperModule in the registry — the scheduler (scheduler.ts) loops
// over SCRAPER_REGISTRY and calls runScraperModule() for each, wrapped
// in runWithRetry per Section 4: "Scheduler ... retries failed
// scrapers, logs every execution (start, end, success/fail, error)."
//
// NOT TESTED in this sandbox (see CLAUDE.md's two network limitations,
// same as Phase 3): the live fetch() calls each ScraperModule.run()
// makes, and every prisma.* call below (Prisma client can't be
// generated here — binaries.prisma.sh is blocked). Run this in an
// environment with normal network access as the real completion check.

import { prisma, JobStatus, JobType, ScraperRunStatus } from "@govjobpulse/database";
import { checkRobotsAllowed, runWithRetry, partitionDuplicates, type ExistingJobKey } from "@govjobpulse/scraper-core";
import { eventBus } from "@govjobpulse/shared";
import type { ScraperModule } from "@govjobpulse/types";

export interface RunScraperOptions {
  retries?: number;
  baseDelayMs?: number;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 200);
}

async function ensureSource(module: ScraperModule) {
  return prisma.source.upsert({
    where: { slug: module.source.slug },
    update: {},
    create: {
      slug: module.source.slug,
      name: module.source.name,
      baseUrl: module.source.baseUrl,
    },
  });
}

async function getDefaultCategory(module: ScraperModule) {
  const category = await prisma.category.findUnique({
    where: { slug: module.source.defaultCategorySlug },
  });
  if (!category) {
    throw new Error(
      `Category '${module.source.defaultCategorySlug}' not found for source '${module.source.slug}' — run \`pnpm --filter @govjobpulse/database db:seed\` first.`
    );
  }
  return category;
}

/**
 * Runs a single scraper end-to-end: robots check -> scrape -> dedupe ->
 * create DRAFT jobs -> ScraperLog. Retries the scrape step (not the
 * robots check) on failure, per Section 4.
 */
export async function runScraperModule(
  module: ScraperModule,
  options: RunScraperOptions = {}
): Promise<void> {
  const { retries = 2, baseDelayMs = 5000 } = options;
  const source = await ensureSource(module);

  const robotsCheck = await checkRobotsAllowed(module.source.baseUrl, module.robotsCheckPath);
  await prisma.source.update({
    where: { id: source.id },
    data: {
      robotsTxtCheckedAt: robotsCheck.checkedAt,
      robotsTxtAllowed: robotsCheck.allowed,
      robotsTxtNotes: robotsCheck.notes,
    },
  });

  if (!robotsCheck.allowed) {
    await prisma.scraperLog.create({
      data: {
        sourceId: source.id,
        status: ScraperRunStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: `robots.txt disallows scraping: ${robotsCheck.notes}`,
      },
    });
    eventBus.emit("ScraperFailed", {
      sourceSlug: module.source.slug,
      errorMessage: `robots.txt disallows scraping: ${robotsCheck.notes}`,
    });
    return;
  }

  const startedAt = new Date();
  try {
    const scraped = await runWithRetry(() => module.run(), {
      retries,
      baseDelayMs,
      onRetry: (attempt, err) =>
        console.warn(
          `[${module.source.slug}] scrape attempt ${attempt} failed, retrying: ${(err as Error).message}`
        ),
    });

    const existingRows = await prisma.job.findMany({
      where: { sourceId: source.id },
      select: { officialNotificationUrl: true, advertisementNumber: true, title: true },
    });
    const existingKeys: ExistingJobKey[] = existingRows;

    const { newJobs, duplicates } = partitionDuplicates(scraped, existingKeys);
    const category = await getDefaultCategory(module);

    for (const job of newJobs) {
      const organization = await prisma.organization.upsert({
        where: { name: job.organizationRaw },
        update: {},
        create: {
          name: job.organizationRaw,
          slug: slugify(job.organizationRaw),
          website: job.officialWebsite,
        },
      });

      const created = await prisma.job.create({
        data: {
          title: job.title,
          slug: slugify(`${job.title}-${job.advertisementNumber ?? Date.now()}`),
          department: job.departmentRaw,
          organizationId: organization.id,
          advertisementNumber: job.advertisementNumber,
          categoryId: category.id,
          jobType: JobType.FULL_TIME,
          officialNotificationUrl: job.officialNotificationUrl,
          officialApplyUrl: job.officialApplyUrl,
          officialWebsite: job.officialWebsite,
          description: job.description,
          applicationStart: job.applicationStart,
          applicationEnd: job.applicationEnd,
          status: JobStatus.DRAFT,
          sourceId: source.id,
        },
      });

      // Section 5: JobCreated fires here — a real insert, not a
      // placeholder wiring. Note this fires on every scraped DRAFT, not
      // on publish (that's JobPublished, still TODO below — it has no
      // trigger yet since the moderation UI that promotes
      // draft -> reviewed -> published doesn't exist until Phase 9).
      eventBus.emit("JobCreated", {
        jobId: created.id,
        slug: created.slug,
        sourceSlug: module.source.slug,
      });
    }

    await prisma.scraperLog.create({
      data: {
        sourceId: source.id,
        status: ScraperRunStatus.SUCCESS,
        startedAt,
        finishedAt: new Date(),
        jobsCreated: newJobs.length,
        jobsSkippedDuplicate: duplicates.length,
      },
    });

    eventBus.emit("ScraperCompleted", {
      sourceSlug: module.source.slug,
      jobsCreated: newJobs.length,
      jobsSkippedDuplicate: duplicates.length,
      durationMs: Date.now() - startedAt.getTime(),
    });
  } catch (err) {
    await prisma.scraperLog.create({
      data: {
        sourceId: source.id,
        status: ScraperRunStatus.FAILED,
        startedAt,
        finishedAt: new Date(),
        errorMessage: (err as Error).message,
      },
    });

    eventBus.emit("ScraperFailed", {
      sourceSlug: module.source.slug,
      errorMessage: (err as Error).message,
    });
    // Deliberately not re-thrown: one source failing (after exhausting
    // retries) must not crash the scheduler or block other sources' runs
    // in the same tick. The ScraperLog row is the record of the failure;
    // the admin staleness view is how a human finds out.
  }
}
