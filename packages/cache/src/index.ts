// Section 10: "Redis caching." Cache-aside pattern: try Redis first, on
// miss call the real data-fetching function and populate the cache.
// TTL-based expiry only — no manual invalidation logic, which keeps
// this simple and, more importantly, keeps staleness bounded and
// honest: a cached value is at most `ttlSeconds` old, never
// indefinitely stale because an invalidation call was missed somewhere.
// This is standard caching, not the "fabricated live data" Section 1
// rule 2 warns about — the data itself is always real, this only
// controls how fresh a read of it is.

import IORedis from "ioredis";

export function createCacheClient(redisUrl: string): IORedis {
  return new IORedis(redisUrl, { maxRetriesPerRequest: 1 });
}

export interface GetOrSetOptions {
  ttlSeconds: number;
}

/**
 * Returns the cached value for `key` if present; otherwise calls
 * `fetchFresh()`, caches the result, and returns it. If Redis itself is
 * unreachable, falls back to calling `fetchFresh()` directly rather
 * than throwing — a cache being down must never take down a page that
 * would otherwise render fine straight from the database. This is the
 * same "must keep working" principle Section 7 applies to notifications,
 * applied here to caching.
 */
export async function getOrSetCache<T>(
  client: IORedis,
  key: string,
  options: GetOrSetOptions,
  fetchFresh: () => Promise<T>
): Promise<T> {
  try {
    const cached = await client.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.error(`[cache] Redis GET failed for key "${key}", falling back to fresh fetch:`, err);
  }

  const fresh = await fetchFresh();

  try {
    await client.set(key, JSON.stringify(fresh), "EX", options.ttlSeconds);
  } catch (err) {
    // Failing to WRITE the cache is even less of a problem than failing
    // to read it — the caller already has a correct, fresh value in
    // hand either way. Log and move on.
    console.error(`[cache] Redis SET failed for key "${key}":`, err);
  }

  return fresh;
}

/**
 * Explicit invalidation for the rare case a value must not wait out
 * its TTL (e.g. right after a job is published, per Phase 9.5's
 * publishJob action) — used sparingly; TTL expiry is the default and
 * preferred mechanism per this module's header comment.
 */
export async function invalidateCache(client: IORedis, key: string): Promise<void> {
  try {
    await client.del(key);
  } catch (err) {
    console.error(`[cache] Redis DEL failed for key "${key}":`, err);
  }
}

// Section 10: "rate limiting." Fixed-window counter — simpler than a
// sliding window, and precise-enough for the actual threat model here
// (spam/abuse of public POST endpoints like /api/subscribe, not a
// system with strict per-second SLA needs). Reuses the same Redis
// connection pattern as caching above.
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

export async function checkRateLimit(
  client: IORedis,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const current = await client.incr(key);
    if (current === 1) {
      // First request in this window — set the expiry now, so the
      // counter resets after windowSeconds regardless of how many
      // requests follow.
      await client.expire(key, windowSeconds);
    }
    return { allowed: current <= limit, remaining: Math.max(0, limit - current), limit };
  } catch (err) {
    // Same "must keep working" principle as caching: if Redis itself
    // is unreachable, fail OPEN (allow the request) rather than block
    // all traffic because a rate limiter's backing store is down. A
    // rate limiter that's temporarily not enforcing limits is a much
    // smaller problem than an outage taking down every public endpoint.
    console.error(`[rate-limit] Redis check failed for key "${key}", failing open:`, err);
    return { allowed: true, remaining: limit, limit };
  }
}
