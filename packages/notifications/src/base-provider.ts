// Section 7: shared behavior every per-platform adapter gets for free.
//
// Two independent layers gate whether a provider actually sends
// anything, matching the brief's "ship disabled by default, enabled
// only once real credentials are added via admin settings":
//   1. isEnabled() here checks whether required credentials are even
//      present in the environment — a provider with no token literally
//      cannot send, regardless of any admin toggle.
//   2. The DB-level NotificationProviderSettings.enabled flag (Phase 9's
//      admin panel) is checked by the queue processor before it calls
//      a provider at all — an admin can have real credentials loaded
//      but still choose not to have that channel live yet.
// Both must be true for a send to actually happen. Neither is
// implemented as a single "trust me it's off" flag.

import type {
  NotificationProvider,
  NotificationJobPayload,
  NotificationSendResult,
  NotificationHealthCheckResult,
} from "@govjobpulse/types";

export abstract class BaseNotificationProvider implements NotificationProvider {
  abstract slug: string;
  abstract name: string;

  abstract isEnabled(): boolean;
  protected abstract doSendJob(job: NotificationJobPayload): Promise<void>;
  protected abstract doHealthCheck(): Promise<string>;

  async sendJob(job: NotificationJobPayload): Promise<NotificationSendResult> {
    if (!this.isEnabled()) {
      return { providerSlug: this.slug, status: "SKIPPED_DISABLED", sentAt: new Date() };
    }
    try {
      await this.doSendJob(job);
      return { providerSlug: this.slug, status: "SENT", sentAt: new Date() };
    } catch (err) {
      return {
        providerSlug: this.slug,
        status: "FAILED",
        errorMessage: (err as Error).message,
        sentAt: new Date(),
      };
    }
  }

  /**
   * Sequential, not Promise.all — mirrors the scheduler's "one source
   * failing doesn't block the others" pattern (Phase 4), and keeps
   * request volume against any single platform's rate limits
   * predictable. One job's send failure is isolated per-result, not
   * thrown, so a batch partially succeeds rather than all-or-nothing.
   */
  async sendBulk(jobs: NotificationJobPayload[]): Promise<NotificationSendResult[]> {
    const results: NotificationSendResult[] = [];
    for (const job of jobs) {
      results.push(await this.sendJob(job));
    }
    return results;
  }

  async healthCheck(): Promise<NotificationHealthCheckResult> {
    if (!this.isEnabled()) {
      return { providerSlug: this.slug, healthy: false, detail: "Disabled — no credentials configured." };
    }
    try {
      const detail = await this.doHealthCheck();
      return { providerSlug: this.slug, healthy: true, detail };
    } catch (err) {
      return { providerSlug: this.slug, healthy: false, detail: (err as Error).message };
    }
  }
}
