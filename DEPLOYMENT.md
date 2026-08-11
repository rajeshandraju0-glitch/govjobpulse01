# GovJobPulse — Ubuntu Deployment Guide
### Optimized for: 1 vCPU · 6 GB RAM · Ubuntu 22.04 LTS

---

## Architecture Overview

```
Internet → Nginx (reverse proxy + SSL) → Docker Compose
                                           ├── web     (Next.js, port 3000)
                                           ├── admin   (Next.js, port 3001)
                                           ├── worker  (Node cron, port 3002)
                                           ├── postgres (port 5432, internal)
                                           └── redis   (port 6379, internal)
```

> **Important:** With 1 vCPU and 6 GB RAM, building Docker images **on the server** will be slow and memory-hungry. The recommended strategy is to **build images locally (or in CI), push to a registry, and pull on the server**. This guide covers both approaches.

---

## Resource Budget (Estimated)

| Service         | RAM (idle) | RAM (peak) |
|-----------------|------------|------------|
| postgres        | ~150 MB    | ~300 MB    |
| redis           | ~30 MB     | ~80 MB     |
| web (Next.js)   | ~250 MB    | ~400 MB    |
| admin (Next.js) | ~200 MB    | ~350 MB    |
| worker (Node)   | ~100 MB    | ~200 MB    |
| Nginx           | ~20 MB     | ~50 MB     |
| OS + headroom   | ~500 MB    | —          |
| **Total**       | **~1.25 GB** | **~1.4 GB** |

> **Tip:** 6 GB is comfortable for this stack. You still have ~4.5 GB free — use 2 GB as swap just in case.

---

## Phase 1 — Server Bootstrap

SSH into your server and run every command as a non-root sudo user (create one if needed).

### 1.1 Create a deploy user

```bash
# As root
adduser deploy
usermod -aG sudo deploy
su - deploy
```

### 1.2 System update + swap

```bash
sudo apt update && sudo apt upgrade -y

# 2 GB swap (guards against OOM during npm install / builds)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Tune swappiness — prefer RAM, use swap as safety net
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 1.3 Install Docker + Docker Compose v2

```bash
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Let deploy user run Docker without sudo
sudo usermod -aG docker deploy
newgrp docker   # apply immediately
```

### 1.4 Install Nginx + Certbot

```bash
sudo apt install -y nginx
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

---

## Phase 2 — Optimized Dockerfiles (Multi-Stage Builds)

The existing Dockerfiles are functional but copy the entire monorepo into every image,
wasting build time and disk. Replace them with leaner multi-stage builds before pushing.

### 2.1 `apps/web/Dockerfile` (replace existing)

```dockerfile
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
```

> **Note:** The `standalone` output requires `output: 'standalone'` in `apps/web/next.config.js`. Add it if not present.

### 2.2 `apps/admin/Dockerfile` (replace existing)

```dockerfile
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
RUN pnpm --filter @govjobpulse/admin build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs
COPY --from=builder /repo/apps/admin/.next/standalone ./
COPY --from=builder /repo/apps/admin/.next/static     ./.next/static
USER nextjs
EXPOSE 3001
ENV PORT=3001 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

### 2.3 `apps/worker/Dockerfile` (replace existing)

```dockerfile
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
```

---

## Phase 3 — Production `docker-compose.prod.yml`

The `docker-compose.prod.yml` file is included at the repo root. It differs from
`docker-compose.yml` in these key ways:

- **No build context** — images are pulled from GHCR, not built on the server
- **Memory limits** per service to prevent OOM on a single-core machine
- **Redis** capped at `128mb` with LRU eviction (cache-aside pattern)
- **Postgres & Redis ports** are NOT exposed to the host — internal Docker network only
- **`restart: unless-stopped`** on all services for automatic recovery

To use it:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

---

## Phase 4 — Environment File

On the server, create `/home/deploy/govjobpulse/.env`. **Never commit this file.**

```bash
mkdir -p /home/deploy/govjobpulse
nano /home/deploy/govjobpulse/.env
```

Paste and fill in real values:

```bash
# ── Registry ────────────────────────────────────────────
REGISTRY=ghcr.io/YOUR_GITHUB_ORG
IMAGE_TAG=latest

