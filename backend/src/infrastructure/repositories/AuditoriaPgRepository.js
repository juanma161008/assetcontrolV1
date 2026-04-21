import pool from '../database/postgres.js';

export default class AuditoriaPgRepository {
  async getAll() {
    const query = `
      SELECT id, usuario_id, accion, tabla_afectada, registro_id, fecha, detalles
      FROM auditoria
      ORDER BY fecha DESC
      LIMIT 100
    `;
    const result = await pool.query(query);
    return result.rows;
  }
}