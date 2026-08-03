import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseListingHtml, parseDetailHtml, toScrapedJob } from "../src/sources/isro";

const fixturesDir = join(__dirname, "fixtures");
const listingHtml = readFileSync(join(fixturesDir, "isro-careers-listing.html"), "utf-8");
const detailHtml = readFileSync(join(fixturesDir, "isro-detail-istrac.html"), "utf-8");

describe("parseListingHtml", () => {
  it("extracts recruitment notice links, ignoring non-recruitment links", () => {
    const items = parseListingHtml(listingHtml);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.detailUrl)).toEqual([
      "/NRSCRecruitment2026_1.html",
      "/URSCRecruitment12.html",
      "/ISTRACRecruitment4.html",
    ]);
  });

  it("does not include the 'Click here to view centre wise' link", () => {
    const items = parseListingHtml(listingHtml);
    expect(items.some((i) => i.detailUrl === "#")).toBe(false);
  });

  it("preserves the full notice text as title", () => {
    const items = parseListingHtml(listingHtml);
    const istrac = items.find((i) => i.detailUrl === "/ISTRACRecruitment4.html");
    expect(istrac?.title).toContain("ISTRAC:02:2026");
    expect(istrac?.title).toContain("Technician 'B'");
  });
});

describe("parseDetailHtml", () => {
  const fields = parseDetailHtml(detailHtml);

  it("extracts the advertisement number", () => {
    expect(fields.advertisementNumber).toBe("ISTRAC:02:2026");
  });

  it("extracts and parses the advertisement date", () => {
    expect(fields.advertisementDate).toBeInstanceOf(Date);
    expect(fields.advertisementDate?.getFullYear()).toBe(2026);
    expect(fields.advertisementDate?.getMonth()).toBe(5); // June = 5
    expect(fields.advertisementDate?.getDate()).toBe(27);
  });

  it("extracts and parses the last date for submission", () => {
    expect(fields.lastDate).toBeInstanceOf(Date);
    expect(fields.lastDate?.getMonth()).toBe(6); // July = 6
    expect(fields.lastDate?.getDate()).toBe(20);
  });

  it("extracts the ISRO centre (bilingual cell, English half)", () => {
    expect(fields.isroCentre).toContain("ISTRAC");
    expect(fields.isroCentre).toContain("ISRO Telemetry, Tracking and Command Network");
  });

  it("extracts the area of work", () => {
    expect(fields.areaOfWork).toContain("Technician 'B'");
    expect(fields.areaOfWork).toContain("Cook 'A'");
  });

  it("extracts the notification PDF link", () => {
    expect(fields.notificationPdfUrl).toMatch(/ISTRAC_BILINGUAL_ADVERTISEMENT.*\.pdf$/);
  });

  it("extracts the direct apply link from the 'Direct link to the advertisement is:' text", () => {
    expect(fields.applyUrl).toBe("https://cdn.digialm.com/EForms/configuredHtml/1258/96897/Index.html");
  });
});

describe("toScrapedJob", () => {
  it("maps parsed detail fields into a ScrapedJob DTO", () => {
    const fields = parseDetailHtml(detailHtml);
    const job = toScrapedJob(
      "Advt No. ISTRAC:02:2026 dated 27.06.2026 - Recruitment to the posts of Technician 'B'...",
      "/ISTRACRecruitment4.html",
      fields
    );

    expect(job.title).toContain("Technician 'B'");
    expect(job.departmentRaw).toContain("ISTRAC");
    expect(job.advertisementNumber).toBe("ISTRAC:02:2026");
    expect(job.officialNotificationUrl).toBe("/ISTRACRecruitment4.html");
    expect(job.officialApplyUrl).toBe("https://cdn.digialm.com/EForms/configuredHtml/1258/96897/Index.html");
    expect(job.sourceSlug).toBe("isro");
    // Fields the source doesn't reliably expose stay null for the human
    // reviewer to fill in — not guessed at.
    expect(job.vacancies).toBeNull();
  });
});
