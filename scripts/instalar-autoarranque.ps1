<#
  Registra AssetControl para que arranque solo cada vez que se reinicie el
  servidor, ejecutando scripts\start-assetcontrol.bat.

  Uso (PowerShell como Administrador):
    powershell -ExecutionPolicy Bypass -File scripts\instalar-autoarranque.ps1

  Diferencia con install-startup-task.ps1: ese otro es para el despliegue con
  Docker (deploy\docker-compose.prod.yml). Este es para la instalacion nativa
  con Node.js contra el PostgreSQL de 10.1.11.92, que es como corre este
  servidor.

  La tarea se registra bajo SYSTEM y con el disparador "Al iniciar el equipo",
  de modo que la aplicacion sube tras un reinicio aunque nadie inicie sesion.
  Ademas se repite cada $RepeatMinutes minutos: como el .bat es idempotente,
  las repeticiones no hacen nada si todo sigue arriba y vuelven a levantar lo
  que se haya caido (watchdog).
#>
param(
  [string]$TaskName = "AssetControl-AutoStart",
  [int]$RepeatMinutes = 10,
  [int]$BackendPort = 5000,
  [int]$FrontendPort = 4173,
  [switch]$SinFirewall,
  [switch]$Desinstalar
)

$ErrorActionPreference = "Stop"
Import-Module ScheduledTasks -ErrorAction Stop

$esAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
  throw "Ejecuta este script en una consola de PowerShell abierta como Administrador."
}

$reglaBackend = "AssetControl API (TCP $BackendPort)"
$reglaFrontend = "AssetControl Web (TCP $FrontendPort)"

if ($Desinstalar) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Tarea '$TaskName' eliminada."
  foreach ($regla in @($reglaBackend, $reglaFrontend)) {
    try {
      Remove-NetFirewallRule -DisplayName $regla -ErrorAction Stop
      Write-Host "Regla de firewall '$regla' eliminada."
    } catch {
      Write-Host "No habia regla de firewall '$regla'."
    }
  }
  return
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runner = Join-Path $repoRoot "scripts\start-assetcontrol.bat"

if (-not (Test-Path $runner)) {
  throw "No se encontro el script de arranque: $runner"
}
if (-not (Test-Path (Join-Path $repoRoot "backend\.env"))) {
  throw "Falta backend\.env. Complete DB_PASSWORD y JWT_SECRET antes de registrar la tarea."
}

$action = New-ScheduledTaskAction -Execute "cmd.exe" `
  -Argument "/c `"$runner`"" `
  -WorkingDirectory $repoRoot

$triggerStartup = New-ScheduledTaskTrigger -AtStartup

# El watchdog se modela como un segundo disparador que se repite
# indefinidamente, en lugar de tocar la repeticion del de arranque.
$triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes $RepeatMinutes) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" `
  -LogonType ServiceAccount -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -DontStopOnIdleEnd `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger @($triggerStartup, $triggerRepeat) `
  -Principal $principal `
  -Settings $settings `
  -Description "Levanta el backend (5000) y el frontend (4173) de AssetControl al iniciar el servidor." `
  -Force | Out-Null

# Sin estas reglas la aplicacion solo se ve desde el propio servidor: Windows
# bloquea 5000 y 4173 de entrada por defecto.
if (-not $SinFirewall) {
  foreach ($regla in @(
      @{ Nombre = $reglaBackend;  Puerto = $BackendPort },
      @{ Nombre = $reglaFrontend; Puerto = $FrontendPort })) {
    if (Get-NetFirewallRule -DisplayName $regla.Nombre -ErrorAction SilentlyContinue) {
      Write-Host "Regla de firewall ya existente: $($regla.Nombre)"
    } else {
      New-NetFirewallRule -DisplayName $regla.Nombre `
        -Direction Inbound -Action Allow -Protocol TCP `
        -LocalPort $regla.Puerto -Profile Domain, Private | Out-Null
      Write-Host "Regla de firewall creada: $($regla.Nombre)"
    }
  }
}

Write-Host "Tarea registrada: $TaskName"
Write-Host "  Cuenta      : SYSTEM (no requiere sesion iniciada)"
Write-Host "  Disparadores: al iniciar el equipo + cada $RepeatMinutes min como watchdog"
Write-Host "  Script      : $runner"
Write-Host "  Log         : $repoRoot\tmp\autostart.log"
Write-Host ""
Write-Host "Probar ahora sin reiniciar:  Start-ScheduledTask -TaskName $TaskName"
Write-Host "Quitar el autoarranque:      powershell -File scripts\instalar-autoarranque.ps1 -Desinstalar"
