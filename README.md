# GovJobPulse

Indian Government Job Portal — aggregates recruitment notifications, admit cards,
results, answer keys, and syllabus updates from official government sources only,
and publishes them as verified, SEO-optimized listings.

- **`ARCHITECTURE.md`** — system design, data flow, why the boundaries are where they are
- **`API.md`** — the actual HTTP endpoint surface
- **`CLAUDE.md`** — phase-by-phase build log, every decision with its reasoning,
  and the running list of known gaps/open items

## Quickstart

```bash
pnpm install
cp .env.example .env   # then fill in real values — see the comments in that file
```

You'll need a real Postgres and (for notifications/caching/rate-limiting) a real
Redis reachable via `DATABASE_URL`/`REDIS_URL`. Then:

```bash
pnpm --filter @govjobpulse/database db:migrate
pnpm --filter @govjobpulse/database db:seed   # seeds categories, states, notification
                                                # provider configs, and (if
                                                # INITIAL_ADMIN_EMAIL/PASSWORD are set)
                                                # the first SUPER_ADMIN account
```

```bash
pnpm run build       # turbo run build across all apps/packages
pnpm run typecheck   # turbo run typecheck across all apps/packages
pnpm run lint        # turbo run lint across all apps/packages
pnpm run test        # turbo run test across all apps/packages
```

Per-app dev servers:

```bash
pnpm --filter @govjobpulse/web dev       # public site, :3000
pnpm --filter @govjobpulse/admin dev     # admin console, :3001 (needs login — see below)
pnpm --filter @govjobpulse/worker scheduler   # scraper cron + digest checks + health server
```

### First admin login

Set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` in `.env` before running
`db:seed` — this creates one `SUPER_ADMIN` account (no hardcoded default
credentials exist anywhere in this codebase). Unset those two vars after the
first successful seed run.

### Docker

```bash
docker compose up
```

**Not verified end-to-end** — the sandboxed environment this repo was built in
has no `docker` binary available. The compose file and Dockerfiles are written
and manually reviewed (including against real Dokploy documentation), but
`docker compose up` actually working has not been confirmed by running it. See
`CLAUDE.md`'s Phase 15 entry before relying on this in production.

## Monorepo layout

```
/apps
  web        — Next.js 15 public site (App Router)
  admin      — Next.js 15 internal ops console, JWT-authenticated
  worker     — scrapers, queues, cron jobs, digest checks (no HTTP framework)
  api        — scaffolded, deliberately never built out — see ARCHITECTURE.md
/packages
  database        — Prisma schema + client singleton, shared health-check/audit-log helpers
  types           — cross-app TypeScript types
  shared          — event bus, SEO generators, subscription tokens, share-link builders
  config          — Zod-validated env schema
  scraper-core    — per-source scraper modules, robots.txt checking, dedup, staleness
  notifications   — 8 platform adapters (all disabled by default) + BullMQ queue config
  cache           — Redis cache-aside + rate limiting
  auth            — password hashing (scrypt) + JWT (jose)
```

Package manager: pnpm workspaces. Task runner: Turborepo.

## Testing

Every package with real logic has a real test suite — 129+ tests across
`packages/shared`, `packages/scraper-core`, `packages/notifications`,
`packages/cache`, `packages/auth`, and `apps/web`. Several suites run against
a real local Redis (`packages/notifications`, `packages/cache`) rather than
mocks, to genuinely verify BullMQ/caching/rate-limiting behavior including
real TTL expiry. `apps/web`'s API route handlers are tested with a mocked
Prisma client, exercising the actual exported Route Handler functions.

Not currently testable in every environment: anything requiring a generated
Prisma client (`prisma generate` needs network access to Prisma's engine CDN)
or a real browser. See `CLAUDE.md` for exactly what was and wasn't verified,
phase by phase.

## Status

Phases 1 through 14 (plus an inserted Phase 9.5 — see `CLAUDE.md`'s Open
Items for why) are complete. Phase 15 (this document, developer experience +
deployment verification) is in progress. Phase 16 (future integration
interface stubs) has not started. See `CLAUDE.md` → "Phase log" for the full,
detailed history of what was built, what was verified, and what remains a
known, documented gap.
