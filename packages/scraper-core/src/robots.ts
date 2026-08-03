// Section 4 open item: check robots.txt before scraping, per source,
// rather than scraping first and asking later. Implemented as a runtime
// check (not a one-off manual audit) so it's re-verified every scraper
// run — a site can change its robots.txt at any time, and a one-time
// sign-off would go stale silently.
//
// Callers are expected to persist the result onto Source.robotsTxtCheckedAt
// / robotsTxtAllowed / robotsTxtNotes (see packages/database schema) so
// the admin staleness view (Phase 4) can surface a source that started
// disallowing us.

import robotsParser from "robots-parser";

export interface RobotsCheckResult {
  allowed: boolean;
  checkedAt: Date;
  notes: string;
}

const USER_AGENT = "GovJobPulseBot";

export async function checkRobotsAllowed(
  baseUrl: string,
  targetPath: string,
  fetchImpl: typeof fetch = fetch
): Promise<RobotsCheckResult> {
  const robotsUrl = new URL("/robots.txt", baseUrl).toString();
  const checkedAt = new Date();

  let robotsTxt: string;
  try {
    const res = await fetchImpl(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) {
      // No robots.txt (404) is conventionally treated as "everything
      // allowed" per the Robots Exclusion Protocol — but we still record
      // that we checked, and what we found (a non-200 status), so this
      // shows up in the admin staleness/audit view rather than being
      // silently assumed.
      return {
        allowed: true,
        checkedAt,
        notes: `robots.txt returned HTTP ${res.status}; treating as unrestricted per spec, but flagging for human review.`,
      };
    }
    robotsTxt = await res.text();
  } catch (err) {
    // Network failure fetching robots.txt: fail CLOSED, not open. We do
    // not want a transient network blip to be silently interpreted as
    // "scraping is allowed."
    return {
      allowed: false,
      checkedAt,
      notes: `Failed to fetch robots.txt (${(err as Error).message}); failing closed until this is resolved.`,
    };
  }

  const robots = robotsParser(robotsUrl, robotsTxt);
  const targetUrl = new URL(targetPath, baseUrl).toString();
  const allowed = robots.isAllowed(targetUrl, USER_AGENT) ?? true;

  return {
    allowed,
    checkedAt,
    notes: allowed
      ? "robots.txt permits this path for our user agent."
      : `robots.txt disallows ${targetPath} for our user agent — scraper must not proceed.`,
  };
}
