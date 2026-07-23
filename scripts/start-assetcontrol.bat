@echo off
setlocal

set "ROOT=%~dp0.."

echo Iniciando backend AssetControl (puerto 5000)...
start "AssetControl - Backend" cmd /k "cd /d "%ROOT%\backend" && node src\index.js"

echo Iniciando frontend AssetControl (puerto 4173)...
start "AssetControl - Frontend" cmd /k "cd /d "%ROOT%\frontend" && npm run preview -- --host 0.0.0.0 --port 4173"

endlocal
