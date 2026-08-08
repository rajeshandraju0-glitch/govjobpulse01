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

// Section 10: XSS mitigation for JSON-LD <script> tags. JSON.stringify()
// does NOT escape "</script>" or other HTML-significant sequences — a
// string value containing e.g. "</script><script>evil()</script>"
// would break out of the intended <script type="application/ld+json">
// tag and execute as HTML/JS. This matters concretely here (not just
// in theory) because JobPostingJsonLd renders scraped job titles and
// descriptions — untrusted input from external government sites, not
// content this codebase authored. Standard mitigation: escape the
// characters that terminate/open HTML tags before they reach
// dangerouslySetInnerHTML. Every JSON-LD component uses this instead
// of raw JSON.stringify().
export function safeJsonLdStringify(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
