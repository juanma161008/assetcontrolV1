import pool from "../database/postgres.js";

const DEFAULT_ROLES = [
  { id: 1, nombre: "Administrador" },
  { id: 2, nombre: "Técnico" },
  { id: 3, nombre: "Usuario" }
];

export default class UsuarioPgRepository {
  constructor() {
    this.securityTableReady = false;
    this.userEntityTableReady = false;
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

  async findByEmail(email) {
    const res = await pool.query(
      "SELECT * FROM usuarios WHERE email=$1",
      [email]
    );
    return res.rows[0];
  }

  async create(data) {
    const res = await pool.query(
      `INSERT INTO usuarios(nombre,email,password,rol_id)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [data.nombre, data.email, data.password, data.rol_id]
    );
    return res.rows[0];
  }

  async findById(id) {
    const res = await pool.query(
      "SELECT * FROM usuarios WHERE id=$1",
      [id]
    );
    return res.rows[0];
  }

  async updatePassword(id, hashedPassword) {
    const res = await pool.query(
      "UPDATE usuarios SET password = $1 WHERE id = $2 RETURNING *",
      [hashedPassword, id]
    );
    return res.rows[0];
  }

  async findAll() {
    const res = await pool.query(
      "SELECT id, nombre, email, rol_id FROM usuarios ORDER BY id DESC"
    );
    return res.rows;
  }

  async update(id, data) {
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

    if (!fields.length) {
      return this.findById(id);
    }

    values.push(id);

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

    await pool.query("BEGIN");
    try {
      await pool.query("DELETE FROM usuario_entidades WHERE usuario_id=$1", [userId]);

      for (const entidadId of normalizedIds) {
        await pool.query(
          "INSERT INTO usuario_entidades(usuario_id, entidad_id) VALUES($1, $2)",
          [userId, entidadId]
        );
      }

      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }

    return this.getEntidadesByUsuario(userId);
  }
}
