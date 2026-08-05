// Section 8: "daily/weekly digest schedulers — architecture only, no
// provider integration yet." This builds the actual scheduling +
// subscriber/job querying logic, and stops deliberately short of
// calling EmailProvider to send anything — see the TODO below for why
// that's a real interface gap, not laziness.
//
// Cron scheduling nuance: NotificationSettings.dailyDigestSendHourUtc/
// weeklyDigestDayOfWeek are admin-configurable at runtime (DB rows),
// but node-cron schedules are fixed strings set at registration time.
// Rather than dynamically re-registering a cron job whenever the
// setting changes (real complexity for little benefit at this scale),
// this runs an hourly check-in cron and only proceeds past it once the
// current UTC hour/day-of-week matches what's configured — a common,
// simple pattern for DB-configurable schedules without cron-string
// rewriting.

import cron from "node-cron";
import { prisma, JobStatus, SubscriberStatus } from "@govjobpulse/database";

async function getDigestSettings() {
  // Section 7's NotificationSettings model is deliberately a
  // single-row table (see packages/database's schema comment) —
  // find the one row, or fall back to defaults if it's never been
  // created (e.g. a fresh DB before any admin has touched settings).
  const settings = await prisma.notificationSettings.findFirst();
  return {
    dailyDigestSendHourUtc: settings?.dailyDigestSendHourUtc ?? 3,
    weeklyDigestDayOfWeek: settings?.weeklyDigestDayOfWeek ?? 1,
    globalKillSwitchEnabled: settings?.globalKillSwitchEnabled ?? false,
  };
}

async function runDailyDigestCheck(): Promise<void> {
  const settings = await getDigestSettings();
  if (settings.globalKillSwitchEnabled) return;

  const now = new Date();
  if (now.getUTCHours() !== settings.dailyDigestSendHourUtc) return;

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { status: SubscriberStatus.VERIFIED, dailyDigest: true },
    select: { id: true, email: true },
  });
  if (subscribers.length === 0) return;

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const newJobs = await prisma.job.findMany({
    where: { status: JobStatus.PUBLISHED, publishedAt: { gte: since } },
    select: { id: true, title: true, slug: true },
    take: 100, // Section 10: bounded
  });

  console.log(
    `[digest] Daily digest check: ${subscribers.length} subscriber(s) eligible, ${newJobs.length} job(s) published in the last 24h.`
  );

  if (newJobs.length === 0) {
    console.log("[digest] No new jobs — skipping send (nothing to digest).");
    return;
  }

  // TODO(interface gap, flagged not forced): sending the actual digest
  // needs a recipient-centric "one email, many jobs" shape — but
  // packages/notifications' NotificationProvider interface
  // (sendJob/sendBulk) is job-centric: "this one job, to the
  // pre-configured channel." A digest is the opposite shape: one
  // subscriber, many jobs. Forcing this through sendJob() in a loop
  // (one call per job per subscriber) would be both wrong (readers
  // want ONE digest email, not N separate emails) and enormously
  // wasteful at scale. This needs either: (a) a second, distinct
  // interface for digest-style sends, or (b) EmailProvider gaining a
  // sendDigest(recipient, jobs[]) method alongside sendJob(). Deferring
  // that design decision rather than picking one under Phase 10's
  // "architecture only" scope — this is exactly the kind of thing that
  // should be decided deliberately, the same way the event bus's
  // process-boundary issue was in Phase 9.5, not smuggled in as a
  // side effect of finishing this phase's checklist.
  console.log(
    `[digest] Would send digest of ${newJobs.length} job(s) to ${subscribers.length} subscriber(s) — actual send not implemented (see TODO in this file).`
  );
}

async function runWeeklyDigestCheck(): Promise<void> {
  const settings = await getDigestSettings();
  if (settings.globalKillSwitchEnabled) return;

  const now = new Date();
  if (now.getUTCDay() !== settings.weeklyDigestDayOfWeek || now.getUTCHours() !== settings.dailyDigestSendHourUtc) {
    return;
  }

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { status: SubscriberStatus.VERIFIED, weeklyDigest: true },
    select: { id: true, email: true },
  });
  if (subscribers.length === 0) return;

  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const newJobs = await prisma.job.findMany({
    where: { status: JobStatus.PUBLISHED, publishedAt: { gte: since } },
    select: { id: true, title: true, slug: true },
    take: 200,
  });

  console.log(
    `[digest] Weekly digest check: ${subscribers.length} subscriber(s) eligible, ${newJobs.length} job(s) published in the last 7 days. Actual send not implemented (same interface gap as the daily digest).`
  );
}

export function startDigestSchedulers(): void {
  console.log("[digest] Scheduling hourly digest check-ins (daily + weekly).");
  cron.schedule("0 * * * *", () => {
    runDailyDigestCheck().catch((err) => console.error("[digest] Daily digest check failed:", err));
    runWeeklyDigestCheck().catch((err) => console.error("[digest] Weekly digest check failed:", err));
  });
}
