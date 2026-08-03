// First end-to-end scraper per Section 4: "write at least one scraper
// end-to-end (pick the simplest official source) before generalizing the
// abstraction." ISRO's Careers page (isro.gov.in/Careers.html) links out
// to per-notice detail pages that use a consistent bilingual label/value
// table (Advertisement Number, Advertisement Date, Last Date for
// Submission, ISRO Centre, Area of Work, Location), which is unusually
// clean for a government site — a good first source.
//
// KNOWN LIMITATION (see CLAUDE.md): the parsing selectors below are
// written against fixture HTML reconstructed from what this sandbox's
// tools could observe (Markdown-converted page content, not raw HTML —
// this sandbox has no general internet egress for the bash/network
// tools that would let a real HTTP client fetch the live page). They
// have NOT been validated against the actual live DOM. Before this
// scraper runs against production, re-verify the CSS selectors below
// against real raw HTML fetched by the worker's own HTTP client.

import * as cheerio from "cheerio";
import type { ScrapedJob } from "@govjobpulse/types";

export const ISRO_SOURCE = {
  slug: "isro",
  name: "Indian Space Research Organisation (ISRO)",
  baseUrl: "https://www.isro.gov.in",
  careersPath: "/Careers.html",
} as const;

export interface IsroListingItem {
  title: string;
  detailUrl: string;
}

/**
 * Parses the Careers.html "Recruitment Notice" table into a list of
 * {title, detailUrl} pairs. Deliberately pattern-based (any link whose
 * text mentions "Advt"/"ADVT"/"Recruitment"/"Advertisement" inside the
 * recruitment-notice table) rather than relying on brittle positional
 * selectors, since exact class names on the live page are unverified —
 * see the KNOWN LIMITATION note above.
 */
export function parseListingHtml(html: string): IsroListingItem[] {
  const $ = cheerio.load(html);
  const items: IsroListingItem[] = [];
  const seen = new Set<string>();

  $("#recruitment-notice a, .recruitment-notice a, table a").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (!href || !text) return;
    if (!/advt|advertisement|recruitment/i.test(text)) return;
    if (seen.has(href)) return;
    seen.add(href);
    items.push({ title: text, detailUrl: href });
  });

  return items;
}

export interface IsroDetailFields {
  advertisementNumber: string | null;
  advertisementDate: Date | null;
  lastDate: Date | null;
  isroCentre: string | null;
  areaOfWork: string | null;
  location: string | null;
  notificationPdfUrl: string | null;
  applyUrl: string | null;
}

// Bilingual cells look like "विज्ञापन संख्‍या / Advertisement Number" —
// we match on the English half after the last "/", case-insensitively,
// so this doesn't depend on exact Devanagari text.
const LABEL_PATTERNS: Record<keyof Omit<IsroDetailFields, "notificationPdfUrl" | "applyUrl">, RegExp> = {
  advertisementNumber: /advertisement\s*number/i,
  advertisementDate: /advertisement\s*date/i,
  lastDate: /last\s*date\s*for\s*submission/i,
  isroCentre: /isro\s*centre/i,
  areaOfWork: /area\s*of\s*work/i,
  location: /location/i,
};