# ── Postgres ────────────────────────────────────────────
POSTGRES_USER=govjobpulse
POSTGRES_PASSWORD=<generate: openssl rand -hex 20>
POSTGRES_DB=govjobpulse

# ── App URLs ────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL=https://www.yourdomain.com

# ── JWT ─────────────────────────────────────────────────
JWT_SECRET=<generate: openssl rand -hex 32>

# ── Redis ───────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Notification providers (optional, add as needed) ────
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_CHAT_ID=
```

Secure the file:

```bash
chmod 600 /home/deploy/govjobpulse/.env
```

---

## Phase 5 — Build & Push Images (from your local machine or CI)

> **Important:** Build on your local machine or GitHub Actions — NOT on the 1-core server.
> This saves ~10–15 minutes and avoids OOM kills.

### Option A: GitHub Actions (Recommended)

The workflow is already included at `.github/workflows/deploy.yml`.

Required GitHub Secrets:

| Secret | Value |
|--------|-------|
| `SERVER_HOST` | Your server's IP address |
| `SERVER_SSH_KEY` | Private SSH key for the `deploy` user |

The workflow runs automatically on every push to `main`:
1. Builds all 3 images on GitHub's runners (free, fast)
2. Pushes to GHCR
3. SSHes into your server and runs `docker compose pull && up -d`

### Option B: Build locally, push manually

```bash
# On your local machine
docker build -t ghcr.io/YOUR_ORG/govjobpulse-web:latest    -f apps/web/Dockerfile .
docker build -t ghcr.io/YOUR_ORG/govjobpulse-admin:latest  -f apps/admin/Dockerfile .
docker build -t ghcr.io/YOUR_ORG/govjobpulse-worker:latest -f apps/worker/Dockerfile .

# Login and push
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
docker push ghcr.io/YOUR_ORG/govjobpulse-web:latest
docker push ghcr.io/YOUR_ORG/govjobpulse-admin:latest
docker push ghcr.io/YOUR_ORG/govjobpulse-worker:latest
```

---

## Phase 6 — First Deploy on Server

```bash
ssh deploy@YOUR_SERVER_IP
cd /home/deploy/govjobpulse

# Copy docker-compose.prod.yml here (scp or paste directly)
# scp docker-compose.prod.yml deploy@YOUR_SERVER_IP:/home/deploy/govjobpulse/

# Login to GHCR to pull private images
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin

# Pull all images
docker compose -f docker-compose.prod.yml --env-file .env pull

# Start postgres + redis first
docker compose -f docker-compose.prod.yml --env-file .env up -d postgres redis

# Run DB migrations (run on every schema change)
docker compose -f docker-compose.prod.yml --env-file .env run --rm worker \
  pnpm --filter @govjobpulse/database db:migrate

# Seed initial admin account (ONLY first time)
docker compose -f docker-compose.prod.yml --env-file .env run --rm worker \
  pnpm --filter @govjobpulse/database db:seed

# Start everything
docker compose -f docker-compose.prod.yml --env-file .env up -d

# Verify all containers are healthy
docker compose -f docker-compose.prod.yml ps
```

---

## Phase 7 — Nginx Reverse Proxy

### 7.1 Create the site config

```bash
sudo nano /etc/nginx/sites-available/govjobpulse
```

```nginx
# Rate limiting zone
limit_req_zone $binary_remote_addr zone=web:10m rate=10r/s;

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options        "SAMEORIGIN"   always;
    add_header X-Content-Type-Options "nosniff"      always;
    add_header Referrer-Policy        "strict-origin-when-cross-origin" always;
    add_header X-XSS-Protection       "1; mode=block" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Next.js static assets — long cache
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Main web app
    location / {
        limit_req zone=web burst=20 nodelay;
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}

