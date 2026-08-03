// Section 5: internal event bus so modules stay decoupled. In-process
// emitter (not a message broker) — see CLAUDE.md's "Architecture
// decisions" for why, and when to revisit that.
//
// Core events per Section 5: JobCreated, JobUpdated, JobPublished,
// JobDeleted, NotificationSent, ScraperCompleted, ScraperFailed.
//
// Wiring status (Phase 5): JobCreated, ScraperCompleted, and
// ScraperFailed are emitted for real from
// apps/worker/src/run-scraper.ts — those code paths already exist
// (every scraper run). JobUpdated, JobPublished, JobDeleted, and
// NotificationSent are fully typed here but have no emit() call yet
// anywhere in the codebase — there's no admin moderation UI to
// update/publish/delete a job (Phase 9) and no notification adapters to
// send anything (Phase 8) for those events to represent yet. Wire them
// at the real mutation point when those phases land; don't emit them
// speculatively before there's a real state change to report.
//
// Deliberately typed against a payload map (GovJobPulseEvents) rather
// than Node's untyped EventEmitter, so `bus.emit("JobCreated", {...})`
// is checked at compile time against the right payload shape, and
// `bus.on("JobCreated", handler)` gives `handler` a typed parameter
// without a cast. Payloads carry ids/refs (jobId, slug), not full
// entities — listeners that need more than that should fetch it, so
// events can't go stale relative to what's actually in the database by
// the time a listener runs.

export interface JobCreatedPayload {
  jobId: string;
  slug: string;
  sourceSlug: string | null;
}

export interface JobUpdatedPayload {
  jobId: string;
  slug: string;
  changedFields: string[];
}

export interface JobPublishedPayload {
  jobId: string;
  slug: string;
  publishedAt: Date;
}

export interface JobDeletedPayload {
  jobId: string;
  slug: string;
}

export interface NotificationSentPayload {
  notificationId: string;
  jobId: string;
  provider: string;
  status: "SENT" | "FAILED";
}

export interface ScraperCompletedPayload {
  sourceSlug: string;
  jobsCreated: number;
  jobsSkippedDuplicate: number;
  durationMs: number;
}

export interface ScraperFailedPayload {
  sourceSlug: string;
  errorMessage: string;
}

export interface GovJobPulseEvents {
  JobCreated: JobCreatedPayload;
  JobUpdated: JobUpdatedPayload;
  JobPublished: JobPublishedPayload;
  JobDeleted: JobDeletedPayload;
  NotificationSent: NotificationSentPayload;
  ScraperCompleted: ScraperCompletedPayload;
  ScraperFailed: ScraperFailedPayload;
}

export type EventName = keyof GovJobPulseEvents;
export type Listener<E extends EventName> = (payload: GovJobPulseEvents[E]) => void;

/**
 * Minimal typed pub/sub, not built on Node's `events` module — keeps
 * this usable identically from apps/worker (Node) and apps/web/admin
 * (Next.js server components, also Node, but no reason to couple to a
 * Node-specific API when a ~20-line implementation covers what's
 * actually needed here).
 */
export class EventBus {
  private listeners = new Map<EventName, Set<Listener<any>>>();

  on<E extends EventName>(event: E, listener: Listener<E>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off<E extends EventName>(event: E, listener: Listener<E>): void {
    this.listeners.get(event)?.delete(listener);
  }

  /**
   * Runs every listener for `event`. A listener throwing does not stop
   * other listeners from running, and does not propagate to the
   * caller of emit() — one broken subscriber (e.g. a notification
   * adapter with a bug) must not be able to take down the module that
   * published the event.
   */
  emit<E extends EventName>(event: E, payload: GovJobPulseEvents[E]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[event-bus] listener for "${event}" threw:`, err);
      }
    }
  }

  listenerCount(event: EventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// Single shared instance across the process — modules import this
// directly rather than constructing their own EventBus, so publishing
// in one module reaches subscribers registered by another.
export const eventBus = new EventBus();
