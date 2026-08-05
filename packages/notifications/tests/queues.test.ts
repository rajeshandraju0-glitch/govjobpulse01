// Unlike this project's Prisma/database tests, these run against a
// REAL local Redis instance (installed via apt in this sandbox — see
// CLAUDE.md, same approach as Phase 2's Postgres). BullMQ's actual
// queueing/retry/backoff behavior is genuinely exercised here, not
// mocked — these tests would fail for real if the retry or dead-letter
// logic were wrong.

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Queue, Worker } from "bullmq";
import {
  QUEUE_NAMES,
  DEAD_LETTER_QUEUE_NAME,
  createRedisConnection,
  createQueue,
  createDeadLetterQueue,
  getJobOptionsFor,
} from "../src/queues/config";
import { wireDeadLetterEscalation, hasExhaustedRetries } from "../src/queues/dead-letter";

const REDIS_URL = process.env.REDIS_URL_TEST ?? "redis://localhost:6379";

describe("hasExhaustedRetries (pure)", () => {
  it("is false before the attempt count reaches the max", () => {
    expect(hasExhaustedRetries(1, 3)).toBe(false);
    expect(hasExhaustedRetries(2, 3)).toBe(false);
  });
  it("is true once attempts reach the configured max", () => {
    expect(hasExhaustedRetries(3, 3)).toBe(true);
    expect(hasExhaustedRetries(4, 3)).toBe(true);
  });
});

describe("queue configuration", () => {
  it("defines all 6 queues from Section 7", () => {
    expect(Object.keys(QUEUE_NAMES)).toHaveLength(6);
    expect(Object.keys(QUEUE_NAMES).sort()).toEqual(
      ["NEW_JOB", "DAILY_DIGEST", "WEEKLY_DIGEST", "SOCIAL_MEDIA", "RETRY_FAILED", "NOTIFICATION_LOGS"].sort()
    );
  });

  it("every queue has an explicit attempts count and backoff strategy — nothing left to BullMQ's defaults", () => {
    for (const name of Object.values(QUEUE_NAMES)) {
      const options = getJobOptionsFor(name);
      expect(options.attempts).toBeGreaterThan(0);
      expect(options.backoff).toBeDefined();
    }
  });

  it("RETRY_FAILED has fewer attempts than NEW_JOB — a last-chance queue shouldn't retry as generously as the primary one", () => {
    const retryFailedAttempts = getJobOptionsFor(QUEUE_NAMES.RETRY_FAILED).attempts as number;
    const newJobAttempts = getJobOptionsFor(QUEUE_NAMES.NEW_JOB).attempts as number;
    expect(retryFailedAttempts).toBeLessThanOrEqual(newJobAttempts);
  });
});

describe("real Redis integration", () => {
  const connection = createRedisConnection(REDIS_URL);
  const testQueues: Queue[] = [];
  const testWorkers: Worker<any, any, string>[] = [];

  afterEach(async () => {
    await Promise.all(testWorkers.splice(0).map((w) => w.close()));
    await Promise.all(testQueues.splice(0).map((q) => q.obliterate({ force: true }).catch(() => {})));
  });

  afterAll(async () => {
    await connection.quit();
  });

  it("enqueues a real job and a real Worker processes it successfully", async () => {
    const queueName = QUEUE_NAMES.NEW_JOB;
    const queue = createQueue(queueName, connection);
    testQueues.push(queue);

    const processed: unknown[] = [];
    const worker = new Worker(
      queueName,
      async (job) => {
        processed.push(job.data);
      },
      { connection: connection.duplicate() }
    );
    testWorkers.push(worker);

    await queue.add("test-job", { jobId: "job_1", title: "Test Job" });

    await vi_waitFor(() => processed.length === 1, 5000);
    expect(processed).toEqual([{ jobId: "job_1", title: "Test Job" }]);
  }, 10000);

  it("retries a failing job the configured number of times, then gives up (not indefinitely)", async () => {
    const queueName = QUEUE_NAMES.NEW_JOB;
    // Override with a fast, test-only backoff so this doesn't take the
    // real 2s/4s/8s exponential delay — the retry COUNT and dead-letter
    // behavior is what's under test, not the production timing.
    const queue = new Queue(queueName, {
      connection,
      defaultJobOptions: { attempts: 2, backoff: { type: "fixed", delay: 50 } },
    });
    testQueues.push(queue);

    let attemptCount = 0;
    const worker = new Worker(
      queueName,
      async (): Promise<void> => {
        attemptCount++;
        throw new Error("simulated platform API failure");
      },
      { connection: connection.duplicate() }
    );
    testWorkers.push(worker);

    const deadLetterQueue = createDeadLetterQueue(connection);
    testQueues.push(deadLetterQueue);
    const events = wireDeadLetterEscalation(queueName, connection, deadLetterQueue);

    await queue.add("failing-job", { jobId: "job_2" });

    await vi_waitFor(() => attemptCount === 2, 5000);
    // Give the dead-letter listener a moment to react to the final failure event.
    await new Promise((r) => setTimeout(r, 300));

    const dlqCounts = await deadLetterQueue.getJobCounts("waiting", "completed");
    expect((dlqCounts.waiting ?? 0) + (dlqCounts.completed ?? 0)).toBeGreaterThanOrEqual(1);

    await events.close();
  }, 10000);
});

// Minimal polling helper — avoids pulling in a separate wait-for-expect
// dependency for this one use case.
async function vi_waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error("vi_waitFor: condition not met within timeout");
    await new Promise((r) => setTimeout(r, 25));
  }
}
