import env from "../../config/env.js";
import pool from "../database/postgres.js";

const DEFAULT_ROLES = [
  { id: 1, nombre: "Administrador" },
  { id: 2, nombre: "Tecnico" },
  { id: 3, nombre: "Usuario" }
];

const PASSWORD_HISTORY_LIMIT = Math.max(1, Number(env.PASSWORD_HISTORY_LIMIT) || 5);

const isPositiveInteger = (value) => {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0;
};

const normalizePasswordHash = (value) => String(value || "").trim();

const buildUpdateStatement = (data = {}) => {
  const fields = [];
  const values = [];

  if (data.nombre !== undefined) {
    fields.push(`nombre=$${values.length + 1}`);
    values.push(data.nombre);
  }

  if (data.email !== undefined) {
    fields.push(`email=$${values.length + 1}`);
    values.push(data.email);
  }

  if (data.password !== undefined) {
    fields.push(`password=$${values.length + 1}`);
    values.push(data.password);
  }

  if (data.rol_id !== undefined) {
    fields.push(`rol_id=$${values.length + 1}`);
    values.push(data.rol_id);
  }

  return { fields, values };
};

export default class UsuarioPgRepository {
  constructor() {
    this.securityTableReady = false;
    this.userEntityTableReady = false;
    this.passwordHistoryTableReady = false;
  }

  async ensureSecurityTable() {
    if (this.securityTableReady) {
      return;
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS usuario_seguridad (
          usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
          debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE,
          actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } finally {
      // Evita intentar crear la tabla en cada llamada si la BD no permite DDL.
      this.securityTableReady = true;
    }
  }

  async ensureUserEntityTable() {
    if (this.userEntityTableReady) {
      return;
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS usuario_entidades (
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
          entidad_id INTEGER NOT NULL REFERENCES entidades(id) ON DELETE CASCADE,
          creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
          PRIMARY KEY (usuario_id, entidad_id)
        )
      `);
    } finally {
      this.userEntityTableReady = true;
    }
  }

  async ensurePasswordHistoryTable() {
    if (this.passwordHistoryTableReady) {
      return;
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS usuario_password_historial (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
          password_hash TEXT NOT NULL,
          creado_en TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_usuario_password_historial_usuario_fecha
        ON usuario_password_historial (usuario_id, creado_en DESC, id DESC)
      `);
    } finally {
      this.passwordHistoryTableReady = true;
    }
  }

  async withTransaction(work) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // No bloquear el error original si rollback falla.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async insertPasswordHistoryEntry(client, userId, passwordHash) {
    const cleanHash = normalizePasswordHash(passwordHash);
    if (!cleanHash) {
      return false;
    }

    await client.query(
      `
        INSERT INTO usuario_password_historial (usuario_id, password_hash)
        VALUES ($1, $2)
      `,
      [userId, cleanHash]
    );

