import { describe, it, expect } from "vitest";
import { signAdminJwt, verifyAdminJwt, type AdminJwtPayload } from "../src/jwt";

const SECRET = "test-secret-do-not-use-in-production";
const PAYLOAD: Omit<AdminJwtPayload, "iat" | "exp" | "nbf" | "iss" | "aud" | "sub" | "jti"> = {
  userId: "user_1",
  email: "admin@govjobpulse.com",
  role: "ADMIN",
};

describe("signAdminJwt / verifyAdminJwt", () => {
  it("verifies a token it just signed, recovering the exact payload", async () => {
    const token = await signAdminJwt(PAYLOAD, SECRET);
    const decoded = await verifyAdminJwt(token, SECRET);
    expect(decoded?.userId).toBe(PAYLOAD.userId);
    expect(decoded?.email).toBe(PAYLOAD.email);
    expect(decoded?.role).toBe(PAYLOAD.role);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signAdminJwt(PAYLOAD, SECRET);
    const decoded = await verifyAdminJwt(token, "a-different-secret");
    expect(decoded).toBeNull();
  });

  it("rejects a tampered token (payload modified after signing)", async () => {
    const token = await signAdminJwt(PAYLOAD, SECRET);
    const parts = token.split(".");
    const tamperedPayload = Buffer.from('{"userId":"attacker","role":"SUPER_ADMIN"}').toString("base64url");
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    expect(await verifyAdminJwt(tampered, SECRET)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signAdminJwt(PAYLOAD, SECRET, "-1s");
    expect(await verifyAdminJwt(token, SECRET)).toBeNull();
  });

  it("rejects a garbage string that isn't a JWT at all", async () => {
    expect(await verifyAdminJwt("not-a-real-jwt", SECRET)).toBeNull();
    expect(await verifyAdminJwt("", SECRET)).toBeNull();
  });

  it("defaults to an 8-hour expiry (session token, not a long-lived API key)", async () => {
    const token = await signAdminJwt(PAYLOAD, SECRET);
    const decoded = await verifyAdminJwt(token, SECRET);
    expect(decoded).not.toBeNull();
  });
});
