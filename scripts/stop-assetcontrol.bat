@echo off
setlocal

rem ==========================================================================
rem  Detiene el backend y el frontend de AssetControl.
rem
rem  Mata los procesos node.exe que escuchan en 5000 y 4173 en lugar de hacer
rem  un 'taskkill /im node.exe', para no tumbar otros procesos Node del
rem  servidor que no tengan nada que ver con AssetControl.
rem ==========================================================================

call :kill_port 5000 backend
call :kill_port 4173 frontend

endlocal
exit /b 0

:kill_port
set "PORT=%~1"
set "NOMBRE=%~2"
set "ENCONTRADO="
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr /r /c:":%PORT% .*LISTENING"') do (
  rem Los parentesis van escapados: sin ^ cerrarian el bloque del for.
  echo Deteniendo %NOMBRE% - puerto %PORT%, PID %%p ...
  taskkill /f /pid %%p >nul 2>&1
  set "ENCONTRADO=1"
)
if not defined ENCONTRADO echo No habia nada escuchando en el puerto %PORT% - %NOMBRE%.
exit /b 0
