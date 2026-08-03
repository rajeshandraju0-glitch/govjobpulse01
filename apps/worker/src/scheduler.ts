// Section 4: "Scheduler: cron every 30 minutes, retries failed
// scrapers, logs every execution (start, end, success/fail, error)."
//
// Uses node-cron rather than BullMQ's repeatable jobs — see CLAUDE.md's
// "Architecture decisions" for the reasoning: Redis+BullMQ is introduced
// in Section 7/8 specifically for the notification queues (still
// disabled placeholders at this phase), and standing up Redis now just
// for cron-like scheduling would be infra ahead of need. Revisit
// consolidating onto BullMQ if scraper scheduling and notification
// queues end up needing to share infrastructure later.
//
// NOT RUN in this sandbox — starting this process means holding a
// long-lived cron schedule against a real database, which needs the
// same working Postgres + generated Prisma client this sandbox's
// network restrictions block (see CLAUDE.md). Structurally correct;
// start this with `pnpm --filter @govjobpulse/worker scheduler` in an
// environment with normal network access.

import cron from "node-cron";
import { SCRAPER_REGISTRY } from "@govjobpulse/scraper-core";
import { eventBus } from "@govjobpulse/shared";
import { runScraperModule } from "./run-scraper";

const CRON_EXPRESSION = "*/30 * * * *"; // every 30 minutes

// First real subscribers to Section 5's event bus: logging is
// deliberately NOT inside run-scraper.ts itself — that module just
// emits, and doesn't know or care who's listening. This is the point of
// decoupling via events rather than the scraper runner calling a logger
// directly. Phase 8's notification adapters will subscribe to
// JobPublished the same way, once they exist.
eventBus.on("ScraperCompleted", (payload) => {
  console.log(
    `[event] ScraperCompleted: ${payload.sourceSlug} — ${payload.jobsCreated} created, ${payload.jobsSkippedDuplicate} duplicate(s) skipped (${payload.durationMs}ms)`
  );
});
eventBus.on("ScraperFailed", (payload) => {
  console.error(`[event] ScraperFailed: ${payload.sourceSlug} — ${payload.errorMessage}`);
});
eventBus.on("JobCreated", (payload) => {
  console.log(`[event] JobCreated: ${payload.slug} (source: ${payload.sourceSlug ?? "manual"})`);
});

async function runAllScrapers(): Promise<void> {
  console.log(`[scheduler] Starting run for ${SCRAPER_REGISTRY.length} source(s)...`);
  // Sequential, not Promise.all: keeps load on any single target site
  // low and keeps ScraperLog ordering easy to reason about. Revisit if
  // the registry grows large enough that a full sweep no longer
  // comfortably fits inside the 30-minute window.
  for (const module of SCRAPER_REGISTRY) {
    await runScraperModule(module);
  }
  console.log("[scheduler] Run complete.");
}

export function startScheduler(): void {
  console.log(`[scheduler] Scheduling scraper runs: "${CRON_EXPRESSION}" (every 30 minutes)`);
  cron.schedule(CRON_EXPRESSION, () => {
    runAllScrapers().catch((err) => {
      // A failure inside runAllScrapers itself (not an individual
      // scraper, which already catches its own errors into ScraperLog)
      // should be loud — this would mean something is wrong with the
      // scheduler loop itself, not a single source.
      console.error("[scheduler] Unexpected error in scheduled run:", err);
    });
  });
}

if (require.main === module) {
  startScheduler();
  // Run once immediately on startup too, so staleness data exists
  // right away rather than waiting up to 30 minutes for the first tick.
  runAllScrapers().catch((err) => console.error("[scheduler] Initial run failed:", err));
}
