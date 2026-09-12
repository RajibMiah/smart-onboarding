#!/bin/sh
set -e

# `depends_on: condition: service_healthy` in docker-compose.yml already
# waits for MySQL's healthcheck, but that only confirms the *server* is
# accepting connections — a fresh container can still take a moment longer
# before it's ready for our specific database/user. Retry migrate briefly
# rather than failing the whole container on a one-off race.
attempt=0
until python manage.py migrate --noinput; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 10 ]; then
    echo "migrate failed after $attempt attempts, giving up" >&2
    exit 1
  fi
  echo "migrate failed (attempt $attempt/10) — retrying in 3s..."
  sleep 3
done

exec "$@"
