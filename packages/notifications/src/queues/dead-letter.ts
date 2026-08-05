import { Queue, QueueEvents } from "bullmq";
import type IORedis from "ioredis";
import { createDeadLetterQueue, type QueueName } from "./config";

/**
 * True only when a job has exhausted every attempt BullMQ was
 * configured to give it — not on the first failure. This is the
 * condition that should trigger dead-letter escalation, not "any
 * failure at all" (which would defeat the point of retries existing).
 */
export function hasExhaustedRetries(attemptsMade: number, maxAttempts: number): boolean {
  return attemptsMade >= maxAttempts;
}

/**
 * Wires a 'failed' listener onto `queueName` that copies a job's data
 * into the shared dead-letter queue once (and only once) it has
 * exhausted its configured retry budget. Returns the QueueEvents
 * instance so the caller can close it during shutdown — this opens its
 * own Redis connection (a BullMQ requirement for the events stream),
 * so it's not free to leave dangling.
 */
export function wireDeadLetterEscalation(
  queueName: QueueName,
  connection: IORedis,
  deadLetterQueue: Queue = createDeadLetterQueue(connection)
): QueueEvents {
  const events = new QueueEvents(queueName, { connection: connection.duplicate() });
  const sourceQueue = new Queue(queueName, { connection });

  events.on("failed", async ({ jobId, failedReason }) => {
    // QueueEvents' 'failed' payload doesn't include attemptsMade/
    // maxAttempts directly — fetch the job to check. If it's gone by
    // the time we look (already retried and later completed), there's
    // nothing to escalate.
    const job = await sourceQueue.getJob(jobId);
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    if (!hasExhaustedRetries(job.attemptsMade, maxAttempts)) return;

    await deadLetterQueue.add(
      "dead-letter",
      { originalQueue: queueName, originalJobId: jobId, data: job.data, failedReason },
      { attempts: 1 }
    );
  });

  return events;
}
