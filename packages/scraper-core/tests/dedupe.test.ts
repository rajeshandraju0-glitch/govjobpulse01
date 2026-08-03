import { describe, it, expect } from "vitest";
import { isDuplicate, partitionDuplicates, type ExistingJobKey } from "../src/dedupe";
import type { ScrapedJob } from "@govjobpulse/types";

function makeJob(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return {
    title: "Recruitment to the post of Technician B",
    departmentRaw: "ISTRAC",
    organizationRaw: "ISRO",
    advertisementNumber: "ISTRAC:02:2026",
    vacancies: null,
    applicationStart: null,
    applicationEnd: null,
    officialNotificationUrl: "/ISTRACRecruitment4.html",
    officialApplyUrl: null,
    officialWebsite: "https://www.isro.gov.in",
    description: "desc",
    sourceSlug: "isro",
    ...overrides,
  };
}

describe("isDuplicate", () => {
  it("flags a match on officialNotificationUrl", () => {
    const existing: ExistingJobKey[] = [
      { officialNotificationUrl: "/ISTRACRecruitment4.html", advertisementNumber: null, title: "different title" },
    ];
    expect(isDuplicate(makeJob(), existing)).toBe(true);
  });

  it("flags a match on advertisementNumber even if URL/title differ", () => {
    const existing: ExistingJobKey[] = [
      {
        officialNotificationUrl: "/some-other-url.html",
        advertisementNumber: "ISTRAC:02:2026",
        title: "a totally different title",
      },
    ];
    expect(isDuplicate(makeJob(), existing)).toBe(true);
  });

  it("flags a match on normalized title even with different punctuation/case", () => {
    const existing: ExistingJobKey[] = [
      {
        officialNotificationUrl: "/different-url.html",
        advertisementNumber: "SOME:OTHER:NUMBER",
        title: "RECRUITMENT TO THE POST OF TECHNICIAN, B!!",
      },
    ];
    expect(isDuplicate(makeJob(), existing)).toBe(true);
  });

  it("does not flag genuinely distinct jobs", () => {
    const existing: ExistingJobKey[] = [
      {
        officialNotificationUrl: "/URSCRecruitment12.html",
        advertisementNumber: "URSC:03:2026",
        title: "Graduate and Diploma Apprentices at URSC",
      },
    ];
    expect(isDuplicate(makeJob(), existing)).toBe(false);
  });

  it("does not false-positive on null advertisementNumber matching null", () => {
    const existing: ExistingJobKey[] = [
      { officialNotificationUrl: "/other.html", advertisementNumber: null, title: "totally different job title" },
    ];
    expect(isDuplicate(makeJob({ advertisementNumber: null }), existing)).toBe(false);
  });
});

describe("partitionDuplicates", () => {
  it("splits candidates into new vs. duplicate", () => {
    const existing: ExistingJobKey[] = [
      { officialNotificationUrl: "/ISTRACRecruitment4.html", advertisementNumber: null, title: "x" },
    ];
    const candidates = [makeJob(), makeJob({ officialNotificationUrl: "/brand-new.html", advertisementNumber: "NEW:1:2026", title: "Brand new posting" })];

    const { newJobs, duplicates } = partitionDuplicates(candidates, existing);
    expect(duplicates).toHaveLength(1);
    expect(newJobs).toHaveLength(1);
    expect(newJobs[0]?.officialNotificationUrl).toBe("/brand-new.html");
  });
});
