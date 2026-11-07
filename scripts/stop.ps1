# Stops NexQuiz. Data (PostgreSQL, images, Grafana, Prometheus) stays in named volumes.
#   .\scripts\stop.ps1          stop and remove containers, keep volumes
#   .\scripts\stop.ps1 -Purge   also delete all NexQuiz volumes (irreversible)
param([switch]$Purge)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($Purge) {
  docker compose down --volumes
  Write-Host 'NexQuiz detenido y volúmenes eliminados: perfiles, cuestionarios, imágenes y resultados se borraron.'
} else {
  docker compose down
  Write-Host 'NexQuiz detenido. Los datos se conservan; vuelve a iniciar con .\scripts\start.ps1.'
}
