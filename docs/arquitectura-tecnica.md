# Documentacion tecnica de AssetControl

Fecha: 2026-04-22

Este documento explica el codigo del sistema por capas y por modulos. La idea es que sirva como guia tecnica separada del codigo fuente, para entender que hace cada archivo y como se conecta con el resto del software.

## 1. Resumen general

AssetControl es un monorepo con tres partes principales:

- `backend/`: API en Node.js con Express, PostgreSQL, JWT, correo, PDF y tareas programadas.
- `frontend/`: SPA en React + Vite con autenticacion, permisos, formularios, reportes y vistas operativas.
- `deploy/`: despliegue productivo con Docker, PostgreSQL, Caddy y variables de entorno.

Ademas hay:

- `scripts/`: utilidades de soporte y generacion de presentaciones.
- `docs/`: manual de usuario, documentacion tecnica y material de cumplimiento ISO.

## 2. Puntos de entrada

### Root

El `package.json` de la raiz define comandos para desarrollo y despliegue:

- `npm run dev:backend`: levanta el backend.
- `npm run dev:frontend`: levanta el frontend.
- `npm run dev:full`: levanta ambos con `concurrently`.
- `npm run generate:pptx:routes`: genera una presentacion con rutas.
- `npm run generate:pptx:compatible`: genera una presentacion compatible con la UI.
- `npm run prod:up`: inicia el stack productivo con Docker.
- `npm run prod:down`: apaga el stack productivo.
- `npm run prod:logs`: sigue los logs del stack productivo.

### Backend

- [`backend/src/index.js`](../backend/src/index.js): arranque principal del servidor. Decide si corre por HTTP o HTTPS, inicia el `app` de Express y enciende los schedulers.
- [`backend/src/server.js`](../backend/src/server.js): configura Express, middlewares, CORS, health check, metrics y rutas.
- [`backend/src/config/env.js`](../backend/src/config/env.js): carga y normaliza variables de entorno.
- [`backend/src/config/db.js`](../backend/src/config/db.js): crea el pool de PostgreSQL.
- [`backend/src/config/jwt.js`](../backend/src/config/jwt.js): genera y verifica tokens JWT.

### Frontend

- [`frontend/src/main.jsx`](../frontend/src/main.jsx): monta React en `#root`, agrega `StrictMode`, `ErrorBoundary` y `BrowserRouter`.
- [`frontend/src/app/App.jsx`](../frontend/src/app/App.jsx): define autenticacion, proteccion de rutas, selector de entidad y layout principal.
- [`frontend/src/config.js`](../frontend/src/config.js): resuelve la URL base del backend para el navegador.

## 3. Backend

### 3.1 Configuracion

| Archivo | Proposito |
| --- | --- |
| [`backend/src/config/env.js`](../backend/src/config/env.js) | Centraliza todas las variables de entorno del backend. |
| [`backend/src/config/db.js`](../backend/src/config/db.js) | Abre la conexion reutilizable con PostgreSQL. |
| [`backend/src/config/jwt.js`](../backend/src/config/jwt.js) | Firma y valida tokens de autenticacion. |

Variables destacadas:

- `PORT`: puerto del API.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: conexion a PostgreSQL.
- `JWT_SECRET`, `JWT_EXPIRES_IN`: firma y duracion de tokens.
- `SMTP_*`: envio de correos.
- `CORS_ORIGINS`: origenes permitidos.
- `HTTPS_ENABLED`, `HTTPS_KEY_PATH`, `HTTPS_CERT_PATH`: arranque seguro con TLS.
- `AUTH_RATE_LIMIT_*`: limites de login y registro.
- `SCHEDULER_ENABLED`, `REPORTES_AUTOMATICOS`, `RECORDATORIOS_AUTOMATICOS`, `RECORDATORIOS_DIAS`: tareas automaticas.
- `LUMIX_AI_*`, `DEEPSEEK_*`, `OPENAI_API_KEY`, `GEMINI_API_KEY`: integracion con asistentes o motores de IA.

### 3.2 Dominio

El dominio define las entidades y contratos que no dependen de Express ni de PostgreSQL.

| Carpeta | Archivos | Proposito |
| --- | --- | --- |
| `backend/src/domain/entities` | `Activo.js`, `Entidad.js`, `FirmaDigital.js`, `Log.js`, `Mantenimiento.js`, `Orden.js`, `Permiso.js`, `Rol.js`, `Usuario.js` | Modelan los conceptos centrales del negocio. |
| `backend/src/domain/repositories` | `ActivosRepository.js`, `LogRepository.js`, `MantenimientoRepository.js`, `OrdenRepository.js`, `PermisoRepository.js`, `UsuarioRepository.js` | Definen contratos que luego implementa infraestructura. |

### 3.3 Casos de uso

La capa `application` contiene la logica de negocio organizada por modulo.

