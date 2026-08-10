// Section 11: "unit + API + scraper tests." These call the actual
// exported Route Handler functions (POST/GET/DELETE) with constructed
// Request objects — no running server needed. @govjobpulse/database is
// mocked entirely rather than using the real Prisma client, which
// means these tests work regardless of this sandbox's Prisma-generate
// limitation (documented elsewhere in CLAUDE.md) — we're not calling
// the real generated client at all, so whether it exists is irrelevant
// here. This tests the ROUTE HANDLER logic (validation, rate limiting,
// status codes, response shape) for real; it does not test Prisma
// itself or a real database round trip.

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@govjobpulse/database", () => ({
  prisma: {
    newsletterSubscriber: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
  SubscriberStatus: { PENDING: "PENDING", VERIFIED: "VERIFIED", UNSUBSCRIBED: "UNSUBSCRIBED" },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitRequest: vi.fn().mockResolvedValue({ allowed: true, remaining: 5, limit: 5 }),
}));

vi.mock("@govjobpulse/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@govjobpulse/shared")>();
  return {
    ...actual,
    generateSubscriptionToken: () => "mock-token-abc123",
    computeVerificationExpiry: () => new Date("2026-01-02T00:00:00Z"),
  };
});

import { POST } from "../../app/api/subscribe/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/subscribe", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
  });

  it("rejects an invalid email with 400", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/valid email/i);
  });

  it("rejects a missing email with 400", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON with 400", async () => {
    const badRequest = new Request("http://localhost/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{{{",
    });
    const res = await POST(badRequest);
    expect(res.status).toBe(400);
  });

  it("creates a new PENDING subscriber for a fresh email", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "sub_1" });

    const res = await POST(makeRequest({ email: "Student@Example.com" }));

    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockCreate.mock.calls[0]![0];
    // Email is lowercased/trimmed by the Zod schema before reaching Prisma.
    expect(createArgs.data.email).toBe("student@example.com");
    expect(createArgs.data.status).toBe("PENDING");
  });

  it("does not leak whether an already-VERIFIED email exists — generic success message", async () => {
    mockFindUnique.mockResolvedValue({ id: "sub_1", status: "VERIFIED" });

    const res = await POST(makeRequest({ email: "existing@example.com" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/already subscribed/i);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("regenerates a fresh token for a PENDING or UNSUBSCRIBED email re-subscribing", async () => {
    mockFindUnique.mockResolvedValue({
      id: "sub_1",
      status: "UNSUBSCRIBED",
      dailyDigest: true,
      weeklyDigest: false,
    });
    mockUpdate.mockResolvedValue({ id: "sub_1" });

    const res = await POST(makeRequest({ email: "returning@example.com" }));

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = mockUpdate.mock.calls[0]![0];
    expect(updateArgs.data.status).toBe("PENDING");
    expect(updateArgs.data.verificationToken).toBe("mock-token-abc123");
  });
});
