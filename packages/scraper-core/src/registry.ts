// Phase 4: registry of every ScraperModule. Adding a new source means
// writing packages/scraper-core/src/sources/<slug>.ts exporting a
// ScraperModule and adding it here — apps/worker's scheduler loops over
// this list generically rather than special-casing each source, per
// Section 4's "generalize the abstraction" instruction, now that ISRO
// (Phase 3) proved the shape out.
//
// Only ISRO exists so far. Each additional source (SSC, UPSC, IBPS, RRB,
// ...) needs its own robots.txt/ToS review before it's added here — see
// CLAUDE.md's open item on this.

import type { ScraperModule } from "@govjobpulse/types";
import { isroScraperModule } from "./sources/isro";

export const SCRAPER_REGISTRY: ScraperModule[] = [isroScraperModule];

export function getScraperModule(slug: string): ScraperModule | undefined {
  return SCRAPER_REGISTRY.find((m) => m.source.slug === slug);
}
