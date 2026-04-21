import ListarHelpdeskThreads from "../../application/helpdesk/ListarHelpdeskThreads.js";
import CrearHelpdeskThread from "../../application/helpdesk/CrearHelpdeskThread.js";
import CrearHelpdeskMensaje from "../../application/helpdesk/CrearHelpdeskMensaje.js";
import ActualizarHelpdeskThread from "../../application/helpdesk/ActualizarHelpdeskThread.js";
import ObtenerHelpdeskThread from "../../application/helpdesk/ObtenerHelpdeskThread.js";

import HelpdeskPgRepository from "../../infrastructure/repositories/HelpdeskPgRepository.js";
import UsuarioPgRepository from "../../infrastructure/repositories/UsuarioPgRepository.js";
import NotificacionPgRepository from "../../infrastructure/repositories/NotificacionPgRepository.js";
import CrearNotificacion from "../../application/notificaciones/CrearNotificacion.js";
import LogPgRepository from "../../infrastructure/repositories/LogPgRepository.js";
import RegistrarLog from "../../application/auditoria/RegistrarLog.js";
import { success, error } from "../../utils/response.js";

const repo = new HelpdeskPgRepository();
const userRepo = new UsuarioPgRepository();
const notificacionRepo = new NotificacionPgRepository();
const crearNotificacionUseCase = new CrearNotificacion(notificacionRepo);
const logUseCase = new RegistrarLog(new LogPgRepository());

const normalizeStatus = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

const isAdminUser = (req) => {
  const permisos = Array.isArray(req?.user?.permisos) ? req.user.permisos : [];
  return permisos.includes("ADMIN_TOTAL") || Number(req?.user?.rol || req?.user?.rol_id) === 1;
};

