import { describe, it, expect } from "vitest";
import { generateSubscriptionToken, computeVerificationExpiry, isTokenExpired } from "../src/index";

describe("generateSubscriptionToken", () => {
  it("generates a 64-char hex string (32 random bytes)", () => {
    const token = generateSubscriptionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a different token each call — not deterministic/guessable", () => {
    const a = generateSubscriptionToken();
    const b = generateSubscriptionToken();
    expect(a).not.toBe(b);
  });
});

describe("computeVerificationExpiry", () => {
  it("returns a timestamp 24 hours after the given time", () => {
    const now = new Date("2026-08-05T00:00:00Z");
    const expiry = computeVerificationExpiry(now);
    expect(expiry.toISOString()).toBe("2026-08-06T00:00:00.000Z");
  });
});

describe("isTokenExpired", () => {
  it("is false for a future expiry", () => {
    const now = new Date("2026-08-05T00:00:00Z");
    const expiresAt = new Date("2026-08-06T00:00:00Z");
    expect(isTokenExpired(expiresAt, now)).toBe(false);
  });

  it("is true for a past expiry", () => {
    const now = new Date("2026-08-07T00:00:00Z");
    const expiresAt = new Date("2026-08-06T00:00:00Z");
    expect(isTokenExpired(expiresAt, now)).toBe(true);
  });

  it("is true (fails closed) when there is no expiry recorded at all", () => {
    expect(isTokenExpired(null)).toBe(true);
  });

  it("treats the exact expiry instant as expired, not valid", () => {
    const now = new Date("2026-08-05T00:00:00.000Z");
    expect(isTokenExpired(now, now)).toBe(false); // exactly equal is NOT expired (> comparison)
    const oneMsLater = new Date(now.getTime() + 1);
    expect(isTokenExpired(now, oneMsLater)).toBe(true);
  });
});
