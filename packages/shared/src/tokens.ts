// Server-only: email subscription tokens. Uses node:crypto.
import { randomBytes } from "node:crypto";

const VERIFICATION_TOKEN_TTL_HOURS = 24;

export function generateSubscriptionToken(): string {
  return randomBytes(32).toString("hex");
}

export function computeVerificationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);
}

export function isTokenExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  return now.getTime() > expiresAt.getTime();
}
