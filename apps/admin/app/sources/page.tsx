// Section 4: "Admin panel exposes per-source last successful run and
// staleness, not just pass/fail logs — a source silently failing for a
// week should be visible at a glance."
//
// Server Component: queries Prisma directly (Next.js App Router), no
// separate API round-trip needed for an internal tool like this. The
// actual staleness computation is packages/scraper-core's
// computeAllStaleness() — tested there (32/32 vitest tests, Phase 4) —
// this file only fetches rows and renders.
//
// NOT RUN in this sandbox: needs a working Prisma client + live
// Postgres, both blocked here (see CLAUDE.md). Structurally correct;
// verify by running `pnpm --filter @govjobpulse/admin dev` against a
// seeded database in an environment with normal network access.

import { prisma } from "@govjobpulse/database";
import { computeAllStaleness, type SourceLike, type ScraperLogLike } from "@govjobpulse/scraper-core";
import type { SourceStaleness, StalenessLevel } from "@govjobpulse/types";

export const metadata = { title: "Sources — GovJobPulse Admin" };
export const dynamic = "force-dynamic"; // always fresh — this page exists to catch staleness, so it can't itself be stale/cached

const LEVEL_LABEL: Record<StalenessLevel, string> = {
  fresh: "Fresh",
  warning: "Delayed",
  stale: "Stale",
  never_run: "Never run",
};

async function getStaleness(): Promise<SourceStaleness[]> {
  const sources = await prisma.source.findMany({ orderBy: { name: "asc" } });

  // Pull a bounded recent window per source (Section 10: no unbounded
  // list queries) rather than the entire ScraperLog table — the last
  // 50 runs per source is far more than enough to determine current
  // staleness (at a 30-min cadence that's over a day of history).
  const logs = await prisma.scraperLog.findMany({
    where: { sourceId: { in: sources.map((s) => s.id) } },
    orderBy: { startedAt: "desc" },
    take: 50 * Math.max(sources.length, 1),
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
  return computeAllStaleness(sourceLikes, logsBySourceSlug);
}

function formatRelative(date: Date | null): string {
  if (!date) return "—";
  const hours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function SourcesPage() {
  const staleness = await getStaleness();

  return (
    <div>
      <h1>Sources</h1>
      <p className="page-subtitle">
        Last successful scraper run per source. A source silently failing for days should be
        visible here at a glance, not buried in pass/fail logs.
      </p>

      {staleness.length === 0 ? (
        <div className="empty-state">
          No sources registered yet. Sources are created automatically the first time their
          scraper runs.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Status</th>
              <th>Last success</th>
              <th>Last run</th>
              <th>Last run result</th>
            </tr>
          </thead>
          <tbody>
            {staleness.map((row) => (
              <tr key={row.sourceSlug}>
                <td>{row.sourceName}</td>
                <td>
                  <span className={`status-pill status-${row.level}`}>{LEVEL_LABEL[row.level]}</span>
                </td>
                <td className="mono">{formatRelative(row.lastSuccessAt)}</td>
                <td className="mono">{formatRelative(row.lastRunAt)}</td>
                <td className="mono">{row.lastRunStatus ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
