// Section 10/14: "role-based middleware." Before this phase, EVERY
// admin route (/moderation, /sources, /integrations, /analytics) was
// completely open — anyone who found the URL could publish jobs,
// toggle notification providers, or view analytics with zero
// authentication. This is the fix: every request to apps/admin except
// /login and its own action endpoint is checked here, before the page
// or Server Action ever runs.

import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminJwt } from "@govjobpulse/auth";
import { SESSION_COOKIE_NAME } from "./app/login/actions";

// Section 2's RBAC matrix (resolved in Phase 2, enforced for the first
// time here): SUPER_ADMIN adds "notification provider credentials" —
// so /integrations (the Social Integrations panel that toggles live
// credentials) is SUPER_ADMIN-only. Everything else an ADMIN can also
// do (moderate jobs, view sources/analytics).
const SUPER_ADMIN_ONLY_PATHS = ["/integrations"];

const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = await verifyAdminJwt(token, secret);
  if (!payload) {
    // Covers expired, tampered, and malformed tokens alike — same
    // response for all of them, redirect to login, no partial access.
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  if (SUPER_ADMIN_ONLY_PATHS.some((path) => pathname.startsWith(path)) && payload.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/moderation", request.url));
  }

  // Pass the authenticated user's identity through to the page/Server
  // Action via a request header, so route handlers can attribute
  // actions (Section 10's "audit logs for admin actions") without
  // re-verifying the JWT themselves.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-govjobpulse-user-id", payload.userId);
  requestHeaders.set("x-govjobpulse-user-email", payload.email);
  requestHeaders.set("x-govjobpulse-user-role", payload.role);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Matches every route except Next.js internals and static assets —
  // deliberately broad rather than an allowlist of "protected" paths,
  // since an allowlist risks a NEW route being added later and
  // accidentally left unprotected. Excluding is the safer default.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
