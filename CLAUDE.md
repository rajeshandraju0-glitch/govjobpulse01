# CLAUDE.md — GovJobPulse project memory

This file is the source of truth for any Claude Code session picking up this
repo. Read this before doing anything else. Keep it current after every phase.

## Product identity (locked — do not redesign)

- **Name:** GovJobPulse
- **One-liner:** GovJobPulse tracks official government sources to bring
  students every Sarkari Naukri notification, admit card, result and answer
  key the moment it's released — verified, organised, and built for students
  who can't afford to miss a deadline.
- **Audience:** Indian students/job seekers (10th pass through PhD) — central,
  state, PSU, banking, railway, teaching, police, defence recruitment.
- **Design tokens (locked):**
  - primary `#2563EB`, secondary `#0F172A`, accent `#F59E0B`,
    success `#16A34A`, danger `#DC2626`, violet/cyan gradient-mesh hero
  - Typography: Space Grotesk (display), Inter (body/UI), JetBrains Mono
    (data — dates, vacancy counts, reference codes)
  - Signature visual language: verified-source badges — **never** fabricated
    "live" counters or fake sync timestamps (see Non-negotiable rules below)
  - Existing homepage/mobile HTML demos (if/when provided) are the visual
    source of truth to port into Next.js components in Phase 6 — not a
    starting point to redesign. **None were provided as of Phase 6** (this
    session had no access to them); Phase 6 was built directly from this
    section's written spec instead. If real demo files turn up later,
    reconcile the built pages against them rather than assuming Phase 6
    is the final word on layout/copy.

## Non-negotiable rules (apply to every phase)

1. Never remove existing features or break existing routes.
2. Never fabricate live-looking data. Every number shown to a user must be
   backed by real data once the backend exists; until then use durable,
   honest copy instead of invented metrics.
3. SEO must never regress — check against the Section 6 checklist (below)
   before marking any phase done that touches routing/metadata/rendering.
4. One phase per session turn. Stop and wait for explicit approval before
   starting the next.
5. Production-quality TypeScript only. No placeholder implementations
   unless explicitly marked `// TODO(Phase N): reason`.
6. Every new module independently testable, Docker/Dokploy compatible.
7. No secrets hardcoded anywhere. All credentials via env vars, validated
   at boot via `@govjobpulse/config` (fail fast with a clear error).

## Architecture decisions made so far

- **Monorepo tool: pnpm workspaces + Turborepo.** Chosen over hand-rolled
  path aliases or plain npm workspaces because this repo has 4 apps and 5
  shared packages with real build-order dependencies (e.g. `packages/database`
  must build before `apps/api` can typecheck against it), and Turborepo gives
  task orchestration + caching for that shape of repo. Revisit only if the
  monorepo's needs outgrow it — no reason to expect that at current scale.
- **Event bus: in-process emitter (not a message broker).** Deferred
  deliberately per Section 5 — MVP scale doesn't need Kafka/RabbitMQ/etc.
  Revisit explicitly (not by default) if/when there's a real cross-service
  need, e.g. worker and api running as genuinely separate deployables at
  meaningful scale.
- **Scraper scheduling: node-cron (not BullMQ).** Section 2 lists
  Redis+BullMQ as the stack's queue tech, but Section 7/8 ties BullMQ
  specifically to the notification queues, which are still disabled
  placeholders. Standing up Redis now just for cron-like scraper
  scheduling (Section 4) would be infra ahead of need. Revisit
  consolidating scraper scheduling onto BullMQ if it ends up needing to
  share infrastructure with the notification queues once those are real
  (Phase 8) — not a default, a deliberate re-check at that point.
- **Admin panel: Next.js**, not a separate frontend framework — keeps
  the stack to one frontend tool. Explicitly NOT governed by Section
  0.1's locked public design (that section only covers `apps/web`);
  admin reuses the brand's status colors and data typeface (JetBrains
  Mono) for legibility/consistency but has its own utilitarian,
  dark ops-console styling, and ships `noindex`/`nofollow` since it's
  never meant to be public.
