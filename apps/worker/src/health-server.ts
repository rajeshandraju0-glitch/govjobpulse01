// Section 9: "/health, /ready, /live endpoints." apps/worker has no
// HTTP server otherwise — it's cron jobs + CLI scripts. A container
// orchestrator still needs an HTTP surface to probe worker's health,
// so this is a deliberately minimal server (Node's built-in `http`,
// no Express) with exactly the 3 routes, nothing else.
//
// "Ready" for a worker means something different than for web/admin:
// not "can I serve a request" but "is the scraper scheduler actually
// producing recent ScraperLog rows" — reuses the same staleness logic
// from Phase 4's admin view (packages/scraper-core's computeAllStaleness),
// so a worker that's silently stopped running its cron (process alive,
// but the schedule broke somehow) shows as not-ready rather than
// falsely healthy.

import { createServer } from "node:http";
import { prisma, checkDatabaseHealth } from "@govjobpulse/database";
import { computeAllStaleness, type SourceLike, type ScraperLogLike } from "@govjobpulse/scraper-core";

const HEALTH_PORT = Number(process.env.WORKER_HEALTH_PORT ?? 3002);

async function checkSchedulerHealth(): Promise<{ healthy: boolean; detail: string }> {
  const sources = await prisma.source.findMany();
  if (sources.length === 0) {
    // No sources registered yet (e.g. fresh DB, scraper never run) —
    // not itself unhealthy, just nothing to report on yet.
    return { healthy: true, detail: "No sources registered yet." };
  }

  const logs = await prisma.scraperLog.findMany({
    where: { sourceId: { in: sources.map((s) => s.id) } },
    orderBy: { startedAt: "desc" },
    take: 50 * sources.length,
  });

  const logsBySourceSlug = new Map<string, ScraperLogLike[]>();
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  for (const log of logs) {
    const source = sourceById.get(log.sourceId);
    if (!source) continue;
    const list = logsBySourceSlug.get(source.slug) ?? [];
    list.push({ status: log.status, startedAt: log.startedAt, finishedAt: log.finishedAt });
    logsBySourceSlug.set(source.slug, list);
  }

  const sourceLikes: SourceLike[] = sources.map((s) => ({ slug: s.slug, name: s.name }));
  const staleness = computeAllStaleness(sourceLikes, logsBySourceSlug);
  const staleSources = staleness.filter((s) => s.level === "stale");

  if (staleSources.length > 0) {
    return {
      healthy: false,
      detail: `${staleSources.length} source(s) stale: ${staleSources.map((s) => s.sourceName).join(", ")}`,
    };
  }
  return { healthy: true, detail: `${sources.length} source(s), none stale.` };
}

export function startHealthServer(): void {
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.url === "/live") {
      res.writeHead(200);
      res.end(JSON.stringify({ status: "alive" }));
      return;
    }

    if (req.url === "/ready") {
      const db = await checkDatabaseHealth();
      res.writeHead(db.healthy ? 200 : 503);
      res.end(JSON.stringify({ status: db.healthy ? "ready" : "not_ready", database: db }));
      return;
    }

    if (req.url === "/health") {
      const [db, scheduler] = await Promise.all([checkDatabaseHealth(), checkSchedulerHealth()]);
      const healthy = db.healthy && scheduler.healthy;
      res.writeHead(healthy ? 200 : 503);
      res.end(
        JSON.stringify({
          status: healthy ? "healthy" : "unhealthy",
          timestamp: new Date().toISOString(),
          checks: { database: db, scheduler },
        })
      );
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(HEALTH_PORT, () => {
    console.log(`[health] Worker health server listening on :${HEALTH_PORT} (/live, /ready, /health)`);
  });
}
