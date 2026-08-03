import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus } from "../src/index";

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it("delivers an emitted event to a registered listener", () => {
    const listener = vi.fn();
    bus.on("JobCreated", listener);
    bus.emit("JobCreated", { jobId: "job_1", slug: "some-job", sourceSlug: "isro" });
    expect(listener).toHaveBeenCalledWith({ jobId: "job_1", slug: "some-job", sourceSlug: "isro" });
  });

  it("delivers to multiple listeners for the same event", () => {
    const a = vi.fn();
    const b = vi.fn();
    bus.on("ScraperCompleted", a);
    bus.on("ScraperCompleted", b);
    bus.emit("ScraperCompleted", {
      sourceSlug: "isro",
      jobsCreated: 3,
      jobsSkippedDuplicate: 1,
      durationMs: 1200,
    });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("does not call listeners registered for a different event", () => {
    const jobListener = vi.fn();
    const scraperListener = vi.fn();
    bus.on("JobCreated", jobListener);
    bus.on("ScraperFailed", scraperListener);
    bus.emit("JobCreated", { jobId: "job_1", slug: "x", sourceSlug: null });
    expect(jobListener).toHaveBeenCalledTimes(1);
    expect(scraperListener).not.toHaveBeenCalled();
  });

  it("stops delivering to a listener after off()", () => {
    const listener = vi.fn();
    bus.on("JobDeleted", listener);
    bus.off("JobDeleted", listener);
    bus.emit("JobDeleted", { jobId: "job_1", slug: "x" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops delivering after calling the unsubscribe function returned by on()", () => {
    const listener = vi.fn();
    const unsubscribe = bus.on("JobUpdated", listener);
    unsubscribe();
    bus.emit("JobUpdated", { jobId: "job_1", slug: "x", changedFields: ["title"] });
    expect(listener).not.toHaveBeenCalled();
  });

  it("isolates a throwing listener — other listeners still run, emit() does not throw", () => {
    const throwing = vi.fn(() => {
      throw new Error("boom");
    });
    const healthy = vi.fn();
    bus.on("NotificationSent", throwing);
    bus.on("NotificationSent", healthy);

    const payload = { notificationId: "n1", jobId: "job_1", provider: "telegram", status: "SENT" as const };
    expect(() => bus.emit("NotificationSent", payload)).not.toThrow();
    expect(healthy).toHaveBeenCalledWith(payload);
  });

  it("emitting with no listeners registered is a no-op, not an error", () => {
    expect(() => bus.emit("JobPublished", { jobId: "job_1", slug: "x", publishedAt: new Date() })).not.toThrow();
  });

  it("listenerCount reflects registrations and removals", () => {
    expect(bus.listenerCount("JobCreated")).toBe(0);
    const listener = vi.fn();
    bus.on("JobCreated", listener);
    expect(bus.listenerCount("JobCreated")).toBe(1);
    bus.off("JobCreated", listener);
    expect(bus.listenerCount("JobCreated")).toBe(0);
  });

  it("keeps event buses independent across instances", () => {
    const otherBus = new EventBus();
    const listener = vi.fn();
    bus.on("JobCreated", listener);
    otherBus.emit("JobCreated", { jobId: "job_1", slug: "x", sourceSlug: null });
    expect(listener).not.toHaveBeenCalled();
  });
});
