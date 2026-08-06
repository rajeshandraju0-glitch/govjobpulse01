# Same status as apps/web/Dockerfile — minimal and functional, not yet
# hardened. See that file's header comment for the full reasoning.
FROM node:20-slim

WORKDIR /repo

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
RUN pnpm --filter @govjobpulse/admin build

EXPOSE 3001
CMD ["pnpm", "--filter", "@govjobpulse/admin", "start"]
