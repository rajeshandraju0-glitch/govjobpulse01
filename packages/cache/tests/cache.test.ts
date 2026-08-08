// Real Redis integration tests — same approach as Phase 8's BullMQ
// tests (this sandbox has a real local Redis via apt; see CLAUDE.md).

import { describe, it, expect, vi, afterAll, afterEach } from "vitest";
import { createCacheClient, getOrSetCache, invalidateCache, checkRateLimit } from "../src/index";

const REDIS_URL = process.env.REDIS_URL_TEST ?? "redis://localhost:6379";
const client = createCacheClient(REDIS_URL);

afterEach(async () => {
  await client.flushdb();
});

afterAll(async () => {
  await client.quit();
});

describe("getOrSetCache — real Redis", () => {
  it("calls fetchFresh on a cache miss and returns its result", async () => {
    const fetchFresh = vi.fn().mockResolvedValue({ value: 42 });
    const result = await getOrSetCache(client, "test:miss", { ttlSeconds: 60 }, fetchFresh);
    expect(result).toEqual({ value: 42 });
    expect(fetchFresh).toHaveBeenCalledTimes(1);
  });

  it("returns the cached value on a hit WITHOUT calling fetchFresh again", async () => {
    const fetchFresh = vi.fn().mockResolvedValue({ value: 1 });
    await getOrSetCache(client, "test:hit", { ttlSeconds: 60 }, fetchFresh);

    const secondFetch = vi.fn().mockResolvedValue({ value: 999 }); // should never be called
    const result = await getOrSetCache(client, "test:hit", { ttlSeconds: 60 }, secondFetch);

    expect(result).toEqual({ value: 1 }); // the ORIGINAL cached value, not 999
    expect(secondFetch).not.toHaveBeenCalled();
  });

  it("actually expires after the real TTL and calls fetchFresh again", async () => {
    const fetchFresh = vi.fn().mockResolvedValueOnce({ value: "first" }).mockResolvedValueOnce({ value: "second" });

    const first = await getOrSetCache(client, "test:ttl", { ttlSeconds: 1 }, fetchFresh);
    expect(first).toEqual({ value: "first" });

    // Real wait for real Redis TTL expiry — this is what makes this a
    // genuine integration test rather than a mocked assertion about
    // what TTL *should* do.
    await new Promise((r) => setTimeout(r, 1200));

    const second = await getOrSetCache(client, "test:ttl", { ttlSeconds: 1 }, fetchFresh);
    expect(second).toEqual({ value: "second" });
    expect(fetchFresh).toHaveBeenCalledTimes(2);
  }, 5000);

  it("different keys are cached independently", async () => {
    await getOrSetCache(client, "test:key-a", { ttlSeconds: 60 }, async () => "a-value");
    await getOrSetCache(client, "test:key-b", { ttlSeconds: 60 }, async () => "b-value");

    const a = await getOrSetCache(client, "test:key-a", { ttlSeconds: 60 }, async () => "should-not-be-called");
    const b = await getOrSetCache(client, "test:key-b", { ttlSeconds: 60 }, async () => "should-not-be-called");

    expect(a).toBe("a-value");
    expect(b).toBe("b-value");
  });

  it("falls back to fetchFresh (not throwing) when Redis is unreachable", async () => {
    const brokenClient = createCacheClient("redis://localhost:1"); // nothing listening here
    const fetchFresh = vi.fn().mockResolvedValue("fallback-value");

    const result = await getOrSetCache(brokenClient, "test:broken", { ttlSeconds: 60 }, fetchFresh);

    expect(result).toBe("fallback-value");
    expect(fetchFresh).toHaveBeenCalledTimes(1);
    brokenClient.disconnect();
  });
});

describe("invalidateCache — real Redis", () => {
  it("removes a cached value so the next getOrSetCache call is a real miss", async () => {
    const fetchFresh = vi.fn().mockResolvedValueOnce("original").mockResolvedValueOnce("after-invalidation");

    await getOrSetCache(client, "test:invalidate", { ttlSeconds: 60 }, fetchFresh);
    await invalidateCache(client, "test:invalidate");

    const result = await getOrSetCache(client, "test:invalidate", { ttlSeconds: 60 }, fetchFresh);
    expect(result).toBe("after-invalidation");
    expect(fetchFresh).toHaveBeenCalledTimes(2);
  });
});

describe("checkRateLimit — real Redis", () => {
  it("allows requests up to the limit", async () => {
    const key = "test:ratelimit:a";
    for (let i = 0; i < 3; i++) {
      const result = await checkRateLimit(client, key, 3, 60);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests once the limit is exceeded within the window", async () => {
    const key = "test:ratelimit:b";
    await checkRateLimit(client, key, 2, 60);
    await checkRateLimit(client, key, 2, 60);
    const third = await checkRateLimit(client, key, 2, 60);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("resets after the real window expires", async () => {
    const key = "test:ratelimit:c";
    await checkRateLimit(client, key, 1, 1); // limit of 1, 1-second window
    const blocked = await checkRateLimit(client, key, 1, 1);
    expect(blocked.allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 1200)); // real wait for real expiry

    const afterReset = await checkRateLimit(client, key, 1, 1);
    expect(afterReset.allowed).toBe(true);
  }, 5000);

  it("tracks different keys independently", async () => {
    const a = await checkRateLimit(client, "test:ratelimit:d1", 1, 60);
    const b = await checkRateLimit(client, "test:ratelimit:d2", 1, 60);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  it("fails open (allows the request) when Redis is unreachable", async () => {
    const brokenClient = createCacheClient("redis://localhost:1");
    const result = await checkRateLimit(brokenClient, "test:broken-ratelimit", 1, 60);
    expect(result.allowed).toBe(true);
    brokenClient.disconnect();
  });
});
