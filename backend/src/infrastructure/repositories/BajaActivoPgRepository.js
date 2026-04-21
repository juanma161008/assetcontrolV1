import pool from "../database/postgres.js";

export default class BajaActivoPgRepository {
  constructor() {
    this.tableReady = false;
  }

  async ensureTable() {
    if (this.tableReady) {
      return;
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS activos_bajas (
          id SERIAL PRIMARY KEY,
          activo_id INTEGER NOT NULL REFERENCES activos(id) ON DELETE CASCADE,
          solicitado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          motivo TEXT NOT NULL,
          evidencia JSONB,
          estado TEXT NOT NULL DEFAULT 'PENDIENTE',
          respuesta_admin TEXT,
          aprobado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          aprobado_en TIMESTAMP,
          creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
          actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(
        "CREATE INDEX IF NOT EXISTS idx_bajas_activo_estado ON activos_bajas(estado)"
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS idx_bajas_activo_id ON activos_bajas(activo_id)"
      );
    } finally {
      this.tableReady = true;
    }
  }

  async findAll(filters = {}) {
    await this.ensureTable();
    const where = [];
    const params = [];

    if (filters.estado) {
      params.push(String(filters.estado).trim().toUpperCase());
      where.push(`b.estado = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${String(filters.search).trim()}%`);
      where.push(`
        (COALESCE(a.activo, '') ILIKE $${params.length}
         OR COALESCE(a.nombre, '') ILIKE $${params.length}
         OR COALESCE(b.motivo, '') ILIKE $${params.length})
      `);
    }

    if (filters.solicitadoPor) {
      params.push(Number(filters.solicitadoPor));
      where.push(`b.solicitado_por = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `
        SELECT
          b.*,
          a.activo AS activo_codigo,
          a.nombre AS activo_nombre,
          a.estado AS activo_estado,
          a.entidad_id AS entidad_id,
          u.nombre AS solicitado_por_nombre,
          u.email AS solicitado_por_email,
          ap.nombre AS aprobado_por_nombre
        FROM activos_bajas b
        LEFT JOIN activos a ON a.id = b.activo_id
        LEFT JOIN usuarios u ON u.id = b.solicitado_por
        LEFT JOIN usuarios ap ON ap.id = b.aprobado_por
        ${whereClause}
        ORDER BY b.creado_en DESC, b.id DESC
      `,
      params
    );

    return rows;
  }

  async findById(id) {
    await this.ensureTable();
    const { rows } = await pool.query(
      `
        SELECT *
        FROM activos_bajas
        WHERE id = $1
      `,
      [id]
    );
    return rows[0];
  }

  async findPendingByActivo(activoId) {
    await this.ensureTable();
    const { rows } = await pool.query(
      `
        SELECT *
        FROM activos_bajas
        WHERE activo_id = $1 AND estado = 'PENDIENTE'
        ORDER BY creado_en DESC, id DESC
        LIMIT 1
      `,
      [activoId]
    );
    return rows[0];
  }

  async create(data = {}) {
    await this.ensureTable();
    const payload = {
      activo_id: Number(data.activo_id),
      solicitado_por: data.solicitado_por ?? null,
      motivo: String(data.motivo || "").trim(),
      evidencia: data.evidencia || []
    };

    const { rows } = await pool.query(
      `
        INSERT INTO activos_bajas (activo_id, solicitado_por, motivo, evidencia)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [
        payload.activo_id,
        payload.solicitado_por,
        payload.motivo,
        JSON.stringify(payload.evidencia)
      ]
    );

    return rows[0];
  }

  async updateEstado(id, data = {}) {
    await this.ensureTable();
    const payload = {
      estado: String(data.estado || "").trim().toUpperCase(),
      respuesta_admin: data.respuesta_admin ? String(data.respuesta_admin).trim() : null,
      aprobado_por: data.aprobado_por ?? null,
      aprobado_en: data.aprobado_en ?? new Date()
    };

    const { rows } = await pool.query(
      `
        UPDATE activos_bajas
        SET
          estado = $1,
          respuesta_admin = $2,
          aprobado_por = $3,
          aprobado_en = $4,
          actualizado_en = NOW()
        WHERE id = $5
        RETURNING *
      `,
      [
        payload.estado,
        payload.respuesta_admin,
        payload.aprobado_por,
        payload.aprobado_en,
        id
      ]
    );

    return rows[0];
  }
}

