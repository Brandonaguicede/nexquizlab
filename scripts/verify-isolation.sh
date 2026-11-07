#!/bin/sh
set -eu
for service in auth game; do
 docker compose exec -T postgres sh -c '
  if [ "$1" = auth ]; then own=nexquiz_auth; other=nexquiz_game; role=$AUTH_DB_USER; PGPASSWORD=$AUTH_DB_PASSWORD; else own=nexquiz_game; other=nexquiz_auth; role=$GAME_DB_USER; PGPASSWORD=$GAME_DB_PASSWORD; fi
  export PGPASSWORD
  psql -h 127.0.0.1 -U "$role" -d "$own" -v ON_ERROR_STOP=1 -c "SELECT 1" >/dev/null
  if psql -h 127.0.0.1 -U "$role" -d "$other" -c "SELECT 1" >/dev/null 2>&1; then echo "Isolation failed" >&2; exit 1; fi
 ' sh "$service"
done
printf 'NexQuiz database isolation passed in both directions.\n'

