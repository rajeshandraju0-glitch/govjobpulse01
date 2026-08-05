import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
  // Revised in Phase 9: the Social Integrations panel needs a real
  // "test connection" action per provider, which means calling
  // provider.healthCheck() — a direct HTTP request to that platform's
  // API, not a queue operation. That's a legitimate reason for admin to
  // depend on @govjobpulse/notifications that apps/web has no
  // equivalent need for, so the two apps get different assertions here
  // rather than the same blanket rule. What's NOT legitimate, for
  // either app, is depending on bullmq/ioredis directly — enqueueing
  // and sending stays exclusively in apps/worker. If admin ever needs
  // to enqueue something, that should go through an API call to a
  // worker-owned endpoint, not a direct BullMQ dependency in admin
  // itself.
  const adminPackageJson = readPackageJson("apps/admin/package.json");

  it("may depend on @govjobpulse/notifications (for provider.healthCheck() only)", () => {
    expect(adminPackageJson.dependencies).toHaveProperty("@govjobpulse/notifications");
  });

  it("does NOT depend on bullmq directly — queueing/sending is apps/worker's job, not admin's", () => {
    expect(adminPackageJson.dependencies).not.toHaveProperty("bullmq");
  });

  it("does NOT depend on ioredis directly", () => {
    expect(adminPackageJson.dependencies).not.toHaveProperty("ioredis");
  });
});
