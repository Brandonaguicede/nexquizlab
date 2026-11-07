#!/usr/bin/env sh
# Starts NexQuiz with only Git, Docker and Docker Compose installed.
#   scripts/start.sh          build images from this repository (default)
#   scripts/start.sh --hub    pull published images from Docker Hub (DOCKERHUB_USER and IMAGE_TAG in .env)
set -eu
cd "$(dirname "$0")/.."
MODE=build
for arg in "$@"; do
  case "$arg" in
    --build) MODE=build ;;
    --hub) MODE=hub ;;
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $arg (usa --build o --hub)" >&2; exit 2 ;;
  esac
done
fail() { echo "ERROR: $*" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || fail "Docker no está instalado. https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 no está disponible (docker compose)."
docker info >/dev/null 2>&1 || fail "Docker no está en ejecución. Inicia Docker Desktop o el servicio docker."

# 1. Configuration and keys: .env from .env.example with random secrets; never overwrites existing values.
NODE_IMAGE=node:24.13.0-bookworm-slim
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) export MSYS_NO_PATHCONV=1; docker run --rm -v "$(pwd -W):/work" -w /work "$NODE_IMAGE" node scripts/setup.cjs ;;
  *) docker run --rm -v "$(pwd):/work" -w /work --user "$(id -u):$(id -g)" "$NODE_IMAGE" node scripts/setup.cjs ;;
esac
setting() { v=$(grep -E "^$1=" .env | tail -n1 | cut -d= -f2-); printf '%s' "${v:-$2}"; }

# 2. Images.
if [ "$MODE" = hub ]; then
  [ -n "$(setting DOCKERHUB_USER '')" ] || fail "Define DOCKERHUB_USER (y IMAGE_TAG) en .env para usar imágenes de Docker Hub."
  echo "Descargando imágenes de Docker Hub ($(setting DOCKERHUB_USER '')/nexquiz-*:$(setting IMAGE_TAG local))…"
  docker compose pull auth-api auth-migrate game-api game-migrate web results-client
  BUILD=--no-build
else
  echo "Construyendo imágenes desde el repositorio (la primera vez tarda varios minutos)…"
  BUILD=--build
fi

# 3. Start: migrations run as jobs before the APIs; the seed job loads demo data through the APIs.
if ! docker compose up -d $BUILD; then
  echo "" >&2
  echo "Compose no pudo iniciar. Si el error dice 'port is already allocated', cambia en .env el puerto" >&2
  echo "ocupado (POSTGRES_PORT, WEB_PORT, AUTH_PORT, GAME_PORT o RESULTS_CLIENT_PORT) y vuelve a ejecutar." >&2
  exit 1
fi
printf 'Esperando a que la web esté lista'
for _ in $(seq 1 90); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q web)" 2>/dev/null || true)
  [ "$status" = healthy ] && break
  printf '.'; sleep 2
done
echo ""
[ "${status:-}" = healthy ] || fail "La web no quedó saludable. Revisa: docker compose ps && docker compose logs"
# docker compose wait ignores containers that already exited, so read the job result directly.
seed=1
for _ in $(seq 1 60); do
  state=$(docker inspect --format '{{.State.Status}} {{.State.ExitCode}}' "$(docker compose ps -aq seed)" 2>/dev/null || true)
  case "$state" in exited*) seed=${state#exited }; break ;; esac
  sleep 2
done
[ "$seed" = 0 ] || echo "AVISO: el seed de demostración no terminó bien. Revisa: docker compose logs seed" >&2

WEB=$(setting PUBLIC_WEB_URL "http://localhost:$(setting WEB_PORT 8080)")
DOMAIN=$(setting DEMO_EMAIL_DOMAIN nexquiz.demo)
cat <<EOF

NexQuiz está listo.
  Aplicación web       $WEB
  Cliente adicional    http://localhost:$(setting RESULTS_CLIENT_PORT 8081)
  Auth API (Scalar)    $WEB/auth/docs
  Game API (Scalar)    $WEB/game/docs
  Grafana              http://localhost:3000   (usuario $(setting GRAFANA_USER nexquiz), contraseña GRAFANA_PASSWORD en .env)

Cuentas de demostración (contraseña: $(setting DEMO_PASSWORD '?'))
  Docente      docente@$DOMAIN   → "Quiz de demostración"
  Estudiantes  estudiante1@$DOMAIN, estudiante2@$DOMAIN, estudiante3@$DOMAIN

Detener: scripts/stop.sh   (conserva datos e imágenes; --purge los borra)
EOF