- **Build script placeholder:** every package/app currently defines
  `"build": "tsc --noEmit"` since there's no real emit target yet (no
  Next.js/Express/Prisma code exists). This produces a harmless
  `WARNING no output files found` from Turborepo. Fix this once real
  build steps exist (Next.js build in Phase 6, tsc→dist for api/worker
  in Phase 2+, prisma generate in Phase 2) — update `turbo.json` outputs
  and each package's build script together at that point.

## Open items flagged during brief review

- ✅ **RBAC matrix — resolved in Phase 2.** `USER`: bookmarks, own profile.
  `ADMIN`: moderate jobs (draft→reviewed→published), edit job content, view
  scraper logs. `SUPER_ADMIN`: adds user/role management, notification
  provider credentials, system config. `GUEST` = unauthenticated, no DB row.
  Enforcement (middleware) is Phase 14 — the schema just has the `UserRole`
  enum for now.
- ✅ **Job archival policy — resolved in Phase 2.** Expired jobs
  (`applicationEnd` passed) stay `PUBLISHED`, not deleted/delisted. No
  `EXPIRED`/`ARCHIVED` status was added to the enum; "applications closed"
  is derived at query time from `applicationEnd < now()`. This preserves
  Section 6's SEO long-tail requirement — deleting/delisting pages would
  actively work against it.
- ✅ **Scraper legal/ToS compliance — addressed in Phase 3 for ISRO.**
  ISRO's Website Policy (isro.gov.in/Website_Policy.html, reviewed directly)
  explicitly permits reproducing site material free of charge in any format,
  conditioned on accurate reproduction, non-derogatory use, and prominently
  acknowledging the source. Could not fetch/verify isro.gov.in/robots.txt
  directly in this sandbox (see limitation below), so `checkRobotsAllowed()`
  in `packages/scraper-core/src/robots.ts` performs this check **at
  runtime, every scraper run** (not a one-time audit) and fails closed
  (disallows) on network error rather than assuming permission. Still
  open: doing this same review (policy + robots.txt) for each of the
  ~19 other sources before their scrapers are written.
- ✅ **Content reproduction / attribution pattern — resolved in Phase 3.**
  Given ISRO's explicit reuse-with-attribution policy, the pattern is:
  store `officialNotificationUrl` (already a required Job field) and
  surface it prominently in the UI as "Source: official notification" —
  Phase 6/7's job page template must not omit this. Revisit per-source
  if other sources' policies are more restrictive.
- ⬜ **PDF parsing reality (before Phase 4's PDF workstream):** many gov
  notification PDFs are scanned images / multi-column — plain text
  extraction (e.g. `pdf-parse`) won't be sufficient for all sources; OCR
  fallback likely needed. ISRO's notices do link a PDF (`notificationPdfUrl`
  in `sources/isro.ts`) that Phase 3 does not parse — the detail HTML page
  itself was structured enough to avoid needing PDF parsing for this one
  source, but that won't hold for most others.
- ⬜ **Review-queue bottleneck fallback (before Phase 4):** 20+ sources on a
  30-min cron could outpace a human reviewer. Confidence-scored auto-review
  is mentioned as a maybe-later in the brief — decide the interim fallback
  before this becomes a real backlog.

## Known environment limitation (this sandbox only)

Prisma's native query-engine binary downloads from `binaries.prisma.sh`,
which is **not** on this sandbox's allowed egress domain list (confirmed via
`x-deny-reason: host_not_allowed`). This means `prisma generate` /
`validate` / `migrate` / `format` cannot run inside this particular sandboxed
conversation — it's a network-layer restriction here, not a schema problem,
and will work normally in Claude Code, CI, or any environment with standard
network access. What I verified instead in Phase 2, given that constraint:
- A real local Postgres 16 instance was installed and running (via apt —
  `archive.ubuntu.com` is allowed) to prove the DB side works.
- Manual structural review of `schema.prisma`: brace balance, and every
  `@relation(fields: [...])` reference cross-checked against a matching
  scalar field in the same model.
- `packages/database/src/index.ts` (the PrismaClient singleton wrapper)
  typechecks cleanly against `@prisma/client`'s base stub types.
