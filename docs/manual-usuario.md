# Manual de Usuario - AssetControl

Versión: 1.0  
Fecha de actualización: 07/04/2026  
Idioma: Español  

## Tabla de contenido
1. Introducción
2. Alcance y público objetivo
3. Requisitos de acceso
4. Inicio de sesión y registro
5. Seguridad y sesión
6. Roles y permisos
7. Selección de entidad
8. Navegación general
9. Módulos del sistema
10. Flujos clave
11. Reportes y documentos
12. Buenas prácticas
13. Soporte

## 1. Introducción
AssetControl es una plataforma para el control de activos tecnológicos, el registro de mantenimientos y la generación de órdenes de trabajo. Centraliza inventario, historial técnico y trazabilidad operativa para equipos de soporte.

## 2. Alcance y público objetivo
Este manual está dirigido a:
- Administradores que gestionan usuarios, entidades y auditoría.
- Técnicos que registran mantenimientos y generan órdenes.
- Usuarios que consultan activos y solicitan bajas.

## 3. Requisitos de acceso
- Navegador web moderno.
- Credenciales válidas (correo y contraseña).
- Si el usuario no es administrador, debe tener al menos una entidad asignada.

## 4. Inicio de sesión y registro
Accede desde la pantalla de autenticación:
- Iniciar sesión: usa correo y contraseña.
- Registro: requiere nombre, correo, contraseña, confirmación y clave de registro.

Política de contraseña:
- Mínimo 12 caracteres.
- Debe incluir mayúscula, minúscula, número y símbolo.

## 5. Seguridad y sesión
- La sesión se cierra automáticamente por inactividad. El tiempo por defecto es 30 minutos.
- Si el sistema solicita cambio de contraseña, serás redirigido a `Mi cuenta`.

## 6. Roles y permisos
Roles estándar:
- Administrador: control total (`ADMIN_TOTAL`).
- Técnico: acceso a tareas de mantenimiento según permisos asignados.
- Usuario: acceso limitado según permisos asignados.

Permisos funcionales principales:
- `VER_ACTIVOS`: acceso a inventario y panel ISO 55000.
- `CREAR_MANTENIMIENTO`, `EDITAR_MANTENIMIENTO`, `ELIMINAR_MANTENIMIENTO`: gestión de mantenimientos.
- `GENERAR_ORDEN`, `FIRMAR_ORDEN`: órdenes de trabajo.

## 7. Selección de entidad
Si no eres administrador y tienes varias entidades asignadas, el sistema pedirá elegir una entidad activa:
- La entidad activa filtra dashboard, activos, mantenimientos, cronograma y calendario.
- Puedes cambiarla desde la barra de contexto de entidad.

## 8. Navegación general
Barra principal:
- Inicio.
- Inventario de activos: Activos, Entidades.
- Mantenimientos: Gesti?n, Cronograma, Calendario, ?rdenes de trabajo.
- Administración: Usuarios, Auditoría, ISO 55000.
- Ayuda: Comunicaciones internas.

Menú de usuario:
- Mi cuenta, Cambiar contraseña.
- Centro de notificaciones.
- Comunicaciones internas.
- Acerca de.

## 9. Módulos del sistema

### 9.1 Inicio (Dashboard)
Funciones principales:
- KPIs de activos y mantenimientos.
- Resumen estadístico de disponibilidad y estado general.
- Indicadores automáticos de confiabilidad e ISO 55000.
- Agenda semanal de mantenimientos.
- Tareas del día con checklist.
- Vista rápida de equipos críticos.

### 9.2 Activos
Funciones principales:
- Registrar, editar y eliminar activos.
- Importar activos desde Excel o CSV.
- Exportar reportes a Excel o PDF.
- Filtrar por estado, categoría, áreas, disco y sistema operativo.
- Consultar detalle con histórico de mantenimientos.
- Enviar hoja de vida por correo.
- Generar hoja de vida para impresión o PDF.
- Solicitar baja de activos con evidencia.

Campos clave del activo:
- Entidad, categoría, equipo, serial, marca, modelo.
- Área principal y área secundaria.
- Estado (Disponible, Mantenimiento, Fuera de servicio).
- Información adicional: fecha de adquisición y vida útil.

