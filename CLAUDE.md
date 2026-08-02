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
    starting point to redesign.

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
- **Build script placeholder:** every package/app currently defines
  `"build": "tsc --noEmit"` since there's no real emit target yet (no
  Next.js/Express/Prisma code exists). This produces a harmless
  `WARNING no output files found` from Turborepo. Fix this once real
  build steps exist (Next.js build in Phase 6, tsc→dist for api/worker
  in Phase 2+, prisma generate in Phase 2) — update `turbo.json` outputs
  and each package's build script together at that point.

## Open items flagged during brief review (not yet decided — decide before the phase that needs them)

- **Scraper legal/ToS compliance (before Phase 3):** check robots.txt and
  ToS for each official source before writing extraction logic; log/flag
  ambiguous cases rather than scraping first and asking later.
- **PDF parsing reality (before Phase 3's PDF workstream):** many gov
  notification PDFs are scanned images / multi-column — plain text
  extraction (e.g. `pdf-parse`) won't be sufficient for all sources; OCR
  fallback likely needed. Don't assume text-layer extraction is enough.
- **RBAC matrix (before Phase 2's schema, or Phase 14 latest):** roles are
  named (Guest, Registered User, Admin, Super Admin) but permissions per
  role aren't specified yet — who can move draft→reviewed→published, edit
  source config, view scraper logs.
- **Job archival policy (before Phase 2's schema is locked):** what happens
  to a Job after `application_end` passes — archived vs. delisted vs. kept
  live with an "applications closed" state (affects SEO long-tail traffic
  and the `status` enum design).
- **Review-queue bottleneck fallback (before Phase 4):** 20+ sources on a
  30-min cron could outpace a human reviewer. Confidence-scored auto-review
  is mentioned as a maybe-later in the brief — decide the interim fallback
  (e.g. auto-flag high-confidence diffs differently from brand-new listings)
  before this becomes a real backlog.
- **Content reproduction / attribution pattern (before Phase 3):** decide
  whether job descriptions get rewritten/summarized vs. reproduced from
  source PDFs, and make linking back to `official_notification_url`
  mandatory in the UI (field already exists in the Section 3 schema).

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
| 2. Database schema | ⬜ Not started | |
| 3. First scraper end-to-end + dup detection | ⬜ Not started | |
| 4. Scraper generalization + scheduler + admin staleness view | ⬜ Not started | |
| 5. Event bus | ⬜ Not started | |
| 6. Public site core pages (real data, locked design) | ⬜ Not started | |
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
