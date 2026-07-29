@echo off
setlocal enabledelayedexpansion

rem ==========================================================================
rem  AssetControl - arranque de la aplicacion
rem
rem  Levanta el backend (API, puerto 5000) y el frontend (puerto 4173) contra
rem  la base PostgreSQL que corre en el servidor 10.1.11.92:5432.
rem
rem  Pensado para ejecutarse desde el Programador de tareas de Windows con el
rem  disparador "Al iniciar el equipo", sin necesidad de que nadie inicie
rem  sesion. Tambien funciona a mano (doble clic).
rem
rem  Es idempotente: si el backend o el frontend ya estan escuchando, no los
rem  vuelve a lanzar. Asi puede repetirse cada pocos minutos como watchdog.
rem
rem  Registro de cada ejecucion: tmp\autostart.log
rem  Salida de los procesos:     tmp\backend.log y tmp\frontend.log
rem ==========================================================================

pushd "%~dp0.."
set "ROOT=%CD%"
popd

set "LOG_DIR=%ROOT%\tmp"
set "LOG=%LOG_DIR%\autostart.log"
set "BACKEND_PORT=5000"
set "FRONTEND_PORT=4173"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

call :log "==== Arranque de AssetControl (%ROOT%) ===="

rem -------------------------------------------------------------------------
rem  1. Node.js. Bajo la cuenta SYSTEM el PATH puede no incluir Node, asi que
rem     se agrega la ruta de instalacion por defecto antes de comprobarlo.
rem -------------------------------------------------------------------------
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
  call :log "ERROR: no se encontro node.exe. Instala Node.js o agregalo al PATH del sistema."
  exit /b 1
)

rem -------------------------------------------------------------------------
rem  2. Configuracion. Sin backend\.env el backend arrancaria contra
rem     localhost y sin JWT_SECRET, asi que se corta aqui.
rem -------------------------------------------------------------------------
if not exist "%ROOT%\backend\.env" (
  call :log "ERROR: falta %ROOT%\backend\.env - copia backend\.env.example y completa DB_* y JWT_SECRET."
  exit /b 1
)

set "DB_HOST="
set "DB_PORT="
for /f "usebackq tokens=1,* delims==" %%a in ("%ROOT%\backend\.env") do (
  if /i "%%a"=="DB_HOST" set "DB_HOST=%%b"
  if /i "%%a"=="DB_PORT" set "DB_PORT=%%b"
)
if "!DB_HOST!"=="" set "DB_HOST=localhost"
if "!DB_PORT!"=="" set "DB_PORT=5432"

rem -------------------------------------------------------------------------
rem  3. Dependencias y build. Solo se hacen si faltan, para que un reinicio
rem     normal no pague el costo de reinstalar.
rem -------------------------------------------------------------------------
if not exist "%ROOT%\backend\node_modules" (
  call :log "Instalando dependencias del backend (puede tardar varios minutos)..."
  pushd "%ROOT%\backend"
  call npm install --no-audit --no-fund >> "%LOG%" 2>&1
  popd
  if not exist "%ROOT%\backend\node_modules" (
    call :log "ERROR: fallo 'npm install' en backend. Revisa el detalle arriba en este log."
    exit /b 1
  )
)

if not exist "%ROOT%\frontend\node_modules" (
  call :log "Instalando dependencias del frontend (puede tardar varios minutos)..."
  pushd "%ROOT%\frontend"
  call npm install --no-audit --no-fund >> "%LOG%" 2>&1
  popd
  if not exist "%ROOT%\frontend\node_modules" (
    call :log "ERROR: fallo 'npm install' en frontend. Revisa el detalle arriba en este log."
    exit /b 1
  )
)

if not exist "%ROOT%\frontend\dist\index.html" (
  call :log "Compilando el frontend..."
  pushd "%ROOT%\frontend"
  call npm run build >> "%LOG%" 2>&1
  popd
  if not exist "%ROOT%\frontend\dist\index.html" (
    call :log "ERROR: fallo 'npm run build' en frontend. Revisa el detalle arriba en este log."
    exit /b 1
  )
)

