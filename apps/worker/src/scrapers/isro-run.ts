// Thin CLI entrypoint for running just the ISRO scraper on demand
// (`pnpm --filter @govjobpulse/worker scrape:isro`). The actual logic
// generalized to run-scraper.ts's runScraperModule() in Phase 4 — this
// file now just wires ISRO's module into it.

import { isroScraperModule } from "@govjobpulse/scraper-core";
import { runScraperModule } from "../run-scraper";

if (require.main === module) {
  runScraperModule(isroScraperModule)
    .then(() => {
      console.log("ISRO scraper run complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("ISRO scraper run failed:", err);
      process.exit(1);
    });
}
