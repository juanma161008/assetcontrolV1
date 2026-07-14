import pool from "../database/postgres.js";

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : value;
const normalizeTextForLookup = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : value;
const DEFAULT_ENTITY_COLUMNS = ["nombre", "nit", "tipo", "direccion"];
const AREA_TIPO_PRIMARIA = "PRIMARIA";
const AREA_TIPO_SECUNDARIA = "SECUNDARIA";
const EMPTY_AREAS = { areas_primarias: [], areas_secundarias: [] };

export default class EntidadPgRepository {
  constructor() {
    this.columnsCache = null;
    this.entityAreasReady = false;
    this.tiposEquiposColumnReady = false;
  }

  async ensureTiposEquiposColumn() {
    if (this.tiposEquiposColumnReady) {
      return;
    }

    if (process.env.NODE_ENV === "test") {
      this.tiposEquiposColumnReady = true;
      return;
    }

    try {
      await pool.query(
        `ALTER TABLE entidades
         ADD COLUMN IF NOT EXISTS tipos_equipos_permitidos JSONB DEFAULT '[]'::jsonb`
      );
      this.tiposEquiposColumnReady = true;
    } catch {
      this.tiposEquiposColumnReady = false;
    }
  }

  async getEntidadesColumns() {
    if (this.columnsCache) {
      return this.columnsCache;
    }

    if (process.env.NODE_ENV === "test") {
      this.columnsCache = DEFAULT_ENTITY_COLUMNS;
      return this.columnsCache;
    }

    try {
      const { rows } = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name='entidades'`
      );

      const columns = rows
        .map((row) => row.column_name)
        .filter(Boolean);

      this.columnsCache = columns.length ? columns : DEFAULT_ENTITY_COLUMNS;
    } catch {
      this.columnsCache = DEFAULT_ENTITY_COLUMNS;
    }

    return this.columnsCache;
  }

  normalizePayload(data = {}) {
    const tipos = data.tipos_equipos_permitidos;
    const tiposNormalizados = Array.isArray(tipos)
      ? [...new Set(tipos.map(t => String(t || "").trim()).filter(Boolean))]
      : [];

    return {
      nombre: normalizeText(data.nombre),
      nit: normalizeText(data.nit),
      tipo: normalizeText(data.tipo),
      direccion: normalizeText(data.direccion),
      tipos_equipos_permitidos: tiposNormalizados
    };
  }

  async findAll() {
    const { rows } = await pool.query(
      "SELECT * FROM entidades ORDER BY id DESC"
    );
    return Array.isArray(rows) ? rows.map(row => this.normalizeRow(row)) : rows;
  }

  async findById(id) {
    const { rows } = await pool.query(
      "SELECT * FROM entidades WHERE id=$1",
      [id]
    );
    return rows[0] ? this.normalizeRow(rows[0]) : rows[0];
  }

  async findByNombreNormalized(nombre) {
    const nombreNormalizado = normalizeTextForLookup(nombre);
    const { rows } = await pool.query(
      "SELECT * FROM entidades WHERE UPPER(TRIM(nombre)) = $1 LIMIT 1",
      [nombreNormalizado]
    );
    return rows[0] ? this.normalizeRow(rows[0]) : rows[0];
  }

  async create(data) {
    await this.ensureTiposEquiposColumn();
    const payload = this.normalizePayload(data);

    const availableColumns = await this.getEntidadesColumns();
    const columnsToUse = [...DEFAULT_ENTITY_COLUMNS, "tipos_equipos_permitidos"]
      .filter((column) => availableColumns.includes(column));

    if (!columnsToUse.includes("nombre") || !columnsToUse.includes("tipo")) {
      throw new Error("La tabla entidades no tiene las columnas requeridas");
    }

    const values = columnsToUse.map((column) => {
      if (column === "tipos_equipos_permitidos") {
        return JSON.stringify(payload[column]);
      }
      return payload[column];
    });
    const placeholders = columnsToUse.map((_, idx) => `$${idx + 1}`).join(",");

    const { rows } = await pool.query(
      `INSERT INTO entidades 
       (${columnsToUse.join(", ")})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );

    return rows[0] ? this.normalizeRow(rows[0]) : rows[0];
  }