rem -------------------------------------------------------------------------
rem  4. Esperar la base de datos. Justo tras un reinicio la red todavia puede
rem     no estar lista, o el servidor de PostgreSQL puede tardar mas que este.
rem     Se reintenta durante ~2,5 minutos antes de rendirse.
rem -------------------------------------------------------------------------
call :log "Esperando a PostgreSQL en !DB_HOST!:!DB_PORT! ..."
set "DB_READY="
for /l %%i in (1,1,30) do (
  if not defined DB_READY (
    powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('!DB_HOST!', !DB_PORT!); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
      set "DB_READY=1"
    ) else (
      rem ping como pausa: 'timeout' falla cuando no hay consola interactiva
      ping -n 6 127.0.0.1 >nul
    )
  )
)

if not defined DB_READY (
  call :log "ERROR: PostgreSQL en !DB_HOST!:!DB_PORT! no respondio tras ~150 s. Se aborta el arranque."
  exit /b 1
)
call :log "PostgreSQL responde en !DB_HOST!:!DB_PORT!."

rem -------------------------------------------------------------------------
rem  5. Backend. Se lanza con 'start /b' (sin ventana nueva) para que
rem     sobreviva a la salida de este .bat, tambien como tarea programada.
rem -------------------------------------------------------------------------
call :is_listening %BACKEND_PORT%
if errorlevel 1 (
  call :log "Iniciando backend en el puerto %BACKEND_PORT% ..."
  rem Los operadores de redireccion van escapados con ^ para que los aplique el
  rem cmd hijo (y no este), evitando comillas anidadas que cmd /c parsea mal.
  start "AssetControl Backend" /b /d "%ROOT%\backend" cmd /c node src\index.js ^>^> "%LOG_DIR%\backend.log" 2^>^&1
) else (
  call :log "El backend ya estaba escuchando en el puerto %BACKEND_PORT%; no se relanza."
)

rem -------------------------------------------------------------------------
rem  6. Frontend. Se invoca vite directamente con node en vez de 'npm run
rem     preview': bajo SYSTEM el shim npm.cmd depende del PATH y del perfil
rem     del usuario, y esta forma no depende de ninguno de los dos.
rem -------------------------------------------------------------------------
call :is_listening %FRONTEND_PORT%
if errorlevel 1 (
  call :log "Iniciando frontend en el puerto %FRONTEND_PORT% ..."
  start "AssetControl Frontend" /b /d "%ROOT%\frontend" cmd /c node node_modules\vite\bin\vite.js preview --host 0.0.0.0 --port %FRONTEND_PORT% ^>^> "%LOG_DIR%\frontend.log" 2^>^&1
) else (
  call :log "El frontend ya estaba escuchando en el puerto %FRONTEND_PORT%; no se relanza."
)

rem -------------------------------------------------------------------------
rem  7. Comprobar que ambos quedaron arriba.
rem -------------------------------------------------------------------------
ping -n 9 127.0.0.1 >nul

call :is_listening %BACKEND_PORT%
if errorlevel 1 (
  call :log "AVISO: el backend no esta escuchando en %BACKEND_PORT%. Revisa tmp\backend.log."
) else (
  call :log "Backend OK: http://localhost:%BACKEND_PORT%"
)

call :is_listening %FRONTEND_PORT%
if errorlevel 1 (
  call :log "AVISO: el frontend no esta escuchando en %FRONTEND_PORT%. Revisa tmp\frontend.log."
) else (
  call :log "Frontend OK: http://localhost:%FRONTEND_PORT%"
)

call :log "==== Fin del arranque ===="
endlocal
exit /b 0

rem =========================== subrutinas ==================================

rem Devuelve errorlevel 0 si hay algo escuchando en el puerto %1, si no 1.
:is_listening
netstat -ano -p tcp | findstr /r /c:":%~1 .*LISTENING" >nul 2>&1
exit /b %errorlevel%

:log
echo [%date% %time%] %~1
>> "%LOG%" echo [%date% %time%] %~1
exit /b 0
