#!/bin/sh
set -eu
umask 077
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
for db in nexquiz_auth nexquiz_game; do
 docker compose -f docker-compose.prod.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$1"' sh "$db" > "backups/$db-$stamp.dump"
done
printf 'Database backups written under backups/. Encrypt and copy off-host.\n'

