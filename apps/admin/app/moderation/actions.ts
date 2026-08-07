"use server";

// Section 4's moderation gate, finally given a real UI (Phase 9.5 —
// see CLAUDE.md's Open Items for why this didn't have a backlog slot
// until now). This is the ONLY place in the codebase that promotes a
// Job to PUBLISHED — Section 1 rule 2's "expired jobs stay PUBLISHED"
// decision and Section 6's SEO infrastructure both assume that
// transition happens deliberately, through here, not implicitly
// anywhere else.

import { prisma, JobStatus } from "@govjobpulse/database";
import { eventBus } from "@govjobpulse/shared";
import { QUEUE_NAMES, createQueue, createRedisConnection } from "@govjobpulse/notifications";
import { createCacheClient, invalidateCache } from "@govjobpulse/cache";
import { revalidatePath } from "next/cache";

export async function markReviewed(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: JobStatus.REVIEWED },
  });
  revalidatePath("/moderation");
}

let newJobQueue: ReturnType<typeof createQueue> | undefined;

function getNewJobQueue() {
  if (!newJobQueue) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error("REDIS_URL not set — cannot enqueue notifications.");
    newJobQueue = createQueue(QUEUE_NAMES.NEW_JOB, createRedisConnection(redisUrl));
  }
  return newJobQueue;
}

export async function publishJob(jobId: string): Promise<void> {
  const publishedAt = new Date();
  const job = await prisma.job.update({
    where: { id: jobId },
    data: { status: JobStatus.PUBLISHED, publishedAt },
  });

  // Two notification paths, deliberately both present:
  //
  // 1. eventBus.emit() — for same-process listeners. Admin doesn't have
  //    any right now, but this keeps admin's own future in-process
  //    concerns (e.g. an audit log) able to subscribe the normal way,
  //    and costs nothing since EventBus.emit() is a no-op with zero
  //    listeners.
  // 2. Direct BullMQ enqueue — the mechanism that ACTUALLY reaches
  //    apps/worker, since it's a different process and Phase 5's
  //    EventBus can't cross that boundary (see the Phase 9.5 revision
  //    in packages/notifications/tests/web-decoupling.test.ts for the
  //    full reasoning). This is the real notification trigger.
  eventBus.emit("JobPublished", { jobId: job.id, slug: job.slug, publishedAt });

  try {
    await getNewJobQueue().add("notify-job-published", {
      jobId: job.id,
      slug: job.slug,
      publishedAt,
    });
  } catch (err) {
    // Section 7: publishing a job must succeed even if notifications
    // can't be enqueued (Redis down, etc.) — the Job row above is
    // already committed by this point. Log loudly, don't throw; a
    // failed-to-enqueue publish is a notifications problem to notice
    // and fix, not a reason to roll back a legitimate publish.
    console.error(`[moderation] Failed to enqueue notification for published job ${job.slug}:`, err);
  }

  // Section 10/13: apps/web's home page caches its published-jobs list
  // for 60s (see apps/web/lib/cache.ts + app/page.tsx). Without this,
  // a job published right now could sit invisible on the home page for
  // up to a minute — invalidate explicitly rather than make an editor
  // wait out the TTL. Same "must not break the publish" principle as
  // the notification enqueue above: cache invalidation failing is
  // logged, never allowed to fail the publish itself.
  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const cacheClient = createCacheClient(redisUrl);
      await invalidateCache(cacheClient, "home:total-published");
      await invalidateCache(cacheClient, "home:popular-categories");
      await invalidateCache(cacheClient, "home:jobs:page:1");
      await cacheClient.quit();
    }
  } catch (err) {
    console.error(`[moderation] Failed to invalidate home page cache after publishing ${job.slug}:`, err);
  }

  revalidatePath("/moderation");
}
