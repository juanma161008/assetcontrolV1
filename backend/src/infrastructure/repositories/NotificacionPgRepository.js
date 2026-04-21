import pool from "../database/postgres.js";

export default class NotificacionPgRepository {
  constructor() {
    this.tableReady = false;
  }

  async ensureTable() {
    if (this.tableReady) {
      return;
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notificaciones (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
          titulo TEXT NOT NULL,
          mensaje TEXT,
          tipo TEXT NOT NULL DEFAULT 'INFO',
          url TEXT,
          leido BOOLEAN NOT NULL DEFAULT FALSE,
          creado_en TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(
        "CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id, leido, creado_en DESC)"
      );
    } finally {
      this.tableReady = true;
    }
  }

  buildFilters(usuarioId, filters = {}) {
    const where = ["usuario_id = $1"];
    const params = [usuarioId];

    if (filters.tipo) {
      params.push(String(filters.tipo).trim().toUpperCase());
      where.push(`tipo = $${params.length}`);
    }

    if (filters.leido !== undefined && filters.leido !== null) {
      params.push(Boolean(filters.leido));
      where.push(`leido = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${String(filters.search).trim()}%`);
      where.push(`(titulo ILIKE $${params.length} OR COALESCE(mensaje, '') ILIKE $${params.length})`);
    }

    return { where, params };
  }

  async findByUsuario(usuarioId, { limit = 30, offset = 0, tipo, leido, search } = {}) {
    await this.ensureTable();
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 30;
    const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
    const { where, params } = this.buildFilters(usuarioId, { tipo, leido, search });

    params.push(safeLimit);
    params.push(safeOffset);

    const { rows } = await pool.query(
      `
        SELECT *
        FROM notificaciones
        WHERE ${where.join(" AND ")}
        ORDER BY creado_en DESC, id DESC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      params
    );
    return rows;
  }

  async countByUsuario(usuarioId, { tipo, leido, search } = {}) {
    await this.ensureTable();
    const { where, params } = this.buildFilters(usuarioId, { tipo, leido, search });
    const { rows } = await pool.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM notificaciones
        WHERE ${where.join(" AND ")}
      `,
      params
    );
    return rows[0]?.total ?? 0;
  }

  async create(data = {}) {
    await this.ensureTable();
    const payload = {
      usuario_id: Number(data.usuario_id),
      titulo: String(data.titulo || "").trim(),
      mensaje: data.mensaje ? String(data.mensaje).trim() : null,
      tipo: String(data.tipo || "INFO").trim().toUpperCase(),
      url: data.url ? String(data.url).trim() : null
    };

    const { rows } = await pool.query(
      `
        INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [
        payload.usuario_id,
        payload.titulo,
        payload.mensaje,
        payload.tipo,
        payload.url
      ]
    );

    return rows[0];
  }

  async markAsRead(id, usuarioId) {
    await this.ensureTable();
    const { rows } = await pool.query(
      `
        UPDATE notificaciones
        SET leido = TRUE
        WHERE id = $1 AND usuario_id = $2
        RETURNING *
      `,
      [id, usuarioId]
    );
    return rows[0];
  }

  async markAllAsRead(usuarioId) {
    await this.ensureTable();
    await pool.query(
      `
        UPDATE notificaciones
        SET leido = TRUE
        WHERE usuario_id = $1
      `,
      [usuarioId]
    );
    return true;
  }

  async deleteById(id, usuarioId) {
    await this.ensureTable();
    const { rows } = await pool.query(
      `
        DELETE FROM notificaciones
        WHERE id = $1 AND usuario_id = $2
        RETURNING *
      `,
      [id, usuarioId]
    );
    return rows[0];
  }

  async deleteAllByUsuario(usuarioId) {
    await this.ensureTable();
    await pool.query(
      `
        DELETE FROM notificaciones
        WHERE usuario_id = $1
      `,
      [usuarioId]
    );
    return true;
  }
}
