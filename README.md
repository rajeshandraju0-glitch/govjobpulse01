# GovJobPulse

Indian Government Job Portal — aggregates recruitment notifications, admit cards,
results, answer keys, and syllabus updates from official government sources only.

See `CLAUDE.md` for product identity, architecture decisions, and current build phase.

## Quickstart

```bash
pnpm install
pnpm run build       # turbo run build across all apps/packages
pnpm run typecheck   # turbo run typecheck across all apps/packages
pnpm run lint        # turbo run lint across all apps/packages
pnpm run test        # turbo run test across all apps/packages
```

Copy `.env.example` to `.env` and fill in values before running anything that
needs them (none yet — this grows as later phases introduce real config).

## Monorepo layout

```
/apps
  web        — Next.js public site         (not yet scaffolded — Phase 6)
  api        — Express API                 (not yet scaffolded — Phase 2+)
  worker     — scrapers, queues, jobs       (not yet scaffolded — Phase 3+)
  admin      — admin panel                  (not yet scaffolded — Phase 4/9)
/packages
  database   — Prisma schema + client       (not yet scaffolded — Phase 2)
  shared     — cross-app utilities, event bus (Phase 5)
  scraper-core — one module per official source (Phase 3+)
  types      — shared TS types
  config     — env var loading + validation (fail-fast at boot)
```

Package manager: pnpm workspaces. Task runner: Turborepo. See `CLAUDE.md`
for why, and for the tradeoff notes on decisions made along the way.

## Status

Phase 1 (repo scaffolding) complete. See `CLAUDE.md` → "Phase log" for details.
