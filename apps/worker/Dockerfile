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

FROM deps AS builder
COPY . .
RUN pnpm --filter @govjobpulse/database db:generate

FROM node:20-slim AS runner
WORKDIR /repo
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nodeuser
COPY --from=builder /repo ./
USER nodeuser
EXPOSE 3002
CMD ["node", "node_modules/.bin/pnpm", "--filter", "@govjobpulse/worker", "scheduler"]
