import ConfiguracionRespaldoPgRepository from "../../infrastructure/repositories/ConfiguracionRespaldoPgRepository.js";
import OrdenPgRepository from "../../infrastructure/repositories/OrdenPgRepository.js";
import SimplePdfService from "../../infrastructure/pdf/SimplePdfService.js";
import EjecutarRespaldo from "../../application/respaldo/EjecutarRespaldo.js";
import RegistrarLog from "../../application/auditoria/RegistrarLog.js";
import LogPgRepository from "../../infrastructure/repositories/LogPgRepository.js";
import { success, error } from "../../utils/response.js";

const configuracionRepo = new ConfiguracionRespaldoPgRepository();
const ordenRepo = new OrdenPgRepository();
const pdfService = new SimplePdfService();
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