    return true;
  }

  async prunePasswordHistory(client, userId, limit = PASSWORD_HISTORY_LIMIT) {
    const historyLimit = Math.max(1, Number(limit) || PASSWORD_HISTORY_LIMIT);

    await client.query(
      `
        DELETE FROM usuario_password_historial
        WHERE usuario_id = $1
          AND id NOT IN (
            SELECT id
            FROM usuario_password_historial
            WHERE usuario_id = $1
            ORDER BY creado_en DESC, id DESC
            LIMIT $2
          )
      `,
      [userId, historyLimit]
    );
  }

  async getRecentPasswordHashes(userId, limit = PASSWORD_HISTORY_LIMIT) {
    const normalizedUserId = Number(userId);
    if (!isPositiveInteger(normalizedUserId)) {
      return [];
    }

    await this.ensurePasswordHistoryTable();
    const historyLimit = Math.max(1, Number(limit) || PASSWORD_HISTORY_LIMIT);

    const res = await pool.query(
      `
        SELECT password_hash
        FROM usuario_password_historial
        WHERE usuario_id = $1
        ORDER BY creado_en DESC, id DESC
        LIMIT $2
      `,
      [normalizedUserId, historyLimit]
    );
    return Array.isArray(res.rows) ? res.rows.map((row) => row.password_hash).filter(Boolean) : [];
  }

  async findByEmail(email) {
    const res = await pool.query(
      "SELECT * FROM usuarios WHERE email=$1",
      [email]
    );
    return res.rows[0];
  }

  async create(data) {
    const normalizedPassword = normalizePasswordHash(data.password);

    if (!normalizedPassword) {
      const res = await pool.query(
        `INSERT INTO usuarios(nombre,email,password,rol_id)
         VALUES($1,$2,$3,$4) RETURNING *`,
        [data.nombre, data.email, data.password, data.rol_id]
      );
      return res.rows[0];
    }

    await this.ensurePasswordHistoryTable();

    return this.withTransaction(async (client) => {
      const res = await client.query(
        `INSERT INTO usuarios(nombre,email,password,rol_id)
         VALUES($1,$2,$3,$4) RETURNING *`,
        [data.nombre, data.email, data.password, data.rol_id]
      );

      const createdUser = res.rows[0];
      if (!createdUser) {
        return createdUser;
      }

      await this.insertPasswordHistoryEntry(client, createdUser.id, data.password);
      await this.prunePasswordHistory(client, createdUser.id);
      return createdUser;
    });
  }

  async findById(id) {
    const res = await pool.query(
      "SELECT * FROM usuarios WHERE id=$1",
      [id]
    );
    return res.rows[0];
  }

  async updatePassword(id, hashedPassword) {
    const normalizedId = Number(id);
    const cleanHash = normalizePasswordHash(hashedPassword);

    if (!isPositiveInteger(normalizedId) || !cleanHash) {
      return null;
    }

    await this.ensurePasswordHistoryTable();

    return this.withTransaction(async (client) => {
      const currentResult = await client.query(
        "SELECT password FROM usuarios WHERE id=$1 FOR UPDATE",
        [normalizedId]
      );
      const currentHash = currentResult.rows[0]?.password || null;

      const res = await client.query(
        "UPDATE usuarios SET password = $1 WHERE id = $2 RETURNING *",
        [cleanHash, normalizedId]
      );

      if (!res.rows[0]) {
        return null;
      }

      if (currentHash) {
        await this.insertPasswordHistoryEntry(client, normalizedId, currentHash);
      }
      await this.insertPasswordHistoryEntry(client, normalizedId, cleanHash);
      await this.prunePasswordHistory(client, normalizedId);
      return res.rows[0];
    });
  }

  async findAll() {
    const res = await pool.query(
      "SELECT id, nombre, email, rol_id FROM usuarios ORDER BY id DESC"
    );
    return res.rows;
  }

  async update(id, data) {
    const normalizedId = Number(id);
    if (!isPositiveInteger(normalizedId)) {
      return null;
    }

    if (data.password !== undefined) {
      const normalizedPassword = normalizePasswordHash(data.password);
      if (!normalizedPassword) {
        return null;
      }

      await this.ensurePasswordHistoryTable();

      return this.withTransaction(async (client) => {
        const currentResult = await client.query(
          "SELECT password FROM usuarios WHERE id=$1 FOR UPDATE",
          [normalizedId]
        );
        const currentHash = currentResult.rows[0]?.password || null;

        const { fields, values } = buildUpdateStatement(data);
        if (!fields.length) {
          return this.findById(normalizedId);
        }

        values.push(normalizedId);

        const res = await client.query(
          `UPDATE usuarios SET ${fields.join(", ")} WHERE id=$${values.length} RETURNING *`,
          values
        );

        if (!res.rows[0]) {
          return null;
        }

        if (currentHash) {
          await this.insertPasswordHistoryEntry(client, normalizedId, currentHash);
        }
        await this.insertPasswordHistoryEntry(client, normalizedId, normalizedPassword);
        await this.prunePasswordHistory(client, normalizedId);
        return res.rows[0];
      });
    }

    const { fields, values } = buildUpdateStatement(data);

    if (!fields.length) {
      return this.findById(normalizedId);
    }

    values.push(normalizedId);

    const res = await pool.query(
      `UPDATE usuarios SET ${fields.join(", ")} WHERE id=$${values.length} RETURNING *`,
      values
    );
    return res.rows[0];
  }

  async delete(id) {
    await pool.query("DELETE FROM usuarios WHERE id=$1", [id]);
  }

  async findRoles() {
    try {
      const res = await pool.query("SELECT id, nombre FROM roles ORDER BY id ASC");
      if (Array.isArray(res.rows) && res.rows.length > 0) {
        return res.rows;
      }
      return DEFAULT_ROLES;
    } catch {
      return DEFAULT_ROLES;
    }
  }

  async setDebeCambiarPassword(userId, debeCambiarPassword = true) {
    await this.ensureSecurityTable();

    try {
      await pool.query(
        `
          INSERT INTO usuario_seguridad (usuario_id, debe_cambiar_password, actualizado_en)
          VALUES ($1, $2, NOW())
          ON CONFLICT (usuario_id)
          DO UPDATE SET
            debe_cambiar_password = EXCLUDED.debe_cambiar_password,
            actualizado_en = NOW()
        `,
        [userId, Boolean(debeCambiarPassword)]
      );
      return true;
    } catch {
      return false;
    }
  }

  async getDebeCambiarPassword(userId) {
    await this.ensureSecurityTable();

    try {
      const res = await pool.query(
        "SELECT debe_cambiar_password FROM usuario_seguridad WHERE usuario_id=$1",
        [userId]
      );
      return Boolean(res.rows[0]?.debe_cambiar_password);
    } catch {
      return false;
    }
  }

  async getEntidadesByUsuario(userId) {
    await this.ensureUserEntityTable();

    try {
      const res = await pool.query(
        `
          SELECT e.id, e.nombre
          FROM usuario_entidades ue
          INNER JOIN entidades e ON e.id = ue.entidad_id
          WHERE ue.usuario_id = $1
          ORDER BY e.nombre ASC
        `,
        [userId]
      );
      return Array.isArray(res.rows) ? res.rows : [];
    } catch {
      return [];
    }
  }

  async setEntidadesByUsuario(userId, entidadIds = []) {
    await this.ensureUserEntityTable();

    const normalizedIds = Array.from(
      new Set(
        (Array.isArray(entidadIds) ? entidadIds : [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );

    await this.withTransaction(async (client) => {
      await client.query("DELETE FROM usuario_entidades WHERE usuario_id=$1", [userId]);

      for (const entidadId of normalizedIds) {
        await client.query(
          "INSERT INTO usuario_entidades(usuario_id, entidad_id) VALUES($1, $2)",
          [userId, entidadId]
        );
      }
    });

    return this.getEntidadesByUsuario(userId);
  }
}
