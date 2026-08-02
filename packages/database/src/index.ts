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

export * from "@prisma/client";
