import pool from "../database/postgres.js";

const DEFAULT_PERMISSIONS = [
  "ADMIN_TOTAL",
  "CREAR_USUARIO",
  "VER_ACTIVOS",
  "CREAR_ACTIVO",
  "EDITAR_ACTIVO",
  "ELIMINAR_ACTIVO",
  "CREAR_MANTENIMIENTO",
  "EDITAR_MANTENIMIENTO",
  "ELIMINAR_MANTENIMIENTO",
  "GENERAR_ORDEN",
  "FIRMAR_ORDEN",
  "FIRMAR_ORDEN_INTERVENTOR"
];

const INTERVENTOR_PERMISSION_NAME = "FIRMAR_ORDEN_INTERVENTOR";
const INTERVENTOR_ROLE_NAME = "Interventor";

export default class PermisoPgRepository {
  constructor() {
    this.userPermissionsTableReady = false;
    this.interventorPermissionReady = false;
  }

  async ensureInterventorPermission() {
    if (this.interventorPermissionReady) {
      return;
    }

    if (process.env.NODE_ENV === "test") {
      this.interventorPermissionReady = true;
      return;
    }

    try {
      await pool.query(
        `INSERT INTO permisos (nombre)
         SELECT $1
         WHERE NOT EXISTS (SELECT 1 FROM permisos WHERE nombre = $1)`,
        [INTERVENTOR_PERMISSION_NAME]
      );

      await pool.query(
        `INSERT INTO rol_permisos (rol_id, permiso_id)
         SELECT r.id, p.id
         FROM roles r, permisos p
         WHERE r.nombre ILIKE $1 AND p.nombre = $2
           AND NOT EXISTS (
             SELECT 1 FROM rol_permisos rp WHERE rp.rol_id = r.id AND rp.permiso_id = p.id
           )`,
        [INTERVENTOR_ROLE_NAME, INTERVENTOR_PERMISSION_NAME]
      );
    } catch {
      // Las tablas de roles/permisos pueden no existir aun o la BD no permitir el insert.
    } finally {
      this.interventorPermissionReady = true;
    }
  }

  async ensureUserPermissionsTable() {
    if (this.userPermissionsTableReady) {
      return;
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS usuario_permisos (
          usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
          permisos TEXT[] NOT NULL DEFAULT '{}',
          actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } finally {
      // Evita reintentos de DDL constantes si la BD no los permite.
      this.userPermissionsTableReady = true;
    }
  }

  async getPermisosByRol(rolId) {
    await this.ensureInterventorPermission();

    const res = await pool.query(
      `SELECT p.nombre FROM permisos p
       JOIN rol_permisos rp ON rp.permiso_id=p.id
       WHERE rp.rol_id=$1`,
      [rolId]
    );

    // Si no hay permisos asignados al rol, retornar permisos por defecto
    if (!res.rows || res.rows.length === 0) {
      return DEFAULT_PERMISSIONS;
    }

    return res.rows.map(r => r.nombre);
  }

  async getPermisosCatalogo() {
    await this.ensureInterventorPermission();

    try {
      const res = await pool.query(
        "SELECT nombre FROM permisos ORDER BY nombre ASC"
      );
      if (Array.isArray(res.rows) && res.rows.length) {
        return res.rows.map((row) => row.nombre);
      }
      return DEFAULT_PERMISSIONS;
    } catch {
      return DEFAULT_PERMISSIONS;
    }
  }

  async getPermisosByUsuario(usuarioId) {
    await this.ensureUserPermissionsTable();

    try {
      const res = await pool.query(
        "SELECT permisos FROM usuario_permisos WHERE usuario_id=$1",
        [usuarioId]
      );

      if (!res.rows.length) {
        return null;
      }

      const permisos = res.rows[0]?.permisos;
      return Array.isArray(permisos) ? permisos : [];
    } catch {
      return null;
    }
  }

  async setPermisosByUsuario(usuarioId, permisos = []) {
    await this.ensureUserPermissionsTable();

    const permisosNormalizados = Array.from(
      new Set(
        (Array.isArray(permisos) ? permisos : [])
          .map((permiso) => String(permiso || "").trim().toUpperCase())
          .filter(Boolean)
      )
    );

    await pool.query(
      `
        INSERT INTO usuario_permisos (usuario_id, permisos, actualizado_en)
        VALUES ($1, $2, NOW())
        ON CONFLICT (usuario_id)
        DO UPDATE SET
          permisos = EXCLUDED.permisos,
          actualizado_en = NOW()
      `,
      [usuarioId, permisosNormalizados]
    );

    return permisosNormalizados;
  }

  async clearPermisosByUsuario(usuarioId) {
    await this.ensureUserPermissionsTable();
    await pool.query("DELETE FROM usuario_permisos WHERE usuario_id=$1", [usuarioId]);
    return [];
  }
}
