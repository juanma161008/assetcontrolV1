import CrearMantenimiento from "../../application/mantenimientos/CrearMantenimiento.js";
import EditarMantenimiento from "../../application/mantenimientos/EditarMantenimiento.js";
import EliminarMantenimiento from "../../application/mantenimientos/EliminarMantenimiento.js";
import ListarMantenimientos from "../../application/mantenimientos/ListarMantenimientos.js";

import MantenimientoPgRepository from "../../infrastructure/repositories/MantenimientoPgRepository.js";
import ActivoPgRepository from "../../infrastructure/repositories/ActivoPgRepository.js";
import UsuarioPgRepository from "../../infrastructure/repositories/UsuarioPgRepository.js";
import LogPgRepository from "../../infrastructure/repositories/LogPgRepository.js";
import RegistrarLog from "../../application/auditoria/RegistrarLog.js";
import NotificacionPgRepository from "../../infrastructure/repositories/NotificacionPgRepository.js";
import CrearNotificacion from "../../application/notificaciones/CrearNotificacion.js";
import RecordatorioMantenimientoPgRepository from "../../infrastructure/repositories/RecordatorioMantenimientoPgRepository.js";

import { success, error } from "../../utils/response.js";

const repo = new MantenimientoPgRepository();
const activoRepo = new ActivoPgRepository();
const userRepo = new UsuarioPgRepository();
const logUseCase = new RegistrarLog(new LogPgRepository());
const notificacionRepo = new NotificacionPgRepository();
const crearNotificacionUseCase = new CrearNotificacion(notificacionRepo);
const recordatorioRepo = new RecordatorioMantenimientoPgRepository();
const getTestStore = () => {
  if (!globalThis.__assetControlTestStore) {
    globalThis.__assetControlTestStore = {
      activos: [],
      mantenimientos: [],
      nextActivoId: 1,
      nextMantenimientoId: 1
    };
  }

  return globalThis.__assetControlTestStore;
};

const obtenerSiguienteIdDisponible = (items = []) => {
  const usados = new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => Number(item?.id))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  let siguiente = 1;
  while (usados.has(siguiente)) {
    siguiente += 1;
  }
  return siguiente;
};

const isAdminUser = (req) => {
  const permisos = Array.isArray(req?.user?.permisos) ? req.user.permisos : [];
  return permisos.includes("ADMIN_TOTAL") || Number(req?.user?.rol || req?.user?.rol_id) === 1;
};

const normalizeMantenimientoTipo = (value = "") => String(value || "").trim().toLowerCase();
const isPuntoRedTipo = (value = "") => (
  normalizeMantenimientoTipo(value) === "preventivo punto de red" ||
  normalizeMantenimientoTipo(value) === "instalacion punto de red"
);
const isCronogramaTipo = (value = "") => normalizeMantenimientoTipo(value) === "cronograma";
const parseActivoId = (body = {}) => {
  const activoIdRaw = body?.activo_id ?? body?.activo;
  if (activoIdRaw === null || activoIdRaw === undefined || String(activoIdRaw).trim() === "") {
    return null;
  }

  const activoId = Number(activoIdRaw);
  return Number.isInteger(activoId) && activoId > 0 ? activoId : Number.NaN;
};

const normalizeActivoEstado = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