Bajas de activos:
- Los usuarios pueden enviar solicitud de baja con motivo y adjuntos.
- Los administradores aprueban o rechazan la solicitud.

### 9.3 Mantenimientos
Funciones principales:
- Crear, editar y eliminar mantenimientos.
- Importar mantenimientos desde Excel o CSV.
- Filtrar por tipo, estado, técnico, equipo, activo y entidad.
- Generar factura/orden con firmas digitales.
- Enviar por correo y producir PDF.

Campos clave:
- Fecha, número de reporte, activo asociado.
- Tipo (Preventivo, Correctivo, Predictivo, Calibración, Punto de Red).
- Planificación, estado, técnico.
- Cambio de partes y descripción.

### 9.4 Cronograma
Funciones principales:
- Programaci?n por fechas, ?reas y dispositivos.
- Solo muestra la programaci?n (sin estados de ejecuci?n).
- La vista se filtra por la entidad activa.
- Cada entidad puede cargar un cronograma diferente.
- La informaci?n se carga desde un archivo con columnas est?ndar.

Cronograma primer semestre 2026:
| Fechas | ?reas | Dispositivos | Equipos de c?mputo | Rack | Switch | Impresoras | Esc?ner | Ergotrones |
|---|---|---|---|---|---|---|---|---|
| mayo 4 al 16 | cirugia | equipos de conputo, rack de datos | 15 | 1 | 3 | 0 | 0 | 19 |
| mayo 19 al 23 | urgencias expansión | equipos de conputo | 16 | 1 | 1 | 0 | 0 | 0 |
| mayo 25 al 30 | admisiones urgencias | equipos de conputo | 10 | 0 | 0 | 0 | 0 | 0 |
| mayo 25 al 30 | urgencias, consultorios y puestos de emfermeria | equipos de conputo | 45 | 1 | 3 | 0 | 0 | 3 |
| mayo 25 al 30 | uci | equipos de conputo, rack | 12 | 1 | 1 | 0 | 0 | 3 |
| junio 1 al 6 | sala de partos | equipos de conputo, rack | 12 | 1 | 2 | 0 | 0 | 3 |
| junio 1 al 6 | gastro | equipos de conputo | 6 | 0 | 0 | 1 | 0 | 0 |
| junio 1 al 6 | quirofanos | equipos de conputo | 0 | 0 | 0 | 0 | 0 | 0 |
| junio 9 al 13 | hospitalizacion | equipos de conputo | 56 | 1 | 3 | 0 | 0 | 12 |
| junio 16 al 20 | centro regulador | equipos de conputo, rack | 14 | 1 | 1 | 0 | 0 |  |
| junio 16 al 20 | almacen, activos fijos. Biomedicos | equipos de conputo | 11 | 0 | 0 | 0 | 1 | 0 |
| junio 16 al 20 | citas medicas, consulta externa | equipos de conputo | 8 | 0 | 0 | 0 | 0 | 0 |
| junio 22 al 24 | farmacia, vacunacion, Archivo | equipos de conputo | 22 | 0 | 0 | 1 | 8 | 0 |
| junio 22 al 24 | comunicaciones, sub gte administrativa, at usuario | equipos de conputo | 12 | 4 | 11 | 2 | 0 | 0 |
| junio 22 al 24 | tesoreria, contabilidad, presupuesto | equipos de conputo | 12 | 0 | 0 | 2 | 2 | 0 |
| junio 25 al 27 | calidad, glosas, facturacion | equipos de conputo | 19 | 0 | 0 | 1 | 0 | 0 |
| junio 25 al 27 | apoyo admin, corrdinadores, juridica, control interno | equipos de conputo | 20 | 0 | 0 | 0 | 2 | 0 |
| junio 25 al 27 | laboratorio, docencia, psicologia | equipos de conputo rack | 9 | 0 | 0 | 2 | 0 | 0 |
| junio 25 al 27 | radicacion.tecnologia, gerencia | equipos de conputo | 14 | 0 | 0 | 1 | 2 | 0 |
| junio 25 al 27 | Datacenter | equipos de conputo rack |  | 5 |  | 0 | 0 | 0 |
| junio 25 al 27 | centros de datos | equipos de conputo rack |  |  |  |  |  |  |
| junio 22 al 27 | sede niquia | equipos de conputo rack | 106 | 4 | 8 | 2 | 3 | 11 |

