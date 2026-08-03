// Section 6: SSR/SSG-friendly data access for the public site. Every
// query here goes through the bounded pagination helper (lib/pagination.ts)
// per Section 10 — no unbounded list queries.
//
// NOT RUN in this sandbox — needs the generated Prisma client, which
// this sandbox's egress restrictions block (see CLAUDE.md). Written
// correctly for a working environment; verify with
// `pnpm --filter @govjobpulse/web dev` against a seeded database.

import { prisma, JobStatus } from "@govjobpulse/database";
import { clampPageSize } from "./pagination";

const JOB_LIST_INCLUDE = {
  organization: true,
  category: true,
  states: { include: { state: true } },
} as const;

export async function getPublishedJobs(params: {
  skip: number;
  take: number;
  categorySlug?: string;
  stateSlug?: string;
  qualification?: string;
}) {
  const take = clampPageSize(params.take);

  const where = {
    status: JobStatus.PUBLISHED,
    ...(params.categorySlug ? { category: { slug: params.categorySlug } } : {}),
    ...(params.stateSlug ? { states: { some: { state: { slug: params.stateSlug } } } } : {}),
    ...(params.qualification ? { qualifications: { has: params.qualification as any } } : {}),
  };

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: JOB_LIST_INCLUDE,
      orderBy: { publishedAt: "desc" },
      skip: params.skip,
      take,
    }),
    prisma.job.count({ where }),
  ]);

  return { jobs, total };
}

export async function getJobBySlug(slug: string) {
  return prisma.job.findUnique({
    where: { slug },
    include: {
      organization: true,
      category: true,
      source: true,
      states: { include: { state: true } },
    },
  });
}

// Section 6: related jobs (internal linking) — same category, excluding
// the current job, bounded to a small fixed count (this is a "more like
// this" widget, not a paginated list, so no page param needed here).
export async function getRelatedJobs(categoryId: string, excludeJobId: string) {
  return prisma.job.findMany({
    where: { categoryId, status: JobStatus.PUBLISHED, NOT: { id: excludeJobId } },
    include: JOB_LIST_INCLUDE,
    orderBy: { publishedAt: "desc" },
    take: 6,
  });
}

export async function getCategory(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
}

export async function getState(slug: string) {
  return prisma.state.findUnique({ where: { slug } });
}

export async function getAllCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function getAllStates() {
  return prisma.state.findMany({ orderBy: { name: "asc" } });
}
