- [ ] Leer/confirmar archivos a modificar para Entidad (backend dominio, repository, use cases, controller) y frontend formulario.
- [ ] Actualizar backend dominio: agregar campo `nit`.
- [ ] Actualizar backend repository `EntidadPgRepository`: agregar `nit` en columns permitidas y normalizar payload.
- [ ] Actualizar `CrearEntidad`: validar `nit` obligatorio y guardarlo.
- [ ] Actualizar `EditarEntidad`: permitir actualización de `nit` (y validar obligatorio si se edita).
- [ ] Actualizar controller `entidades.controller.js`: incluir `nit` en payload extracción.
- [ ] Actualizar frontend `EntidadesPage.jsx`: agregar input “NIT *”, incluir en payload, precargar en editar y mostrar en tabla/detalle.
- [ ] Ejecutar tests (backend y/o frontend) y corregir cualquier error de columnas.