  async update(id, data = {}) {
    await this.ensureTiposEquiposColumn();
    const payload = this.normalizePayload(data);
    const availableColumns = await this.getEntidadesColumns();
    const allowedColumns = [...DEFAULT_ENTITY_COLUMNS, "tipos_equipos_permitidos"]
      .filter((column) => availableColumns.includes(column));
    const fields = [];
    const values = [];

    for (const column of allowedColumns) {
      if (payload[column] === undefined) continue;
      const valueToAdd = column === "tipos_equipos_permitidos" 
        ? JSON.stringify(payload[column])
        : payload[column];
      fields.push(`${column}=$${values.length + 1}`);
      values.push(valueToAdd);
    }

    if (!fields.length) {
      return this.findById(id);
    }

    values.push(id);

    const { rows } = await pool.query(
      `UPDATE entidades SET ${fields.join(", ")} WHERE id=$${values.length} RETURNING *`,
      values
    );

    return rows[0] ? this.normalizeRow(rows[0]) : rows[0];
  }

  async delete(id) {
    await pool.query("DELETE FROM entidades WHERE id=$1", [id]);
  }

  normalizeAreaList(values = []) {
    if (!Array.isArray(values)) return [];
    const unique = new Set();
    values.forEach((item) => {
      const normalized = normalizeTextForLookup(item);
      if (typeof normalized === "string" && normalized) {
        unique.add(normalized);
      }
    });
    return [...unique];
  }

  normalizeRow(row) {
    if (!row || typeof row !== "object") {
      return row;
    }

    const normalized = { ...row };
    
    // Normalizar tipos_equipos_permitidos que viene como JSONB de PostgreSQL
    if ("tipos_equipos_permitidos" in normalized) {
      const tipos = normalized.tipos_equipos_permitidos;
      if (typeof tipos === "string") {
        try {
          normalized.tipos_equipos_permitidos = JSON.parse(tipos);
        } catch {
          normalized.tipos_equipos_permitidos = [];
        }
      } else if (Array.isArray(tipos)) {
        normalized.tipos_equipos_permitidos = tipos;
      } else if (tipos === null || tipos === undefined) {
        normalized.tipos_equipos_permitidos = [];
      } else {
        normalized.tipos_equipos_permitidos = [];
      }
    }

    return normalized;
  }

  async ensureEntityAreasTable() {
    if (this.entityAreasReady) {
      return;
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS entidad_areas (
        id SERIAL PRIMARY KEY,
        entidad_id INTEGER NOT NULL REFERENCES entidades(id) ON DELETE CASCADE,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('${AREA_TIPO_PRIMARIA}', '${AREA_TIPO_SECUNDARIA}')),
        nombre VARCHAR(120) NOT NULL,
        creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        UNIQUE(entidad_id, tipo, nombre)
      )
    `);

    this.entityAreasReady = true;
  }

  async getAreasByEntidad(entidadId) {
    const normalizedId = Number(entidadId);
    if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
      return EMPTY_AREAS;
    }

    try {
      await this.ensureEntityAreasTable();
      const { rows } = await pool.query(
        `SELECT tipo, nombre
         FROM entidad_areas
         WHERE entidad_id = $1
         ORDER BY tipo, nombre`,
        [normalizedId]
      );

      const areasPrimarias = [];
      const areasSecundarias = [];
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const nombre = String(row?.nombre || "").trim();
        if (!nombre) return;
        if (row?.tipo === AREA_TIPO_PRIMARIA) {
          areasPrimarias.push(nombre);
        } else if (row?.tipo === AREA_TIPO_SECUNDARIA) {
          areasSecundarias.push(nombre);
        }
      });

      return {
        areas_primarias: areasPrimarias,
        areas_secundarias: areasSecundarias
      };
    } catch {
      return EMPTY_AREAS;
    }
  }

  async setAreasByEntidad(entidadId, payload = {}) {
    const normalizedId = Number(entidadId);
    if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
      return EMPTY_AREAS;
    }

    const primarias = this.normalizeAreaList(payload.areas_primarias);
    const secundarias = this.normalizeAreaList(payload.areas_secundarias);

    await this.ensureEntityAreasTable();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM entidad_areas WHERE entidad_id = $1", [normalizedId]);

      for (const nombre of primarias) {
        await client.query(
          "INSERT INTO entidad_areas (entidad_id, tipo, nombre) VALUES ($1, $2, $3)",
          [normalizedId, AREA_TIPO_PRIMARIA, nombre]
        );
      }

      for (const nombre of secundarias) {
        await client.query(
          "INSERT INTO entidad_areas (entidad_id, tipo, nombre) VALUES ($1, $2, $3)",
          [normalizedId, AREA_TIPO_SECUNDARIA, nombre]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return {
      areas_primarias: primarias,
      areas_secundarias: secundarias
    };
  }
}
