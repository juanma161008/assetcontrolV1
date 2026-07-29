# Despliegue en el servidor Windows (sin Docker)

Como corre AssetControl hoy: la aplicacion se ejecuta con Node.js en el
servidor de aplicaciones y la base de datos vive en otro servidor.

| Pieza | Donde | Puerto |
| --- | --- | --- |
| Frontend (React ya compilado, servido por `vite preview`) | servidor de app, `10.1.8.51` | 4173 |
| Backend (API Express) | servidor de app, `10.1.8.51` | 5000 |
| PostgreSQL (el que administras con pgAdmin) | `10.1.11.92` | 5432 |

> Para el despliegue alternativo con Docker Compose, ver [../deploy/README.md](../deploy/README.md).
> Los dos no se usan a la vez.

## 1. Configuracion

`backend/.env` (no se versiona) apunta a la base remota:

```
DB_HOST=10.1.11.92
DB_PORT=5432
DB_NAME=assetcontrol
DB_USER=postgres
DB_PASSWORD=...
JWT_SECRET=...
```

`frontend/.env.production` define a que URL llama el navegador:

```
VITE_API_BASE_URL=http://10.1.8.51:5000
```

Tiene que ser la IP del servidor, no `localhost`: el codigo se ejecuta en el
navegador del usuario, asi que `localhost` apuntaria al PC del usuario. Este
valor se incrusta durante `npm run build`, asi que **si cambia la IP del
servidor hay que recompilar el frontend**.

CORS no necesita configuracion: el backend acepta cualquier origen de red
privada (`10.x`, `192.168.x`, ...) automaticamente. Ver
[backend/src/server.js](../backend/src/server.js).

## 2. Permitir el acceso en el servidor de PostgreSQL

Esto se hace **en `10.1.11.92`**, no en el servidor de aplicaciones. Que el
puerto 5432 responda no basta: PostgreSQL rechaza la conexion si no hay una
linea en `pg_hba.conf` que cubra al cliente. El sintoma exacto en
`tmp/backend.log` es:

```
no hay una linea en pg_hba.conf para «10.1.8.51», usuario «postgres», base de datos «assetcontrol», sin cifrado
```

Para resolverlo, en el servidor de base de datos:

1. En `postgresql.conf`, asegurar que escucha en la red:
   `listen_addresses = '*'`
2. En `pg_hba.conf`, agregar el servidor de aplicaciones:
   ```
   host    assetcontrol    postgres    10.1.8.51/32    scram-sha-256
   ```
3. Recargar la configuracion (`SELECT pg_reload_conf();` en pgAdmin, o
   reiniciar el servicio).
4. Comprobar el firewall de `10.1.11.92` para el puerto 5432 de entrada.

Verificar desde el servidor de aplicaciones:

```
npm run db:check
```

Muestra base, usuario, version y las tablas del esquema `public`. Es la forma
rapida de distinguir un problema de credenciales de uno de `pg_hba.conf`.

## 2.1. El esquema no se crea solo

Ojo con esto al montar un servidor nuevo: **el repositorio no contiene el DDL de
las tablas principales**. No hay archivos `.sql` ni migraciones.

Los repositorios crean bajo demanda, con `CREATE TABLE IF NOT EXISTS`, solo 13
tablas auxiliares (`usuario_seguridad`, `usuario_permisos`, `notificaciones`,
`helpdesk_*`, `reportes_kpi`, `configuracion_respaldo`, ...). Las 12 tablas
centrales **tienen que existir de antes**:

`usuarios`, `roles`, `permisos`, `rol_permisos`, `activos`, `mantenimientos`,
`ordenes`, `orden_detalle`, `entidades`, `auditoria`, `logs`, `firmas_digitales`

`npm run create-admin` tampoco las crea: hace `INSERT INTO usuarios` asumiendo
que ya estan.

Por eso una base recien creada y vacia no sirve. El sintoma es que la API
arranca bien y el login responde `no existe la relación «usuarios»`. Hay que
restaurar un respaldo de la base original:

```
pg_restore -h 10.1.11.92 -U postgres -d assetcontrol respaldo.dump
# si el respaldo es .sql en texto plano:
psql -h 10.1.11.92 -U postgres -d assetcontrol -f respaldo.sql
```

## 3. Arranque manual

```
npm run start:win    # levanta backend y frontend
npm run stop:win     # los detiene
```

[scripts/start-assetcontrol.bat](../scripts/start-assetcontrol.bat) instala
dependencias y compila el frontend si faltan, espera a que PostgreSQL responda
(hasta ~150 s, porque tras un reinicio la red puede tardar), y arranca ambos
procesos. Es idempotente: si un puerto ya esta escuchando, no relanza nada.

Detalle: hay que ejecutarlo sin capturar su salida. Si se redirige a una
tuberia o a un archivo (`npm run start:win | ...`, `... > salida.txt`), los
procesos hijos heredan ese descriptor y el comando parece colgarse hasta que se
detiene la aplicacion; los servicios si arrancan, solo no se devuelve el
control. Ejecutado tal cual en una consola, o desde la tarea programada,
termina en unos segundos. El registro queda igualmente en `tmp/autostart.log`.

## 4. Arranque automatico al reiniciar el servidor

**En una consola de PowerShell abierta como Administrador:**

```
npm run autostart:install
```

Registra la tarea programada `AssetControl-AutoStart`:

- Cuenta **SYSTEM**, asi que sube tras un reinicio sin que nadie inicie sesion.
- Disparador **al iniciar el equipo**.
- Segundo disparador cada 10 minutos como watchdog: al ser idempotente el
  `.bat`, no hace nada si todo sigue arriba y vuelve a levantar lo que se haya
  caido.
- Crea las reglas de firewall de entrada para TCP 5000 y 4173 (perfiles Dominio
  y Privado). Sin ellas la aplicacion solo se ve desde el propio servidor.

Comandos utiles:

```powershell
Start-ScheduledTask -TaskName AssetControl-AutoStart          # probar sin reiniciar
Get-ScheduledTaskInfo -TaskName AssetControl-AutoStart        # ultimo resultado
powershell -File scripts\instalar-autoarranque.ps1 -Desinstalar
```

## 5. Logs

Todos en `tmp/` (no se versiona):

| Archivo | Contenido |
| --- | --- |
| `tmp/autostart.log` | cada ejecucion del `.bat`: espera de la base, arranques, avisos |
| `tmp/backend.log` | salida de la API, incluidos los errores de conexion a la base |
| `tmp/frontend.log` | salida de `vite preview` |

## 6. Tras cambiar codigo o configuracion

```
npm run stop:win
cd frontend && npm run build && cd ..    # solo si cambio el frontend
npm run start:win
```

El backend lee `backend/.env` al arrancar, asi que cualquier cambio ahi (la
contrasena de la base, por ejemplo) exige reiniciar los procesos.
