# GovJobPulse — Architecture

This is a companion to `CLAUDE.md` (the phase-by-phase build log and
decision journal). This file is the "explain the system to a new
engineer" document — what exists, how the pieces talk to each other,
and why the boundaries are where they are. For *why a specific decision
was made in a specific phase*, `CLAUDE.md` has the full reasoning;
this file assumes those decisions and describes the resulting shape.

## Monorepo layout

```
/apps
  web        — Next.js public site (App Router). Talks to Postgres
               directly via Prisma; no separate API tier.
  admin      — Next.js internal ops console. JWT-authenticated
               (Phase 14). Moderation, source health, notification
               config, analytics.
  worker     — Node process, no HTTP framework. Cron-scheduled
               scrapers + digest checks, plus a minimal built-in
               health server (Section 9).
  api        — Scaffolded (Phase 1) but deliberately never built out.
               See "Why there's no separate API tier" below.
/packages
  database        — Prisma schema + client singleton + shared health-
                     check/audit-log helpers. Every app depends on this.
  types           — Cross-app TypeScript types with no runtime deps.
  shared          — Event bus, SEO generators, subscription tokens,
                     share-link builders. Pure logic, no I/O.
  config          — Zod-validated env schema (see the known gap below).
  scraper-core    — Per-source scraper modules + the general
                     ScraperModule interface, robots.txt checking,
                     duplicate detection, staleness computation.
  notifications   — Per-platform adapters (8 platforms) + BullMQ queue
                     config. All adapters disabled by default.
  cache           — Redis cache-aside + rate limiting.
  auth            — Password hashing (scrypt) + JWT (jose).
```

## Data flow: how a job gets from a government website to the public site

```
apps/worker (cron, every 30 min)
  -> checkRobotsAllowed()                      [scraper-core]
  -> ScraperModule.run()                        [scraper-core]
  -> dedupe against existing Job rows           [scraper-core]
  -> prisma.job.create({ status: DRAFT })       [database]
  -> eventBus.emit("JobCreated")                [shared]
  -> eventBus.emit("ScraperCompleted"/"Failed")

apps/admin (/moderation -- a human reviewer)
  -> markReviewed(jobId)   -> status: REVIEWED
  -> publishJob(jobId)     -> status: PUBLISHED, publishedAt: now()
    -> eventBus.emit("JobPublished")             [same-process listeners]
    -> BullMQ Queue.add() onto NEW_JOB queue      [cross-process -- see below]
    -> invalidateCache() for the home page        [cache]
    -> logAdminAction()                           [audit log]

apps/worker (subscribed to JobPublished -- same process as the queue consumer)
  -> BullMQ Worker processes NEW_JOB queue
  -> (would call packages/notifications' adapters -- the actual "send"
     step through a disabled-by-default adapter; digest emails have a
     documented, deferred interface gap -- see CLAUDE.md Phase 10)

apps/web (public visitor)
  -> getPublishedJobs() / getJobBySlug()          [reads only PUBLISHED]
  -> cached via packages/cache, 60s TTL, home page only
  -> trackJobView() / trackSearchQuery() / trackShareEvent()  [Section 9]
```

## Why the event bus AND a queue both exist

Phase 5 built `packages/shared`'s `EventBus` as a simple in-process
`emit`/`on` -- deliberately not a message broker, since at this scale a
broker would be infra ahead of need. Phase 9.5 discovered the real
limit of that choice: `apps/admin` (where a job gets published) and
`apps/worker` (where the notification consumer lives) are **different
Node processes**. An in-process event bus cannot cross that boundary --
`admin` emitting `JobPublished` on its own `EventBus` instance never
reaches a listener registered in `worker`'s process.

The fix wasn't to replace the event bus -- it's still useful for
same-process concerns (Phase 5's `ScraperCompleted`/`ScraperFailed`
logging, both emitted and consumed inside `apps/worker`). The fix was
recognizing that **cross-process notification** needs the queue
directly: `apps/admin`'s `publishJob` action enqueues onto BullMQ's
`NEW_JOB` queue using a `Queue` object (a lightweight *producer*
handle, safe in any process) -- never a `Worker` (the *consumer*, which
has exactly one owner: `apps/worker`). See
`packages/notifications/tests/web-decoupling.test.ts` for the test
that encodes and enforces this boundary.

## Why there's no separate API tier (`apps/api`)

Section 2 of the original brief lists `apps/api` (Express) as a core
app. No phase ever built it out. Every phase since 6 used Next.js
Route Handlers and Server Actions talking to Prisma directly instead --
`apps/web`'s SEO/tracking/subscription endpoints, `apps/admin`'s
moderation/integrations Server Actions. This was a deliberate choice,
documented in `CLAUDE.md`'s Phase 10 entry: nothing built so far needed
a framework-independent API surface, and Section 12/16 already defers
a "public REST API" as a future interface stub -- which reads as
confirmation this was expected, not an oversight. Revisit if a real
need shows up (e.g. a future mobile app).

## The RBAC boundary (Phase 14)

- **`GUEST`** -- unauthenticated. Can read published jobs, subscribe to
  the newsletter, register for push, search, share.
- **`USER`** ("Registered User" in Section 2) -- **not implemented**.
  Would own `Bookmark` rows. No public registration/login flow exists.
  This is why "most bookmarked" (Section 9) has no data -- see
  `CLAUDE.md`'s open items.
- **`ADMIN`** -- can access `apps/admin`, moderate jobs, view sources
  and analytics. Cannot toggle notification provider credentials.
- **`SUPER_ADMIN`** -- everything `ADMIN` can, plus `/integrations`
  (turning on live outbound posting to a real platform).

Enforcement lives in `apps/admin/middleware.ts`, which runs on every
request except `/login` -- not per-page checks scattered across route
files. See that file for the full reasoning on why an exclude-list
(not an allow-list) is the safer default.

## Known gaps (see `CLAUDE.md` for the full list with reasoning)

- `packages/config`'s `loadEnv()` fail-fast validation exists but is
  never actually called at any app's startup.
- Digest email/push sending is architecturally scoped but not
  implemented -- the `NotificationProvider` interface is job-centric
  (one job -> a channel), a digest needs recipient-centric (one
  subscriber -> many jobs); a real design decision, deferred not forced.
- A strict Content-Security-Policy header was deliberately left out of
  Phase 14's security headers pass -- see that phase's entry for why.
- `docker compose up` has never actually been run -- this sandbox has
  no `docker` binary. The compose file and Dockerfiles are written and
  reviewed, not executed.

## Sandbox limitations vs. real environment behavior

Several pieces of this codebase were built and reasoned about
correctly but could not be executed in the sandbox this was built in
(no general internet access, no Docker, and -- critically -- Prisma's
native query-engine binary CDN is blocked by the sandbox's egress
proxy). None of these are code problems; they're documented per-phase
in `CLAUDE.md` with exactly what was and wasn't verified. Before
trusting this system in production, run, in order:

1. `pnpm --filter @govjobpulse/database db:migrate` then `db:seed`
   (needs a reachable Postgres and normal network access for
   `prisma generate`)
2. `pnpm --filter @govjobpulse/worker scrape:isro` -- the one scraper
   that exists, against the real live site
3. `pnpm build` across the whole workspace
4. `docker compose up` from the repo root
