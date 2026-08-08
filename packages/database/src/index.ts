// Prisma schema + client. Schema lives in prisma/schema.prisma (Section 3
// content model). This module exports a singleton PrismaClient so every
// workspace member shares one connection pool instead of each import
// spinning up its own — important once api/worker/admin all depend on
// this package in the same process or across processes with pooled infra.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Section 9: "/health, /ready, /live endpoints." Shared here since
// every app (web, admin) needs the same "can I reach Postgres"
// check for its /ready and /health endpoints — one implementation,
// not copy-pasted per app.
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; detail: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { healthy: true, detail: "Database reachable." };
  } catch (err) {
    return { healthy: false, detail: `Database unreachable: ${(err as Error).message}` };
  }
}

// Section 10: "audit logs for admin actions." One helper so every
// admin Server Action logs consistently rather than each one building
// its own prisma.adminAuditLog.create() call. Never throws — an audit
// log failing to write must not block the actual admin action it's
// trying to record (same "must keep working" principle applied
// elsewhere in this codebase to notifications/caching).
export async function logAdminAction(params: {
  userId: string;
  userEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({ data: params });
  } catch (err) {
    console.error("[audit-log] Failed to write admin audit log entry:", err);
  }
}

export * from "@prisma/client";