- **Not verified here:** an actual `prisma migrate dev` applying the schema
  to Postgres and generating real model types. **Do this first** in any
  environment with normal network access before trusting the schema
  further — run `pnpm --filter @govjobpulse/database db:migrate` then
  `db:seed`, and treat that as the real completion check for Phase 2.

**Second limitation, found in Phase 3:** this sandbox's `bash_tool` has no
general internet egress (only specific package registries — see the
network_configuration in the system prompt), so a real HTTP client
(`fetch`/`curl`/cheerio) run from inside the container cannot reach any
live government website. The separate `web_fetch`/`web_search` tools *can*
reach the live web, but return Markdown-converted content, not raw HTML —
so even they can't be used to inspect a page's actual DOM/CSS structure for
writing scraper selectors. Net effect: `packages/scraper-core`'s ISRO
parsing logic was written against fixture HTML reconstructed from
Markdown-converted content, not validated against real raw HTML. Treat any
new scraper's selectors as unverified until run against the live site from
an environment with normal network access (Claude Code, CI, or a real dev
machine) — write fixture-based unit tests here as usual, but budget a real
live-site smoke test before trusting a scraper in production.

## Environment variables (running log)

| Var | Introduced | Description |
|---|---|---|
| `NODE_ENV` | Phase 1 | `development` \| `production` \| `test`, validated via `@govjobpulse/config` |