| Carpeta | Archivos | Proposito |
| --- | --- | --- |
| `backend/src/application/activos` | `CrearActivo.js`, `EditarActivo.js`, `EliminarActivo.js`, `ListarActivos.js` | CRUD de activos. |
| `backend/src/application/entidades` | `CrearEntidad.js`, `EditarEntidad.js`, `EliminarEntidad.js`, `ListarEntidades.js`, `ObtenerEntidad.js` | CRUD y consulta de entidades. |
| `backend/src/application/mantenimientos` | `CrearMantenimiento.js`, `EditarMantenimiento.js`, `EliminarMantenimiento.js`, `ListarMantenimientos.js` | Gestion de mantenimientos. |
| `backend/src/application/ordenes` | `CrearOrden.js`, `EliminarOrden.js`, `FirmarOrden.js`, `GenerarPDF.js`, `ListarOrden.js`, `ObtenerOrden.js` | Flujo de ordenes de trabajo. |
| `backend/src/application/notificaciones` | `CrearNotificacion.js`, `EnviarCorreo.js`, `ListarNotificaciones.js`, `MarcarNotificacionLeida.js`, `MarcarTodasNotificacionesLeidas.js` | Generacion, envio y lectura de notificaciones. |
| `backend/src/application/helpdesk` | `ActualizarHelpdeskThread.js`, `CrearHelpdeskMensaje.js`, `CrearHelpdeskThread.js`, `ListarHelpdeskThreads.js`, `ObtenerHelpdeskThread.js` | Mesa de ayuda e intercambio de mensajes. |
| `backend/src/application/auth` | `LoginUseCase.js`, `RegistroUseCase.js`, `ResetPasswordUseCase.js` | Autenticacion y recuperacion de credenciales. |
| `backend/src/application/auditoria` | `RegistrarLog.js`, `getAuditoriaLogs.js` | Trazabilidad y consulta de logs. |
| `backend/src/application/reportes` | `GenerarKpiReport.js` | Generacion del reporte KPI. |
| `backend/src/application/scheduler` | `index.js` | Ejecucion automatica de reportes y recordatorios. |

### 3.4 Infraestructura

La infraestructura conecta el dominio con tecnologia concreta.

| Carpeta | Archivos | Proposito |
| --- | --- | --- |
| `backend/src/infrastructure/database` | `postgres.js` | Cliente de base de datos sobre `pg`. |
| `backend/src/infrastructure/repositories` | `ActivoPgRepository.js`, `AuditoriaPgRepository.js`, `AuthVerificationPgRepository.js`, `BajaActivoPgRepository.js`, `EntidadPgRepository.js`, `HelpdeskPgRepository.js`, `KpiReportPgRepository.js`, `LogPgRepository.js`, `MantenimientoPgRepository.js`, `NotificacionPgRepository.js`, `OrdenPgRepository.js`, `PermisoPgRepository.js`, `RecordatorioMantenimientoPgRepository.js`, `UsuarioPgRepository.js` | Implementaciones PostgreSQL de los repositorios del dominio. |
| `backend/src/infrastructure/email` | `SmtpEmailProvider.js` | Proveedor de correo SMTP. |
| `backend/src/infrastructure/pdf` | `KpiPdfService.js`, `SimplePdfService.js` | Generacion de PDFs de KPI y documentos simples. |
| `backend/src/infrastructure/storage` | `FirmaStorage.js` | Persistencia o resolucion de firmas digitales. |

### 3.5 Interfaces HTTP

#### Middleware

| Archivo | Proposito |
| --- | --- |
| [`backend/src/interfaces/middleware/requestContext.js`](../backend/src/interfaces/middleware/requestContext.js) | Genera o propaga `x-request-id` para trazabilidad. |
| [`backend/src/interfaces/middleware/requestLogger.js`](../backend/src/interfaces/middleware/requestLogger.js) | Registra cada request, su duracion, estado y usuario. |
| [`backend/src/interfaces/middleware/jwtAuth.js`](../backend/src/interfaces/middleware/jwtAuth.js) | Valida JWT y carga `req.user`. En test hace bypass. |
| [`backend/src/interfaces/middleware/permisosAuth.js`](../backend/src/interfaces/middleware/permisosAuth.js) | Verifica permisos por ruta. |
| [`backend/src/interfaces/middleware/rateLimiter.js`](../backend/src/interfaces/middleware/rateLimiter.js) | Limita intentos repetidos, sobre todo en autenticacion. |
| [`backend/src/interfaces/middleware/auditlogger.js`](../backend/src/interfaces/middleware/auditlogger.js) | Guarda eventos de auditoria despues de operaciones sensibles. |

#### Controllers

