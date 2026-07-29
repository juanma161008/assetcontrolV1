import fs from "node:fs";
import path from "node:path";
import respaldarBaseDatos from "./respaldarBaseDatos.js";

const pad = (value) => String(value).padStart(2, "0");

const timestamp = () => {
  const now = new Date();
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  );
};

const sanitizeFileName = (value) => String(value || "").replace(/[^a-zA-Z0-9-_]/g, "-");

// Respaldo diario: vuelca la base de datos completa (incluye las firmas guardadas como
// base64) y ademas guarda un PDF por cada orden ya aprobada (con las dos firmas), para
// minimizar el riesgo de perder informacion aunque falle la base de datos.
export default class EjecutarRespaldo {
  constructor(configuracionRepo, ordenRepo, pdfService) {
    this.configuracionRepo = configuracionRepo;
    this.ordenRepo = ordenRepo;
    this.pdfService = pdfService;
  }

  async execute() {
    const config = await this.configuracionRepo.obtener();
    const carpetaBase = String(config?.carpeta_destino || "").trim();

    if (!carpetaBase) {
      const mensaje = "No hay una carpeta de destino configurada para el respaldo.";
      await this.configuracionRepo.registrarResultado({ ok: false, resultado: mensaje });
      throw new Error(mensaje);
    }

    const carpetaRespaldo = path.join(carpetaBase, `assetcontrol-backup-${timestamp()}`);
    fs.mkdirSync(carpetaRespaldo, { recursive: true });

    const errores = [];
    let baseDeDatosOk = false;
    let documentosGuardados = 0;

    try {
      await this.respaldarBaseDatos(carpetaRespaldo);
      baseDeDatosOk = true;
    } catch (err) {
      errores.push(`Base de datos: ${err.message}`);
    }

    try {
      documentosGuardados = await this.respaldarDocumentosAprobados(carpetaRespaldo);
    } catch (err) {
      errores.push(`Documentos: ${err.message}`);
    }

    const ok = baseDeDatosOk && errores.length === 0;
    const resultado = ok
      ? `Respaldo correcto: base de datos + ${documentosGuardados} documento(s) firmado(s) en ${carpetaRespaldo}`
      : `Respaldo con errores (${errores.join(" | ")}). Carpeta: ${carpetaRespaldo}`;

    await this.configuracionRepo.registrarResultado({ ok, resultado });

    return { ok, carpeta: carpetaRespaldo, baseDeDatosOk, documentosGuardados, errores };
  }

  async respaldarBaseDatos(carpetaRespaldo) {
    const archivo = path.join(carpetaRespaldo, "base-de-datos.sql");
    respaldarBaseDatos(archivo);
  }

  async respaldarDocumentosAprobados(carpetaRespaldo) {
    const documentosDir = path.join(carpetaRespaldo, "documentos-firmados");

    const ordenes = await this.ordenRepo.findAll();
    const aprobadas = (Array.isArray(ordenes) ? ordenes : []).filter(
      (orden) => orden?.estado === "Aprobada"
    );

    if (!aprobadas.length) {
      return 0;
    }

    fs.mkdirSync(documentosDir, { recursive: true });

    let guardados = 0;
    for (const orden of aprobadas) {
      try {
        const ordenCompleta = await this.ordenRepo.findById(orden.id);
        const pdfBuffer = await this.pdfService.generar(ordenCompleta);
        const nombre = sanitizeFileName(orden.numero || orden.id);
        fs.writeFileSync(path.join(documentosDir, `Orden-${nombre}.pdf`), pdfBuffer);
        guardados += 1;
      } catch {
        // Se omite ese documento puntual sin interrumpir el resto del respaldo.
      }
    }

    return guardados;
  }
}
