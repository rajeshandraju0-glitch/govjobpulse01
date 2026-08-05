// Section 7: "Queues (Redis + BullMQ): New Job, Daily Digest, Weekly
// Digest, Social Media, Retry Failed Notifications, Notification Logs.
// Define an explicit max-retry count and backoff strategy per queue,
// with a dead-letter queue for permanently failed jobs."

import { Queue, type QueueOptions, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

export const QUEUE_NAMES = {
  NEW_JOB: "notifications-new-job",
  DAILY_DIGEST: "notifications-daily-digest",
  WEEKLY_DIGEST: "notifications-weekly-digest",
  SOCIAL_MEDIA: "notifications-social-media",
  RETRY_FAILED: "notifications-retry-failed",
  NOTIFICATION_LOGS: "notifications-logs",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const DEAD_LETTER_QUEUE_NAME = "notifications-dead-letter";

// Per-queue retry/backoff policy. Reasoning per queue:
//   - NEW_JOB: time-sensitive (a student wants to know about a fresh
//     posting soon), so fewer retries with a short exponential backoff
//     — fail fast into RETRY_FAILED rather than block the queue long.
//   - DAILY_DIGEST / WEEKLY_DIGEST: not time-critical to the minute, so
//     more retries with longer backoff is fine — better to eventually
//     succeed than to give up quickly on a scheduled digest.
//   - SOCIAL_MEDIA: platform APIs (Twitter/Facebook/etc.) are prone to
//     transient rate-limiting, so a longer backoff specifically helps
//     avoid hammering a rate limit into a harder block.
//   - RETRY_FAILED: deliberately conservative — jobs here already
//     failed once elsewhere, so this is a last-chance queue before
//     dead-letter, not a place to retry indefinitely.
//   - NOTIFICATION_LOGS: writing a log entry should essentially never
//     fail (it's a DB write, not an external API call), but still gets
//     a couple of retries rather than assuming infallibility.
const JOB_OPTIONS: Record<QueueName, JobsOptions> = {
  [QUEUE_NAMES.NEW_JOB]: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
  [QUEUE_NAMES.DAILY_DIGEST]: { attempts: 5, backoff: { type: "exponential", delay: 10000 } },
  [QUEUE_NAMES.WEEKLY_DIGEST]: { attempts: 5, backoff: { type: "exponential", delay: 10000 } },
  [QUEUE_NAMES.SOCIAL_MEDIA]: { attempts: 4, backoff: { type: "exponential", delay: 15000 } },
  [QUEUE_NAMES.RETRY_FAILED]: { attempts: 2, backoff: { type: "fixed", delay: 60000 } },
  [QUEUE_NAMES.NOTIFICATION_LOGS]: { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
};

export function getJobOptionsFor(queueName: QueueName): JobsOptions {
  return JOB_OPTIONS[queueName];
}

export function createRedisConnection(redisUrl: string): IORedis {
  // BullMQ requires this specific option — without it, blocking
  // commands (used internally by Workers) throw immediately on
  // connection instead of blocking as intended.
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

export function createQueue(name: QueueName, connection: IORedis): Queue {
  const options: QueueOptions = {
    connection,
    defaultJobOptions: getJobOptionsFor(name),
  };
  return new Queue(name, options);
}

export function createDeadLetterQueue(connection: IORedis): Queue {
  // No retries on the dead-letter queue itself — a job here already
  // exhausted its real retry budget; the DLQ exists for a human to
  // inspect and manually decide next steps (Phase 9/12's admin
  // surfacing), not to keep silently retrying forever.
  return new Queue(DEAD_LETTER_QUEUE_NAME, { connection, defaultJobOptions: { attempts: 1 } });
}
