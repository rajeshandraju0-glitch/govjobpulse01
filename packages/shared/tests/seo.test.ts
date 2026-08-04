import { describe, it, expect } from "vitest";
import { generateSeoTitle, generateSeoDescription, type SeoJobFields } from "../src/index";

function makeJob(overrides: Partial<SeoJobFields> = {}): SeoJobFields {
  return {
    title: "Recruitment to the post of Technician 'B'",
    organizationName: "Indian Space Research Organisation (ISRO)",
    vacancies: 42,
    applicationEnd: new Date("2026-07-20"),
    ...overrides,
  };
}

describe("generateSeoTitle", () => {
  it("includes the job title, organization, and application-end year", () => {
    const title = generateSeoTitle(makeJob());
    expect(title).toContain("Technician 'B'");
    expect(title).toContain("Indian Space Research Organisation (ISRO)");
    expect(title).toContain("2026");
  });

  it("falls back to the current year when applicationEnd is null", () => {
    const title = generateSeoTitle(makeJob({ applicationEnd: null }));
    expect(title).toContain(String(new Date().getFullYear()));
  });
});

describe("generateSeoDescription", () => {
  it("mentions the organization, title, vacancy count, and last date when they all fit", () => {
    const description = generateSeoDescription(
      makeJob({ title: "Technician 'B' Recruitment", organizationName: "ISRO" })
    );
    expect(description).toContain("ISRO");
    expect(description).toContain("42");
    expect(description).toMatch(/Last date to apply/);
    expect(description).toMatch(/Verified against the official notification/);
  });

  it("drops the least important detail (last date) before the trust signal, when space is tight", () => {
    // A long organization name + title leaves no room for every optional
    // sentence — the function should keep "verified" and drop the least
    // essential detail (last date) rather than exceed the length cap or
    // silently drop the trust signal.
    const description = generateSeoDescription(
      makeJob({
        title: "Recruitment to the post of Technician 'B'",
        organizationName: "Indian Space Research Organisation (ISRO)",
      })
    );
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toMatch(/Verified against the official notification/);
  });

  it("omits the vacancy sentence when vacancies is null — never fabricates a number", () => {
    const description = generateSeoDescription(makeJob({ vacancies: null }));
    expect(description).not.toMatch(/\d+ vacancies/);
  });

  it("omits the last-date sentence when applicationEnd is null", () => {
    const description = generateSeoDescription(makeJob({ applicationEnd: null }));
    expect(description).not.toMatch(/Last date to apply/);
  });

  it("stays within Google's practical meta-description length even for a very long title", () => {
    const description = generateSeoDescription(
      makeJob({
        title: "Recruitment to the posts of Technician 'B', Draughtsman 'B', Technical Assistant, Scientific Assistant, Library Assistant 'A' and Cook 'A'",
      })
    );
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toMatch(/Verified against the official notification/);
  });
});
