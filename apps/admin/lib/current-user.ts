import { headers } from "next/headers";

// middleware.ts verifies the JWT and forwards the identity via
// headers, so Server Actions don't need to re-verify the token
// themselves — this just reads what middleware already established.
// If these headers are missing, middleware.ts's own logic guarantees
// the request would have been redirected to /login before reaching
// here, so this should never actually be null in practice — but
// callers (audit logging) treat a null return as "skip logging"
// rather than throwing, since an audit log gap is far less severe
// than blocking a legitimate admin action over it.
export async function getCurrentAdminUser(): Promise<{ userId: string; email: string; role: string } | null> {
  const headersList = await headers();
  const userId = headersList.get("x-govjobpulse-user-id");
  const email = headersList.get("x-govjobpulse-user-email");
  const role = headersList.get("x-govjobpulse-user-role");
  if (!userId || !email || !role) return null;
  return { userId, email, role };
}
