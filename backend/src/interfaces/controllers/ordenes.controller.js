import CrearOrden from "../../application/ordenes/CrearOrden.js";
import FirmarOrden from "../../application/ordenes/FirmarOrden.js";
import ListarOrden from "../../application/ordenes/ListarOrden.js";
import ObtenerOrden from "../../application/ordenes/ObtenerOrden.js";
import EliminarOrden from "../../application/ordenes/EliminarOrden.js";
import GenerarPDF from "../../application/ordenes/GenerarPDF.js";
import OrdenPgRepository from "../../infrastructure/repositories/OrdenPgRepository.js";
import MantenimientoPgRepository from "../../infrastructure/repositories/MantenimientoPgRepository.js";
import UsuarioPgRepository from "../../infrastructure/repositories/UsuarioPgRepository.js";
import SimplePdfService from "../../infrastructure/pdf/SimplePdfService.js";
import LogPgRepository from "../../infrastructure/repositories/LogPgRepository.js";
import RegistrarLog from "../../application/auditoria/RegistrarLog.js";
import NotificacionPgRepository from "../../infrastructure/repositories/NotificacionPgRepository.js";
import CrearNotificacion from "../../application/notificaciones/CrearNotificacion.js";

import { success, error } from "../../utils/response.js";

const repo = new OrdenPgRepository();
const mantenimientoRepo = new MantenimientoPgRepository();
const userRepo = new UsuarioPgRepository();
const logUseCase = new RegistrarLog(new LogPgRepository());
const pdfUseCase = new GenerarPDF(new SimplePdfService());
const notificacionRepo = new NotificacionPgRepository();
const crearNotificacionUseCase = new CrearNotificacion(notificacionRepo);

const isAdminUser = (req) => {
  const permisos = Array.isArray(req?.user?.permisos) ? req.user.permisos : [];
  return permisos.includes("ADMIN_TOTAL") || Number(req?.user?.rol || req?.user?.rol_id) === 1;
};

