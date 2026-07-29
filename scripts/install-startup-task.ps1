param(
  [string]$TaskName = "AssetControl-AutoStart",
  [string]$UserId = "$env:USERDOMAIN\$env:USERNAME",
  [int]$RepeatMinutes = 10,
  [int]$DockerWaitSeconds = 180
)

$ErrorActionPreference = "Stop"
Import-Module ScheduledTasks -ErrorAction Stop

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runner = Join-Path $repoRoot "scripts/start-assetcontrol-prod.ps1"

if (-not (Test-Path $runner)) {
  throw "No se encontro el script de arranque: $runner"
}

$argumentList = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$runner`"",
  "-DockerWaitSeconds", $DockerWaitSeconds
)

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ($argumentList -join " ")

# Se dispara al iniciar sesion del usuario y luego se repite indefinidamente
# cada $RepeatMinutes minutos. Como "docker compose up -d" es idempotente,
# las repeticiones no hacen nada si todo sigue arriba, y vuelven a levantar
# cualquier contenedor que se haya caido (auto-recuperacion tipo watchdog).
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $UserId
$repeatTemplate = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes $RepeatMinutes) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$trigger.Repetition = $repeatTemplate.Repetition

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -DontStopOnIdleEnd

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Force | Out-Null

Write-Host "Tarea registrada: $TaskName"
Write-Host "Se ejecutara al iniciar sesion de $UserId y se repetira cada $RepeatMinutes minutos como watchdog."
Write-Host "Log de cada ejecucion: tmp/autostart.log"
Write-Host ""
Write-Host "IMPORTANTE: para que esto funcione, Docker Desktop debe iniciar solo con el usuario."
Write-Host "Revisa: Docker Desktop > Settings > General > 'Start Docker Desktop when you sign in'."
