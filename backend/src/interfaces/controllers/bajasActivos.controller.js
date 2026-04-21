import ActivoPgRepository from "../../infrastructure/repositories/ActivoPgRepository.js";
import BajaActivoPgRepository from "../../infrastructure/repositories/BajaActivoPgRepository.js";
import UsuarioPgRepository from "../../infrastructure/repositories/UsuarioPgRepository.js";
import NotificacionPgRepository from "../../infrastructure/repositories/NotificacionPgRepository.js";
import CrearNotificacion from "../../application/notificaciones/CrearNotificacion.js";
import LogPgRepository from "../../infrastructure/repositories/LogPgRepository.js";
import RegistrarLog from "../../application/auditoria/RegistrarLog.js";
import { normalizeAdjuntos, getAdjuntosMeta } from "../../utils/adjuntos.js";
import { success, error } from "../../utils/response.js";

const activoRepo = new ActivoPgRepository();
const bajaRepo = new BajaActivoPgRepository();
const userRepo = new UsuarioPgRepository();
const notificacionRepo = new NotificacionPgRepository();
const crearNotificacionUseCase = new CrearNotificacion(notificacionRepo);
const logUseCase = new RegistrarLog(new LogPgRepository());

const isAdminUser = (req) => {
  const permisos = Array.isArray(req?.user?.permisos) ? req.user.permisos : [];
  return permisos.includes("ADMIN_TOTAL") || Number(req?.user?.rol || req?.user?.rol_id) === 1;
};

const getAllowedEntityIds = async (req) => {
  if (isAdminUser(req)) {
    return null;
  }

  if (!req?.user?.id || typeof userRepo.getEntidadesByUsuario !== "function") {
    return null;
  }

  const entidades = await userRepo.getEntidadesByUsuario(req.user.id);
  return (Array.isArray(entidades) ? entidades : [])
    .map((item) => Number(item?.id))
    .filter((item) => Number.isInteger(item) && item > 0);
};

const normalizeEstado = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

export async function listarBajas(req, res) {
  try {
    const isAdmin = isAdminUser(req);
    const filters = {
      estado: req.query?.estado ? normalizeEstado(req.query.estado) : "",
      search: req.query?.q ?? req.query?.search ?? "",
      solicitadoPor: isAdmin ? null : req.user?.id
    };

    const data = await bajaRepo.findAll(filters);
    return success(res, data);
  } catch (e) {
    return error(res, e.message || "No se pudieron cargar las bajas");
  }
}

export async function crearBaja(req, res) {
  try {
    const activoId = Number(req.body?.activo_id ?? req.body?.activoId);
    if (!Number.isInteger(activoId) || activoId <= 0) {
      return error(res, "Activo invalido", 400);
    }

    const activo = await activoRepo.findById(activoId);
    if (!activo) {
      return error(res, "Activo no encontrado", 404);
    }

    const allowedEntityIds = await getAllowedEntityIds(req);
    if (allowedEntityIds !== null && !allowedEntityIds.includes(Number(activo?.entidad_id))) {
      return error(res, "No tienes acceso a la entidad del activo seleccionado", 403);
    }

    const estadoActivo = normalizeEstado(activo?.estado || "");
    if (estadoActivo === "FUERA_DE_SERVICIO" || estadoActivo === "BAJA") {
      return error(res, "El activo ya fue dado de baja", 400);
    }

    const motivo = String(req.body?.motivo || "").trim();
    if (!motivo) {
      return error(res, "El motivo es obligatorio", 400);
    }

    const pendiente = await bajaRepo.findPendingByActivo(activoId);
    if (pendiente) {
      return error(res, "Ya existe una baja pendiente para este activo", 400);
    }

    const evidencia = normalizeAdjuntos(req.body?.evidencia || req.body?.adjuntos || []);
    const result = await bajaRepo.create({
      activo_id: activoId,
      solicitado_por: req.user?.id ?? null,
      motivo,
      evidencia
    });

    if (logUseCase?.execute) {
      await logUseCase.execute({
        usuario_id: req.user?.id ?? null,
        accion: "SOLICITAR_BAJA_ACTIVO",
        entidad: "ACTIVO",
        entidad_id: activoId,
        despues: { motivo: motivo.slice(0, 200), adjuntos: getAdjuntosMeta(evidencia) }
      });
    }

    try {
      const users = await userRepo.findAll();
      const admins = (Array.isArray(users) ? users : []).filter((user) => Number(user?.rol_id) === 1);
      await Promise.all(
        admins.map((admin) =>
          crearNotificacionUseCase.execute({
            usuario_id: admin.id,
            titulo: "Solicitud de baja de activo",
            mensaje: `${activo.activo || activo.nombre || `Activo #${activoId}`} - ${motivo}`,
            tipo: "ACTIVO",
            url: "/activos"
          })
        )
      );
    } catch {
      // No bloquear la respuesta si falla notificacion.
    }

    return success(res, result, "Solicitud de baja registrada", 201);
  } catch (e) {
    return error(res, e.message || "No se pudo registrar la baja", 400);
  }
}

