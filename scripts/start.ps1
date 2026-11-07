# Starts NexQuiz on Windows with only Git, Docker Desktop and Docker Compose installed.
#   .\scripts\start.ps1          build images from this repository (default)
#   .\scripts\start.ps1 -Hub     pull published images from Docker Hub (DOCKERHUB_USER and IMAGE_TAG in .env)
param([switch]$Hub)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
function Fail($message) { Write-Host "ERROR: $message" -ForegroundColor Red; exit 1 }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail 'Docker no está instalado. https://docs.docker.com/get-docker/' }
docker compose version *> $null; if ($LASTEXITCODE -ne 0) { Fail 'Docker Compose v2 no está disponible (docker compose).' }
docker info *> $null; if ($LASTEXITCODE -ne 0) { Fail 'Docker no está en ejecución. Inicia Docker Desktop.' }

# 1. Configuration and keys inside a Node container; existing values are never overwritten.
docker run --rm -v "$((Get-Location).Path):/work" -w /work node:24.13.0-bookworm-slim node scripts/setup.cjs
if ($LASTEXITCODE -ne 0) { Fail 'No se pudo preparar la configuración.' }
function Setting($name, $default) {
  $line = Get-Content .env | Where-Object { $_ -match "^$name=" } | Select-Object -Last 1
  if ($line) { $value = $line.Substring($name.Length + 1) } else { $value = '' }
  if ($value) { $value } else { $default }
}

# 2. Images.
if ($Hub) {
  if (-not (Setting 'DOCKERHUB_USER' '')) { Fail 'Define DOCKERHUB_USER (y IMAGE_TAG) en .env para usar imágenes de Docker Hub.' }
  Write-Host "Descargando imágenes de Docker Hub..."
  docker compose pull auth-api auth-migrate game-api game-migrate web results-client
  if ($LASTEXITCODE -ne 0) { Fail 'No se pudieron descargar las imágenes.' }
  $build = '--no-build'
} else {
  Write-Host 'Construyendo imágenes desde el repositorio (la primera vez tarda varios minutos)...'
  $build = '--build'
}

# 3. Start: migrations run as jobs before the APIs; the seed job loads demo data through the APIs.
docker compose up -d $build
if ($LASTEXITCODE -ne 0) { Fail "Compose no pudo iniciar. Si dice 'port is already allocated', cambia en .env el puerto ocupado (POSTGRES_PORT, WEB_PORT, AUTH_PORT, GAME_PORT o RESULTS_CLIENT_PORT)." }
Write-Host -NoNewline 'Esperando a que la web esté lista'
$status = ''
for ($i = 0; $i -lt 90; $i++) {
  $status = docker inspect --format '{{.State.Health.Status}}' (docker compose ps -q web) 2>$null
  if ($status -eq 'healthy') { break }
  Write-Host -NoNewline '.'; Start-Sleep -Seconds 2
}
Write-Host ''
if ($status -ne 'healthy') { Fail 'La web no quedó saludable. Revisa: docker compose ps; docker compose logs' }
# docker compose wait ignores containers that already exited, so read the job result directly.
$seed = '1'
for ($i = 0; $i -lt 60; $i++) {
  $state = docker inspect --format '{{.State.Status}} {{.State.ExitCode}}' (docker compose ps -aq seed) 2>$null
  if ($state -like 'exited *') { $seed = $state.Substring(7); break }
  Start-Sleep -Seconds 2
}
if ($seed -ne '0') { Write-Host 'AVISO: el seed de demostración no terminó bien. Revisa: docker compose logs seed' -ForegroundColor Yellow }

$web = Setting 'PUBLIC_WEB_URL' "http://localhost:$(Setting 'WEB_PORT' '8080')"
$domain = Setting 'DEMO_EMAIL_DOMAIN' 'nexquiz.demo'
Write-Host ''
Write-Host 'NexQuiz está listo.' -ForegroundColor Green
Write-Host "  Aplicación web       $web"
Write-Host "  Cliente adicional    http://localhost:$(Setting 'RESULTS_CLIENT_PORT' '8081')"
Write-Host "  Auth API (Scalar)    $web/auth/docs"
Write-Host "  Game API (Scalar)    $web/game/docs"
Write-Host "  Grafana              http://localhost:3000   (usuario $(Setting 'GRAFANA_USER' 'nexquiz'), contraseña GRAFANA_PASSWORD en .env)"
Write-Host ''
Write-Host "Cuentas de demostración (contraseña: $(Setting 'DEMO_PASSWORD' '?'))"
Write-Host "  Docente      docente@$domain   -> 'Quiz de demostración'"
Write-Host "  Estudiantes  estudiante1@$domain, estudiante2@$domain, estudiante3@$domain"
Write-Host ''
Write-Host 'Detener: .\scripts\stop.ps1   (conserva datos e imágenes; -Purge los borra)'
