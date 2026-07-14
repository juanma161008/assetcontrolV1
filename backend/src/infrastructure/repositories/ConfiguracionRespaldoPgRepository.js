import pool from "../database/postgres.js";

export default class ConfiguracionRespaldoPgRepository {
  constructor() {
    this.tableReady = false;
  }

  async ensureTable() {
    if (this.tableReady) {
      return;
    }

    if (process.env.NODE_ENV === "test") {
      this.tableReady = true;
      return;
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS configuracion_respaldo (
          id INTEGER PRIMARY KEY DEFAULT 1,
          carpeta_destino TEXT NULL,
          proveedor VARCHAR(20) NOT NULL DEFAULT 'local',
          habilitado BOOLEAN NOT NULL DEFAULT false,
          hora VARCHAR(5) NOT NULL DEFAULT '02:00',
          ultima_ejecucion TIMESTAMP NULL,
          ultimo_ok BOOLEAN NULL,
          ultimo_resultado TEXT NULL,
          actualizado_por INTEGER NULL,
          actualizado_en TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT configuracion_respaldo_single_row CHECK (id = 1)
        )
      `);
    } catch {
      // No bloquear si la BD no permite DDL; la tabla debe existir de antemano.
    } finally {
      this.tableReady = true;
    }
  }

  async obtener() {
    await this.ensureTable();
    try {
      const res = await pool.query("SELECT * FROM configuracion_respaldo WHERE id=1");
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }

  async guardar({ carpetaDestino, proveedor, habilitado, hora, usuarioId }) {
    await this.ensureTable();
    const res = await pool.query(
      `INSERT INTO configuracion_respaldo (id, carpeta_destino, proveedor, habilitado, hora, actualizado_por, actualizado_en)
       VALUES (1, $1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
         carpeta_destino = EXCLUDED.carpeta_destino,
         proveedor = EXCLUDED.proveedor,
         habilitado = EXCLUDED.habilitado,
         hora = EXCLUDED.hora,
         actualizado_por = EXCLUDED.actualizado_por,
         actualizado_en = NOW()
       RETURNING *`,
      [carpetaDestino || null, proveedor || "local", Boolean(habilitado), hora || "02:00", usuarioId || null]
    );
    return res.rows[0];
  }

  async registrarResultado({ ok, resultado }) {
    await this.ensureTable();
    try {
      await pool.query(
        `UPDATE configuracion_respaldo
         SET ultima_ejecucion = NOW(), ultimo_ok = $1, ultimo_resultado = $2
         WHERE id = 1`,
        [Boolean(ok), String(resultado || "").slice(0, 2000)]
      );
    } catch {
      // No bloquear el respaldo si falla el registro del resultado.
    }
  }
}
