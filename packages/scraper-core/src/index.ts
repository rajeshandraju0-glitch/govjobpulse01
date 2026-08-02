// Per-source scraper modules (SSC, UPSC, IBPS, RRB, ...) live here,
// one isolated module per source, per Section 4.
// TODO(Phase 3): before writing any scraper, check each target site's
// robots.txt and terms of service; log/flag ambiguous cases rather than
// scraping first and asking later. Then implement one scraper end-to-end
// (simplest official source) and only generalize the abstraction after
// that's proven, per Section 4's explicit instruction not to build a
// generic framework against zero real examples.

export {};
