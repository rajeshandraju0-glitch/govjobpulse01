import { createCacheClient, getOrSetCache, type GetOrSetOptions } from "@govjobpulse/cache";

// Singleton, same reasoning as packages/database's PrismaClient
// singleton (Phase 2): one connection pool per process, not one per
// request. If REDIS_URL isn't set, caching is silently skipped
// (callers fall through to fetchFresh directly) rather than crashing
// pages that don't strictly need caching to function — Section 10's
// caching is a performance optimization, not a hard dependency the
// site should fail without.
const globalForCache = globalThis as unknown as {
  cacheClient: ReturnType<typeof createCacheClient> | undefined;
};

function getCacheClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  if (!globalForCache.cacheClient) {
    globalForCache.cacheClient = createCacheClient(redisUrl);
  }
  return globalForCache.cacheClient;
}

export async function withCache<T>(key: string, options: GetOrSetOptions, fetchFresh: () => Promise<T>): Promise<T> {
  const client = getCacheClient();
  if (!client) return fetchFresh();
  return getOrSetCache(client, key, options, fetchFresh);
}
