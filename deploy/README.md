# AssetControl - Produccion

## 1) Requisitos del servidor

- Docker Engine + Docker Compose plugin
- Dominio apuntando a la IP publica del servidor (`A`/`AAAA`)
- Puertos `80` y `443` abiertos

## 2) Variables de entorno

1. Copia el archivo de ejemplo:

```bash
cp deploy/.env.production.example deploy/.env.production
```

2. Edita `deploy/.env.production` y completa:
- `APP_DOMAIN` (ej: `assetcontrol.midominio.com`)
- `LETSENCRYPT_EMAIL`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- (Opcional) variables SMTP

Si quieres usar Google Drive para los respaldos, crea una carpeta local y sincronizala con Google Drive for desktop. En tu caso, usa `G:\Mi unidad\Backup Assetcontrol` y deja `BACKUP_DIR` al registrar la tarea o como variable de entorno.
El script toma `deploy/.env.production` por defecto como archivo de variables de respaldo. Si `pg_dump` no esta en el PATH, define `PG_DUMP_PATH` con la ruta completa al binario, ya sea en `deploy/.env.production` o al registrar la tarea.
El respaldo diario tambien guarda un PDF con el diseño real de cada orden aprobada (logo, tarjetas, firmas). Para eso el contenedor `backend` incluye Chromium y `CHROMIUM_PATH=/usr/bin/chromium` ya viene configurado en su Dockerfile; si corres el backend fuera de Docker (desarrollo local), define `CHROMIUM_PATH` apuntando a un Chrome/Edge instalado o deja que se autodetecte.

## 3) Levantar stack productivo

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d --build
```

Servicios:
- `caddy` (TLS + reverse proxy)
- `frontend` (Nginx + build de Vite)
- `backend` (API Node/Express)
- `db` (PostgreSQL)

## 4) Verificar

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production ps
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production logs -f caddy
```

Abre:

`https://<APP_DOMAIN>`

## 5) Comandos utiles

Reiniciar:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production restart
```

Bajar servicios:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production down
```

Actualizar con nueva version:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d --build
```

## 6) Copia automatica diaria a Google Drive

Si quieres que la copia sea automatica, usa Google Drive for desktop con la cuenta `microcinco-hmfs@gmail.com` y sincroniza la carpeta `G:\Mi unidad\Backup Assetcontrol`.

Luego registra la tarea diaria:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-daily-backup.ps1 -BackupDir "G:\Mi unidad\Backup Assetcontrol" -BackupEnvFile "deploy/.env.production" -At "02:00"
```

La primera vez te pedira credenciales de Windows para guardar la tarea en el Programador de tareas.

La tarea hace esto cada dia:
- exporta PostgreSQL a un archivo `.sql`;
- lo guarda en la carpeta local sincronizada;
- Google Drive sube ese archivo automaticamente a tu cuenta.

Si ya dejaste las variables en `deploy/.env.production`, solo ejecuta:

```bash
npm run backup:db
```

## 7) Nota importante de datos

Este despliegue **no crea tablas automaticamente**. Debes restaurar tu esquema/datos de PostgreSQL antes de usar la app en produccion.
Google Drive debe usarse como destino del respaldo, no como carpeta de datos viva de PostgreSQL.

## 8) Logs y diagnostico rapido

- Un `304` en `/api/*` significa que la respuesta no cambio y el navegador reutilizo la copia cacheada. No es un error.
- Si quieres ver actividad real del stack, revisa:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production logs -f backend
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production logs -f caddy
```

- Si la interfaz no refleja cambios, haz una recarga dura del navegador antes de asumir que el backend fallo.

## 9) Arranque automatico al encender el equipo + auto-recuperacion

Registra una tarea en el Programador de tareas de Windows que:

- levanta el stack (`docker compose up -d`) cuando inicias sesion en Windows;
- se repite cada 10 minutos como watchdog: si un contenedor se cayo, lo vuelve a levantar (como `up -d` es idempotente, si todo esta arriba no hace nada).

Requisitos previos:

- Docker Desktop instalado, con **Settings > General > "Start Docker Desktop when you sign in"** activado (esto no se puede configurar por script).
- `deploy/.env.production` ya completado (ver seccion 2).

Registrar la tarea (una sola vez):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-startup-task.ps1
```

Parametros opcionales: `-RepeatMinutes` (por defecto 10), `-DockerWaitSeconds` (por defecto 180, tiempo que espera a que Docker responda antes de rendirse), `-TaskName`.

Ver el log de cada corrida:

```powershell
Get-Content tmp\autostart.log -Tail 40 -Wait
```

Quitar la tarea:

```powershell
Unregister-ScheduledTask -TaskName "AssetControl-AutoStart" -Confirm:$false
```

Nota: la tarea no reconstruye imagenes (`--build`) en cada corrida para que el watchdog sea rapido. Despues de subir cambios de codigo, sigue actualizando manualmente con `npm run prod:up` (seccion 5).
