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
