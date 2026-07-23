param(
  [int]$DockerWaitSeconds = 180,
  [switch]$Build
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$composeFile = Join-Path $repoRoot "deploy/docker-compose.prod.yml"
$envFile = Join-Path $repoRoot "deploy/.env.production"
$logDir = Join-Path $repoRoot "tmp"
$logFile = Join-Path $logDir "autostart.log"

if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $logFile -Value $line
}

if (-not (Test-Path $envFile)) {
  Write-Log "ERROR: no existe $envFile. Copia deploy/.env.production.example y completa las variables."
  exit 1
}

Write-Log "Esperando a que el daemon de Docker este listo..."
$deadline = (Get-Date).AddSeconds($DockerWaitSeconds)
$ready = $false
while ((Get-Date) -lt $deadline) {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 5
}

if (-not $ready) {
  Write-Log "ERROR: Docker no respondio despues de $DockerWaitSeconds s. Verifica que Docker Desktop este instalado y configurado para iniciar con el usuario (Settings > General > Start Docker Desktop when you sign in)."
  exit 1
}

Write-Log "Docker listo. Verificando/levantando el stack de AssetControl..."
Set-Location $repoRoot

$composeArgs = @("compose", "-f", $composeFile, "--env-file", $envFile, "up", "-d")
if ($Build) {
  $composeArgs += "--build"
}

$output = & docker @composeArgs 2>&1
$output | ForEach-Object { Write-Log $_ }

if ($LASTEXITCODE -ne 0) {
  Write-Log "ERROR: 'docker compose up' fallo (codigo $LASTEXITCODE)"
  exit $LASTEXITCODE
}

Write-Log "Stack de AssetControl levantado/verificado correctamente."
