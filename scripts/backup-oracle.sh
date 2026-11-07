#!/usr/bin/env bash
# Maintenance backup: stops the two APIs briefly for a consistent image/database copy.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
compose=(docker compose --env-file .env.oracle -f docker-compose.prod.yml -f docker-compose.oracle.yml)
"${compose[@]}" config --quiet
running=$("${compose[@]}" ps --status running --services)
for service in auth-api game-api; do
  grep -qx "$service" <<< "$running" || { echo "Start $service before using this maintenance backup." >&2; exit 1; }
done
mkdir -p backups
destination=$(mktemp -d "backups/oracle-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
restart_apis() {
  status=$?
  trap - EXIT
  if ! "${compose[@]}" start auth-api game-api >/dev/null; then
    echo 'API restart failed; restart both services manually.' >&2
    status=1
  fi
  exit "$status"
}
trap restart_apis EXIT
"${compose[@]}" stop auth-api game-api
for db in nexquiz_auth nexquiz_game; do
  "${compose[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$1"' sh "$db" > "$destination/$db.dump"
done
"${compose[@]}" run --rm --no-deps -T --entrypoint tar game-api -C /app/images -czf - . > "$destination/images.tar.gz"
tar -czf "$destination/configuration.tar.gz" .env.oracle secrets/oracle
printf 'Complete backup; contains credentials. Encrypt and copy off-host.\n' > "$destination/COMPLETE.txt"
echo "Backup saved under $destination. APIs are restarting."
