// Section 2: "Auth: JWT, role-based access (Guest, Registered User,
// Admin, Super Admin)." This module only signs/verifies — it has no
// opinion on where the token is stored (apps/admin puts it in an
// httpOnly cookie) or which routes require which role (apps/admin's
// middleware.ts owns that).
//
// Uses `jose`, not the more common `jsonwebtoken` package — verified
// this matters, not assumed: Next.js middleware.ts runs in the Edge
// Runtime by default (Next 15.x, what this repo is on), which has no
// Node.js `crypto` module. `jsonwebtoken` depends on it directly and
// throws at runtime in middleware specifically — a real incompatibility,
// not a theoretical one. `jose` is built on the standard Web Crypto
// API, so the exact same functions work in middleware, Server
// Components, and Server Actions without a second code path.

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface AdminJwtPayload extends JWTPayload {
  userId: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
}

const DEFAULT_EXPIRES_IN = "8h"; // an admin session, not a long-lived API token

export async function signAdminJwt(
  payload: Omit<AdminJwtPayload, keyof JWTPayload>,
  secret: string,
  expiresIn: string = DEFAULT_EXPIRES_IN
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

/**
 * Returns the decoded payload, or null for ANY verification failure
 * (expired, tampered, wrong secret, malformed) — callers should treat
 * null as "not authenticated," full stop, never branch on the specific
 * failure reason to decide whether to grant partial access.
 */
export async function verifyAdminJwt(token: string, secret: string): Promise<AdminJwtPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    if (!("userId" in payload) || !("email" in payload) || !("role" in payload)) return null;
    return payload as AdminJwtPayload;
  } catch {
    return null;
  }
}
