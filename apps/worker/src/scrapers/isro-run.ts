// Scrapers, queues, scheduled jobs. First end-to-end run: ISRO (Phase 3).
//
// TESTED in this sandbox (packages/scraper-core's vitest suite, 21
// tests): HTML parsing logic, duplicate-detection logic, robots.txt
// decision logic — all against fixtures/mocks, no live network needed.
//
// NOT TESTED in this sandbox (see CLAUDE.md's two network limitations):
//   1. The live `fetch()` calls to isro.gov.in — this sandbox's bash/
//      network tools have no general internet egress, only specific
//      package registries. `fetchIsroListing`/`fetchIsroDetail` in
//      scraper-core have not run against the real site from here.
//   2. The `prisma.job.create(...)` / `prisma.scraperLog.create(...)`
//      calls below — packages/database's Prisma client can't be
//      generated in this sandbox (binaries.prisma.sh is blocked).
// Both are ordinary in any environment with normal network access —
// run this file there (or in Claude Code) as the real completion check,
// the same way Phase 2 flagged for its migration.

import { prisma, JobStatus, JobType, ScraperRunStatus } from "@govjobpulse/database";
import {
  checkRobotsAllowed,
  scrapeIsro,
  partitionDuplicates,
  ISRO_SOURCE,
  type ExistingJobKey,
} from "@govjobpulse/scraper-core";

async function ensureIsroSource() {
  return prisma.source.upsert({
    where: { slug: ISRO_SOURCE.slug },
    update: {},
    create: {
      slug: ISRO_SOURCE.slug,
      name: ISRO_SOURCE.name,
      baseUrl: ISRO_SOURCE.baseUrl,
    },
  });
}

async function ensureIsroOrganization() {
  return prisma.organization.upsert({
    where: { name: ISRO_SOURCE.name },
    update: {},
    create: { name: ISRO_SOURCE.name, slug: ISRO_SOURCE.slug, website: ISRO_SOURCE.baseUrl },
  });
}

async function getCentralCategory() {
  const category = await prisma.category.findUnique({ where: { slug: "central" } });
  if (!category) {
    throw new Error(
      "Category 'central' not found — run `pnpm --filter @govjobpulse/database db:seed` first."
    );
  }
  return category;
}

export async function runIsroScraper(): Promise<void> {
  const source = await ensureIsroSource();

  const robotsCheck = await checkRobotsAllowed(ISRO_SOURCE.baseUrl, ISRO_SOURCE.careersPath);
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
    return;
  }

  const startedAt = new Date();
  try {
    const scraped = await scrapeIsro();

    const existingRows = await prisma.job.findMany({
      where: { sourceId: source.id },
      select: { officialNotificationUrl: true, advertisementNumber: true, title: true },
    });
    const existingKeys: ExistingJobKey[] = existingRows;

    const { newJobs, duplicates } = partitionDuplicates(scraped, existingKeys);

    const organization = await ensureIsroOrganization();
    const category = await getCentralCategory();

    for (const job of newJobs) {
      await prisma.job.create({
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
    throw err;
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 200);
}

if (require.main === module) {
  runIsroScraper()
    .then(() => {
      console.log("ISRO scraper run complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("ISRO scraper run failed:", err);
      process.exit(1);
    });
}