export async function listarThreads(req, res) {
  try {
    const isAdmin = isAdminUser(req);
    const actorId = req.user?.id ?? null;
    const filters = {
      estado: req.query?.estado ? normalizeStatus(req.query.estado) : "",
      search: req.query?.q ?? req.query?.search ?? "",
      creadoPor: !isAdmin && actorId ? actorId : null,
      adminAsignadoId: isAdmin && actorId ? actorId : null
    };
    const usecase = new ListarHelpdeskThreads(repo);
    const data = await usecase.execute(filters);
    return success(res, data);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function obtenerThread(req, res) {
  try {
    const usecase = new ObtenerHelpdeskThread(repo);
    const thread = await usecase.execute(req.params.id);
    if (!thread) {
      return error(res, "Hilo no encontrado", 404);
    }
    const actorId = req.user?.id ?? null;
    const isAdmin = isAdminUser(req);
    if (isAdmin) {
      if (Number(thread.admin_asignado_id) !== Number(actorId)) {
        return error(res, "No tienes acceso a este caso", 403);
      }
    } else if (Number(thread.creado_por) !== Number(actorId)) {
      return error(res, "No tienes acceso a este caso", 403);
    }

    const mensajes = await repo.findMessagesByThread(thread.id);
    return success(res, { thread, mensajes });
  } catch (e) {
    return error(res, e.message);
  }
}

export async function crearThread(req, res) {
  try {
    const requestedAdminId = Number(
      req.body?.admin_asignado_id ?? req.body?.adminAsignadoId ?? req.body?.admin_id
    );
    const users = await userRepo.findAll();
    const admins = (Array.isArray(users) ? users : []).filter(
      (user) => Number(user?.rol_id) === 1
    );
    const resolvedAdminId = Number.isInteger(requestedAdminId) && requestedAdminId > 0
      ? requestedAdminId
      : (admins[0]?.id ?? null);

    if (!resolvedAdminId) {
      return error(res, "No hay administradores disponibles para asignar este caso", 400);
    }

    const adminExists = admins.some((admin) => Number(admin.id) === Number(resolvedAdminId));
    if (!adminExists) {
      return error(res, "El administrador asignado no es valido", 400);
    }

    const usecase = new CrearHelpdeskThread(repo, logUseCase);
    const result = await usecase.execute(
      { ...req.body, admin_asignado_id: resolvedAdminId },
      req.user?.id
    );

    try {
      const actorId = req.user?.id ?? null;
      if (actorId) {
        await crearNotificacionUseCase.execute({
          usuario_id: actorId,
          titulo: "Caso registrado en Comunicaciones internas",
          mensaje: result.thread?.titulo || "Nuevo caso registrado",
          tipo: "HELPDESK",
          url: "/ayuda"
        });
      }

      if (Number(resolvedAdminId) !== Number(actorId)) {
        await crearNotificacionUseCase.execute({
          usuario_id: resolvedAdminId,
          titulo: "Nuevo caso asignado",
          mensaje: result.thread?.titulo || "Nuevo caso registrado",
          tipo: "HELPDESK",
          url: "/ayuda"
        });
      }
    } catch {
      // No bloquear la respuesta si falla notificacion.
    }

    return success(res, result, "Hilo creado", 201);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function crearMensaje(req, res) {
  try {
    const threadId = Number(req.params.id);
    if (!Number.isInteger(threadId) || threadId <= 0) {
      return error(res, "Hilo invalido", 400);
    }

    const thread = await repo.findThreadById(threadId);
    if (!thread) {
      return error(res, "Hilo no encontrado", 404);
    }

    const actorId = req.user?.id ?? null;
    const isAdmin = isAdminUser(req);
    if (isAdmin) {
      if (Number(thread.admin_asignado_id) !== Number(actorId)) {
        return error(res, "No tienes acceso a este caso", 403);
      }
    } else if (Number(thread.creado_por) !== Number(actorId)) {
      return error(res, "No tienes acceso a este caso", 403);
    }

    const usecase = new CrearHelpdeskMensaje(repo, logUseCase);
    const result = await usecase.execute(threadId, req.body, req.user?.id);

    try {
      if (isAdmin) {
        if (thread.creado_por && Number(thread.creado_por) !== Number(actorId)) {
          await crearNotificacionUseCase.execute({
            usuario_id: thread.creado_por,
            titulo: "Respuesta del administrador",
            mensaje: thread.titulo || "Comunicaciones internas",
            tipo: "HELPDESK",
            url: "/ayuda"
          });
        }
      } else if (thread.admin_asignado_id) {
        await crearNotificacionUseCase.execute({
          usuario_id: thread.admin_asignado_id,
          titulo: "Nueva respuesta en un caso asignado",
          mensaje: thread.titulo || "Comunicaciones internas",
          tipo: "HELPDESK",
          url: "/ayuda"
        });
      }
    } catch {
      // Evitar bloquear si falla notificacion.
    }

    return success(res, result, "Mensaje registrado", 201);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function actualizarThread(req, res) {
  try {
    const threadId = Number(req.params.id);
    if (!Number.isInteger(threadId) || threadId <= 0) {
      return error(res, "Hilo invalido", 400);
    }

    const existing = await repo.findThreadById(threadId);
    if (!existing) {
      return error(res, "Hilo no encontrado", 404);
    }

    const actorId = req.user?.id ?? null;
    const isAdmin = isAdminUser(req);
    if (!isAdmin || Number(existing.admin_asignado_id) !== Number(actorId)) {
      return error(res, "No tienes acceso para actualizar este caso", 403);
    }

    const usecase = new ActualizarHelpdeskThread(repo, logUseCase);
    const result = await usecase.execute(threadId, req.body, req.user?.id);
    try {
      if (existing?.creado_por && Number(existing.creado_por) !== Number(actorId)) {
        await crearNotificacionUseCase.execute({
          usuario_id: existing.creado_por,
          titulo: "Actualizacion de caso",
          mensaje: result?.estado ? `Estado: ${String(result.estado).replace(/_/g, " ")}` : "Tu caso fue actualizado",
          tipo: "HELPDESK",
          url: "/ayuda"
        });
      }
    } catch {
      // Evitar bloquear si falla notificacion.
    }
    return success(res, result, "Hilo actualizado");
  } catch (e) {
    return error(res, e.message);
  }
}

export async function listarAdmins(req, res) {
  try {
    const users = await userRepo.findAll();
    const admins = (Array.isArray(users) ? users : [])
      .filter((user) => Number(user?.rol_id) === 1)
      .map((user) => ({
        id: user.id,
        nombre: user.nombre,
        rol_id: user.rol_id
      }));
    return success(res, admins);
  } catch (e) {
    return error(res, e.message);
  }
}
