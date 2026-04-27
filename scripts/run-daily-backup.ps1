param(
  [Parameter(Mandatory = $true)]
  [string]$BackupDir,

  [string]$BackupEnvFile = "",

  [string]$PgDumpPath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$env:BACKUP_DIR = $BackupDir

if ($BackupEnvFile) {
  $env:BACKUP_ENV_FILE = $BackupEnvFile
} else {
  $defaultEnv = Join-Path $repoRoot "deploy/.env.production"
  if (Test-Path $defaultEnv) {
    $env:BACKUP_ENV_FILE = $defaultEnv
  }
}

if ($PgDumpPath) {
  $env:PG_DUMP_PATH = $PgDumpPath
}

npm run backup:db

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
