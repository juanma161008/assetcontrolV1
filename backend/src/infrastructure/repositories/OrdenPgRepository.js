import pool from "../database/postgres.js";

export default class OrdenPgRepository {
  constructor() {
    this.hasActivoColumnCache = null;
    this.interventorColumnsReady = false;
  }

  async ensureInterventorColumns() {
    if (this.interventorColumnsReady) {
      return;
    }

    if (process.env.NODE_ENV === "test") {
      this.interventorColumnsReady = true;
      return;
    }

    try {
      await pool.query(`
        ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS interventor_id INTEGER NULL;
        ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS enviada_interventor_en TIMESTAMP NULL;
        ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS comentario_interventor TEXT NULL;
        ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS firmante_nombre VARCHAR(150) NULL;
        ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS firmante_area VARCHAR(150) NULL;
        ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS firmante_cargo VARCHAR(150) NULL;
        ALTER TABLE firmas_digitales ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'USUARIO';
      `);
    } catch {
      // No bloquear si la BD no permite DDL; las columnas deben existir de antemano.
    } finally {
      this.interventorColumnsReady = true;
    }
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

  async getActivoLabelExpression(alias = "a") {
    const hasActivoColumn = await this.hasActivoColumn();
    if (hasActivoColumn) {
      return `COALESCE(NULLIF(${alias}.activo, ''), NULLIF(${alias}.nombre, ''), NULLIF(${alias}.numeroreporte, ''), CONCAT('ACTIVO #', ${alias}.id::text))`;
    }
    return `COALESCE(NULLIF(${alias}.nombre, ''), NULLIF(${alias}.numeroreporte, ''), CONCAT('ACTIVO #', ${alias}.id::text))`;
  }

  async create(data) {
    await this.ensureInterventorColumns();

    const mantenimientos = Array.isArray(data?.mantenimientos)
      ? Array.from(
          new Set(
            data.mantenimientos
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0)
          )
        )
      : [];

    const firmanteValues = [
      data.firmante_nombre || null,
      data.firmante_area || null,
      data.firmante_cargo || null
    ];

    if (!mantenimientos.length) {
      const res = await pool.query(
        `INSERT INTO ordenes(numero,fecha,estado,creado_por,firmante_nombre,firmante_area,firmante_cargo)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [data.numero, data.fecha, data.estado, data.creado_por, ...firmanteValues]
      );
      return res.rows[0];
    }

    await pool.query("BEGIN");
    try {
      const res = await pool.query(
        `INSERT INTO ordenes(numero,fecha,estado,creado_por,firmante_nombre,firmante_area,firmante_cargo)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [data.numero, data.fecha, data.estado, data.creado_por, ...firmanteValues]
      );
      const orden = res.rows[0];

      if (mantenimientos.length) {
        for (const mantenimientoId of mantenimientos) {
          await pool.query(
            `INSERT INTO orden_detalle(orden_id,mantenimiento_id)
             VALUES($1,$2)`,
            [orden.id, mantenimientoId]
          );
        }
      }

      await pool.query("COMMIT");
      return orden;
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  async firmar(id, firmaBase64, usuarioId) {
    await this.ensureInterventorColumns();

    await pool.query(
      `INSERT INTO firmas_digitales
       (orden_id,firma_base64,firmado_por,fecha)
       VALUES($1,$2,$3,NOW())`,
      [id, firmaBase64, usuarioId]
    );

    await pool.query(
      `UPDATE ordenes SET estado='Firmada' WHERE id=$1`,
      [id]
    );
  }

  async enviarAInterventor(id) {
    await this.ensureInterventorColumns();

    const res = await pool.query(
      `UPDATE ordenes
       SET estado='Pendiente Interventor', enviada_interventor_en=NOW(), comentario_interventor=NULL
       WHERE id=$1 AND estado IN ('Firmada','Rechazada por Interventor')
       RETURNING *`,
      [id]
    );
    return res.rows[0];
  }

  async firmarInterventor(id, firmaBase64, usuarioId) {
    await this.ensureInterventorColumns();

    await pool.query("BEGIN");
    try {
      await pool.query(
        `INSERT INTO firmas_digitales
         (orden_id,firma_base64,firmado_por,fecha,tipo)
         VALUES($1,$2,$3,NOW(),'INTERVENTOR')`,
        [id, firmaBase64, usuarioId]
      );

      const res = await pool.query(
        `UPDATE ordenes
         SET estado='Aprobada', interventor_id=$2
         WHERE id=$1 AND estado='Pendiente Interventor'
         RETURNING *`,
        [id, usuarioId]
      );

      await pool.query("COMMIT");
      return res.rows[0];
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  async rechazarInterventor(id, usuarioId, comentario) {
    await this.ensureInterventorColumns();

    const res = await pool.query(
      `UPDATE ordenes
       SET estado='Rechazada por Interventor', interventor_id=$2, comentario_interventor=$3
       WHERE id=$1 AND estado='Pendiente Interventor'
       RETURNING *`,
      [id, usuarioId, comentario]
    );
    return res.rows[0];
  }

  async findById(id) {
    await this.ensureInterventorColumns();
    const activoLabelExpression = await this.getActivoLabelExpression("a");
    const res = await pool.query(
      `SELECT
         o.*,
         u.nombre AS creador_nombre,
         u.email AS creador_email,
         iu.nombre AS interventor_nombre,
         MAX(ufd.firma_base64) AS usuario_firma,
         COALESCE(
           STRING_AGG(
             DISTINCT ${activoLabelExpression},
             ', '
           ),
           ''
         ) AS activos,
         COALESCE(STRING_AGG(DISTINCT m.numero_reporte, ', '), '') AS reportes,
         COALESCE(STRING_AGG(DISTINCT m.tipo, ', '), '') AS tipos_mantenimiento,
         COALESCE(STRING_AGG(DISTINCT NULLIF(a.areaprincipal, ''), ', '), '') AS areas_principales,
         COALESCE(STRING_AGG(DISTINCT NULLIF(a.areasecundaria, ''), ', '), '') AS areas_secundarias,
         COALESCE(STRING_AGG(DISTINCT e.nombre, ', '), '') AS entidades,
         COALESCE(array_remove(array_agg(DISTINCT e.id), NULL), '{}') AS entidades_ids,
         COALESCE(COUNT(DISTINCT od.mantenimiento_id), 0)::INT AS total_mantenimientos,
         CASE WHEN COUNT(fd.id) > 0 THEN TRUE ELSE FALSE END AS firmada
       FROM ordenes o
       LEFT JOIN usuarios u ON u.id = o.creado_por
       LEFT JOIN usuarios iu ON iu.id = o.interventor_id
       LEFT JOIN orden_detalle od ON od.orden_id = o.id
       LEFT JOIN mantenimientos m ON m.id = od.mantenimiento_id
       LEFT JOIN activos a ON a.id = m.activo_id
       LEFT JOIN entidades e ON e.id = a.entidad_id
       LEFT JOIN firmas_digitales fd ON fd.orden_id = o.id
       LEFT JOIN firmas_digitales ufd ON ufd.orden_id = o.id AND ufd.tipo = 'USUARIO'
       WHERE o.id=$1
       GROUP BY o.id, u.nombre, u.email, iu.nombre`,
      [id]
    );
    return res.rows[0];
  }

  async findByMantenimientoId(mantenimientoId) {
    await this.ensureInterventorColumns();

    const res = await pool.query(
      `SELECT o.id
       FROM ordenes o
       INNER JOIN orden_detalle od ON od.orden_id = o.id
       WHERE od.mantenimiento_id = $1
       ORDER BY o.id DESC
       LIMIT 1`,
      [mantenimientoId]
    );

    const ordenId = res.rows[0]?.id;
    if (!ordenId) {
      return null;
    }

    return this.findById(ordenId);
  }

  // Reconstruye la informacion completa para el documento imprimible/PDF (activo,
  // mantenimiento, firmas) desde el servidor, para que cualquier dispositivo o rol
  // pueda descargarlo igual, sin depender del respaldo local del navegador que lo creo.
  async findDocumentData(id) {
    await this.ensureInterventorColumns();

    const res = await pool.query(
      `SELECT
         o.numero, o.fecha AS orden_fecha, o.estado,
         o.firmante_nombre, o.firmante_area, o.firmante_cargo,
         iu.nombre AS interventor_nombre,
         o.comentario_interventor,
         MAX(ufd.firma_base64) AS usuario_firma,
         MAX(ifd.firma_base64) AS interventor_firma,
         m.id AS mantenimiento_id,
         m.tipo AS mantenimiento_tipo,
         m.descripcion AS mantenimiento_descripcion,
         m.cambio_partes,
         m.fecha AS mantenimiento_fecha,
         tec.nombre AS tecnico_nombre,
         a.id AS activo_id,
         a.activo,
         a.nombre AS activo_nombre,
         a.serial,
         a.equipo,
         a.marca,
         a.modelo,
         a.procesador,
         a.ram,
         a.tiporam,
         a.tipodisco,
         a.hdd,
         a.os,
         a.areaprincipal,
         a.areasecundaria,
         a.sede,
         a.estado AS activo_estado,
         e.nombre AS entidad_nombre
       FROM ordenes o
       LEFT JOIN usuarios iu ON iu.id = o.interventor_id
       LEFT JOIN orden_detalle od ON od.orden_id = o.id
       LEFT JOIN mantenimientos m ON m.id = od.mantenimiento_id
       LEFT JOIN usuarios tec ON tec.id = m.tecnico_id
       LEFT JOIN activos a ON a.id = m.activo_id
       LEFT JOIN entidades e ON e.id = COALESCE(a.entidad_id, m.entidad_id)
       LEFT JOIN firmas_digitales ufd ON ufd.orden_id = o.id AND ufd.tipo = 'USUARIO'
       LEFT JOIN firmas_digitales ifd ON ifd.orden_id = o.id AND ifd.tipo = 'INTERVENTOR'
       WHERE o.id = $1
       GROUP BY
         o.numero, o.fecha, o.estado, o.firmante_nombre, o.firmante_area, o.firmante_cargo,
         iu.nombre, o.comentario_interventor,
         m.id, m.tipo, m.descripcion, m.cambio_partes, m.fecha,
         tec.nombre, a.id, a.activo, a.nombre, a.serial, a.equipo, a.marca, a.modelo,
         a.procesador, a.ram, a.tiporam, a.tipodisco, a.hdd, a.os, a.areaprincipal,
         a.areasecundaria, a.sede, a.estado, e.nombre
       LIMIT 1`,
      [id]
    );

    return res.rows[0] || null;
  }

  async findAll() {
    await this.ensureInterventorColumns();
    const activoLabelExpression = await this.getActivoLabelExpression("a");
    const res = await pool.query(
      `SELECT
         o.*,
         u.nombre AS creador_nombre,
         u.email AS creador_email,
         iu.nombre AS interventor_nombre,
         COALESCE(
           STRING_AGG(
             DISTINCT ${activoLabelExpression},
             ', '
           ),
           ''
         ) AS activos,
         COALESCE(STRING_AGG(DISTINCT m.numero_reporte, ', '), '') AS reportes,
         COALESCE(STRING_AGG(DISTINCT m.tipo, ', '), '') AS tipos_mantenimiento,
         COALESCE(STRING_AGG(DISTINCT NULLIF(a.areaprincipal, ''), ', '), '') AS areas_principales,
         COALESCE(STRING_AGG(DISTINCT NULLIF(a.areasecundaria, ''), ', '), '') AS areas_secundarias,
         COALESCE(STRING_AGG(DISTINCT e.nombre, ', '), '') AS entidades,
         COALESCE(array_remove(array_agg(DISTINCT e.id), NULL), '{}') AS entidades_ids,
         COALESCE(COUNT(DISTINCT od.mantenimiento_id), 0)::INT AS total_mantenimientos,
         CASE WHEN COUNT(fd.id) > 0 THEN TRUE ELSE FALSE END AS firmada
       FROM ordenes o
       LEFT JOIN usuarios u ON u.id = o.creado_por
       LEFT JOIN usuarios iu ON iu.id = o.interventor_id
       LEFT JOIN orden_detalle od ON od.orden_id = o.id
       LEFT JOIN mantenimientos m ON m.id = od.mantenimiento_id
       LEFT JOIN activos a ON a.id = m.activo_id
       LEFT JOIN entidades e ON e.id = a.entidad_id
       LEFT JOIN firmas_digitales fd ON fd.orden_id = o.id
       GROUP BY o.id, u.nombre, u.email, iu.nombre
       ORDER BY o.fecha DESC, o.id DESC`
    );
    return res.rows;
  }

  async delete(id) {
    await pool.query("BEGIN");
    try {
      await pool.query("DELETE FROM orden_detalle WHERE orden_id = $1", [id]);
      await pool.query("DELETE FROM firmas_digitales WHERE orden_id = $1", [id]);
      await pool.query("DELETE FROM ordenes WHERE id = $1", [id]);
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }
}
