import { prisma, JobStatus } from "@govjobpulse/database";
import { SITE_URL, SITE_NAME } from "@/lib/site";

// Section 6: "news sitemap." Distinct from the regular sitemap.xml —
// Google News Sitemap format only wants recently-published items (the
// spec's own convention is roughly the last 48 hours; older items
// should already be indexed via the regular sitemap and don't belong
// here). Government job notifications are genuinely time-sensitive in
// the way news is, which is why Section 6 calls this out as its own
// requirement rather than folding it into the general sitemap.
export async function GET() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const recentJobs = await prisma.job.findMany({
    where: { status: JobStatus.PUBLISHED, publishedAt: { gte: cutoff } },
    select: { slug: true, title: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 1000, // News sitemap protocol caps at 1,000 URLs per file
  });

  const urlEntries = recentJobs
    .map(
      (job) => `  <url>
    <loc>${SITE_URL}/jobs/${job.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>${SITE_NAME}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${job.publishedAt?.toISOString()}</news:publication_date>
      <news:title>${escapeXml(job.title)}</news:title>
    </news:news>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urlEntries}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
