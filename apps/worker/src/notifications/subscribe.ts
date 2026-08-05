// Section 5's event bus foreshadowed this exact wiring (see
// scheduler.ts's comment from Phase 5: "Phase 8's notification adapters
// will subscribe to JobPublished the same way, once they exist"). This
// is that subscriber.
//
// IMPORTANT: nothing calls eventBus.emit("JobPublished", ...) yet — the
// admin moderation UI that promotes a job from reviewed -> published
// doesn't exist until Phase 9. So this subscriber is correctly wired
// but will not fire in practice until that phase lands. That's
// intentional, not a gap: per Section 5's own module header, events
// should be wired when the real trigger exists, and the *subscriber*
// side existing early is fine — a subscriber sitting idle costs
// nothing and is registered once, whereas emitting an event with no
// real state change behind it would be the same "fabrication" problem
// Section 1 rule 2 warns about, just on the event bus instead of the UI.

import { eventBus } from "@govjobpulse/shared";
import { QUEUE_NAMES, createQueue, createRedisConnection } from "@govjobpulse/notifications";
import type { Queue } from "bullmq";

let newJobQueue: Queue | undefined;

function getNewJobQueue(): Queue {
  if (!newJobQueue) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL not set — cannot enqueue notifications.");
    }
    newJobQueue = createQueue(QUEUE_NAMES.NEW_JOB, createRedisConnection(redisUrl));
  }
  return newJobQueue;
}

/**
 * Registers the JobPublished -> NEW_JOB queue subscriber. Call once at
 * worker startup (see scheduler.ts). Enqueue failures are caught and
 * logged, never thrown — per Section 7: "The website must keep
 * functioning even if every notification fails." A JobPublished
 * listener throwing would already be isolated by the event bus itself
 * (Phase 5's EventBus.emit() catches listener errors), but this
 * subscriber also isolates internally so a Redis outage produces a
 * clear log line instead of relying solely on that outer safety net.
 */
export function subscribeJobPublishedToNotifications(): void {
  eventBus.on("JobPublished", async (payload) => {
    try {
      const queue = getNewJobQueue();
      await queue.add("notify-job-published", {
        jobId: payload.jobId,
        slug: payload.slug,
        publishedAt: payload.publishedAt,
      });
      console.log(`[notifications] Enqueued NEW_JOB notification for ${payload.slug}`);
    } catch (err) {
      console.error(
        `[notifications] Failed to enqueue NEW_JOB notification for ${payload.slug}:`,
        (err as Error).message
      );
    }
  });
}
