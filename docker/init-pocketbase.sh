#!/usr/bin/env sh
set -eu

if [ -z "${PB_SUPERUSER_EMAIL:-}" ] || [ -z "${PB_SUPERUSER_PASSWORD:-}" ]; then
  echo "[pocketbase-init] skipped: PB_SUPERUSER_EMAIL/PB_SUPERUSER_PASSWORD missing"
  exit 0
fi

for attempt in $(seq 1 60); do
  if curl -fsS "${POCKETBASE_URL:-http://127.0.0.1:8090}/api/health" >/dev/null 2>&1; then
    npm run pb:init
    exit 0
  fi
  sleep 1
done

echo "[pocketbase-init] PocketBase did not become ready" >&2
exit 1
