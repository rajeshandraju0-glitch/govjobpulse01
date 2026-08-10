# GovJobPulse — HTTP API surface

There is no separate REST API service (`apps/api` is unbuilt — see
`ARCHITECTURE.md`). This documents the actual HTTP endpoints that
exist, all as Next.js Route Handlers in `apps/web` or `apps/admin`.

## Public endpoints (`apps/web`, no auth required)

### `POST /api/subscribe`
Subscribe to email notifications (double opt-in).

**Body:** `{ "email": string, "dailyDigest"?: boolean, "weeklyDigest"?: boolean }`
**Rate limit:** 5 requests/hour/IP
**Responses:**
- `200` — `{ "message": string }` (always this shape, even for an
  already-subscribed email — no account-enumeration signal)
- `400` — `{ "error": string }` (invalid/missing email)
- `429` — `{ "error": string }` (rate limited)

### `GET /api/verify?token=...`
Confirms an email subscription via the link sent after `/api/subscribe`.
Single-use — the token is cleared after successful verification.

**Responses:** `200` confirmed / `400` missing token / `404` invalid
or already-used token / `410` expired token (24h TTL).

### `GET /api/unsubscribe?token=...`
One-click unsubscribe, no login required (standard email-list convention).

### `POST /api/push/subscribe`
Registers a push notification device/browser endpoint.

**Body:** `{ "endpoint": string, "platform": "WEB" | "IOS" | "ANDROID" }`
(exact-case; not normalized)
**Rate limit:** 10 requests/hour/IP

### `DELETE /api/push/subscribe?endpoint=...`
Deactivates a push subscription.

### `POST /api/track/share`
Records a share-button click (Section 9 analytics — "most shared jobs").

**Body:** `{ "jobId": string, "channel": "FACEBOOK" | "LINKEDIN" | "TWITTER" | "TELEGRAM" | "WHATSAPP" | "COPY_LINK" }`
**Rate limit:** 60 requests/hour/IP
**Note:** always returns `200 { "ok": true }` even if the underlying
tracking write fails — a tracking failure must never surface as an
error to someone just trying to share a job.

### `GET /api/health`, `/api/ready`, `/api/live`
Standard health-check endpoints (Section 9). `/live` never checks the
database (a DB outage should fail `/ready`, not trigger a restart-loop
via `/live`). `/health` returns a combined human-readable view.

### SEO/content feeds (no auth, all `GET`)
- `/sitemap.xml` — dynamic, regenerated per request from live data
- `/news-sitemap.xml` — Google News format, last 48h of publishes
- `/feed.xml` — RSS 2.0, last 50 published jobs
- `/sitemap-html` — human-readable equivalent of `/sitemap.xml`

## Admin endpoints (`apps/admin`, JWT-authenticated)

Every route below requires a valid session cookie
(`govjobpulse_admin_session`), enforced by `apps/admin/middleware.ts`.
There is no separate `/api/*` prefix for these — they're Server
Actions invoked from their respective pages, not standalone HTTP
routes callable independently. Listed here for completeness of what
state-changing operations exist and who can trigger them.

| Action | File | Required role | Effect |
|---|---|---|---|
| `login` | `app/login/actions.ts` | none (public) | Issues session cookie |
| `logout` | `app/login/actions.ts` | any session | Clears session cookie |
| `markReviewed(jobId)` | `app/moderation/actions.ts` | `ADMIN` | `Job.status: DRAFT -> REVIEWED` |
| `publishJob(jobId)` | `app/moderation/actions.ts` | `ADMIN` | `Job.status -> PUBLISHED`, enqueues notification, invalidates home cache, audit-logged |
| `toggleProviderEnabled(platform, enabled)` | `app/integrations/actions.ts` | `SUPER_ADMIN` only | Flips a notification platform's DB-level enabled flag, audit-logged unconditionally |
| `runProviderHealthCheck(slug)` | `app/integrations/actions.ts` | `SUPER_ADMIN` only | Makes a real HTTP request to that platform's API |

### `GET /api/health` (apps/admin)
Same shape as `apps/web`'s, plus real BullMQ queue-depth monitoring
per queue (Section 9's "queue monitoring").

## What's NOT here

- No public REST API for third-party consumption — Section 12/16
  explicitly defers this as a future interface stub.
- No webhook receivers.
- No GraphQL endpoint.
