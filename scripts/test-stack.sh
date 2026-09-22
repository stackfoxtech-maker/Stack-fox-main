#!/usr/bin/env bash
# Local integration-test stack.
#
# Brings up throwaway Postgres and Redis, applies migrations, seeds, starts the
# API and runs the suites — then leaves everything running so you can re-run
# `pnpm --filter @stackfox/api test` without the setup cost.
#
#   ./scripts/test-stack.sh up      # start + migrate + seed + boot API
#   ./scripts/test-stack.sh test    # run the suites against it
#   ./scripts/test-stack.sh down    # remove containers and stop the API
#
# Ports are deliberately non-default: 5432 is commonly already taken by a local
# Postgres, and binding over it would be a nasty surprise.
#
# Every external credential is blanked, so no test can reach real Supabase,
# Resend, Razorpay, MSG91 or Gemini. Shell exports win over .env because dotenv
# does not override existing variables — that is what keeps this off production.
set -euo pipefail

PG_PORT=55432
REDIS_PORT=56379
API_PORT=4000
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export DATABASE_URL="postgresql://stackfox:stackfox_dev@localhost:${PG_PORT}/stackfox_test"
export DIRECT_DATABASE_URL="$DATABASE_URL"
export REDIS_URL="redis://localhost:${REDIS_PORT}"
export JWT_SECRET="ci-test-secret-at-least-32-characters-long"
export NODE_ENV=test
export PORT=$API_PORT
export WORKERS_INLINE=false
export ADMIN_PASSWORD="test-admin-password-not-real-12345"
export SUPABASE_URL="" SUPABASE_SECRET_KEY="" SUPABASE_PUBLISHABLE_KEY=""
export RESEND_API_KEY="" SMTP_HOST="" MSG91_AUTH_KEY=""
export RAZORPAY_KEY_ID="" RAZORPAY_KEY_SECRET="" RAZORPAY_WEBHOOK_SECRET=""
export STRIPE_SECRET_KEY="" GEMINI_API_KEY="" MEILI_URL=""
export GOOGLE_CLIENT_ID="" GOOGLE_CLIENT_SECRET=""
export WHATSAPP_BSP_URL="" WHATSAPP_BSP_TOKEN=""

PRISMA="$ROOT/packages/prisma/node_modules/.bin/prisma"

start_api() {
  ( cd "$ROOT" && nohup node apps/api/dist/server.js > /tmp/sfx-api.log 2>&1 & )
  for i in $(seq 1 45); do
    if curl -sf "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
      echo "  API ready after ${i}s: $(curl -s http://localhost:${API_PORT}/health)"
      return 0
    fi
    sleep 1
  done
  echo "  API failed to start. Last log lines:"; tail -25 /tmp/sfx-api.log; return 1
}

stop_api() {
  local pid
  pid=$(netstat -ano 2>/dev/null | grep ":${API_PORT}" | grep LISTENING | awk '{print $5}' | head -1 || true)
  [ -n "${pid:-}" ] && taskkill //PID "$pid" //F >/dev/null 2>&1 || true
}

case "${1:-up}" in
  up)
    echo "→ containers"
    docker rm -f sfx-test-pg sfx-test-redis >/dev/null 2>&1 || true
    docker run -d --name sfx-test-pg \
      -e POSTGRES_USER=stackfox -e POSTGRES_PASSWORD=stackfox_dev -e POSTGRES_DB=stackfox_test \
      -p ${PG_PORT}:5432 postgres:16-alpine >/dev/null
    docker run -d --name sfx-test-redis -p ${REDIS_PORT}:6379 redis:7-alpine >/dev/null

    echo "→ waiting for postgres"
    for i in $(seq 1 45); do
      docker exec sfx-test-pg pg_isready -U stackfox -d stackfox_test >/dev/null 2>&1 && break
      sleep 1
    done
    docker exec sfx-test-redis redis-cli ping >/dev/null

    echo "→ migrations"
    ( cd "$ROOT/packages/prisma" && "$PRISMA" migrate deploy --schema prisma/schema.prisma | tail -3 )

    echo "→ seed"
    ( cd "$ROOT" && pnpm --filter @stackfox/prisma db:seed 2>&1 | tail -3 )

    echo "→ build + start API"
    ( cd "$ROOT" && pnpm --filter @stackfox/api build >/dev/null )
    stop_api; start_api
    ;;

  test)
    ( cd "$ROOT" && pnpm --filter @stackfox/api test )
    ;;

  down)
    stop_api
    docker rm -f sfx-test-pg sfx-test-redis >/dev/null 2>&1 || true
    echo "stopped"
    ;;

  *) echo "usage: $0 {up|test|down}"; exit 1 ;;
esac
