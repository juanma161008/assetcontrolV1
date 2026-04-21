import pool from "../database/postgres.js";

function normalizeJsonPayload(value) {
  if (value === null || value === undefined) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  if (typeof value === "object") {
    return value;
  }

  return {};
}

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function hasNumeroReporteField(data) {
  return (
    hasOwn(data, "numeroReporte") ||
    hasOwn(data, "numero_reporte") ||
    hasOwn(data, "numeroreporte")
  );
}

export default class ActivoPgRepository {
  constructor() {
    this.hasActivoColumnCache = null;
    this.hasLifecycleColumnsCache = null;
  }

  async hasActivoColumn() {
    if (this.hasActivoColumnCache !== null) {
      return this.hasActivoColumnCache;
    }

    if (process.env.NODE_ENV === "test") {
      this.hasActivoColumnCache = true;
      return true;
    }

    try {
      const existsRes = await pool.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'activos'
           AND column_name = 'activo'
         LIMIT 1`
      );

      if (Array.isArray(existsRes.rows) && existsRes.rows.length > 0) {
        this.hasActivoColumnCache = true;
        return true;
      }

      await pool.query("ALTER TABLE activos ADD COLUMN IF NOT EXISTS activo TEXT");
      this.hasActivoColumnCache = true;
      return true;
    } catch {
      this.hasActivoColumnCache = false;
      return false;
    }
  }

  async ensureLifecycleColumns() {
    if (this.hasLifecycleColumnsCache !== null) {
      return this.hasLifecycleColumnsCache;
    }

    if (process.env.NODE_ENV === "test") {
      this.hasLifecycleColumnsCache = true;
      return true;
    }

    try {
      await pool.query(`
        ALTER TABLE activos
          ADD COLUMN IF NOT EXISTS ciclo_vida_etapa TEXT,
          ADD COLUMN IF NOT EXISTS fecha_adquisicion DATE,
          ADD COLUMN IF NOT EXISTS vida_util_anios INTEGER,
          ADD COLUMN IF NOT EXISTS categoria_activo TEXT,
          ADD COLUMN IF NOT EXISTS tipoRam TEXT,
          ADD COLUMN IF NOT EXISTS criticidad TEXT,
          ADD COLUMN IF NOT EXISTS iso55000_reglas JSONB,
          ADD COLUMN IF NOT EXISTS campos_especificos JSONB
      `);

      this.hasLifecycleColumnsCache = true;
      return true;
    } catch {
      this.hasLifecycleColumnsCache = false;
      return false;
    }
  }

  mapRow(row) {
    if (!row || typeof row !== "object") {
      return row;
    }

    const mapped = { ...row };

    if ("numeroreporte" in row || "numeroReporte" in row) {
      mapped.numeroReporte = row.numeroReporte ?? row.numeroreporte ?? "";
    }

    if ("areaprincipal" in row || "areaPrincipal" in row) {
      mapped.areaPrincipal = row.areaPrincipal ?? row.areaprincipal ?? "";
    }

    if ("areasecundaria" in row || "areaSecundaria" in row) {
      mapped.areaSecundaria = row.areaSecundaria ?? row.areasecundaria ?? "";
    }

    if ("tiporam" in row || "tipoRam" in row) {
      mapped.tipoRam = row.tipoRam ?? row.tiporam ?? "";
    }

    if ("categoria_activo" in row || "categoriaActivo" in row) {
      mapped.categoria_activo = row.categoria_activo ?? row.categoriaActivo ?? "";
    }

    if ("tipodisco" in row || "tipoDisco" in row) {
      mapped.tipoDisco = row.tipoDisco ?? row.tipodisco ?? "";
    }

    if ("nombre" in row || "activo" in row) {
      const numeroReporte = row.numeroReporte ?? row.numeroreporte ?? "";
      const activoCodigo = String(row.activo ?? "").trim();
      mapped.activo = activoCodigo || row.nombre || numeroReporte || "";
      mapped.nombre = row.nombre ?? "";
      mapped.responsable = row.nombre ?? "";
    }

    if ("ciclo_vida_etapa" in row) {
      mapped.ciclo_vida_etapa = row.ciclo_vida_etapa ?? "";
    }

    if ("fecha_adquisicion" in row) {
      mapped.fecha_adquisicion = row.fecha_adquisicion ?? null;
    }

    if ("vida_util_anios" in row) {
      mapped.vida_util_anios = row.vida_util_anios ?? null;
    }

    if ("criticidad" in row) {
      mapped.criticidad = row.criticidad ?? "";
    }

    if ("iso55000_reglas" in row) {
      mapped.iso55000_reglas = normalizeJsonPayload(row.iso55000_reglas);
    }

    if ("campos_especificos" in row || "camposEspecificos" in row) {
      mapped.campos_especificos = normalizeJsonPayload(
        row.campos_especificos ?? row.camposEspecificos
      );
    }

    return mapped;
  }

  async findAll() {
    const res = await pool.query("SELECT * FROM activos ORDER BY id DESC");
    return res.rows.map((row) => this.mapRow(row));
  }

  async findById(id) {
    const res = await pool.query(
      "SELECT * FROM activos WHERE id=$1",
      [id]
    );
    return this.mapRow(res.rows[0]);
  }

  async create(data) {
    const withActivoColumn = await this.hasActivoColumn();
    const withLifecycleColumns = await this.ensureLifecycleColumns();
    const numeroReportePayload = hasNumeroReporteField(data)
      ? normalizeNullableText(data.numeroReporte ?? data.numero_reporte ?? data.numeroreporte)
      : normalizeNullableText(data.activo ?? data.nombre ?? "");

    if (!withActivoColumn) {
      const resFallback = await pool.query(
        `INSERT INTO activos
        (sede,numeroReporte,nombre,serial,areaPrincipal,areaSecundaria,
         equipo,marca,modelo,procesador,ram,tipoDisco,hdd,os,estado,entidad_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *`,
        [
          data.sede,
          numeroReportePayload,
          data.activo ?? data.nombre ?? "",
          data.serial,
          data.areaPrincipal,
          data.areaSecundaria,
          data.equipo,
          data.marca,
          data.modelo,
          data.procesador,
          data.ram,
          data.tipoDisco,
          data.hdd,
          data.os,
          data.estado,
          data.entidad_id
        ]
      );

      return this.mapRow(resFallback.rows[0]);
    }

    if (!withLifecycleColumns) {
      const res = await pool.query(
        `INSERT INTO activos
        (sede,numeroReporte,activo,nombre,serial,areaPrincipal,areaSecundaria,
         equipo,marca,modelo,procesador,ram,tipoDisco,hdd,os,estado,entidad_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *`,
        [
          data.sede,
          numeroReportePayload,
          data.activo ?? data.nombre ?? "",
          data.nombre ?? "",
          data.serial,
          data.areaPrincipal,
          data.areaSecundaria,
          data.equipo,
          data.marca,
          data.modelo,
          data.procesador,
          data.ram,
          data.tipoDisco,
          data.hdd,
          data.os,
          data.estado,
          data.entidad_id
        ]
      );

      return this.mapRow(res.rows[0]);
    }

    const res = await pool.query(
      `INSERT INTO activos
       (sede,numeroReporte,activo,nombre,serial,areaPrincipal,areaSecundaria,
        equipo,marca,modelo,procesador,tipoRam,ram,tipoDisco,hdd,os,estado,entidad_id,
        categoria_activo,ciclo_vida_etapa,fecha_adquisicion,vida_util_anios,criticidad,iso55000_reglas,campos_especificos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       RETURNING *`,
      [
        data.sede,
        numeroReportePayload,
        data.activo ?? data.nombre ?? "",
        data.nombre ?? "",
        data.serial,
        data.areaPrincipal,
        data.areaSecundaria,
        data.equipo,
        data.marca,
        data.modelo,
        data.procesador,
        data.tipoRam,
        data.ram,
        data.tipoDisco,
        data.hdd,
        data.os,
        data.estado,
        data.entidad_id,
        data.categoria_activo ?? data.categoriaActivo ?? null,
        data.ciclo_vida_etapa ?? null,
        data.fecha_adquisicion ?? null,
        data.vida_util_anios ?? null,
        data.criticidad ?? null,
        JSON.stringify(normalizeJsonPayload(data.iso55000_reglas)),
        JSON.stringify(normalizeJsonPayload(data.campos_especificos ?? data.camposEspecificos ?? {}))
      ]
    );

    return this.mapRow(res.rows[0]);
  }

  async update(id, data) {
    const withActivoColumn = await this.hasActivoColumn();
    const withLifecycleColumns = await this.ensureLifecycleColumns();
    const numeroReportePayload = hasNumeroReporteField(data)
      ? normalizeNullableText(data.numeroReporte ?? data.numero_reporte ?? data.numeroreporte)
      : normalizeNullableText(data.activo ?? data.nombre ?? null);

    if (!withActivoColumn) {
      const resFallback = await pool.query(
        `UPDATE activos SET
         sede=COALESCE($1, sede),
         numeroReporte=COALESCE($2, numeroReporte),
         nombre=COALESCE($3, nombre),
         serial=COALESCE($4, serial),
         areaPrincipal=COALESCE($5, areaPrincipal),
         areaSecundaria=COALESCE($6, areaSecundaria),
         equipo=COALESCE($7, equipo),
         marca=COALESCE($8, marca),
         modelo=COALESCE($9, modelo),
         procesador=COALESCE($10, procesador),
         ram=COALESCE($11, ram),
         tipoDisco=COALESCE($12, tipoDisco),
         hdd=COALESCE($13, hdd),
         os=COALESCE($14, os),
         estado=COALESCE($15, estado),
         entidad_id=COALESCE($16, entidad_id)
         WHERE id=$17 RETURNING *`,
        [
          data.sede ?? null,
          numeroReportePayload,
          data.activo ?? data.nombre ?? null,
          data.serial ?? null,
          data.areaPrincipal ?? null,
          data.areaSecundaria ?? null,
          data.equipo ?? null,
          data.marca ?? null,
          data.modelo ?? null,
          data.procesador ?? null,
          data.ram ?? null,
          data.tipoDisco ?? null,
          data.hdd ?? null,
          data.os ?? null,
          data.estado ?? null,
          data.entidad_id ?? null,
          id
        ]
      );

      return this.mapRow(resFallback.rows[0]);
    }

    let res;
    if (!withLifecycleColumns) {
      res = await pool.query(
        `UPDATE activos SET
         sede=COALESCE($1, sede),
         numeroReporte=COALESCE($2, numeroReporte),
         activo=COALESCE($3, activo),
         nombre=COALESCE($4, nombre),
         serial=COALESCE($5, serial),
         areaPrincipal=COALESCE($6, areaPrincipal),
         areaSecundaria=COALESCE($7, areaSecundaria),
         equipo=COALESCE($8, equipo),
         marca=COALESCE($9, marca),
         modelo=COALESCE($10, modelo),
         procesador=COALESCE($11, procesador),
         ram=COALESCE($12, ram),
         tipoDisco=COALESCE($13, tipoDisco),
         hdd=COALESCE($14, hdd),
         os=COALESCE($15, os),
         estado=COALESCE($16, estado),
         entidad_id=COALESCE($17, entidad_id)
         WHERE id=$18 RETURNING *`,
        [
          data.sede ?? null,
          numeroReportePayload,
          data.activo ?? null,
          data.nombre ?? null,
          data.serial ?? null,
          data.areaPrincipal ?? null,
          data.areaSecundaria ?? null,
          data.equipo ?? null,
          data.marca ?? null,
          data.modelo ?? null,
          data.procesador ?? null,
          data.ram ?? null,
          data.tipoDisco ?? null,
          data.hdd ?? null,
          data.os ?? null,
          data.estado ?? null,
          data.entidad_id ?? null,
          id
        ]
      );
    } else {
      res = await pool.query(
        `UPDATE activos SET
         sede=COALESCE($1, sede),
         numeroReporte=COALESCE($2, numeroReporte),
         activo=COALESCE($3, activo),
         nombre=COALESCE($4, nombre),
         serial=COALESCE($5, serial),
         areaPrincipal=COALESCE($6, areaPrincipal),
         areaSecundaria=COALESCE($7, areaSecundaria),
         equipo=COALESCE($8, equipo),
         marca=COALESCE($9, marca),
         modelo=COALESCE($10, modelo),
         procesador=COALESCE($11, procesador),
         tipoRam=COALESCE($12, tipoRam),
         ram=COALESCE($13, ram),
         tipoDisco=COALESCE($14, tipoDisco),
         hdd=COALESCE($15, hdd),
         os=COALESCE($16, os),
         estado=COALESCE($17, estado),
         entidad_id=COALESCE($18, entidad_id),
         categoria_activo=COALESCE($19, categoria_activo),
         ciclo_vida_etapa=COALESCE($20, ciclo_vida_etapa),
         fecha_adquisicion=COALESCE($21, fecha_adquisicion),
         vida_util_anios=COALESCE($22, vida_util_anios),
         criticidad=COALESCE($23, criticidad),
         iso55000_reglas=COALESCE($24, iso55000_reglas),
         campos_especificos=COALESCE($25, campos_especificos)
         WHERE id=$26 RETURNING *`,
        [
          data.sede ?? null,
          numeroReportePayload,
          data.activo ?? null,
          data.nombre ?? null,
          data.serial ?? null,
          data.areaPrincipal ?? null,
          data.areaSecundaria ?? null,
          data.equipo ?? null,
          data.marca ?? null,
          data.modelo ?? null,
          data.procesador ?? null,
          data.tipoRam ?? null,
          data.ram ?? null,
          data.tipoDisco ?? null,
          data.hdd ?? null,
          data.os ?? null,
          data.estado ?? null,
          data.entidad_id ?? null,
          data.categoria_activo ?? data.categoriaActivo ?? null,
          data.ciclo_vida_etapa ?? null,
          data.fecha_adquisicion ?? null,
          data.vida_util_anios ?? null,
          data.criticidad ?? null,
          data.iso55000_reglas === undefined ? null : JSON.stringify(normalizeJsonPayload(data.iso55000_reglas)),
          data.campos_especificos === undefined && data.camposEspecificos === undefined
            ? null
            : JSON.stringify(normalizeJsonPayload(data.campos_especificos ?? data.camposEspecificos)),
          id
        ]
      );
    }

    return this.mapRow(res.rows[0]);
  }

  async delete(id) {
    await pool.query("DELETE FROM activos WHERE id=$1", [id]);
  }
}
