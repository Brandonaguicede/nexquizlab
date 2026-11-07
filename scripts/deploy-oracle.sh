#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -m)" != "aarch64" && "$(uname -m)" != "arm64" ]]; then
  echo 'Run this script on the Oracle Ampere A1 ARM64 VM.' >&2; exit 1
fi
[[ -f .env.oracle ]] || { echo 'First run setup-oracle.cjs with your public hostname.' >&2; exit 1; }
docker compose version >/dev/null
docker run --rm -v "$PWD:/work:ro" -w /work node:24.13.0-bookworm-slim node scripts/check-production.cjs --env-file .env.oracle
compose=(docker compose --env-file .env.oracle -f docker-compose.prod.yml -f docker-compose.oracle.yml)
"${compose[@]}" config --quiet
# Build sequentially to reduce peak RAM on the free VM.
for service in auth-api game-api web results-client; do
  "${compose[@]}" build "$service"
done
"${compose[@]}" up -d --wait postgres
"${compose[@]}" run --rm --no-deps auth-migrate
"${compose[@]}" run --rm --no-deps game-migrate
# Migrations were explicitly completed above; avoid launching the optional demo seed.
"${compose[@]}" up -d --no-deps --wait auth-api game-api web results-client proxy otel-collector tempo prometheus grafana
"${compose[@]}" ps
echo 'Services started. Verify public HTTPS and a real game before declaring deployment complete.'