const getAllowedEntityIds = async (req) => {
  if (isAdminUser(req)) {
    return null;
  }

  const hasScopeContext =
    Array.isArray(req?.user?.permisos) ||
    req?.user?.rol !== undefined ||
    req?.user?.rol_id !== undefined;

  if (!hasScopeContext) {
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

const hasOrderAccess = (order, allowedEntityIds, userId = null) => {
  if (allowedEntityIds === null) return true;
  const entityIds = (Array.isArray(order?.entidades_ids) ? order.entidades_ids : [])
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  if (!entityIds.length) {
    return Number(order?.creado_por) === Number(userId);
  }
  return entityIds.some((id) => allowedEntityIds.includes(id));
};

const notificarAdminsYAutor = async (req, payload = {}) => {
  if (!req?.user?.id || typeof userRepo.findAll !== "function") {
    return;
  }

  const actorId = Number(req.user.id);
  const users = await userRepo.findAll();
  const admins = (Array.isArray(users) ? users : []).filter(
    (user) => Number(user?.rol_id) === 1
  );

  const tasks = [];
  if (actorId) {
    tasks.push(crearNotificacionUseCase.execute({ ...payload, usuario_id: actorId }));
  }
  admins
    .filter((admin) => Number(admin?.id) !== actorId)
    .forEach((admin) => {
      tasks.push(crearNotificacionUseCase.execute({ ...payload, usuario_id: admin.id }));
    });

  await Promise.all(tasks);
};

export async function crearOrden(req, res) {
  try {
    const allowedEntityIds = await getAllowedEntityIds(req);
    if (allowedEntityIds !== null && typeof mantenimientoRepo.findAll === "function") {
      const requestedMantenimientos = Array.isArray(req.body?.mantenimientos)
        ? req.body.mantenimientos.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [];

      if (requestedMantenimientos.length > 0) {
        const allMantenimientos = await mantenimientoRepo.findAll();
        const byId = (Array.isArray(allMantenimientos) ? allMantenimientos : []).reduce((acc, item) => {
          acc[Number(item?.id)] = item;
          return acc;
        }, {});

        const unauthorized = requestedMantenimientos.some((mId) => {
          const mant = byId[mId];
          return !mant || !allowedEntityIds.includes(Number(mant?.entidad_id));
        });
        if (unauthorized) {
          return error(res, "No tienes acceso a una o mas entidades de los mantenimientos seleccionados", 403);
        }
      }
    }

    const usecase = new CrearOrden(repo, logUseCase);
    const orden = await usecase.execute(req.body, req.user.id);
    try {
      const numeroOrden = orden?.numero || orden?.id;
      await notificarAdminsYAutor(req, {
        titulo: "Nueva orden de trabajo",
        mensaje: numeroOrden ? `Orden ${numeroOrden}` : "Orden creada",
        tipo: "ORDEN",
        url: "/ordenes"
      });
    } catch {
      // Evitar bloquear la respuesta si falla la notificacion.
    }
    return success(res, orden, "Orden creada", 201);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function firmarOrden(req, res) {
  try {
    const allowedEntityIds = await getAllowedEntityIds(req);
    if (allowedEntityIds !== null && typeof repo.findById === "function") {
      const ordenActual = await repo.findById(req.params.id);
      if (!ordenActual || !hasOrderAccess(ordenActual, allowedEntityIds, req?.user?.id)) {
        return error(res, "No tienes acceso a esa orden", 403);
      }
    }

    const usecase = new FirmarOrden(repo, logUseCase);
    await usecase.execute(req.params.id, req.body.firmaBase64, req.user.id);
    return success(res, {}, "Orden firmada correctamente");
  } catch (e) {
    return error(res, e.message);
  }
}

export async function listar(req, res) {
  try {
    const usecase = new ListarOrden(repo);
    const ordenes = await usecase.execute();
    const allowedEntityIds = await getAllowedEntityIds(req);
    if (allowedEntityIds !== null) {
      const filtradas = (Array.isArray(ordenes) ? ordenes : []).filter((item) =>
        hasOrderAccess(item, allowedEntityIds, req?.user?.id)
      );
      return success(res, filtradas);
    }
    return success(res, ordenes);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function obtenerPorId(req, res) {
  try {
    const allowedEntityIds = await getAllowedEntityIds(req);
    const usecase = new ObtenerOrden(repo);
    const orden = await usecase.execute(req.params.id);
    if (allowedEntityIds !== null && orden && !hasOrderAccess(orden, allowedEntityIds, req?.user?.id)) {
      return error(res, "No tienes acceso a esa orden", 403);
    }
    return success(res, orden);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function descargarPdfOrden(req, res) {
  try {
    const allowedEntityIds = await getAllowedEntityIds(req);
    const usecase = new ObtenerOrden(repo);
    const orden = await usecase.execute(req.params.id);

    if (!orden) {
      return error(res, "Orden no encontrada", 404);
    }

    if (allowedEntityIds !== null && !hasOrderAccess(orden, allowedEntityIds, req?.user?.id)) {
      return error(res, "No tienes acceso a esa orden", 403);
    }

    const pdfBuffer = await pdfUseCase.execute(orden);
    const nombre = String(orden?.numero || orden?.id || "orden").replace(/[^a-zA-Z0-9-_]/g, "-");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Orden-${nombre}.pdf"`);
    return res.send(pdfBuffer);
  } catch (e) {
    return error(res, e.message || "No se pudo generar PDF", 400);
  }
}

export async function eliminarOrden(req, res) {
  try {
    const allowedEntityIds = await getAllowedEntityIds(req);
    if (allowedEntityIds !== null && typeof repo.findById === "function") {
      const orden = await repo.findById(req.params.id);
      if (!orden || !hasOrderAccess(orden, allowedEntityIds, req?.user?.id)) {
        return error(res, "No tienes acceso a esa orden", 403);
      }
    }

    const usecase = new EliminarOrden(repo);
    await usecase.execute(req.params.id);
    return success(res, {}, "Orden eliminada", 200);
  } catch (e) {
    return error(res, e.message);
  }
}
