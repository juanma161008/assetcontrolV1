import pool from "../database/postgres.js";

export default class LogPgRepository {

  async create(log) {
    const toJson = (value) => {
      if (value === undefined || value === null) return null;
      if (typeof value === "object") return JSON.stringify(value);
      return value;
    };

    const query = `
      INSERT INTO logs 
      (usuario_id, accion, entidad, entidad_id, antes, despues, ip)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `;

    const result = await pool.query(query, [
      log.usuario_id,
      log.accion,
      log.entidad ?? "SISTEMA",
      log.entidad_id ?? null,
      toJson(log.antes),
      toJson(log.despues),
      log.ip ?? null
    ]);

    return result.rows[0];
  }

  async findAll(filters = {}) {
    const usuario = String(filters.usuario || "").trim().toUpperCase();
    const whereClause = usuario
      ? `
        WHERE (
          UPPER(COALESCE(u.nombre, '')) LIKE $1
          OR UPPER(COALESCE(u.email, '')) LIKE $1
          OR UPPER(COALESCE(l.despues::text, '')) LIKE $1
          OR UPPER(COALESCE(l.antes::text, '')) LIKE $1
          OR UPPER(COALESCE(l.entidad, '')) LIKE $1
          OR CAST(COALESCE(l.usuario_id, 0) AS TEXT) LIKE $1
          OR CAST(COALESCE(l.entidad_id, 0) AS TEXT) LIKE $1
        )
      `
      : "";
    const params = usuario ? [`%${usuario}%`] : [];

    const { rows } = await pool.query(
      `SELECT l.*, u.nombre AS usuario_nombre, u.email AS usuario_email
       FROM logs l
       LEFT JOIN usuarios u ON u.id = l.usuario_id
       ${whereClause}
       ORDER BY l.creado_en DESC
       LIMIT 500`,
      params
    );
    return rows;
  }
}
