import pool from "../database/postgres.js";

export default class MantenimientoPgRepository {
  constructor() {
    this.hasActivoColumnCache = null;
    this.hasNumeroReporteColumnCache = null;
    this.hasCambioPartesColumnCache = null;
    this.hasChecklistColumnCache = null;
    this.hasPointRedColumnsCache = null;
  }

  async hasActivoColumn() {
    if (this.hasActivoColumnCache !== null) {
      return this.hasActivoColumnCache;
    }

    if (process.env.NODE_ENV === "test") {
      this.hasActivoColumnCache = false;
      return false;
    }

    try {
      const res = await pool.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'activos'
           AND column_name = 'activo'
         LIMIT 1`
      );
      this.hasActivoColumnCache = Boolean(res.rows?.length);
      return this.hasActivoColumnCache;
    } catch {
      this.hasActivoColumnCache = false;
      return false;
    }
  }

  async ensureNumeroReporteColumn() {
    if (this.hasNumeroReporteColumnCache !== null) {
      return this.hasNumeroReporteColumnCache;
    }

    if (process.env.NODE_ENV === "test") {
      this.hasNumeroReporteColumnCache = true;
      return true;
    }

    try {
      await pool.query("ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS numero_reporte TEXT");
      this.hasNumeroReporteColumnCache = true;
      return true;
    } catch {
      this.hasNumeroReporteColumnCache = false;
      return false;
    }
  }

  async ensureCambioPartesColumn() {
    if (this.hasCambioPartesColumnCache !== null) {
      return this.hasCambioPartesColumnCache;
    }

    if (process.env.NODE_ENV === "test") {
      this.hasCambioPartesColumnCache = true;
      return true;
    }

    try {
      await pool.query("ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS cambio_partes TEXT");
      this.hasCambioPartesColumnCache = true;
      return true;
    } catch {
      this.hasCambioPartesColumnCache = false;
      return false;
    }
  }

  async ensureChecklistColumn() {
    if (this.hasChecklistColumnCache !== null) {
      return this.hasChecklistColumnCache;
    }

    if (process.env.NODE_ENV === "test") {
      this.hasChecklistColumnCache = true;
      return true;
    }

    try {
      await pool.query("ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS checklist JSONB");
      this.hasChecklistColumnCache = true;
      return true;
    } catch {
      this.hasChecklistColumnCache = false;
      return false;
    }
  }

  async ensurePointRedColumns() {
    if (this.hasPointRedColumnsCache !== null) {
      return this.hasPointRedColumnsCache;
    }

    if (process.env.NODE_ENV === "test") {
      this.hasPointRedColumnsCache = true;
      return true;
    }

    try {
      await pool.query(
        `ALTER TABLE mantenimientos
         ADD COLUMN IF NOT EXISTS entidad_id INTEGER REFERENCES entidades(id),
         ADD COLUMN IF NOT EXISTS sede TEXT,
         ADD COLUMN IF NOT EXISTS area_principal TEXT`
      );
      this.hasPointRedColumnsCache = true;
      return true;
    } catch {
      this.hasPointRedColumnsCache = false;
      return false;
    }
  }

  async findAll() {
    const [hasActivoColumn] = await Promise.all([
      this.hasActivoColumn(),
      this.ensureNumeroReporteColumn(),
      this.ensureCambioPartesColumn(),
      this.ensureChecklistColumn(),
      this.ensurePointRedColumns()
    ]);
    const activoLabelExpression = hasActivoColumn
      ? "COALESCE(NULLIF(a.activo, ''), CAST(a.id AS TEXT))"
      : "CAST(a.id AS TEXT)";

    const res = await pool.query(
       `SELECT
          m.*,
          ${activoLabelExpression} AS activo,
          a.entidad_id AS activo_entidad_id,
          a.nombre AS activo_nombre,
          a.equipo AS activo_equipo,
          u.nombre AS tecnico
        FROM mantenimientos m
        LEFT JOIN activos a ON a.id = m.activo_id
       LEFT JOIN usuarios u ON u.id = m.tecnico_id
       ORDER BY m.fecha DESC, m.id DESC`
    );
    return res.rows;
  }

  async create(data) {
    const [
      hasNumeroReporteColumn,
      hasCambioPartesColumn,
      hasChecklistColumn,
      hasPointRedColumns
    ] = await Promise.all([
      this.ensureNumeroReporteColumn(),
      this.ensureCambioPartesColumn(),
      this.ensureChecklistColumn(),
      this.ensurePointRedColumns()
    ]);
    const numeroReporte = String(data?.numeroReporte ?? data?.numero_reporte ?? "").trim() || null;
    const cambioPartes = String(data?.cambio_partes ?? data?.cambioPartes ?? "").trim() || null;
    const checklist = data?.checklist ?? data?.checklist_items ?? null;
    const entidadIdRaw = data?.entidad_id ?? data?.entidadId ?? null;
    const entidadIdValue = entidadIdRaw === null || entidadIdRaw === undefined || String(entidadIdRaw).trim() === ""
      ? null
      : Number(entidadIdRaw);
    const entidadId = Number.isFinite(entidadIdValue) ? entidadIdValue : null;
    const sede = String(data?.sede ?? "").trim() || null;
    const areaPrincipal = String(data?.area_principal ?? data?.areaPrincipal ?? "").trim() || null;
    let res;

    if (hasPointRedColumns && hasNumeroReporteColumn && hasCambioPartesColumn && hasChecklistColumn) {
      res = await pool.query(
        `INSERT INTO mantenimientos
         (fecha,tipo,descripcion,activo_id,tecnico_id,estado,numero_reporte,cambio_partes,checklist,entidad_id,sede,area_principal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          data.fecha,
          data.tipo,
          data.descripcion,
          data.activo_id,
          data.tecnico_id,
          data.estado,
          numeroReporte,
          cambioPartes,
          checklist ? JSON.stringify(checklist) : null,
          entidadId,
          sede,
          areaPrincipal
        ]
      );
    } else if (hasPointRedColumns && hasNumeroReporteColumn && hasChecklistColumn) {
      res = await pool.query(
        `INSERT INTO mantenimientos
         (fecha,tipo,descripcion,activo_id,tecnico_id,estado,numero_reporte,checklist,entidad_id,sede,area_principal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          data.fecha,
          data.tipo,
          data.descripcion,
          data.activo_id,
          data.tecnico_id,
          data.estado,
          numeroReporte,
          checklist ? JSON.stringify(checklist) : null,
          entidadId,
          sede,
          areaPrincipal
        ]
      );
    } else if (hasPointRedColumns && hasCambioPartesColumn && hasChecklistColumn) {
      res = await pool.query(
        `INSERT INTO mantenimientos
         (fecha,tipo,descripcion,activo_id,tecnico_id,estado,cambio_partes,checklist,entidad_id,sede,area_principal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          data.fecha,
          data.tipo,
          data.descripcion,
          data.activo_id,
          data.tecnico_id,
          data.estado,
          cambioPartes,
          checklist ? JSON.stringify(checklist) : null,
          entidadId,
          sede,
          areaPrincipal
        ]
      );
    } else {
      if (hasPointRedColumns) {
        res = await pool.query(
          `INSERT INTO mantenimientos
           (fecha,tipo,descripcion,activo_id,tecnico_id,estado,entidad_id,sede,area_principal)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [
            data.fecha,
            data.tipo,
            data.descripcion,
            data.activo_id,
            data.tecnico_id,
            data.estado,
            entidadId,
            sede,
            areaPrincipal
          ]
        );
      } else {
        res = await pool.query(
          `INSERT INTO mantenimientos
           (fecha,tipo,descripcion,activo_id,tecnico_id,estado)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [
            data.fecha,
            data.tipo,
            data.descripcion,
            data.activo_id,
            data.tecnico_id,
            data.estado
          ]
        );
      }
    }
    return res.rows[0];
  }

  async update(id, data) {
    const [hasNumeroReporteColumn, hasCambioPartesColumn, hasChecklistColumn] = await Promise.all([
      this.ensureNumeroReporteColumn(),
      this.ensureCambioPartesColumn(),
      this.ensureChecklistColumn()
    ]);
    const activoId = data.activo_id ?? data.activo ?? null;
    const hasTecnicoId = Object.prototype.hasOwnProperty.call(data || {}, "tecnico_id");
    const tecnicoIdRaw = data?.tecnico_id;
    const tecnicoIdEsNulo = tecnicoIdRaw === null || tecnicoIdRaw === undefined || tecnicoIdRaw === "";
    const tecnicoIdParsed = tecnicoIdEsNulo ? null : Number(tecnicoIdRaw);
    const tecnicoIdValido = tecnicoIdEsNulo || Number.isFinite(tecnicoIdParsed);
    const shouldUpdateTecnicoId = hasTecnicoId && tecnicoIdValido;
    const hasNumeroReporte =
      Object.prototype.hasOwnProperty.call(data || {}, "numeroReporte") ||
      Object.prototype.hasOwnProperty.call(data || {}, "numero_reporte");
    const numeroReporteRaw = data?.numeroReporte ?? data?.numero_reporte;
    const numeroReporte = numeroReporteRaw === null || numeroReporteRaw === undefined
      ? null
      : String(numeroReporteRaw).trim();
    const hasCambioPartes =
      Object.prototype.hasOwnProperty.call(data || {}, "cambioPartes") ||
      Object.prototype.hasOwnProperty.call(data || {}, "cambio_partes");
    const cambioPartesRaw = data?.cambio_partes ?? data?.cambioPartes;
    const cambioPartes = cambioPartesRaw === null || cambioPartesRaw === undefined
      ? null
      : String(cambioPartesRaw).trim();
    const hasChecklist = Object.prototype.hasOwnProperty.call(data || {}, "checklist") ||
      Object.prototype.hasOwnProperty.call(data || {}, "checklist_items");
    const checklistRaw = data?.checklist ?? data?.checklist_items;
    const checklist = checklistRaw === null || checklistRaw === undefined ? null : checklistRaw;

    let res;

    if (hasNumeroReporteColumn && hasNumeroReporte && !hasCambioPartes && !hasChecklist) {
      res = await pool.query(
        `UPDATE mantenimientos SET
         fecha=COALESCE($1, fecha),
         tipo=COALESCE($2, tipo),
         descripcion=COALESCE($3, descripcion),
         activo_id=COALESCE($4, activo_id),
         tecnico_id=CASE WHEN $8 THEN $5 ELSE tecnico_id END,
         estado=COALESCE($6, estado),
         numero_reporte=CASE WHEN $9 THEN $7 ELSE numero_reporte END
         WHERE id=$10 RETURNING *`,
        [
          data.fecha ?? null,
          data.tipo ?? null,
          data.descripcion ?? null,
          activoId,
          tecnicoIdEsNulo ? null : tecnicoIdParsed,
          data.estado ?? null,
          numeroReporte,
          shouldUpdateTecnicoId,
          hasNumeroReporte,
          id
        ]
      );
    } else if (hasNumeroReporteColumn && hasCambioPartesColumn && hasChecklistColumn && (hasCambioPartes || hasChecklist)) {
      res = await pool.query(
        `UPDATE mantenimientos SET
         fecha=COALESCE($1, fecha),
         tipo=COALESCE($2, tipo),
         descripcion=COALESCE($3, descripcion),
         activo_id=COALESCE($4, activo_id),
         tecnico_id=CASE WHEN $8 THEN $5 ELSE tecnico_id END,
         estado=COALESCE($6, estado),
         numero_reporte=CASE WHEN $9 THEN $7 ELSE numero_reporte END,
         cambio_partes=CASE WHEN $11 THEN $10 ELSE cambio_partes END,
         checklist=CASE WHEN $13 THEN $12 ELSE checklist END
         WHERE id=$14 RETURNING *`,
        [
          data.fecha ?? null,
          data.tipo ?? null,
          data.descripcion ?? null,
          activoId,
          tecnicoIdEsNulo ? null : tecnicoIdParsed,
          data.estado ?? null,
          numeroReporte,
          shouldUpdateTecnicoId,
          hasNumeroReporte,
          cambioPartes,
          hasCambioPartes,
          checklist ? JSON.stringify(checklist) : null,
          hasChecklist,
          id
        ]
      );
    } else if (hasNumeroReporteColumn && hasChecklistColumn && hasChecklist) {
      res = await pool.query(
        `UPDATE mantenimientos SET
         fecha=COALESCE($1, fecha),
         tipo=COALESCE($2, tipo),
         descripcion=COALESCE($3, descripcion),
         activo_id=COALESCE($4, activo_id),
         tecnico_id=CASE WHEN $8 THEN $5 ELSE tecnico_id END,
         estado=COALESCE($6, estado),
         numero_reporte=CASE WHEN $9 THEN $7 ELSE numero_reporte END,
         checklist=CASE WHEN $11 THEN $10 ELSE checklist END
         WHERE id=$12 RETURNING *`,
        [
          data.fecha ?? null,
          data.tipo ?? null,
          data.descripcion ?? null,
          activoId,
          tecnicoIdEsNulo ? null : tecnicoIdParsed,
          data.estado ?? null,
          numeroReporte,
          shouldUpdateTecnicoId,
          hasNumeroReporte,
          checklist ? JSON.stringify(checklist) : null,
          hasChecklist,
          id
        ]
      );
    } else if (hasCambioPartesColumn && hasChecklistColumn && (hasCambioPartes || hasChecklist)) {
      res = await pool.query(
        `UPDATE mantenimientos SET
         fecha=COALESCE($1, fecha),
         tipo=COALESCE($2, tipo),
         descripcion=COALESCE($3, descripcion),
         activo_id=COALESCE($4, activo_id),
         tecnico_id=CASE WHEN $8 THEN $5 ELSE tecnico_id END,
         estado=COALESCE($6, estado),
         cambio_partes=CASE WHEN $9 THEN $7 ELSE cambio_partes END,
         checklist=CASE WHEN $11 THEN $10 ELSE checklist END
         WHERE id=$12 RETURNING *`,
        [
          data.fecha ?? null,
          data.tipo ?? null,
          data.descripcion ?? null,
          activoId,
          tecnicoIdEsNulo ? null : tecnicoIdParsed,
          data.estado ?? null,
          cambioPartes,
          shouldUpdateTecnicoId,
          hasCambioPartes,
          checklist ? JSON.stringify(checklist) : null,
          hasChecklist,
          id
        ]
      );
    } else if (hasChecklistColumn && hasChecklist) {
      res = await pool.query(
        `UPDATE mantenimientos SET
         fecha=COALESCE($1, fecha),
         tipo=COALESCE($2, tipo),
         descripcion=COALESCE($3, descripcion),
         activo_id=COALESCE($4, activo_id),
         tecnico_id=CASE WHEN $8 THEN $5 ELSE tecnico_id END,
         estado=COALESCE($6, estado),
         checklist=CASE WHEN $10 THEN $7 ELSE checklist END
         WHERE id=$9 RETURNING *`,
        [
          data.fecha ?? null,
          data.tipo ?? null,
          data.descripcion ?? null,
          activoId,
          tecnicoIdEsNulo ? null : tecnicoIdParsed,
          data.estado ?? null,
          checklist ? JSON.stringify(checklist) : null,
          shouldUpdateTecnicoId,
          id,
          hasChecklist
        ]
      );
    } else {
      res = await pool.query(
        `UPDATE mantenimientos SET
         fecha=COALESCE($1, fecha),
         tipo=COALESCE($2, tipo),
         descripcion=COALESCE($3, descripcion),
         activo_id=COALESCE($4, activo_id),
         tecnico_id=CASE WHEN $8 THEN $5 ELSE tecnico_id END,
         estado=COALESCE($6, estado)
         WHERE id=$7 RETURNING *`,
        [
          data.fecha ?? null,
          data.tipo ?? null,
          data.descripcion ?? null,
          activoId,
          tecnicoIdEsNulo ? null : tecnicoIdParsed,
          data.estado ?? null,
          id,
          shouldUpdateTecnicoId
        ]
      );
    }

    return res.rows[0];
  }

  async delete(id) {
    await pool.query("DELETE FROM mantenimientos WHERE id=$1", [id]);
  }
}
