// Section 4: "Scheduler: cron every 30 minutes, retries failed
// scrapers, logs every execution." Retry logic factored out as a pure,
// mockable wrapper so it's unit-testable without real timers/network.

export interface RetryOptions {
  retries: number;
  /** Base delay in ms; actual delay is baseDelayMs * 2^attempt (exponential backoff). */
  baseDelayMs: number;
  onRetry?: (attempt: number, error: unknown) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { retries, baseDelayMs, onRetry, sleep = defaultSleep } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      onRetry?.(attempt + 1, err);
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }

  throw lastError;
}
