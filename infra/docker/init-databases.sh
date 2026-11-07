#!/bin/sh
set -eu
# psql variables quote identifiers/literals safely. Runs once for a new PGDATA.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set=auth_user="$AUTH_DB_USER" --set=auth_password="$AUTH_DB_PASSWORD" \
  --set=game_user="$GAME_DB_USER" --set=game_password="$GAME_DB_PASSWORD" <<'SQL'
CREATE ROLE :"auth_user" LOGIN PASSWORD :'auth_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE :"game_user" LOGIN PASSWORD :'game_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE nexquiz_auth OWNER :"auth_user";
CREATE DATABASE nexquiz_game OWNER :"game_user";
REVOKE ALL ON DATABASE nexquiz_auth FROM PUBLIC;
REVOKE ALL ON DATABASE nexquiz_game FROM PUBLIC;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname nexquiz_auth <<'SQL'
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname nexquiz_game <<'SQL'
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SQL