# Admin panel — separate subdomain
server {
    listen 443 ssl http2;
    server_name admin.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Optional: restrict admin to your IP only
    # allow YOUR.IP.ADDRESS;
    # deny all;

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/govjobpulse /etc/nginx/sites-enabled/
sudo nginx -t    # test config — must say "syntax is ok"
```

### 7.2 SSL Certificate

```bash
# Point your domain's DNS A record to the server IP first, then:
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d admin.yourdomain.com

sudo systemctl reload nginx
```

---

## Phase 8 — Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

> **Caution:** Do NOT expose ports 5432 (Postgres) or 6379 (Redis) to the internet.
> `docker-compose.prod.yml` keeps them on an internal Docker network. Verify with `sudo ufw status`.

---

## Phase 9 — Monitoring & Logs

### View logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service, last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 -f web
docker compose -f docker-compose.prod.yml logs --tail=100 -f worker
```

### Resource usage

```bash
docker stats                      # live container RAM/CPU
sudo apt install -y htop && htop  # system overview
```

### Health check all at once

```bash
curl -f http://localhost:3000/api/health && echo "web OK"
curl -f http://localhost:3001/api/health && echo "admin OK"
curl -f http://localhost:3002/health      && echo "worker OK"
```

### Auto-restart on server reboot

`restart: unless-stopped` in the compose file handles this automatically. Ensure Docker
starts on boot:

```bash
sudo systemctl enable docker
```

### Log rotation (prevent disk fill)

```bash
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
sudo systemctl restart docker
```

---

## Phase 10 — Database Backups

```bash
nano /home/deploy/backup-db.sh
```

```bash
#!/bin/bash
set -euo pipefail

source /home/deploy/govjobpulse/.env

BACKUP_DIR=/home/deploy/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

docker compose -f /home/deploy/govjobpulse/docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

# Keep only last 7 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_$TIMESTAMP.sql.gz"
```

```bash
chmod +x /home/deploy/backup-db.sh

# Schedule daily at 2 AM
crontab -e
# Add this line:
0 2 * * * /home/deploy/backup-db.sh >> /home/deploy/backup.log 2>&1
```

---

## Phase 11 — Deploying Updates

### Automatic (GitHub Actions — recommended)

```bash
git push origin main
# GitHub Actions builds → pushes → deploys automatically
```

### Manual

```bash
ssh deploy@YOUR_SERVER_IP
cd /home/deploy/govjobpulse

docker compose -f docker-compose.prod.yml --env-file .env pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --remove-orphans

# Run migrations if the Prisma schema changed
docker compose -f docker-compose.prod.yml --env-file .env run --rm worker \
  pnpm --filter @govjobpulse/database db:migrate

# Clean up old/dangling images
docker image prune -f
```

---

## Quick Reference Cheatsheet

| Task | Command |
|------|---------|
| Start all | `docker compose -f docker-compose.prod.yml up -d` |
| Stop all | `docker compose -f docker-compose.prod.yml down` |
| Restart one service | `docker compose -f docker-compose.prod.yml restart web` |
| View logs | `docker compose -f docker-compose.prod.yml logs -f` |
| Run DB migration | `docker compose -f docker-compose.prod.yml run --rm worker pnpm --filter @govjobpulse/database db:migrate` |
| Check container health | `docker compose -f docker-compose.prod.yml ps` |
| Check resource usage | `docker stats` |
| Pull + redeploy | `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d` |
| Backup DB | `/home/deploy/backup-db.sh` |

---

## Troubleshooting

### Container exits immediately

```bash
docker compose -f docker-compose.prod.yml logs web   # check the error
```

### OOM / Out of memory

```bash
free -h       # check available RAM
docker stats  # identify which container is consuming RAM
# Fix: add NODE_OPTIONS=--max-old-space-size=256 to the service's environment
```

### Postgres connection refused

```bash
# Check postgres is healthy
docker compose -f docker-compose.prod.yml ps postgres
# Common fix: wait for healthcheck, then restart dependents
docker compose -f docker-compose.prod.yml restart web admin worker
```

### Nginx 502 Bad Gateway

```bash
# Is the container running?
docker compose -f docker-compose.prod.yml ps
# Test directly
curl http://localhost:3000/api/health
# Check next.config.js — must have output: 'standalone' for the multi-stage Dockerfile
```
