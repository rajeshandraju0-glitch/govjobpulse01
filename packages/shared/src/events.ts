// Internal in-process event bus and typed event definitions.
export interface JobCreatedPayload { jobId: string; slug: string; sourceSlug: string | null; }
export interface JobUpdatedPayload { jobId: string; slug: string; changedFields: string[]; }
export interface JobPublishedPayload { jobId: string; slug: string; publishedAt: Date; }
export interface JobDeletedPayload { jobId: string; slug: string; }
export interface NotificationSentPayload { notificationId: string; jobId: string; provider: string; status: "SENT" | "FAILED"; }
export interface ScraperCompletedPayload { sourceSlug: string; jobsCreated: number; jobsSkippedDuplicate: number; durationMs: number; }
export interface ScraperFailedPayload { sourceSlug: string; errorMessage: string; }

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

  emit<E extends EventName>(event: E, payload: GovJobPulseEvents[E]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      try { listener(payload); } catch (err) {
        console.error(`[event-bus] listener for "${event}" threw:`, err);
      }
    }
  }

  listenerCount(event: EventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

export const eventBus = new EventBus();