function parseIndianDate(raw: string): Date | null {
  // Observed format: "June 27, 2026" — native Date parsing handles this
  // format reliably; guard against garbage input producing Invalid Date.
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDetailHtml(html: string): IsroDetailFields {
  const $ = cheerio.load(html);
  const fields: IsroDetailFields = {
    advertisementNumber: null,
    advertisementDate: null,
    lastDate: null,
    isroCentre: null,
    areaOfWork: null,
    location: null,
    notificationPdfUrl: null,
    applyUrl: null,
  };

  // Label/value pairs sit in adjacent table cells: a <strong>/<b> or bold
  // label cell followed by a value cell. Walk every cell; if its text
  // matches a known label pattern, take the *next* cell's text as the
  // value.
  const cells = $("table td, table th").toArray();
  for (let i = 0; i < cells.length; i++) {
    const labelText = $(cells[i]).text().trim();
    const valueCell = cells[i + 1];
    if (!valueCell) continue;
    const valueText = $(valueCell).text().trim();
    if (!valueText) continue;

    for (const [field, pattern] of Object.entries(LABEL_PATTERNS) as [
      keyof typeof LABEL_PATTERNS,
      RegExp
    ][]) {
      if (pattern.test(labelText) && !fields[field]) {
        if (field === "advertisementDate" || field === "lastDate") {
          fields[field] = parseIndianDate(valueText);
        } else {
          fields[field] = valueText;
        }
      }
    }
  }

  // Notification PDF: first link whose href ends in .pdf.
  const pdfLink = $('a[href$=".pdf"]').first().attr("href");
  if (pdfLink) fields.notificationPdfUrl = pdfLink;

  // Apply link: the brief's pages state it as plain text, e.g.
  // "Direct link to the advertisement is: https://...". Extract the
  // first http(s) URL following that phrase; fall back to any link
  // whose href host isn't isro.gov.in (external application portals).
  const bodyText = $("body").text();
  const directLinkMatch = bodyText.match(/direct link[^:]*:\s*(https?:\/\/\S+)/i);
  if (directLinkMatch && directLinkMatch[1]) {
    fields.applyUrl = directLinkMatch[1].replace(/[).]+$/, "");
  } else {
    $("a[href^='http']").each((_, el) => {
      if (fields.applyUrl) return;
      const href = $(el).attr("href")!;
      if (!href.includes("isro.gov.in")) fields.applyUrl = href;
    });
  }

  return fields;
}

/**
 * Maps a parsed detail page + its listing title into the normalized
 * ScrapedJob DTO. Fields the source doesn't reliably expose (vacancies,
 * qualification, salary, selection process, application fee) are left
 * for the human reviewer per Section 4's moderation gate — this is not
 * a gap to "fix" by guessing, it's the intended handoff point.
 */
export function toScrapedJob(
  listingTitle: string,
  detailUrl: string,
  detail: IsroDetailFields
): ScrapedJob {
  return {
    title: detail.areaOfWork ?? listingTitle,
    departmentRaw: detail.isroCentre ?? "ISRO",
    organizationRaw: ISRO_SOURCE.name,
    advertisementNumber: detail.advertisementNumber,
    vacancies: null,
    applicationStart: detail.advertisementDate,
    applicationEnd: detail.lastDate,
    officialNotificationUrl: detailUrl,
    officialApplyUrl: detail.applyUrl ?? detail.notificationPdfUrl,
    officialWebsite: ISRO_SOURCE.baseUrl,
    description: listingTitle,
    sourceSlug: ISRO_SOURCE.slug,
  };
}

// --- Network wrappers (untested in this sandbox — see CLAUDE.md) ---

export async function fetchIsroListing(
  fetchImpl: typeof fetch = fetch
): Promise<IsroListingItem[]> {
  const url = new URL(ISRO_SOURCE.careersPath, ISRO_SOURCE.baseUrl).toString();
  const res = await fetchImpl(url, { headers: { "User-Agent": "GovJobPulseBot" } });
  if (!res.ok) throw new Error(`Failed to fetch ISRO careers listing: HTTP ${res.status}`);
  return parseListingHtml(await res.text());
}

export async function fetchIsroDetail(
  detailUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<IsroDetailFields> {
  const url = new URL(detailUrl, ISRO_SOURCE.baseUrl).toString();
  const res = await fetchImpl(url, { headers: { "User-Agent": "GovJobPulseBot" } });
  if (!res.ok) throw new Error(`Failed to fetch ISRO detail page ${url}: HTTP ${res.status}`);
  return parseDetailHtml(await res.text());
}

/**
 * Full scrape: listing -> each detail page -> normalized ScrapedJob[].
 * Does NOT check robots.txt itself — the worker orchestrator is
 * responsible for calling checkRobotsAllowed() first per source and
 * skipping the run entirely if disallowed (see packages/scraper-core's
 * robots.ts and apps/worker's per-source runner).
 */
export async function scrapeIsro(fetchImpl: typeof fetch = fetch): Promise<ScrapedJob[]> {
  const listing = await fetchIsroListing(fetchImpl);
  const jobs: ScrapedJob[] = [];
  for (const item of listing) {
    const detail = await fetchIsroDetail(item.detailUrl, fetchImpl);
    jobs.push(toScrapedJob(item.title, item.detailUrl, detail));
  }
  return jobs;
}