(Grows as later phases add `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, notification
provider credentials, etc. — see `.env.example` for the checked-in template.)

## Section 6 — SEO regression checklist (re-check every phase that touches routing/metadata/rendering)

- [ ] SSR/SSG preserved where applicable
- [ ] Dynamic per-page metadata, canonical URLs, breadcrumbs intact
- [ ] JSON-LD (JobPosting, Organization, Breadcrumb, FAQ, SearchAction) intact
- [ ] robots.txt, sitemap.xml, news sitemap, HTML sitemap, RSS feed intact
      and sitemap still auto-updates on publish
- [ ] OG + Twitter Card metadata intact, branded OG image architecture
      unaffected
- [ ] Internal linking (related/prev/next/trending/popular) intact
- [ ] `seo_title`/`seo_description` generation path intact
- [ ] No SEO-breaking route changes without explicit sign-off

_Not yet applicable — no routes/metadata/rendering exist yet (Phase 1 is
scaffolding only). First real check-in: Phase 6 or Phase 7._

## Phase log

| Phase | Status | Notes |
|---|---|---|
| 1. Repo scaffolding + monorepo setup | ✅ Complete | pnpm workspaces + Turborepo; 4 apps + 5 packages scaffolded as placeholder TS packages; build/typecheck/lint/test all pass (12/12 tasks) across the workspace. No app framework code yet (Next.js/Express/Prisma all deferred to the phases that build against a real schema). |
| 2. Database schema | ⚠️ Complete, unverified by CLI | Prisma schema for Section 3's content model + resolved RBAC/archival open items + seed script for real categories/states. `pnpm run typecheck` passes 12/12 (doesn't need the engine). `pnpm run build` **fails** at `@govjobpulse/database` in this sandbox only — `prisma generate` needs `binaries.prisma.sh`, which this sandbox's egress proxy blocks (`host_not_allowed`). Verified everything short of that: real local Postgres 16 running, schema manually cross-checked for relation/brace consistency. **Before trusting this schema further, run `pnpm --filter @govjobpulse/database db:migrate` then `db:seed` in an environment with normal network access** — that's the real completion check this phase couldn't finish here. |
| 3. First scraper end-to-end + dup detection | ⚠️ Core logic verified, live run unverified | ISRO (isro.gov.in/Careers.html) chosen as first source: official, simple bilingual label/value table per notice, and — checked directly — ISRO's own Website Policy explicitly permits reproducing site material with attribution (resolves the content-attribution open item). `packages/scraper-core`: `robots.ts` (runtime robots.txt check, fails closed on network error, re-checked every run — not a one-time audit), `sources/isro.ts` (listing + detail parsing, split into pure `parse*Html` functions vs. thin `fetch*` network wrappers), `dedupe.ts` (Section 4's URL/advertisement-number/title matching). **21/21 vitest tests pass** against reconstructed fixtures + mocked fetch; `tsc --noEmit` clean for the package standalone. `apps/worker/src/scrapers/isro-run.ts` orchestrates robots-check → scrape → dedupe → `prisma.job.create(status: DRAFT)` → `ScraperLog`, wired for real but **not run against Postgres** (same Prisma CDN block as Phase 2) **or the live site** (this sandbox's fixtures were reconstructed from `web_fetch`'s Markdown-converted content, not raw HTML — the CSS selectors in `parseListingHtml`/`parseDetailHtml` are unverified against the real live DOM). Root `pnpm run typecheck`/`test` now fail workspace-wide because `worker` depends on `@govjobpulse/database`, cascading the Phase 2 Prisma block further — this is correct/expected behavior (the generated types genuinely don't exist yet), not a new bug. **Before trusting this scraper in production:** (1) run it against the real live page and confirm the selectors still match actual raw HTML, (2) run `db:migrate` + `db:seed` so `runIsroScraper()` can execute against a real Postgres and be confirmed end-to-end. |
| 4. Scraper generalization + scheduler + admin staleness view | ⚠️ Core logic verified, live run unverified | Generalized ISRO's proven shape into a `ScraperModule` interface (`packages/types`) + `SCRAPER_REGISTRY` (`packages/scraper-core/src/registry.ts`) — new sources register a module rather than the worker special-casing each one. Added `staleness.ts` (pure `computeSourceStaleness`/`computeAllStaleness`, the actual logic behind the admin view) and `retry.ts` (exponential-backoff wrapper). **32/32 vitest tests pass** (added 11: 7 staleness + 4 retry), `tsc --noEmit` clean for `packages/scraper-core` and `packages/types` standalone. `apps/worker`: `run-scraper.ts` generalizes Phase 3's ISRO-only runner into `runScraperModule()` (works for any registered source — dedupe, category via each module's `defaultCategorySlug`, organization upserted per-job from `organizationRaw`); `scheduler.ts` uses `node-cron` on a `*/30 * * * *` schedule, sequential per source, one failing source doesn't crash the loop. **Decision:** `node-cron` chosen over BullMQ for this — Redis+BullMQ is scoped to the *notification* queues (Section 7/8, still disabled placeholders), so standing up Redis now for cron-like scheduling would be infra ahead of need; revisit if scraper scheduling and notifications end up needing shared infra later. `apps/admin`: scaffolded Next.js 15 (App Router), one real screen — `/sources`, the staleness table Section 4 explicitly requires, server component querying Prisma + `computeAllStaleness()`, `noindex`/`nofollow` since it's an internal tool, bounded query (`take: 50 * sources`, not unbounded) per Section 10. Same two sandbox limitations as Phase 3 apply here too: `run-scraper.ts` and `app/sources/page.tsx` both fail `tsc --noEmit` **only** on the missing generated Prisma types (`prisma.source`/`JobStatus`/etc. don't exist without `prisma generate`) — not new bugs, same documented cause. **Before trusting this in production:** run `db:migrate` + `db:seed`, then `pnpm --filter @govjobpulse/admin dev` and `pnpm --filter @govjobpulse/worker scheduler` against a real Postgres, in an environment with normal network access. |
| 5. Event bus | ✅ Complete, fully verified | Typed in-process `EventBus` (`packages/shared/src/index.ts`) per Section 5 — payload map (`GovJobPulseEvents`) checked at compile time rather than untyped Node `EventEmitter` strings; not built on `node:events` so it's identical across worker/web/admin. Listener isolation (a throwing listener doesn't break others or propagate to the caller) and unsubscribe (`off()` + the function `on()` returns) are both real behavior, not just documented intent. **9/9 vitest tests pass, `tsc --noEmit` clean** — this package has no live-network or database dependency, so unlike Phases 2–4 there is no sandbox limitation here; this is a genuinely complete, fully-verified phase. **Wiring:** `JobCreated`, `ScraperCompleted`, `ScraperFailed` are emitted for real from `apps/worker/src/run-scraper.ts` (the code paths already exist — every scraper run). `scheduler.ts` subscribes and logs them, proving the decoupling (the runner doesn't know or care who's listening). `JobUpdated`, `JobPublished`, `JobDeleted`, `NotificationSent` are fully typed but **not yet emitted anywhere** — there's no admin moderation UI to update/publish/delete a job (Phase 9) or notification adapters to send anything (Phase 8) for those events to represent yet. Wire them at the real mutation point when those phases land, per the module's own header comment — don't emit speculatively. |
| 6. Public site core pages (real data, locked design) | ⚠️ Built to spec, unverified by build/run | **No homepage/mobile HTML demos were provided in this conversation** — built directly from Section 0.1's written spec (colors, Space Grotesk/Inter/JetBrains Mono, "verified-source badges, not fabricated live counters") rather than porting a demo pixel-for-pixel. If real demo files exist, reconcile this phase against them before treating it as final. Scaffolded Next.js 15 (App Router) + Tailwind with the locked tokens in `tailwind.config.ts`. Pages: home (`/`, hero + latest published jobs), job detail (`/jobs/[slug]`, prominent `VerifiedSourceBadge` linking to `officialNotificationUrl` per the Phase 3 attribution decision), category (`/categories/[slug]`), state (`/states/[slug]`), qualification (`/qualifications/[slug]`, enum-based via `QUALIFICATION_SLUGS`/`QUALIFICATION_LABELS` in `packages/types` — no DB table, matching Section 3). All list queries go through `lib/pagination.ts`'s hard-capped `clampPageSize` (Section 10, no unbounded queries). The Hero's "X verified openings" stat is a real Prisma `count()` passed as a prop, never hardcoded — consistent with Section 1 rule 2. Basic per-page `generateMetadata` only; the full Section 6 JSON-LD/sitemap/OG-image pass is explicitly Phase 7's scope, not pulled forward. **Three sandbox limitations apply, all documented, none new in kind:** (1) same Prisma-generate block as Phases 2–5 — `tsc --noEmit` shows both the expected `JobStatus` import errors and a new *symptom* of the same cause (implicit `any` on `.map()` callbacks, since untyped Prisma results cascade into component props); (2) same "can't verify against the live DOM" caveat doesn't apply here (no scraping involved) but the live-data rendering itself is unverified for the same DB reason; (3) **new finding this phase:** `next build` also fails here because `next/font/google` needs `fonts.googleapis.com` at build time, which isn't on this sandbox's allowed egress list — confirmed via the same `host_not_allowed` pattern as Prisma's CDN. This is a completely standard, always-reachable Google service in any real deployment; it's a sandbox artifact, not a design flaw, so I did not switch away from `next/font` to work around it. **Before trusting this in production:** run `db:migrate` + `db:seed`, then `pnpm --filter @govjobpulse/web build` and `dev` in an environment with normal network access — that's the real completion check. |
| 7. SEO implementation pass | ⬜ Not started | |
| 8. Notification adapters + queues (disabled) | ⬜ Not started | |
| 9. Admin Social Integrations panel | ⬜ Not started | |
| 10. Push + email subscription foundations | ⬜ Not started | |
| 11. Social sharing on job pages | ⬜ Not started | |
| 12. Analytics + monitoring foundations | ⬜ Not started | |
| 13. Performance pass | ⬜ Not started | |
| 14. Security pass | ⬜ Not started | |
| 15. Dev experience + deployment verification | ⬜ Not started | |
| 16. Future integration interface stubs | ⬜ Not started | |

## Tech stack (confirmed, Section 2)

Next.js 15 / React 19 / TypeScript / TailwindCSS / shadcn/ui / Framer Motion /
Lucide (web) · Node.js/Express/TypeScript (api) · PostgreSQL + Prisma (database)
· Redis + BullMQ (queue) · JWT + RBAC (auth) · Docker/Docker Compose/Dokploy
(deployment) · local storage for MVP, flag for object storage later.
