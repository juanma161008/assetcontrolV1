import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ConfiguracionRespaldoPgRepository from "../../infrastructure/repositories/ConfiguracionRespaldoPgRepository.js";
import OrdenPgRepository from "../../infrastructure/repositories/OrdenPgRepository.js";
import SimplePdfService from "../../infrastructure/pdf/SimplePdfService.js";
import EjecutarRespaldo from "../../application/respaldo/EjecutarRespaldo.js";
import respaldarBaseDatos from "../../application/respaldo/respaldarBaseDatos.js";
import RegistrarLog from "../../application/auditoria/RegistrarLog.js";
import LogPgRepository from "../../infrastructure/repositories/LogPgRepository.js";
import { success, error } from "../../utils/response.js";

const configuracionRepo = new ConfiguracionRespaldoPgRepository();
const ordenRepo = new OrdenPgRepository();
const pdfService = new SimplePdfService(ordenRepo);
const logUseCase = new RegistrarLog(new LogPgRepository());

const PROVEEDORES_VALIDOS = ["local", "onedrive", "googledrive"];

export async function obtenerConfiguracion(req, res) {
  try {
    const config = await configuracionRepo.obtener();
    return success(res, config || {
      carpeta_destino: null,
      proveedor: "local",
      habilitado: false,
      hora: "02:00",
      ultima_ejecucion: null,
      ultimo_ok: null,
      ultimo_resultado: null
    });
  } catch (e) {
    return error(res, e.message || "No se pudo obtener la configuracion de respaldo");
  }
}

export async function guardarConfiguracion(req, res) {
  try {
    const carpetaDestino = String(req.body?.carpeta_destino || "").trim();
    const proveedor = PROVEEDORES_VALIDOS.includes(req.body?.proveedor) ? req.body.proveedor : "local";
    const habilitado = Boolean(req.body?.habilitado);
    const hora = /^\d{2}:\d{2}$/.test(req.body?.hora) ? req.body.hora : "02:00";

    if (habilitado && !carpetaDestino) {
      return error(res, "Debes indicar la carpeta de destino para activar el respaldo diario", 400);
    }

    const config = await configuracionRepo.guardar({
      carpetaDestino,
      proveedor,
      habilitado,
      hora,
      usuarioId: req.user?.id ?? null
    });

    try {
      await logUseCase.execute({
        usuario_id: req.user?.id ?? null,
        accion: "ACTUALIZAR_CONFIGURACION_RESPALDO",
        entidad: "RESPALDO",
        despues: { carpeta_destino: carpetaDestino, proveedor, habilitado, hora }
      });
    } catch {
      // No bloquear la respuesta si falla la auditoria.
    }

    return success(res, config, "Configuracion de respaldo guardada");
  } catch (e) {
    return error(res, e.message || "No se pudo guardar la configuracion de respaldo");
  }
}

export async function ejecutarRespaldoAhora(req, res) {
  try {
    const usecase = new EjecutarRespaldo(configuracionRepo, ordenRepo, pdfService);
    const resultado = await usecase.execute();

    try {
      await logUseCase.execute({
        usuario_id: req.user?.id ?? null,
        accion: "EJECUTAR_RESPALDO",
        entidad: "RESPALDO",
        despues: resultado
      });
    } catch {
      // No bloquear la respuesta si falla la auditoria.
    }

    return success(res, resultado, resultado.ok ? "Respaldo generado correctamente" : "Respaldo generado con errores");
  } catch (e) {
    return error(res, e.message || "No se pudo generar el respaldo", 400);
  }
}

// Genera el respaldo de la base de datos y lo entrega como descarga: no se
// guarda en la carpeta compartida del servidor, sino directo en el equipo de
// quien lo pide, para que cada usuario pueda tener su propia copia.
export async function descargarRespaldo(req, res) {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const nombreArchivo =
    `assetcontrol-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.sql`;
  const archivoTemporal = path.join(os.tmpdir(), `assetcontrol-descarga-${Date.now()}-${process.pid}.sql`);

  try {
    respaldarBaseDatos(archivoTemporal);

    try {
      await logUseCase.execute({
        usuario_id: req.user?.id ?? null,
        accion: "DESCARGAR_RESPALDO",
        entidad: "RESPALDO"
      });
    } catch {
      // No bloquear la descarga si falla la auditoria.
    }

    res.download(archivoTemporal, nombreArchivo, (err) => {
      fs.unlink(archivoTemporal, () => {});
      if (err && !res.headersSent) {
        error(res, "No se pudo descargar el respaldo", 500);
      }
    });
  } catch (e) {
    if (fs.existsSync(archivoTemporal)) {
      try {
        fs.unlinkSync(archivoTemporal);
      } catch {
        // Ignorar errores de limpieza.
      }
    }
    return error(res, e.message || "No se pudo generar el respaldo", 400);
  }
}