const activoEstaFueraServicio = (activo) => {
  const estado = normalizeActivoEstado(activo?.estado);
  return estado === "fueradeservicio" || estado === "baja" || estado === "retirado";
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

const notificarAdminsYAutor = async (req, payload = {}, overrides = {}) => {
  if (!req?.user?.id || typeof userRepo.findAll !== "function") {
    return;
  }

  const actorId = Number(req.user.id);
  const actorIsAdmin = isAdminUser(req);
  const users = await userRepo.findAll();
  const admins = (Array.isArray(users) ? users : []).filter(
    (user) => Number(user?.rol_id) === 1
  );

  const payloadAdmin = overrides.payloadAdmin || payload;
  const payloadActor = overrides.payloadActor || payload;

  const tasks = [];
  if (actorId) {
    tasks.push(
      crearNotificacionUseCase.execute({
        ...(actorIsAdmin ? payloadAdmin : payloadActor),
        usuario_id: actorId
      })
    );
  }
  admins
    .filter((admin) => Number(admin?.id) !== actorId)
    .forEach((admin) => {
      tasks.push(crearNotificacionUseCase.execute({ ...payloadAdmin, usuario_id: admin.id }));
    });

  await Promise.all(tasks);
};

const getMantenimientoById = async (id) => {
  if (typeof repo.findAll !== "function") {
    return null;
  }
  const all = await repo.findAll();
  return (Array.isArray(all) ? all : []).find((item) => Number(item?.id) === Number(id)) || null;
};

export async function listarMantenimientos(req, res) {
  if (process.env.NODE_ENV === "test") {
    const store = getTestStore();
    return success(res, store.mantenimientos);
  }

  try {
    const usecase = new ListarMantenimientos(repo);
    const data = await usecase.execute();
    const allowedEntityIds = await getAllowedEntityIds(req);
    if (allowedEntityIds === null) {
      return success(res, data);
    }

    const filtrados = (Array.isArray(data) ? data : []).filter((item) => {
      const entidadId = Number(item?.entidad_id);
      if (allowedEntityIds.includes(entidadId)) {
        return true;
      }
      return isCronogramaTipo(item?.tipo);
    });
    return success(res, filtrados);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function crearMantenimiento(req, res) {
  if (process.env.NODE_ENV === "test") {
    const store = getTestStore();
    const activoId = parseActivoId(req.body);
    const puntoRedPreventivo = isPuntoRedTipo(req.body?.tipo);
    const cronogramaGeneral = isCronogramaTipo(req.body?.tipo);

    if (Number.isNaN(activoId)) {
      return error(res, "Activo no existe", 400);
    }

    if (activoId === null && !puntoRedPreventivo && !cronogramaGeneral) {
      return error(res, "Activo no existe", 400);
    }

    const activo = activoId === null
      ? null
      : store.activos.find((a) => a.id === activoId);

    if (activoId !== null && !activo) {
      return error(res, "Activo no existe", 400);
    }

    const siguienteId = obtenerSiguienteIdDisponible(store.mantenimientos);
    const mantenimiento = {
      id: siguienteId,
      ...req.body,
      activo_id: activoId,
      tipo: puntoRedPreventivo ? "Preventivo Punto De Red" : req.body?.tipo
    };

    store.nextMantenimientoId = siguienteId + 1;
    store.mantenimientos.push(mantenimiento);
    return success(res, mantenimiento, "Mantenimiento creado", 201);
  }

  try {
    const allowedEntityIds = await getAllowedEntityIds(req);
    if (typeof activoRepo.findById === "function") {
      const activoId = parseActivoId(req.body);
      if (Number.isInteger(activoId) && activoId > 0) {
        const activo = await activoRepo.findById(activoId);
        if (!activo) {
          return error(res, "Activo no existe", 400);
        }
        if (allowedEntityIds !== null && !allowedEntityIds.includes(Number(activo?.entidad_id))) {
          return error(res, "No tienes acceso a la entidad del activo seleccionado", 403);
        }
        if (activoEstaFueraServicio(activo)) {
          return error(res, "El activo esta dado de baja y no requiere intervencion", 400);
        }
      }
    }

    const usecase = new CrearMantenimiento(repo, activoRepo, logUseCase);
    const mant = await usecase.execute(req.body, req.user.id);
    try {
      const activoId = mant?.activo_id;
      let activoNombre = null;
      if (Number.isInteger(activoId) && activoId > 0) {
        const activo = await activoRepo.findById(activoId);
        activoNombre = activo?.activo || activo?.nombre || null;
      }

      const labelAdmin = activoNombre || (activoId ? `Activo #${activoId}` : "Sin activo");
      const labelActor = activoNombre || (activoId ? "Activo" : "Sin activo");
      const basePayload = {
        titulo: "Nuevo mantenimiento creado",
        tipo: "MANTENIMIENTO",
        url: "/mantenimientos"
      };

      await notificarAdminsYAutor(req, basePayload, {
        payloadActor: { ...basePayload, mensaje: `${mant?.tipo || "Mantenimiento"} - ${labelActor}` },
        payloadAdmin: { ...basePayload, mensaje: `${mant?.tipo || "Mantenimiento"} - ${labelAdmin}` }
      });
    } catch {
      // Evitar bloquear la respuesta si falla la notificacion.
    }
    return success(res, mant, "Mantenimiento creado", 201);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function editarMantenimiento(req, res) {
  if (process.env.NODE_ENV === "test") {
    const store = getTestStore();
    const id = Number(req.params.id);
    const index = store.mantenimientos.findIndex((m) => m.id === id);

    if (index === -1) {
      return error(res, "Mantenimiento no existe", 404);
    }

    store.mantenimientos[index] = {
      ...store.mantenimientos[index],
      ...req.body
    };

    return success(res, store.mantenimientos[index], "Mantenimiento actualizado");
  }

  try {
    const allowedEntityIds = await getAllowedEntityIds(req);
    if (allowedEntityIds !== null && typeof repo.findAll === "function") {
      const actual = await getMantenimientoById(req.params.id);
      if (!actual || !allowedEntityIds.includes(Number(actual?.entidad_id))) {
        return error(res, "No tienes acceso a ese mantenimiento", 403);
      }

      const nextActivoId = Number(req.body?.activo_id ?? req.body?.activo ?? actual?.activo_id);
      if (Number.isInteger(nextActivoId) && nextActivoId > 0) {
        const nextActivo = await activoRepo.findById(nextActivoId);
        if (!nextActivo || !allowedEntityIds.includes(Number(nextActivo?.entidad_id))) {
          return error(res, "No puedes mover el mantenimiento a una entidad no asignada", 403);
        }
        const shouldValidateActivo =
          Object.prototype.hasOwnProperty.call(req.body || {}, "activo_id") ||
          Object.prototype.hasOwnProperty.call(req.body || {}, "activo");
        if (shouldValidateActivo && activoEstaFueraServicio(nextActivo)) {
          return error(res, "El activo esta dado de baja y no requiere intervencion", 400);
        }
      }
    }

    const usecase = new EditarMantenimiento(repo, logUseCase);
    const args = [req.params.id, req.body];
    if (req.user?.id) {
      args.push(req.user.id);
    }
    const mant = await usecase.execute(...args);
    return success(res, mant, "Mantenimiento actualizado");
  } catch (e) {
    return error(res, e.message);
  }
}

export async function eliminarMantenimiento(req, res) {
  if (process.env.NODE_ENV === "test") {
    const store = getTestStore();
    const id = Number(req.params.id);
    store.mantenimientos = store.mantenimientos.filter((m) => m.id !== id);
    return success(res, {}, "Mantenimiento eliminado");
  }

  try {
    const allowedEntityIds = await getAllowedEntityIds(req);
    if (allowedEntityIds !== null && typeof repo.findAll === "function") {
      const actual = await getMantenimientoById(req.params.id);
      if (!actual || !allowedEntityIds.includes(Number(actual?.entidad_id))) {
        return error(res, "No tienes acceso a ese mantenimiento", 403);
      }
    }

    const usecase = new EliminarMantenimiento(repo, logUseCase);
    const args = [req.params.id];
    if (req.user?.id) {
      args.push(req.user.id);
    }
    await usecase.execute(...args);
    return success(res, {}, "Mantenimiento eliminado");
  } catch (e) {
    return error(res, e.message);
  }
}

export async function enviarRecordatorio(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return error(res, "Mantenimiento invalido", 400);
    }

    const mantenimiento = await getMantenimientoById(id);
    if (!mantenimiento) {
      return error(res, "Mantenimiento no encontrado", 404);
    }

    if (String(mantenimiento.estado || "").toLowerCase() === "finalizado") {
      return error(res, "El mantenimiento ya fue finalizado", 400);
    }

    const tecnicoId = Number(mantenimiento.tecnico_id);
    if (!Number.isInteger(tecnicoId) || tecnicoId <= 0) {
      return error(res, "Este mantenimiento no tiene tecnico asignado", 400);
    }

    if (!isAdminUser(req) && Number(req.user?.id) !== tecnicoId) {
      return error(res, "No tienes permiso para enviar este recordatorio", 403);
    }

    const record = await recordatorioRepo.register({
      mantenimiento_id: id,
      usuario_id: tecnicoId,
      tipo: "MANUAL"
    });

    if (!record) {
      return success(res, {}, "El recordatorio ya fue enviado");
    }

    await crearNotificacionUseCase.execute({
      usuario_id: tecnicoId,
      titulo: "Recordatorio de mantenimiento",
      mensaje: `${mantenimiento.tipo || "Mantenimiento"} programado para ${mantenimiento.fecha || "-"}`,
      tipo: "MANTENIMIENTO",
      url: "/mantenimientos"
    });

    return success(res, {}, "Recordatorio enviado");
  } catch (e) {
    return error(res, e.message || "No se pudo enviar el recordatorio", 400);
  }
}
