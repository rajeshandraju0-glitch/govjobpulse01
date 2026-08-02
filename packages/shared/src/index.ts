// Cross-app utilities shared between web, api, worker, admin.
// TODO(Phase 5): the internal event bus (JobCreated, JobUpdated,
// JobPublished, JobDeleted, NotificationSent, ScraperCompleted,
// ScraperFailed) lives here as an in-process emitter per Section 5.
// TODO(Phase 3+): slug generation, date/pagination helpers, etc. land
// here as real modules need them — nothing speculative yet.

export {};
