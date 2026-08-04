import { prisma, JobStatus } from "@govjobpulse/database";
import { SITE_URL, SITE_NAME } from "@/lib/site";

// Section 6: "RSS feed." Standard RSS 2.0, latest published jobs —
// bounded to a reasonable recent window (Section 10: no unbounded
// queries) rather than every job ever published.
export async function GET() {
  const jobs = await prisma.job.findMany({
    where: { status: JobStatus.PUBLISHED },
    include: { organization: true },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const items = jobs
    .map(
      (job) => `  <item>
    <title>${escapeXml(job.title)}</title>
    <link>${SITE_URL}/jobs/${job.slug}</link>
    <guid>${SITE_URL}/jobs/${job.slug}</guid>
    <description>${escapeXml(`${job.organization.name} — ${job.department}`)}</description>
    <pubDate>${(job.publishedAt ?? job.createdAt).toUTCString()}</pubDate>
  </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${SITE_NAME} — Latest Government Job Notifications</title>
  <link>${SITE_URL}</link>
  <description>Verified Sarkari Naukri notifications, sourced directly from official government websites.</description>
  <language>en-in</language>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml" },
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
