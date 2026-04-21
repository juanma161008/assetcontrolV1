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

## 6) Nota importante de datos

Este despliegue **no crea tablas automaticamente**. Debes restaurar tu esquema/datos de PostgreSQL antes de usar la app en produccion.