### 9.5 Calendario
Funciones principales:
- Muestra las actividades ya realizadas.
- Indica el d?a exacto en que se realiz? cada actividad.
- Filtros por entidad y rango de fechas.
- Historial de lo ejecutado para seguimiento.

### 9.6 Órdenes de trabajo
Funciones principales:
- Listar órdenes con filtros globales, por entidad o activo.
- Exportar órdenes a CSV.
- Descargar PDF o imprimir orden.
- Acceso restringido a órdenes creadas por el usuario (si no es admin).

### 9.7 ISO 55000
Funciones principales:
- Panel ejecutivo de cumplimiento ISO 55000.
- Indicadores por requisito y brechas críticas.
- Enviar reporte KPI (solo administradores).

### 9.8 Entidades
Funciones principales:
- Crear, editar y eliminar entidades (solo administradores).
- Definir tipo, dirección y áreas primarias/secundarias.
- Visualizar cobertura de usuarios por entidad.

### 9.9 Usuarios
Funciones principales:
- Crear usuarios con rol y contraseña temporal.
- Asignar entidades y permisos personalizados.
- Generar contraseñas seguras.
- Restablecer credenciales según políticas.

### 9.10 Auditoría
Funciones principales:
- Consultar trazabilidad de acciones.
- Filtrar por usuario.
- Exportar registros a CSV.

### 9.11 Notificaciones
Funciones principales:
- Ver notificaciones por módulo y estado de lectura.
- Marcar como leídas o eliminar.
- Acceso directo al módulo relacionado.

### 9.12 Ayuda (Comunicaciones internas)
Funciones principales:
- Crear casos de soporte con título, categoría y prioridad.
- Asignar administrador responsable.
- Adjuntar evidencias (PDF o imágenes).
- Dar seguimiento por estado: Abierto, En revisión, Resuelto.

Adjuntos:
- Máximo 4 archivos.
- Hasta 2 MB por archivo.
- Formatos: PDF, PNG, JPG, JPEG, WEBP.

### 9.13 Mi cuenta
Funciones principales:
- Actualizar nombre y correo.
- Cambiar contraseña con validación de políticas.

### 9.14 Acerca de
Descripción general de AssetControl y versión actual del sistema.

## 10. Flujos clave

### 10.1 Registrar un activo
1. Ir a `Activos`.
2. Seleccionar `Nuevo Activo`.
3. Completar entidad, categoría, equipo, marca, modelo y áreas.
4. Guardar.

### 10.2 Importar activos
1. Ir a `Activos`.
2. Seleccionar `Importar`.
3. Cargar archivo Excel o CSV.
4. Revisar el mensaje de éxito o errores.

### 10.3 Solicitar baja de un activo
1. Abrir el detalle del activo.
2. Seleccionar `Solicitar baja`.
3. Indicar motivo y adjuntos.
4. Enviar solicitud.

### 10.4 Crear un mantenimiento
1. Ir a `Mantenimientos`.
2. Seleccionar `Nuevo mantenimiento`.
3. Completar fecha, tipo, reporte, técnico y descripción.
4. Guardar.

### 10.5 Generar orden con firmas
1. Abrir un mantenimiento.
2. Seleccionar `Factura / Pdf / Orden`.
3. Registrar usuario habitual y quien autoriza.
4. Capturar firmas digitales.
5. Generar orden en PDF.

### 10.6 Exportar órdenes
1. Ir a `Órdenes de trabajo`.
2. Filtrar si es necesario.
3. Seleccionar `Exportar CSV` o `Descargar PDF`.

## 11. Reportes y documentos
Documentos disponibles:
- Reporte de activos en Excel o PDF.
- Hoja de vida del activo.
- Órdenes de mantenimiento en PDF.
- Auditoría en CSV.

## 12. Buenas prácticas
- Mantén actualizados los datos de activos y mantenimientos.
- Usa filtros para encontrar información más rápido.
- Adjunta evidencias en solicitudes de baja o ayuda.
- Revisa notificaciones diariamente.
- Cambia la contraseña si el sistema lo solicita.

## 13. Soporte
Usa el módulo `Comunicaciones internas` para abrir casos de soporte y dar seguimiento. Si no tienes entidades asignadas o acceso a módulos, solicita al administrador la asignación correspondiente.
