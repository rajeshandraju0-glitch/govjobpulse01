import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@govjobpulse/database";
import { QUEUE_NAMES, createQueue, createRedisConnection, DEAD_LETTER_QUEUE_NAME } from "@govjobpulse/notifications";
import { Queue } from "bullmq";

// Section 9: "queue monitoring" — admin is the natural home for this
// (it already has a producer-only BullMQ relationship since Phase 9.5's
// moderation "Publish" action), reporting job counts per queue rather
// than just "queue exists/doesn't." A queue with 500 waiting jobs and
// 0 active workers is a real signal worth seeing, not something a
// binary up/down check would catch.
async function checkQueues() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return { healthy: false, detail: "REDIS_URL not set.", queues: {} };
  }

  try {
    const connection = createRedisConnection(redisUrl);
    const counts: Record<string, unknown> = {};

    for (const name of Object.values(QUEUE_NAMES)) {
      const queue = createQueue(name, connection);
      counts[name] = await queue.getJobCounts("waiting", "active", "failed", "completed", "delayed");
      await queue.close();
    }

    const deadLetterQueue = new Queue(DEAD_LETTER_QUEUE_NAME, { connection });
    counts[DEAD_LETTER_QUEUE_NAME] = await deadLetterQueue.getJobCounts(
      "waiting",
      "active",
      "failed",
      "completed",
      "delayed"
    );
    await deadLetterQueue.close();

    await connection.quit();
    return { healthy: true, detail: "Redis reachable, queue counts retrieved.", queues: counts };
  } catch (err) {
    return { healthy: false, detail: `Redis/queue check failed: ${(err as Error).message}`, queues: {} };
  }
}

export async function GET(): Promise<NextResponse> {
  const [db, queues] = await Promise.all([checkDatabaseHealth(), checkQueues()]);
  return NextResponse.json({
    status: db.healthy && queues.healthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    checks: { database: db, queues },
  });
}
