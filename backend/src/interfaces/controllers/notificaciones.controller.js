import EnviarCorreo from "../../application/notificaciones/EnviarCorreo.js";
import ListarNotificaciones from "../../application/notificaciones/ListarNotificaciones.js";
import MarcarNotificacionLeida from "../../application/notificaciones/MarcarNotificacionLeida.js";
import MarcarTodasNotificacionesLeidas from "../../application/notificaciones/MarcarTodasNotificacionesLeidas.js";
import SmtpEmailProvider from "../../infrastructure/email/SmtpEmailProvider.js";
import NotificacionPgRepository from "../../infrastructure/repositories/NotificacionPgRepository.js";
import { error, success } from "../../utils/response.js";

const emailProvider = new SmtpEmailProvider();
const usecase = new EnviarCorreo(emailProvider);
const notificacionRepo = new NotificacionPgRepository();
const listarUseCase = new ListarNotificaciones(notificacionRepo);
const marcarLeidaUseCase = new MarcarNotificacionLeida(notificacionRepo);
const marcarTodasUseCase = new MarcarTodasNotificacionesLeidas(notificacionRepo);

export async function enviarCorreo(req, res) {
  try {
    if (!emailProvider.isConfigured()) {
      const missing = emailProvider.getMissingConfigKeys?.() || [];
      const detail = missing.length ? `Falta configurar: ${missing.join(", ")}` : "SMTP no configurado";
      return success(res, { skipped: true }, `Correo no enviado. ${detail}.`);
    }

    const result = await usecase.execute(req.body, {
      replyTo: req.user?.email || ""
    });

    return success(res, result, "Correo enviado");
  } catch (e) {
    return error(res, e.message || "No se pudo enviar el correo", 400);
  }
}

export async function listarNotificaciones(req, res) {
  try {
    if (!req.user?.id) {
      return error(res, "No autenticado", 401);
    }
    const limit = Number(req.query?.limit) || 30;
    const page = Number(req.query?.page) || 1;
    const offset = page > 1 ? (page - 1) * limit : 0;
    const tipo = req.query?.tipo ? String(req.query.tipo).trim().toUpperCase() : "";
    const search = req.query?.q ?? req.query?.search ?? "";
    const leidoRaw = req.query?.leido;
    const leido = leidoRaw === undefined || leidoRaw === ""
      ? undefined
      : String(leidoRaw).toLowerCase() === "true";

    const filters = {
      tipo: tipo || undefined,
      search: search || undefined,
      leido
    };

    const [items, total] = await Promise.all([
      listarUseCase.execute(req.user.id, { limit, offset, ...filters }),
      notificacionRepo.countByUsuario(req.user.id, filters)
    ]);

    return success(res, {
      items,
      total,
      page,
      limit
    });
  } catch (e) {
    return error(res, e.message || "No se pudo cargar notificaciones", 400);
  }
}

export async function marcarNotificacionLeida(req, res) {
  try {
    if (!req.user?.id) {
      return error(res, "No autenticado", 401);
    }
    const id = Number(req.params.id);
    const result = await marcarLeidaUseCase.execute(req.user.id, id);
    if (!result) {
      return error(res, "Notificacion no encontrada", 404);
    }
    return success(res, result, "Notificacion actualizada");
  } catch (e) {
    return error(res, e.message || "No se pudo actualizar", 400);
  }
}

export async function marcarTodasLeidas(req, res) {
  try {
    if (!req.user?.id) {
      return error(res, "No autenticado", 401);
    }
    await marcarTodasUseCase.execute(req.user.id);
    return success(res, {}, "Notificaciones actualizadas");
  } catch (e) {
    return error(res, e.message || "No se pudo actualizar", 400);
  }
}

export async function eliminarNotificacion(req, res) {
  try {
    if (!req.user?.id) {
      return error(res, "No autenticado", 401);
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return error(res, "Identificador invalido", 400);
    }
    const deleted = await notificacionRepo.deleteById(id, req.user.id);
    if (!deleted) {
      return error(res, "Notificacion no encontrada", 404);
    }
    return success(res, deleted, "Notificacion eliminada");
  } catch (e) {
    return error(res, e.message || "No se pudo eliminar", 400);
  }
}

export async function eliminarTodasNotificaciones(req, res) {
  try {
    if (!req.user?.id) {
      return error(res, "No autenticado", 401);
    }
    await notificacionRepo.deleteAllByUsuario(req.user.id);
    return success(res, {}, "Notificaciones eliminadas");
  } catch (e) {
    return error(res, e.message || "No se pudieron eliminar", 400);
  }
}
