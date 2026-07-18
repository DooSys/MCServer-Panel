#!/usr/bin/env sh
set -eu

mkdir -p "${POCKETBASE_DATA:-/app/pb_data}"

if [ -n "${PB_SUPERUSER_EMAIL:-}" ] && [ -n "${PB_SUPERUSER_PASSWORD:-}" ]; then
  pocketbase superuser upsert "${PB_SUPERUSER_EMAIL}" "${PB_SUPERUSER_PASSWORD}" --dir="${POCKETBASE_DATA:-/app/pb_data}" || true
fi

exec /usr/bin/supervisord -c /etc/supervisord.conf
