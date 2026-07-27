#!/usr/bin/env bash
# GustoPOS PM2 startup wrapper.
# Sources /srv/gustopos/apps/api/.env if present, then exec pm2 with the
# ecosystem config. Idempotent. Safe to re-run.
set -e
cd "$(dirname "$0")/.."

if [ -f apps/api/.env ]; then
  set -a
  . apps/api/.env
  set +a
  echo "[pm2-start] sourced apps/api/.env"
else
  echo "[pm2-start] WARNING: apps/api/.env missing — relying on shell env"
fi

if [ ! -f apps/api/dist/main.js ]; then
  echo "[pm2-start] ERROR: apps/api/dist/main.js not built. Run: npm run build"
  exit 1
fi

exec pm2 start ecosystem.config.cjs "$@"
