import { describe, it, expect } from "vitest";
import { computeSourceStaleness, computeAllStaleness, type ScraperLogLike } from "../src/staleness";

const NOW = new Date("2026-08-03T12:00:00Z");
const source = { slug: "isro", name: "ISRO" };

function log(status: ScraperLogLike["status"], hoursAgo: number): ScraperLogLike {
  const startedAt = new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000);
  return { status, startedAt, finishedAt: startedAt };
}

describe("computeSourceStaleness", () => {
  it("returns 'never_run' when there are no logs at all", () => {
    const result = computeSourceStaleness(source, [], NOW);
    expect(result.level).toBe("never_run");
    expect(result.lastSuccessAt).toBeNull();
    expect(result.hoursSinceLastSuccess).toBeNull();
  });

  it("returns 'fresh' when the last success was within the warning threshold", () => {
    const result = computeSourceStaleness(source, [log("SUCCESS", 0.5)], NOW);
    expect(result.level).toBe("fresh");
  });

  it("returns 'warning' when the last success is between 2h and 24h old", () => {
    const result = computeSourceStaleness(source, [log("SUCCESS", 5)], NOW);
    expect(result.level).toBe("warning");
  });

  it("returns 'stale' when the last success is more than 24h old — the 'silently failing for a week' case", () => {
    const result = computeSourceStaleness(source, [log("SUCCESS", 24 * 7)], NOW);
    expect(result.level).toBe("stale");
  });

  it("uses the most recent success even if more recent runs failed", () => {
    const logs = [log("FAILED", 0.1), log("FAILED", 1), log("SUCCESS", 3)];
    const result = computeSourceStaleness(source, logs, NOW);
    expect(result.level).toBe("warning"); // last success 3h ago
    expect(result.lastRunStatus).toBe("FAILED"); // but most recent run overall failed
    expect(result.lastRunAt?.getTime()).toBe(log("FAILED", 0.1).startedAt.getTime());
  });

  it("is 'never_run' if there are runs but none succeeded", () => {
    const logs = [log("FAILED", 1), log("FAILED", 2)];
    const result = computeSourceStaleness(source, logs, NOW);
    expect(result.level).toBe("never_run");
    expect(result.lastRunAt).not.toBeNull();
    expect(result.lastRunStatus).toBe("FAILED");
  });
});

describe("computeAllStaleness", () => {
  it("computes staleness for multiple sources independently", () => {
    const sources = [
      { slug: "isro", name: "ISRO" },
      { slug: "ssc", name: "SSC" },
    ];
    const logsBySourceSlug = new Map([
      ["isro", [log("SUCCESS", 0.5)]],
      // ssc has no logs at all
    ]);
    const results = computeAllStaleness(sources, logsBySourceSlug, NOW);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.sourceSlug === "isro")?.level).toBe("fresh");
    expect(results.find((r) => r.sourceSlug === "ssc")?.level).toBe("never_run");
  });
});
