# Minimal, functional Dockerfile — NOT yet hardened (multi-stage
# build optimization, non-root user, layer caching tuning, etc. are
# explicitly Phase 15's "Developer experience + deployment
# verification" job per Section 11). This exists now so Phase 12's
# docker-compose.yml has something real to build, per Section 9's
# "wire [health endpoints] into the Docker Compose / Dokploy config."
FROM node:20-slim

WORKDIR /repo

# Monorepo build: copy everything needed to resolve workspace deps
# before installing, so Docker's layer cache isn't busted by every
# source change.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/scraper-core/package.json packages/scraper-core/package.json
COPY packages/notifications/package.json packages/notifications/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json

RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @govjobpulse/database db:generate
RUN pnpm --filter @govjobpulse/web build

EXPOSE 3000
CMD ["pnpm", "--filter", "@govjobpulse/web", "start"]
