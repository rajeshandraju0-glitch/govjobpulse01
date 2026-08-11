"use server";

// Section 14 (Section 2's "JWT, role-based access"): this is the ONLY
// way into apps/admin now — every other route is enforced by
// middleware.ts. Deliberately generic error messages ("invalid email
// or password") regardless of whether the email exists at all, so
// this endpoint can't be used to enumerate registered admin accounts.

import { prisma, UserRole } from "@govjobpulse/database";
import { verifyPassword, signAdminJwt } from "@govjobpulse/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

export async function login(formData: FormData): Promise<{ error: string } | never> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Same generic message whether the user doesn't exist OR the
  // password is wrong OR the account isn't ADMIN/SUPER_ADMIN — a
  // different message per case would let someone probe which emails
  // have admin accounts.
  const genericError = { error: "Invalid email or password." };

  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN)) {
    return genericError;
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    return genericError;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail loudly server-side (this is a deployment misconfiguration,
    // not a user error) but keep the response generic.
    console.error("[auth] JWT_SECRET is not set — cannot issue a session.");
    return { error: "Login is temporarily unavailable. Please try again later." };
  }

  const token = await signAdminJwt({ userId: user.id, email: user.email, role: user.role }, secret);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true, // never readable from client-side JS — mitigates XSS token theft
    secure: process.env.NODE_ENV === "production", // HTTPS-only in production; allow http in local dev
    sameSite: "lax", // CSRF mitigation — cross-site requests won't carry this cookie
    maxAge: 8 * 60 * 60, // matches the JWT's own 8h expiry
    path: "/",
  });

  redirect("/moderation");
}

export async function logout(): Promise<void> {
  "use server";
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
