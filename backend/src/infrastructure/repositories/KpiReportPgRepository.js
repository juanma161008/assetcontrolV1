import pool from "../database/postgres.js";

export default class KpiReportPgRepository {
  constructor() {
    this.tableReady = false;
  }

  async ensureTable() {
    if (this.tableReady) return;

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reportes_kpi (
          id SERIAL PRIMARY KEY,
          periodo TEXT NOT NULL UNIQUE,
          data JSONB,
          enviado_en TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } finally {
      this.tableReady = true;
    }
  }

  async findByPeriodo(periodo) {
    await this.ensureTable();
    const { rows } = await pool.query(
      "SELECT * FROM reportes_kpi WHERE periodo = $1",
      [periodo]
    );
    return rows[0];
  }

  async create(periodo, data = {}) {
    await this.ensureTable();
    const { rows } = await pool.query(
      `
        INSERT INTO reportes_kpi (periodo, data)
        VALUES ($1, $2)
        ON CONFLICT (periodo)
        DO UPDATE SET data = EXCLUDED.data, enviado_en = NOW()
        RETURNING *
      `,
      [String(periodo), JSON.stringify(data || {})]
    );
    return rows[0];
  }
}

