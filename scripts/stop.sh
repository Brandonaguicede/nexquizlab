#!/usr/bin/env sh
# Stops NexQuiz. Data (PostgreSQL, images, Grafana, Prometheus) stays in named volumes.
#   scripts/stop.sh           stop and remove containers, keep volumes
#   scripts/stop.sh --purge   also delete all NexQuiz volumes (irreversible)
set -eu
cd "$(dirname "$0")/.."
case "${1:-}" in
  "") docker compose down; echo "NexQuiz detenido. Los datos se conservan; vuelve a iniciar con scripts/start.sh." ;;
  --purge) docker compose down --volumes; echo "NexQuiz detenido y volúmenes eliminados: perfiles, cuestionarios, imágenes y resultados se borraron." ;;
  -h|--help) sed -n '2,4p' "$0" ;;
  *) echo "Opción desconocida: $1 (usa --purge)" >&2; exit 2 ;;
esac