| Archivo | Proposito |
| --- | --- |
| [`backend/src/interfaces/controllers/auth.controller.js`](../backend/src/interfaces/controllers/auth.controller.js) | Login, registro, perfil y contrasenas. |
| [`backend/src/interfaces/controllers/activos.controller.js`](../backend/src/interfaces/controllers/activos.controller.js) | CRUD de activos, importacion y consulta. |
| [`backend/src/interfaces/controllers/bajasActivos.controller.js`](../backend/src/interfaces/controllers/bajasActivos.controller.js) | Solicitudes y aprobaciones de baja de activos. |
| [`backend/src/interfaces/controllers/mantenimientos.controller.js`](../backend/src/interfaces/controllers/mantenimientos.controller.js) | CRUD de mantenimientos y recordatorios. |
| [`backend/src/interfaces/controllers/ordenes.controller.js`](../backend/src/interfaces/controllers/ordenes.controller.js) | Ordenes, PDF y firma. |
| [`backend/src/interfaces/controllers/Usuarios.controller.js`](../backend/src/interfaces/controllers/Usuarios.controller.js) | Usuarios, roles y permisos. |
| [`backend/src/interfaces/controllers/entidades.controller.js`](../backend/src/interfaces/controllers/entidades.controller.js) | CRUD de entidades. |
| [`backend/src/interfaces/controllers/auditoria.controller.js`](../backend/src/interfaces/controllers/auditoria.controller.js) | Consulta de auditoria y registro de errores de software. |
| [`backend/src/interfaces/controllers/notificaciones.controller.js`](../backend/src/interfaces/controllers/notificaciones.controller.js) | Bandeja de notificaciones, marcado de lectura y envio de correo. |
| [`backend/src/interfaces/controllers/helpdesk.controller.js`](../backend/src/interfaces/controllers/helpdesk.controller.js) | Threads y mensajes de soporte. |
| [`backend/src/interfaces/controllers/reportes.controller.js`](../backend/src/interfaces/controllers/reportes.controller.js) | Reportes KPI manuales y automatizados. |

#### Routes

