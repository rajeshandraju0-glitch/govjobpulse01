// Single source of truth for the site's canonical origin. Real deployment
// value comes from an env var; falls back to a placeholder for local/dev
// so nothing crashes when it's unset, but every canonical URL/sitemap/
// JSON-LD entry below routes through this rather than hardcoding a domain
// in multiple places.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.govjobpulse.com";
export const SITE_NAME = "GovJobPulse";

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
