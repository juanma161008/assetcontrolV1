import pool from "../database/postgres.js";

export default class RecordatorioMantenimientoPgRepository {
  constructor() {
    this.tableReady = false;
  }

  async ensureTable() {
    if (this.tableReady) return;

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS mantenimiento_recordatorios (
          id SERIAL PRIMARY KEY,
          mantenimiento_id INTEGER NOT NULL REFERENCES mantenimientos(id) ON DELETE CASCADE,
          usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          tipo TEXT NOT NULL,
          enviado_en TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (mantenimiento_id, usuario_id, tipo)
        )
      `);
    } finally {
      this.tableReady = true;
    }
  }

  async register({ mantenimiento_id, usuario_id, tipo }) {
    await this.ensureTable();
    const { rows } = await pool.query(
      `
        INSERT INTO mantenimiento_recordatorios (mantenimiento_id, usuario_id, tipo)
        VALUES ($1, $2, $3)
        ON CONFLICT (mantenimiento_id, usuario_id, tipo)
        DO NOTHING
        RETURNING *
      `,
      [mantenimiento_id, usuario_id, String(tipo || "AUTO").toUpperCase()]
    );
    return rows[0] || null;
  }
}

