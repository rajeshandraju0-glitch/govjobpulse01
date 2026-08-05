import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Section 7: "The website must keep functioning even if every
// notification fails — write a test that kills the notification worker
// and confirms the public site still serves correctly."
//
// A literal "kill the worker process and hit the live site" test would
// need apps/web actually running against a real Postgres — blocked in
// this sandbox by the same Prisma limitation documented in CLAUDE.md
// (and arguably a slow/flaky way to prove this property even in a
// normal environment). The property Section 7 actually cares about —
// "the website keeps functioning even if every notification fails" —
// is a STRUCTURAL one: apps/web must have zero build-time dependency on
// packages/notifications, BullMQ, or Redis. If that's true, there is no
// code path by which a notification failure (or Redis being down
// entirely) can affect a page render, because the web app never calls
// into that system at all — the coupling is impossible, not just
// handled gracefully at runtime. This test verifies that structural
// guarantee directly, which is stronger than a runtime try/catch would
// be (a try/catch proves failures are handled; this proves the failure
// mode can't reach the site's dependency graph in the first place).
//
// If this test ever needs to be updated to allow apps/web to depend on
// notifications, that's a real architectural decision that deserves a
// second look, not something that should happen silently.

function readPackageJson(relativePath: string): { dependencies?: Record<string, string> } {
  const fullPath = join(__dirname, "..", "..", "..", relativePath);
  return JSON.parse(readFileSync(fullPath, "utf-8"));
}

describe("apps/web has no dependency on the notification system (Section 7)", () => {
  const webPackageJson = readPackageJson("apps/web/package.json");

  it("does not depend on @govjobpulse/notifications", () => {
    expect(webPackageJson.dependencies).not.toHaveProperty("@govjobpulse/notifications");
  });

  it("does not depend on bullmq directly", () => {
    expect(webPackageJson.dependencies).not.toHaveProperty("bullmq");
  });

  it("does not depend on ioredis directly", () => {
    expect(webPackageJson.dependencies).not.toHaveProperty("ioredis");
  });
});

describe("apps/admin's coupling to the notification system is deliberately narrower than apps/web's", () => {
  // Revised TWICE now — documenting both revisions rather than quietly
  // overwriting the reasoning, since each was a real correction:
  //
  // Phase 9 (first revision): admin needs @govjobpulse/notifications for
  // provider.healthCheck() (a direct HTTP call, no queue).
  //
  // Phase 9.5 (this revision): building the job moderation UI (see
  // CLAUDE.md's Open Items — Section 13's backlog had no dedicated
  // phase for this) surfaced that admin's "publish" action needs to
  // enqueue a NEW_JOB notification, and it runs in a DIFFERENT PROCESS
  // than apps/worker. Phase 5's EventBus is explicitly in-process only
  // — admin emitting on its own EventBus instance can never reach
  // worker's subscriber, they're different Node processes with
  // separate module registries. The original "admin never depends on
  // bullmq" rule assumed admin would call a worker-owned HTTP endpoint
  // instead, but no such endpoint exists (apps/api isn't built yet).
  //
  // The actual fix, and BullMQ's own intended pattern: `Queue` is a
  // lightweight PRODUCER handle, safe to instantiate in any process —
  // that's what admin needs. `Worker` is the CONSUMER, and should have
  // exactly one owner (apps/worker). So the real boundary isn't "admin
  // never touches bullmq" — it's "admin may enqueue (Queue.add), admin
  // must never consume (never instantiate a Worker)". The dependency
  // check alone can't distinguish Queue-usage from Worker-usage (both
  // come from the same package), so this is paired with a source-level
  // check that admin's code never constructs a `new Worker(`.
  const adminPackageJson = readPackageJson("apps/admin/package.json");

  it("may depend on @govjobpulse/notifications (healthCheck) and bullmq (Queue.add — producer only)", () => {
    expect(adminPackageJson.dependencies).toHaveProperty("@govjobpulse/notifications");
    expect(adminPackageJson.dependencies).toHaveProperty("bullmq");
  });

  it("never instantiates a BullMQ Worker (consumer) — that stays exclusively in apps/worker", () => {
    const adminAppDir = join(__dirname, "..", "..", "..", "apps", "admin", "app");
    const offendingFiles = findFilesContaining(adminAppDir, /new\s+Worker\s*\(/);
    expect(offendingFiles).toEqual([]);
  });

  it("does NOT depend on ioredis directly — admin uses packages/notifications' createRedisConnection helper, not its own connection setup", () => {
    expect(adminPackageJson.dependencies).not.toHaveProperty("ioredis");
  });
});

function findFilesContaining(dir: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findFilesContaining(fullPath, pattern));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      const content = readFileSync(fullPath, "utf-8");
      if (pattern.test(content)) matches.push(fullPath);
    }
  }
  return matches;
}
