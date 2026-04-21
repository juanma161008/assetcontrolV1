import pool from "../database/postgres.js";

export default class HelpdeskPgRepository {
  constructor() {
    this.tablesReady = false;
  }

  async ensureTables() {
    if (this.tablesReady) {
      return;
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS helpdesk_threads (
          id SERIAL PRIMARY KEY,
          titulo TEXT NOT NULL,
          categoria TEXT,
          estado TEXT NOT NULL DEFAULT 'ABIERTO',
          prioridad TEXT NOT NULL DEFAULT 'MEDIA',
          admin_asignado_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
          actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        ALTER TABLE helpdesk_threads
        ADD COLUMN IF NOT EXISTS admin_asignado_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS helpdesk_messages (
          id SERIAL PRIMARY KEY,
          thread_id INTEGER NOT NULL REFERENCES helpdesk_threads(id) ON DELETE CASCADE,
          mensaje TEXT NOT NULL,
          adjuntos JSONB,
          creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          creado_en TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        ALTER TABLE helpdesk_messages
        ADD COLUMN IF NOT EXISTS adjuntos JSONB
      `);

      await pool.query(
        "CREATE INDEX IF NOT EXISTS idx_helpdesk_messages_thread_id ON helpdesk_messages(thread_id)"
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS idx_helpdesk_threads_estado ON helpdesk_threads(estado)"
      );
      await pool.query(
        "CREATE INDEX IF NOT EXISTS idx_helpdesk_threads_admin ON helpdesk_threads(admin_asignado_id)"
      );
    } finally {
      this.tablesReady = true;
    }
  }

  async findThreads(filters = {}) {
    await this.ensureTables();
    const where = [];
    const params = [];

    if (filters.estado) {
      params.push(String(filters.estado).toUpperCase());
      where.push(`t.estado = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${String(filters.search).trim()}%`);
      where.push(`(t.titulo ILIKE $${params.length} OR COALESCE(t.categoria, '') ILIKE $${params.length})`);
    }

    if (filters.creadoPor) {
      params.push(Number(filters.creadoPor));
      where.push(`t.creado_por = $${params.length}`);
    }

    if (filters.adminAsignadoId) {
      params.push(Number(filters.adminAsignadoId));
      where.push(`t.admin_asignado_id = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `
        SELECT
          t.*,
          u.nombre AS creado_por_nombre,
          u.rol_id AS creado_por_rol,
          a.nombre AS admin_asignado_nombre,
          a.rol_id AS admin_asignado_rol,
          stats.total_mensajes,
          stats.ultimo_mensaje_en,
          stats.tiene_respuesta_admin,
          lastmsg.creado_por_nombre AS ultimo_mensaje_por_nombre,
          lastmsg.creado_por_rol AS ultimo_mensaje_por_rol
        FROM helpdesk_threads t
        LEFT JOIN usuarios u ON u.id = t.creado_por
        LEFT JOIN usuarios a ON a.id = t.admin_asignado_id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(m.id)::INT AS total_mensajes,
            MAX(m.creado_en) AS ultimo_mensaje_en,
            COALESCE(BOOL_OR(COALESCE(um.rol_id, 0) = 1), false) AS tiene_respuesta_admin
          FROM helpdesk_messages m
          LEFT JOIN usuarios um ON um.id = m.creado_por
          WHERE m.thread_id = t.id
        ) stats ON true
        LEFT JOIN LATERAL (
          SELECT
            m2.creado_en,
            u2.nombre AS creado_por_nombre,
            u2.rol_id AS creado_por_rol
          FROM helpdesk_messages m2
          LEFT JOIN usuarios u2 ON u2.id = m2.creado_por
          WHERE m2.thread_id = t.id
          ORDER BY m2.creado_en DESC, m2.id DESC
          LIMIT 1
        ) lastmsg ON true
        ${whereClause}
        ORDER BY t.actualizado_en DESC, t.id DESC
      `,
      params
    );

    return rows;
  }

  async findThreadById(id) {
    await this.ensureTables();
    const { rows } = await pool.query(
      `
        SELECT
          t.*,
          u.nombre AS creado_por_nombre,
          u.rol_id AS creado_por_rol,
          a.nombre AS admin_asignado_nombre,
          a.rol_id AS admin_asignado_rol
        FROM helpdesk_threads t
        LEFT JOIN usuarios u ON u.id = t.creado_por
        LEFT JOIN usuarios a ON a.id = t.admin_asignado_id
        WHERE t.id = $1
      `,
      [id]
    );
    return rows[0];
  }

  async findMessagesByThread(threadId) {
    await this.ensureTables();
    const { rows } = await pool.query(
      `
        SELECT
          m.*,
          u.nombre AS creado_por_nombre,
          u.rol_id AS creado_por_rol
        FROM helpdesk_messages m
        LEFT JOIN usuarios u ON u.id = m.creado_por
        WHERE m.thread_id = $1
        ORDER BY m.creado_en ASC, m.id ASC
      `,
      [threadId]
    );
    return rows;
  }

  async createThread(data = {}) {
    await this.ensureTables();
    const normalizeStatusValue = (value, fallback) =>
      String(value || fallback)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const payload = {
      titulo: String(data.titulo || "").trim(),
      categoria: data.categoria ? String(data.categoria).trim() : null,
      estado: normalizeStatusValue(data.estado, "ABIERTO"),
      prioridad: data.prioridad ? String(data.prioridad).trim().toUpperCase() : "MEDIA",
      admin_asignado_id: data.admin_asignado_id ? Number(data.admin_asignado_id) : null,
      creado_por: data.creado_por ?? null
    };

    const { rows } = await pool.query(
      `
        INSERT INTO helpdesk_threads (titulo, categoria, estado, prioridad, admin_asignado_id, creado_por)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        payload.titulo,
        payload.categoria,
        payload.estado,
        payload.prioridad,
        payload.admin_asignado_id,
        payload.creado_por
      ]
    );

    return rows[0];
  }

  async createMessage(data = {}) {
    await this.ensureTables();
    const payload = {
      thread_id: Number(data.thread_id),
      mensaje: String(data.mensaje || "").trim(),
      creado_por: data.creado_por ?? null,
      adjuntos: data.adjuntos ?? []
    };

    const { rows } = await pool.query(
      `
        INSERT INTO helpdesk_messages (thread_id, mensaje, creado_por, adjuntos)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [
        payload.thread_id,
        payload.mensaje,
        payload.creado_por,
        JSON.stringify(payload.adjuntos || [])
      ]
    );

    await pool.query(
      "UPDATE helpdesk_threads SET actualizado_en = NOW() WHERE id = $1",
      [payload.thread_id]
    );

    return rows[0];
  }

  async createThreadWithMessage(data = {}) {
    await this.ensureTables();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const normalizeStatusValue = (value, fallback) =>
        String(value || fallback)
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "_");

      const payload = {
        titulo: String(data.titulo || "").trim(),
        categoria: data.categoria ? String(data.categoria).trim() : null,
        estado: normalizeStatusValue(data.estado, "ABIERTO"),
        prioridad: data.prioridad ? String(data.prioridad).trim().toUpperCase() : "MEDIA",
        admin_asignado_id: data.admin_asignado_id ? Number(data.admin_asignado_id) : null,
        creado_por: data.creado_por ?? null
      };

      const threadResult = await client.query(
        `
          INSERT INTO helpdesk_threads (titulo, categoria, estado, prioridad, admin_asignado_id, creado_por)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `,
        [
          payload.titulo,
          payload.categoria,
          payload.estado,
          payload.prioridad,
          payload.admin_asignado_id,
          payload.creado_por
        ]
      );

      const thread = threadResult.rows[0];

      const messageResult = await client.query(
        `
          INSERT INTO helpdesk_messages (thread_id, mensaje, creado_por, adjuntos)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [
          thread.id,
          String(data.mensaje || "").trim(),
          payload.creado_por,
          JSON.stringify(data.adjuntos || [])
        ]
      );

      await client.query("UPDATE helpdesk_threads SET actualizado_en = NOW() WHERE id = $1", [thread.id]);
      await client.query("COMMIT");

      return { thread, message: messageResult.rows[0] };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateThread(id, data = {}) {
    await this.ensureTables();
    const normalizeStatusValue = (value) =>
      String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const fields = [];
    const values = [];

    if (data.titulo !== undefined) {
      fields.push(`titulo = $${values.length + 1}`);
      values.push(String(data.titulo || "").trim());
    }

    if (data.categoria !== undefined) {
      fields.push(`categoria = $${values.length + 1}`);
      values.push(data.categoria ? String(data.categoria).trim() : null);
    }

    if (data.estado !== undefined) {
      fields.push(`estado = $${values.length + 1}`);
      values.push(normalizeStatusValue(data.estado));
    }

    if (data.prioridad !== undefined) {
      fields.push(`prioridad = $${values.length + 1}`);
      values.push(String(data.prioridad || "").trim().toUpperCase());
    }

    if (data.admin_asignado_id !== undefined) {
      fields.push(`admin_asignado_id = $${values.length + 1}`);
      values.push(data.admin_asignado_id ? Number(data.admin_asignado_id) : null);
    }

    fields.push(`actualizado_en = NOW()`);

    values.push(id);

    const { rows } = await pool.query(
      `UPDATE helpdesk_threads SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );

    return rows[0];
  }
}