| Prefijo | Archivo | Endpoints principales |
| --- | --- | --- |
| `/api/auth` | [`auth.routes.js`](../backend/src/interfaces/routes/auth.routes.js) | `POST /login`, `POST /registro`, `POST /forgot-username/request`, `POST /forgot-username/verify`, `GET /me`, `PUT /me`, `POST /reset-password`, `POST /change-password` |
| `/api/activos` | [`activos.routes.js`](../backend/src/interfaces/routes/activos.routes.js) | `GET /`, `GET /bajas`, `POST /bajas`, `PATCH /bajas/:id/aprobar`, `PATCH /bajas/:id/rechazar`, `POST /`, `POST /import`, `PUT /:id`, `DELETE /:id` |
| `/api/mantenimientos` | [`mantenimientos.routes.js`](../backend/src/interfaces/routes/mantenimientos.routes.js) | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/recordatorio` |
| `/api/ordenes` | [`ordenes.routes.js`](../backend/src/interfaces/routes/ordenes.routes.js) | `GET /`, `GET /:id`, `GET /:id/pdf`, `POST /`, `POST /:id/firmar`, `DELETE /:id` |
| `/api/usuarios` | [`usuarios.routes.js`](../backend/src/interfaces/routes/usuarios.routes.js) | `GET /`, `GET /roles`, `GET /catalogo/permisos`, `POST /`, `GET /:id`, `PUT /:id`, `PUT /:id/permisos`, `DELETE /:id` |
| `/api/entidades` | [`entidades.routes.js`](../backend/src/interfaces/routes/entidades.routes.js) | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| `/api/auditoria` | [`auditoria.routes.js`](../backend/src/interfaces/routes/auditoria.routes.js) | `GET /`, `POST /errores` |
| `/api/notificaciones` | [`notificaciones.routes.js`](../backend/src/interfaces/routes/notificaciones.routes.js) | `GET /`, `DELETE /`, `PATCH /marcar-todas`, `PATCH /:id/leido`, `DELETE /:id`, `POST /email` |
| `/api/helpdesk` | [`helpdesk.routes.js`](../backend/src/interfaces/routes/helpdesk.routes.js) | `GET /threads`, `GET /threads/:id`, `POST /threads`, `POST /threads/:id/messages`, `PATCH /threads/:id`, `GET /admins` |
| `/api/reportes` | [`reportes.routes.js`](../backend/src/interfaces/routes/reportes.routes.js) | `POST /kpi`, `GET /kpi` |

### 3.6 Utilidades

| Archivo | Proposito |
| --- | --- |
| [`backend/src/utils/response.js`](../backend/src/utils/response.js) | Helpers de respuesta HTTP uniforme. |
| [`backend/src/utils/passwordPolicy.js`](../backend/src/utils/passwordPolicy.js) | Politica de contrasenas, validacion y generacion segura. |
| [`backend/src/utils/metrics.js`](../backend/src/utils/metrics.js) | Contador interno de requests, errores y metodos. |
| [`backend/src/utils/kpi.js`](../backend/src/utils/kpi.js) | Calculo de MTBF, MTTR, disponibilidad, OEE y periodos. |
| [`backend/src/utils/hash.js`](../backend/src/utils/hash.js) | Hash y comparacion de contrasenas con bcrypt. |
| [`backend/src/utils/adjuntos.js`](../backend/src/utils/adjuntos.js) | Normalizacion y validacion de adjuntos base64. |

### 3.7 Tareas automaticas

[`backend/src/application/scheduler/index.js`](../backend/src/application/scheduler/index.js) arranca los procesos automaticos del backend:

- envia el reporte KPI mensual si corresponde al primer dia del mes;
- evita duplicar reportes ya generados;
- busca mantenimientos proximos a vencer y crea recordatorios;
- genera notificaciones automaticas para el tecnico responsable;
- se desactiva en `NODE_ENV=test` y puede apagarse con `SCHEDULER_ENABLED=false`.

### 3.8 Pruebas del backend y criterios de calidad

El backend usa Vitest como runner principal. Los comandos relevantes estan en `backend/package.json`:

- `npm run test`: ejecuta `vitest run --coverage` y despues imprime el resumen con `scripts/print-coverage-summary.mjs`.
- `npm run test:coverage`: alias de `npm run test` para ejecutar cobertura completa.
- `npm run test:watch`: corre Vitest en modo observacion para desarrollo local.
- `npm run test:sonar`: ejecuta las pruebas y despues lanza `sonar-scanner`.

La configuracion de pruebas vive en [`backend/vitest.config.js`](../backend/vitest.config.js) y define:

- entorno `node`, porque el codigo del backend no depende del DOM;
- proveedor de cobertura `v8`;
- reportes `text`, `html`, `json-summary` y `lcov`;
- inclusion de solo codigo productivo en `src/application`, `src/utils`, `src/config/env.js` y `src/config/jwt.js`;
- exclusion de archivos `**/*.test.js`;
- umbrales minimos de 90% en statements, branches, functions y lines.

El resumen de cobertura se imprime desde [`backend/scripts/print-coverage-summary.mjs`](../backend/scripts/print-coverage-summary.mjs). Ese script lee `coverage/coverage-summary.json` y muestra:

- cobertura global por statements, branches, functions y lines;
- una referencia puntual a `src/interfaces/controllers/auth.controller.js` para revisar ramas sensibles de autenticacion.

Reglas de calidad para los tests del backend:

- las pruebas deben ser deterministas;
- las dependencias externas como base de datos, correo, PDF o almacenamiento se mockean en pruebas unitarias;
- en entorno `test`, `jwtAuth` y `rateLimiter` tienen bypass o comportamiento simplificado para evitar ruido;
- no se debe bajar cobertura para aprobar un cambio; si un modulo nuevo queda sin test, se documenta el riesgo y se agrega cobertura.

### 3.9 Catalogo de pruebas del backend

| Familia | Archivos de ejemplo | Que valida |
| --- | --- | --- |
| Controladores | `tests/controllers.activos.unit.test.js`, `tests/controllers.auth.unit.test.js`, `tests/controllers.mantenimientos.unit.test.js` | Traduccion de request a respuesta, validaciones y manejo de errores. |
| Casos de uso y utilidades | `tests/application.unit.test.js`, `tests/auditoria.application.unit.test.js`, `tests/kpi.unit.test.js`, `tests/passwordPolicy.unit.test.js`, `tests/metrics.unit.test.js`, `tests/adjuntos.unit.test.js` | Logica pura de negocio, reglas de contrasena, adjuntos, metricas y calculos. |
| Flujos de negocio | `tests/auth.test.js`, `tests/activos.test.js`, `tests/mantenimientos.test.js`, `tests/permisos.test.js`, `tests/notificaciones.unit.test.js`, `tests/helpdesk.unit.test.js` | Flujos mas completos que conectan varias piezas del backend. |
| Infraestructura y configuracion | `tests/repositories.unit.test.js`, `tests/env.unit.test.js`, `tests/middleware.utils.config.unit.test.js` | Repositorios, variables de entorno y configuraciones transversales. |
| Automatizacion | `tests/scheduler.unit.test.js`, `tests/GenerarKpiReport.unit.test.js`, `tests/CrearNotificacion.unit.test.js`, `tests/EnviarCorreo.unit.test.js` | Tareas automaticas, reportes KPI y notificaciones programadas. |

Los tests del backend suelen cubrir:

- autenticacion y recuperacion de credenciales;
- activos y bajas;
- mantenimientos y ordenes;
- notificaciones y correo;
- helpdesk;
- KPI, reportes y scheduler;
- middleware, permisos y configuracion;
- repositorios y acceso a datos.

## 4. Frontend

### 4.1 Shell de la aplicacion

| Archivo | Proposito |
| --- | --- |
| [`frontend/src/main.jsx`](../frontend/src/main.jsx) | Punto de entrada de React. Monta el arbol de la app. |
| [`frontend/src/app/App.jsx`](../frontend/src/app/App.jsx) | Navegacion principal, proteccion de rutas, autenticacion, selector de entidad e inactivity lock. |
| [`frontend/src/config.js`](../frontend/src/config.js) | Determina la URL base del backend desde `VITE_API_BASE_URL` o el host actual. |

`App.jsx` es la pieza central del frontend:

- valida la sesion al iniciar;
- redirige a login si no hay token;
- protege rutas por permisos;
- obliga cambio de contrasena si el backend lo indica;
- administra la entidad activa para usuarios no administradores;
- aplica cierre por inactividad;
- monta `Header`, `Footer` y el arbol de rutas.

### 4.2 Servicios y dominio

| Carpeta | Archivos | Proposito |
| --- | --- | --- |
| `frontend/src/services` | `httpClient.js`, `authService.js`, `notificacionService.js` | Acceso HTTP, autenticacion y notificaciones. |
| `frontend/src/domain/activos` | `ActivoApi.js`, `ActivoService.js`, `activo.model.js` | Logica de activos en el cliente. |
| `frontend/src/domain/mantenimientos` | `MantenimientoAPI.js`, `MantenimientoService.js`, `mantenimiento.model.js` | Logica de mantenimientos en el cliente. |
| `frontend/src/domain/ordenes` | `OrdenAPI.js`, `OrdenService.js`, `orden.model.js` | Logica de ordenes en el cliente. |
| `frontend/src/domain/auditoria` | `AuditoriaAPI.js`, `AuditoriaService.js`, `log.model.js` | Logica de auditoria en el cliente. |

#### Servicios principales

| Archivo | Proposito |
| --- | --- |
| [`frontend/src/services/httpClient.js`](../frontend/src/services/httpClient.js) | Instancia Axios con token Bearer, manejo de 401 y log de errores al backend. |
| [`frontend/src/services/authService.js`](../frontend/src/services/authService.js) | Manejo de sesion, login, registro, perfil, cambio de contrasena y recuperacion de usuario. |
| [`frontend/src/services/notificacionService.js`](../frontend/src/services/notificacionService.js) | Envio de correos desde la UI via API. |

`authService.js` es especialmente importante porque:

- guarda la sesion en `localStorage`;
- calcula expiracion por inactividad;
- actualiza el usuario activo;
- expone funciones para login, registro, cambio de contrasena y actualizacion de perfil;
- sincroniza la sesion con el backend usando `/api/auth/me`.

`httpClient.js` agrega comportamiento transversal:

- adjunta el token en cada request;
- redirige a login si llega un 401;
- reporta errores 500 o superiores a `/api/auditoria/errores`;
- evita bucles al no volver a registrar ese mismo error;
- expone helpers `get`, `post`, `put` y `del`.

### 4.3 Paginas

| Archivo | Proposito |
| --- | --- |
| [`frontend/src/pages/auth/login.jsx`](../frontend/src/pages/auth/login.jsx) | Acceso y registro de usuarios. |
| [`frontend/src/pages/home/Home.jsx`](../frontend/src/pages/home/Home.jsx) | Dashboard principal. |
| [`frontend/src/pages/activos/ActivosPage.jsx`](../frontend/src/pages/activos/ActivosPage.jsx) | Inventario, detalle, filtros, importacion y exportacion de activos. |
| [`frontend/src/pages/mantenimientos/MantenimientosPage.jsx`](../frontend/src/pages/mantenimientos/MantenimientosPage.jsx) | Gestion de mantenimientos. |
| [`frontend/src/pages/cronograma/CronogramaPage.jsx`](../frontend/src/pages/cronograma/CronogramaPage.jsx) | Planeacion cronologica de mantenimientos. |
| [`frontend/src/pages/ordenes/OrdenesPage.jsx`](../frontend/src/pages/ordenes/OrdenesPage.jsx) | Listado y gestion de ordenes. |
| [`frontend/src/pages/auditoria/AuditoriaPage.jsx`](../frontend/src/pages/auditoria/AuditoriaPage.jsx) | Consulta de trazabilidad y auditoria. |
| [`frontend/src/pages/entidades/EntidadesPage.jsx`](../frontend/src/pages/entidades/EntidadesPage.jsx) | Administracion de entidades. |
| [`frontend/src/pages/usuarios/UsuariosPage.jsx`](../frontend/src/pages/usuarios/UsuariosPage.jsx) | Administracion de usuarios, roles y permisos. |
| [`frontend/src/pages/mi-cuenta/MiCuentaPage.jsx`](../frontend/src/pages/mi-cuenta/MiCuentaPage.jsx) | Perfil personal y cambio de contrasena. |
| [`frontend/src/pages/ayuda/AyudaPage.jsx`](../frontend/src/pages/ayuda/AyudaPage.jsx) | Mesa de ayuda y soporte interno. |
| [`frontend/src/pages/notificaciones/NotificacionesPage.jsx`](../frontend/src/pages/notificaciones/NotificacionesPage.jsx) | Bandeja de notificaciones. |
| [`frontend/src/pages/iso/Iso55000Page.jsx`](../frontend/src/pages/iso/Iso55000Page.jsx) | Vista ISO 55000 y estado de cumplimiento. |
| [`frontend/src/pages/acerca-de/AcercaDePage.jsx`](../frontend/src/pages/acerca-de/AcercaDePage.jsx) | Informacion del sistema. |

### 4.4 Componentes compartidos

| Archivo | Proposito |
| --- | --- |
| [`frontend/src/components/layout/Header.jsx`](../frontend/src/components/layout/Header.jsx) | Navegacion superior, usuario y acciones globales. |
| [`frontend/src/components/layout/Footer.jsx`](../frontend/src/components/layout/Footer.jsx) | Pie de pagina. |
| [`frontend/src/components/common/ErrorBoundary.jsx`](../frontend/src/components/common/ErrorBoundary.jsx) | Captura errores de renderizado y evita pantalla en blanco. |
| [`frontend/src/components/shared/FirmaDigital.jsx`](../frontend/src/components/shared/FirmaDigital.jsx) | Captura y renderizado de firmas digitales. |
| [`frontend/src/components/OrdenMantenimiento.jsx`](../frontend/src/components/OrdenMantenimiento.jsx) | Construye la experiencia visual para ordenes de mantenimiento. |

### 4.5 Utilidades

| Archivo | Proposito |
| --- | --- |
| [`frontend/src/utils/permissions.js`](../frontend/src/utils/permissions.js) | Verifica permisos y etiquetas de roles en la UI. |
| [`frontend/src/utils/passwordPolicy.js`](../frontend/src/utils/passwordPolicy.js) | Valida y genera contrasenas desde el frontend. |
| [`frontend/src/utils/formatters.js`](../frontend/src/utils/formatters.js) | Formatea fechas, numeros y texto para la UI. |
| [`frontend/src/utils/email.js`](../frontend/src/utils/email.js) | Borradores de email para activos y mantenimientos. |
| [`frontend/src/utils/emailDocuments.js`](../frontend/src/utils/emailDocuments.js) | Construye HTML para envio de documentos y firmas. |
| [`frontend/src/utils/assetsReport.js`](../frontend/src/utils/assetsReport.js) | Genera reportes HTML/MHTML de activos para PDF o Excel. |
| [`frontend/src/utils/maintenanceReport.js`](../frontend/src/utils/maintenanceReport.js) | Genera reportes HTML de mantenimientos. |
| [`frontend/src/utils/assetLifecycle.js`](../frontend/src/utils/assetLifecycle.js) | Calcula ciclo de vida, ISO 55000 y KPIs del activo. |
| [`frontend/src/utils/activosCategoria.js`](../frontend/src/utils/activosCategoria.js) | Clasificacion de activos por categoria. |
| [`frontend/src/utils/pdf.utils.js`](../frontend/src/utils/pdf.utils.js) | Ayudas para exportacion a PDF. |

Estas utilidades permiten que la UI no solo muestre datos, sino que tambien:

- genere hojas de vida del activo;
- cree reportes de activos y mantenimientos;
- construya documentos HTML para correo;
- estime MTBF, MTTR, disponibilidad y OEE;
- derive evaluaciones ISO 55000 automaticas a partir de historial y metadatos.

### 4.6 Estilos

El frontend separa estilos por modulo para evitar un solo archivo enorme.

| Archivo | Proposito |
| --- | --- |
| [`frontend/src/index.css`](../frontend/src/index.css) | Estilos base globales. |
| `frontend/src/styles/Global.css` | Estructura global del layout y componentes comunes. |
| `frontend/src/styles/Login.css` | Pantalla de acceso. |
| `frontend/src/styles/Home.css` | Dashboard. |
| `frontend/src/styles/activos.css` | Modulo de activos. |
| `frontend/src/styles/Mantenimiento.css` | Modulo de mantenimientos. |
| `frontend/src/styles/MantenimientoPrint.css` | Version de impresion de mantenimientos. |
| `frontend/src/styles/Orden.css` | Ordenes de trabajo. |
| `frontend/src/styles/OrdenesPage.css` | Layout de la pagina de ordenes. |
| `frontend/src/styles/UsuariosPage.css` | Administracion de usuarios. |
| `frontend/src/styles/Notificaciones.css` | Bandeja de notificaciones. |
| `frontend/src/styles/MiCuentaPage.css` | Perfil y contrasena. |
| `frontend/src/styles/Iso55000.css` | Vista ISO 55000. |
| `frontend/src/styles/InfoPages.css` | Paginas informativas. |
| `frontend/src/styles/Cronograma.css` | Cronograma. |
| `frontend/src/styles/firma.css` | Interfaz de firma. |

### 4.7 Pruebas del frontend y criterios de calidad

El frontend usa Vitest con entorno `node` para utilidades y servicios. Los comandos relevantes estan en `frontend/package.json`:

- `npm run test`: ejecuta Vitest sin cobertura.
- `npm run test:watch`: modo observacion para desarrollo.
- `npm run test:coverage`: ejecuta Vitest con cobertura.
- `npm run sonar`: lanza `sonar-scanner` para el analisis en SonarCloud.

La configuracion principal esta en [`frontend/vitest.config.js`](../frontend/vitest.config.js) y define:

- entorno `node`, porque las pruebas se enfocan en servicios y utilidades;
- inclusion de `src/**/*.test.js` para localizar las pruebas cerca del codigo;
- cobertura sobre `src/services/notificacionService.js`, `src/utils/email.js` y `src/utils/permissions.js`;
- exclusion de `src/**/*.test.js` del calculo de cobertura;
- umbrales minimos de 90% en statements, branches, functions y lines.

La configuracion de SonarCloud esta en [`frontend/sonar-project.properties`](../frontend/sonar-project.properties) y define:

- `sonar.sources=src`;
- `sonar.tests=src`;
- inclusiones de prueba como `**/*.test.js`, `**/*.test.jsx`, `**/*.spec.js` y `**/*.spec.jsx`;
- exclusiones de `node_modules`, `dist`, archivos de prueba y `*.css`;
- reporte LCOV en `coverage/lcov.info`.

Reglas de calidad para los tests del frontend:

- las pruebas deben trabajar con mocks de `localStorage`, `httpClient` y cualquier API del navegador que no sea estable;
- no deben depender de un backend real;
- deben validar casos felices, errores y valores borde;
- los helpers puros deben probarse de forma directa y sin render innecesario.

### 4.8 Catalogo de pruebas del frontend

| Archivo | Que valida |
| --- | --- |
| [`frontend/src/services/authService.test.js`](../frontend/src/services/authService.test.js) | Sesion, login, expiracion por inactividad, recuperacion de usuario y cambio de contrasena. |
| [`frontend/src/services/notificacionService.test.js`](../frontend/src/services/notificacionService.test.js) | Envio de correo y manejo de errores desde la interfaz. |
| [`frontend/src/utils/permissions.test.js`](../frontend/src/utils/permissions.test.js) | Evaluacion de permisos, permisos multiples y etiquetas de rol. |
| [`frontend/src/utils/email.test.js`](../frontend/src/utils/email.test.js) | Construccion de borradores de correo para activos y mantenimientos. |
| [`frontend/src/utils/assetLifecycle.test.js`](../frontend/src/utils/assetLifecycle.test.js) | Calculo de ciclo de vida, KPIs, ISO 55000 y datos derivados del activo. |

Las pruebas del frontend se concentran en:

- autenticacion y manejo de sesion;
- permisos y roles;
- notificaciones;
- politica de contrasenas;
- ciclo de vida del activo;
- reportes y utilidades de correo o PDF.

## 5. Flujo funcional del sistema

### 5.1 Autenticacion

1. `login.jsx` envia credenciales a `authService.login()`.
2. `httpClient.js` agrega token y maneja respuestas.
3. `backend/src/interfaces/routes/auth.routes.js` expone `/api/auth/login`.
4. `backend/src/application/auth/LoginUseCase.js` valida y crea la sesion.
5. `App.jsx` guarda la sesion y levanta la interfaz protegida.

### 5.2 Activos

1. El frontend consulta `/api/activos`.
2. `activos.controller.js` coordina la peticion.
3. `CrearActivo.js`, `EditarActivo.js`, `EliminarActivo.js` y `ListarActivos.js` manejan la logica.
4. `ActivoPgRepository.js` persiste en PostgreSQL.
5. La UI usa utilidades de reporte para exportar hoja de vida, PDF y Excel.

### 5.3 Mantenimientos y ordenes

1. El frontend gestiona mantenimientos y crea ordenes desde `MantenimientosPage` y `OrdenesPage`.
2. El backend calcula KPIs y puede crear recordatorios automaticos.
3. `GenerarPDF.js` y `SimplePdfService.js` producen documentos.
4. `FirmarOrden.js` y `FirmaStorage.js` soportan firmas digitales.

### 5.4 Notificaciones y helpdesk

1. El backend crea notificaciones al ocurrir eventos.
2. `notificaciones.controller.js` expone la bandeja y el marcado de lectura.
3. `helpdesk.controller.js` administra threads y mensajes.
4. `notificacionService.js` permite enviar correos desde la UI.

### 5.5 Auditoria y observabilidad

1. `requestContext.js` genera el identificador de request.
2. `requestLogger.js` registra estado, duracion y usuario.
3. `auditlogger.js` guarda cambios sensibles en la base.
4. `/api/metrics` expone un snapshot de requests y errores.

## 6. Despliegue

La carpeta `deploy/` contiene el stack de produccion:

- `deploy/docker-compose.prod.yml`: orquesta backend, frontend, base de datos y proxy.
- `deploy/Caddyfile`: termina TLS y hace reverse proxy.
- `deploy/.env.production.example`: plantilla de variables de produccion.
- `deploy/README.md`: pasos de despliegue.

Flujo general:

1. copiar `deploy/.env.production.example` a `deploy/.env.production`;
2. completar dominio, correo, contrasena de base y JWT;
3. ejecutar `npm run prod:up`;
4. verificar logs con `npm run prod:logs`.

## 7. Calidad, pruebas y SonarQube

El proyecto trata la calidad como una restriccion funcional, no como algo opcional. La estrategia real se apoya en tres capas:

- linting con ESLint;
- pruebas unitarias y de integracion con Vitest;
- analisis estatica y quality gate en SonarCloud/SonarQube.

### 7.1 Estandares de calidad

Los estandares que se esperan en este repositorio son:

- cobertura minima de 90% en statements, branches, functions y lines, tanto en backend como en frontend;
- pruebas con casos felices, errores y ramas alternativas;
- mocks para toda dependencia inestable o externa;
- separacion clara entre codigo productivo y codigo de prueba;
- nombres de archivo consistentes para facilitar analisis en Sonar.

### 7.2 SonarCloud y SonarQube

Este repositorio esta preparado para SonarCloud, que usa la misma logica de analisis de SonarQube como plataforma.

Primero corre Vitest y genera los reportes; despues SonarCloud consume `coverage/lcov.info` para calcular cobertura, duplicacion, smells y otros indicadores.

Backend:

- [`backend/sonar-project.properties`](../backend/sonar-project.properties) define `sonar.projectKey`, `sonar.sources=src`, `sonar.tests=tests` y `sonar.javascript.lcov.reportPaths=coverage/lcov.info`.
- `sonar.test.inclusions=tests/**/*.test.js` separa claramente las pruebas del codigo productivo.
- `sonar.exclusions=node_modules/**,coverage/**` evita ruido de artefactos generados.

Frontend:

- [`frontend/sonar-project.properties`](../frontend/sonar-project.properties) define `sonar.projectKey`, `sonar.sources=src` y `sonar.tests=src`.
- `sonar.test.inclusions` incluye los patrones de pruebas del frontend.
- `sonar.exclusions` elimina `node_modules`, `dist`, archivos de prueba y CSS del analisis.
- el mismo `coverage/lcov.info` alimenta el analisis de cobertura.

Importante:

- el quality gate real se administra en SonarCloud, no dentro del repo;
- el codigo del repo solo entrega la configuracion y los reportes necesarios para que Sonar calcule cobertura, smells, duplicacion y riesgo.

### 7.3 Seguridad que tambien influye en calidad

Ademas de la cobertura, el sistema incluye barreras que ayudan a mantener calidad operativa:

- `helmet` en el backend;
- CORS restringido por origen;
- JWT para rutas protegidas;
- autorizacion por permisos;
- rate limiting en autenticacion;
- cierre por inactividad en frontend;
- auditoria de requests y eventos sensibles;
- validacion de adjuntos y politicas de contrasenas;
- reportes de error desde frontend a `POST /api/auditoria/errores`.

### 7.4 Como interpretar una regresion

Si un cambio rompe los estandares, el criterio recomendado es:

1. primero agregar o corregir pruebas;
2. luego revisar si la cobertura baja por una nueva rama no contemplada;
3. despues comprobar si el analisis de Sonar introduce deuda tecnica nueva;
4. solo al final revisar si el cambio realmente debe quedarse o dividirse en una tarea mas pequena.

## 8. Documentacion relacionada

- [`README.md`](../README.md): resumen general del repositorio.
- [`docs/manual-usuario.md`](./manual-usuario.md): guia funcional para usuarios finales.
- [`docs/iso27001/README.md`](./iso27001/README.md): indice del paquete ISO 27001.
- [`backend/vitest.config.js`](../backend/vitest.config.js): cobertura y umbrales del backend.

## 9. Alcance de este documento

Este archivo documenta la arquitectura completa por responsabilidades y por modulo. No reemplaza una documentacion linea por linea, pero si deja claro:

- que hace cada archivo importante;
- como se relacionan backend y frontend;
- donde vive cada responsabilidad;
- que rutas, servicios y tareas automaticas forman parte del sistema.
