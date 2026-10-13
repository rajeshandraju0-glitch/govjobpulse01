// Browser-safe: SEO title/description generators.
export interface SeoJobFields {
  title: string;
  organizationName: string;
  vacancies: number | null;
  applicationEnd: Date | null;
}

export function generateSeoTitle(job: SeoJobFields): string {
  const year = job.applicationEnd?.getFullYear() ?? new Date().getFullYear();
  return `${job.title} — ${job.organizationName} Recruitment ${year}`;
}

export function generateSeoDescription(job: SeoJobFields): string {
  const MAX_LENGTH = 160;
  const core = `${job.organizationName}: ${job.title}.`;
  const verified = "Verified against the official notification.";
  const optional: string[] = [];
  if (job.vacancies !== null) optional.push(`${job.vacancies.toLocaleString("en-IN")} vacancies.`);
  if (job.applicationEnd) optional.push(`Last date to apply: ${job.applicationEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}.`);

  let result = core;
  for (const sentence of optional) {
    const candidate = `${result} ${sentence}`;
    if ((candidate + " " + verified).length <= MAX_LENGTH) result = candidate;
  }
  const withVerified = `${result} ${verified}`;
  if (withVerified.length <= MAX_LENGTH) return withVerified;
  const room = MAX_LENGTH - verified.length - 4;
  return `${core.slice(0, room)}... ${verified}`;
}
