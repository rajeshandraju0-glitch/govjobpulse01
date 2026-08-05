"use server";

// Section 7: "Admin — Social Integrations panel: enable/disable each
// platform, store config in DB, zero hardcoded secrets." Both actions
// below only ever read/write the `enabled` boolean and health-check
// metadata in NotificationProviderConfig — never a credential value.
// Credentials live exclusively in environment variables (Section 1
// rule 7); this file never reads, stores, or displays one.

import { prisma, NotificationPlatform } from "@govjobpulse/database";
import { getProvider } from "@govjobpulse/notifications";
import { revalidatePath } from "next/cache";

export async function toggleProviderEnabled(platform: NotificationPlatform, enabled: boolean): Promise<void> {
  await prisma.notificationProviderConfig.update({
    where: { platform },
    data: { enabled },
  });
  revalidatePath("/integrations");
}

/**
 * Runs a REAL health check against the platform's API — the adapter
 * makes an actual HTTP request (see packages/notifications/src/base-provider.ts).
 * If no credentials are configured, the adapter's own isEnabled() gate
 * means this returns "disabled", not a fake success.
 */
export async function runProviderHealthCheck(platformSlug: string): Promise<void> {
  const provider = getProvider(platformSlug);
  if (!provider) {
    throw new Error(`No provider registered for slug "${platformSlug}"`);
  }

  const result = await provider.healthCheck();

  await prisma.notificationProviderConfig.update({
    where: { platform: platformSlug.toUpperCase() as NotificationPlatform },
    data: {
      lastHealthCheckAt: new Date(), // record that a check ran, healthy or not
      lastHealthCheckHealthy: result.healthy,
      lastHealthCheckDetail: result.detail,
    },
  });

  revalidatePath("/integrations");
}
