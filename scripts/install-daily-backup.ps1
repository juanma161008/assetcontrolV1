param(
  [Parameter(Mandatory = $true)]
  [string]$BackupDir,

  [string]$TaskName = "AssetControl-Backup",

  [string]$At = "02:00",

  [string]$BackupEnvFile = "",

  [string]$PgDumpPath = ""
)

$ErrorActionPreference = "Stop"
Import-Module ScheduledTasks -ErrorAction Stop

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runner = Join-Path $repoRoot "scripts/run-daily-backup.ps1"

if (-not (Test-Path $runner)) {
  throw "No se encontro el script de respaldo: $runner"
}

$argumentList = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$runner`"",
  "-BackupDir", "`"$BackupDir`""
)

if ($BackupEnvFile) {
  $argumentList += @("-BackupEnvFile", "`"$BackupEnvFile`"")
}

if ($PgDumpPath) {
  $argumentList += @("-PgDumpPath", "`"$PgDumpPath`"")
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ($argumentList -join " ")
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew

Write-Host "Se te pediran credenciales de Windows una sola vez para registrar la tarea."
$credential = Get-Credential -Message "Usuario de Windows que ejecutara el respaldo diario"

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -User $credential.UserName `
  -Password ($credential.GetNetworkCredential().Password) `
  -Force | Out-Null

Write-Host "Tarea registrada: $TaskName"
