# ─── Stage 1: deps ─────────────────────────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /repo

RUN npm install -g pnpm@9

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json              apps/web/package.json
COPY apps/admin/package.json            apps/admin/package.json
COPY apps/api/package.json              apps/api/package.json
COPY apps/worker/package.json           apps/worker/package.json
COPY packages/database/package.json     packages/database/package.json
COPY packages/shared/package.json       packages/shared/package.json
COPY packages/scraper-core/package.json packages/scraper-core/package.json
COPY packages/notifications/package.json packages/notifications/package.json
COPY packages/types/package.json        packages/types/package.json
COPY packages/config/package.json       packages/config/package.json
COPY packages/cache/package.json        packages/cache/package.json
COPY packages/auth/package.json         packages/auth/package.json

RUN pnpm install --frozen-lockfile

# ─── Stage 2: builder ──────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN pnpm --filter @govjobpulse/database db:generate
RUN pnpm --filter @govjobpulse/web build

# ─── Stage 3: runner ───────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy only the built output + runtime deps
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static     ./.next/static
COPY --from=builder /repo/apps/web/public           ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
