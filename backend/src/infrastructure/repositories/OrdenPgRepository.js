import pool from "../database/postgres.js";

export default class OrdenPgRepository {
  constructor() {
    this.hasActivoColumnCache = null;
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
    const mantenimientos = Array.isArray(data?.mantenimientos)
      ? Array.from(
          new Set(
            data.mantenimientos
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0)
          )
        )
      : [];

    if (!mantenimientos.length) {
      const res = await pool.query(
        `INSERT INTO ordenes(numero,fecha,estado,creado_por)
         VALUES($1,$2,$3,$4) RETURNING *`,
        [data.numero, data.fecha, data.estado, data.creado_por]
      );
      return res.rows[0];
    }

    await pool.query("BEGIN");
    try {
      const res = await pool.query(
        `INSERT INTO ordenes(numero,fecha,estado,creado_por)
         VALUES($1,$2,$3,$4) RETURNING *`,
        [data.numero, data.fecha, data.estado, data.creado_por]
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

  async findById(id) {
    const activoLabelExpression = await this.getActivoLabelExpression("a");
    const res = await pool.query(
      `SELECT
         o.*,
         u.nombre AS creador_nombre,
         u.email AS creador_email,
         COALESCE(
           STRING_AGG(
             DISTINCT ${activoLabelExpression},
             ', '
           ),
           ''
         ) AS activos,
         COALESCE(STRING_AGG(DISTINCT e.nombre, ', '), '') AS entidades,
         COALESCE(array_remove(array_agg(DISTINCT e.id), NULL), '{}') AS entidades_ids,
         COALESCE(COUNT(DISTINCT od.mantenimiento_id), 0)::INT AS total_mantenimientos,
         CASE WHEN COUNT(fd.id) > 0 THEN TRUE ELSE FALSE END AS firmada
       FROM ordenes o
       LEFT JOIN usuarios u ON u.id = o.creado_por
       LEFT JOIN orden_detalle od ON od.orden_id = o.id
       LEFT JOIN mantenimientos m ON m.id = od.mantenimiento_id
       LEFT JOIN activos a ON a.id = m.activo_id
       LEFT JOIN entidades e ON e.id = a.entidad_id
       LEFT JOIN firmas_digitales fd ON fd.orden_id = o.id
       WHERE o.id=$1
       GROUP BY o.id, u.nombre, u.email`,
      [id]
    );
    return res.rows[0];
  }

  async findAll() {
    const activoLabelExpression = await this.getActivoLabelExpression("a");
    const res = await pool.query(
      `SELECT
         o.*,
         u.nombre AS creador_nombre,
         u.email AS creador_email,
         COALESCE(
           STRING_AGG(
             DISTINCT ${activoLabelExpression},
             ', '
           ),
           ''
         ) AS activos,
         COALESCE(STRING_AGG(DISTINCT e.nombre, ', '), '') AS entidades,
         COALESCE(array_remove(array_agg(DISTINCT e.id), NULL), '{}') AS entidades_ids,
         COALESCE(COUNT(DISTINCT od.mantenimiento_id), 0)::INT AS total_mantenimientos,
         CASE WHEN COUNT(fd.id) > 0 THEN TRUE ELSE FALSE END AS firmada
       FROM ordenes o
       LEFT JOIN usuarios u ON u.id = o.creado_por
       LEFT JOIN orden_detalle od ON od.orden_id = o.id
       LEFT JOIN mantenimientos m ON m.id = od.mantenimiento_id
       LEFT JOIN activos a ON a.id = m.activo_id
       LEFT JOIN entidades e ON e.id = a.entidad_id
       LEFT JOIN firmas_digitales fd ON fd.orden_id = o.id
       GROUP BY o.id, u.nombre, u.email
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
