import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/password";

describe("hashPassword / verifyPassword", () => {
  it("verifies the correct password against its own hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces a different hash for the same password on each call (random salt)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
    // But both should still verify correctly against their own hash.
    expect(await verifyPassword("same-password", a)).toBe(true);
    expect(await verifyPassword("same-password", b)).toBe(true);
  });

  it("stores the salt alongside the hash (salt:hash format)", async () => {
    const hash = await hashPassword("test");
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it("fails closed (returns false, does not throw) on a malformed stored hash", async () => {
    await expect(verifyPassword("anything", "not-a-valid-hash-format")).resolves.toBe(false);
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });

  it("is case-sensitive and exact-match (no partial-password acceptance)", async () => {
    const hash = await hashPassword("Password123");
    expect(await verifyPassword("password123", hash)).toBe(false);
    expect(await verifyPassword("Password12", hash)).toBe(false);
  });
});
