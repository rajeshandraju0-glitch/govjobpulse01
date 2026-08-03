// Scrapers, queues, scheduled jobs.
// TODO(Phase 4): cron scheduler (every 30 min) that runs each registered
// source's scraper, with retries and staleness tracking for the admin
// view. For now this just re-exports the one scraper that exists.
// TODO(Phase 8): BullMQ queues for notifications, disabled providers only.

export { runIsroScraper } from "./scrapers/isro-run";
