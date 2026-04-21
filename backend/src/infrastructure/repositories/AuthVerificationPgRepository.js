import pool from "../database/postgres.js";

export default class AuthVerificationPgRepository {
  constructor() {
    this.tableReady = false;
  }

  async ensureTable() {
    if (this.tableReady) {
      return;
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_verificaciones (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          tipo TEXT NOT NULL,
          codigo_hash TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          usado_en TIMESTAMP NULL,
          creado_en TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_auth_verificaciones_email_tipo
        ON auth_verificaciones (email, tipo, creado_en DESC)
      `);
    } finally {
      this.tableReady = true;
    }
  }

  async create({ email, tipo, codeHash, expiresAt }) {
    await this.ensureTable();

    const res = await pool.query(
      `
        INSERT INTO auth_verificaciones (email, tipo, codigo_hash, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [email, tipo, codeHash, expiresAt]
    );

    return res.rows[0];
  }

  async findLatestActive(email, tipo) {
    await this.ensureTable();

    const res = await pool.query(
      `
        SELECT *
        FROM auth_verificaciones
        WHERE email = $1
          AND tipo = $2
          AND usado_en IS NULL
          AND expires_at > NOW()
        ORDER BY creado_en DESC
        LIMIT 1
      `,
      [email, tipo]
    );

    return res.rows[0];
  }

  async markUsed(id) {
    await this.ensureTable();
    await pool.query(
      "UPDATE auth_verificaciones SET usado_en = NOW() WHERE id = $1",
      [id]
    );
    return true;
  }
}
