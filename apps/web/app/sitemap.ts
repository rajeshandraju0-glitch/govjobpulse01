import type { MetadataRoute } from "next";
import { prisma, JobStatus } from "@govjobpulse/database";
import { SITE_URL } from "@/lib/site";
import { QUALIFICATION_SLUGS } from "@govjobpulse/types";

export const dynamic = "force-dynamic"; // DB query — render at request time, not build time

// Section 6: "sitemap.xml ... auto-updates on every publish." This is a
// dynamic Next.js route (app/sitemap.ts), not a static file — it queries
// the database on every request/rebuild, so a newly published job is in
// the sitemap the next time it's fetched, with no separate regeneration
// step to remember.
//
// TODO(scale): once the published-job count grows large enough that a
// single sitemap file exceeds the ~50,000-URL / 50MB sitemap protocol
// limit, split this using Next's generateSitemaps() into a proper
// sitemap index instead of one flat file. Not needed yet at this data
// volume, but noted so it isn't a surprise later — flagging this now
// per Section 1 rule 5 (mark shortcuts with a reason) rather than
// silently building something that would break at scale.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, states, jobs] = await Promise.all([
    prisma.category.findMany({ select: { slug: true } }),
    prisma.state.findMany({ select: { slug: true } }),
    prisma.job.findMany({
      where: { status: JobStatus.PUBLISHED },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 45000, // stay under the sitemap protocol's 50,000-URL cap with room for static routes
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: "never", priority: 0.1 },
    ...categories.map((c) => ({
      url: `${SITE_URL}/categories/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...states.map((s) => ({
      url: `${SITE_URL}/states/${s.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...Object.values(QUALIFICATION_SLUGS).map((slug) => ({
      url: `${SITE_URL}/qualifications/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];

  const jobRoutes: MetadataRoute.Sitemap = jobs.map((job) => ({
    url: `${SITE_URL}/jobs/${job.slug}`,
    lastModified: job.updatedAt,
    changeFrequency: "daily",
    priority: 0.9,
  }));

  return [...staticRoutes, ...jobRoutes];
}