export async function aprobarBaja(req, res) {
  try {
    if (!isAdminUser(req)) {
      return error(res, "Acceso denegado", 403);
    }
    const bajaId = Number(req.params.id);
    if (!Number.isInteger(bajaId) || bajaId <= 0) {
      return error(res, "Solicitud invalida", 400);
    }

    const baja = await bajaRepo.findById(bajaId);
    if (!baja) {
      return error(res, "Solicitud no encontrada", 404);
    }

    const result = await bajaRepo.updateEstado(bajaId, {
      estado: "APROBADO",
      aprobado_por: req.user?.id ?? null,
      respuesta_admin: req.body?.respuesta_admin ?? req.body?.comentario ?? null
    });

    await activoRepo.update(baja.activo_id, {
      estado: "Fuera de servicio",
      ciclo_vida_etapa: "Retirado"
    });

    if (logUseCase?.execute) {
      await logUseCase.execute({
        usuario_id: req.user?.id ?? null,
        accion: "APROBAR_BAJA_ACTIVO",
        entidad: "ACTIVO",
        entidad_id: baja.activo_id,
        despues: { baja_id: bajaId }
      });
    }

    try {
      if (baja.solicitado_por) {
        await crearNotificacionUseCase.execute({
          usuario_id: baja.solicitado_por,
          titulo: "Baja de activo aprobada",
          mensaje: "Tu solicitud fue aprobada. El activo queda fuera de servicio.",
          tipo: "ACTIVO",
          url: "/activos"
        });
      }
    } catch {
      // Evitar bloquear.
    }

    return success(res, result, "Baja aprobada");
  } catch (e) {
    return error(res, e.message || "No se pudo aprobar la baja", 400);
  }
}

export async function rechazarBaja(req, res) {
  try {
    if (!isAdminUser(req)) {
      return error(res, "Acceso denegado", 403);
    }
    const bajaId = Number(req.params.id);
    if (!Number.isInteger(bajaId) || bajaId <= 0) {
      return error(res, "Solicitud invalida", 400);
    }

    const baja = await bajaRepo.findById(bajaId);
    if (!baja) {
      return error(res, "Solicitud no encontrada", 404);
    }

    const respuesta = String(req.body?.respuesta_admin || req.body?.comentario || "").trim();

    const result = await bajaRepo.updateEstado(bajaId, {
      estado: "RECHAZADO",
      aprobado_por: req.user?.id ?? null,
      respuesta_admin: respuesta
    });

    if (logUseCase?.execute) {
      await logUseCase.execute({
        usuario_id: req.user?.id ?? null,
        accion: "RECHAZAR_BAJA_ACTIVO",
        entidad: "ACTIVO",
        entidad_id: baja.activo_id,
        despues: { baja_id: bajaId, respuesta }
      });
    }

    try {
      if (baja.solicitado_por) {
        await crearNotificacionUseCase.execute({
          usuario_id: baja.solicitado_por,
          titulo: "Baja de activo rechazada",
          mensaje: respuesta || "Tu solicitud fue rechazada.",
          tipo: "ACTIVO",
          url: "/activos"
        });
      }
    } catch {
      // Evitar bloquear.
    }

    return success(res, result, "Baja rechazada");
  } catch (e) {
    return error(res, e.message || "No se pudo rechazar la baja", 400);
  }
}

