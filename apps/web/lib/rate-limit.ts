import { createCacheClient, checkRateLimit, type RateLimitResult } from "@govjobpulse/cache";

// Same singleton pattern as lib/cache.ts — one connection per process,
// and silently no-ops (allows the request) if REDIS_URL isn't set,
// consistent with rate limiting being a defense-in-depth layer, not a
// hard dependency the site should fail without.
const globalForRateLimit = globalThis as unknown as {
  rateLimitClient: ReturnType<typeof createCacheClient> | undefined;
};

function getRateLimitClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  if (!globalForRateLimit.rateLimitClient) {
    globalForRateLimit.rateLimitClient = createCacheClient(redisUrl);
  }
  return globalForRateLimit.rateLimitClient;
}

/**
 * IP-based rate limiting for a public endpoint. `request` must be the
 * incoming Next.js Request so we can read the client's address —
 * behind a reverse proxy (the norm in production), this needs
 * x-forwarded-for; falls back to "unknown" locally, where per-IP
 * limiting isn't meaningful anyway.
 */
export async function rateLimitRequest(
  request: Request,
  routeName: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const client = getRateLimitClient();
  if (!client) return { allowed: true, remaining: limit, limit };

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `ratelimit:${routeName}:${ip}`;
  return checkRateLimit(client, key, limit, windowSeconds);
}
