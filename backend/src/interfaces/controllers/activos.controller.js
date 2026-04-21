import CrearActivo from "../../application/activos/CrearActivo.js";
import EditarActivo from "../../application/activos/EditarActivo.js";
import EliminarActivo from "../../application/activos/EliminarActivo.js";
import ListarActivos from "../../application/activos/ListarActivos.js";

import ActivoPgRepository from "../../infrastructure/repositories/ActivoPgRepository.js";
import EntidadPgRepository from "../../infrastructure/repositories/EntidadPgRepository.js";
import UsuarioPgRepository from "../../infrastructure/repositories/UsuarioPgRepository.js";
import LogPgRepository from "../../infrastructure/repositories/LogPgRepository.js";
import RegistrarLog from "../../application/auditoria/RegistrarLog.js";
import NotificacionPgRepository from "../../infrastructure/repositories/NotificacionPgRepository.js";
import CrearNotificacion from "../../application/notificaciones/CrearNotificacion.js";

import { success, error } from "../../utils/response.js";

const repo = new ActivoPgRepository();
const entidadRepo = new EntidadPgRepository();
const userRepo = new UsuarioPgRepository();
const logUseCase = new RegistrarLog(new LogPgRepository());
const notificacionRepo = new NotificacionPgRepository();
const crearNotificacionUseCase = new CrearNotificacion(notificacionRepo);
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

const normalizeText = (value = "") => String(value ?? "").trim();
const normalizeNullableText = (value = "") => {
  const normalized = normalizeText(value);
  return normalized ? normalized : null;
};
const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const normalizeActivoKey = (value = "") =>
  normalizeText(value)
    .toUpperCase()
    .replace(/\s+/g, "");
const DEFAULT_ENTIDAD_TIPO = "ENTIDAD";
const normalizeEntidadName = (value = "") => normalizeText(value).toUpperCase();
const normalizeAreaValue = (value = "") => normalizeText(value);
const normalizeCategoryValue = (value = "") => normalizeText(value).toLowerCase();
const inferCategoriaActivo = (payload = {}) => {
  const categoriaRaw = normalizeCategoryValue(
    payload?.categoria_activo ?? payload?.categoriaActivo ?? payload?.categoria
  );
  if (categoriaRaw) {
    if (["equipo de trabajo", "computo", "cómputo", "pc"].includes(categoriaRaw)) {
      return "Equipo de trabajo";
    }
    if (["impresora / escaner", "impresora/escaner", "impresion", "impresión", "scanner", "escaner"].includes(categoriaRaw)) {
      return "Impresora / Escaner";
    }
    if (["infraestructura", "red", "networking"].includes(categoriaRaw)) {
      return "Infraestructura";
    }
    if (["telefono", "telefonia", "telefonía", "celular"].includes(categoriaRaw)) {
      return "Telefono";
    }
  }

  const equipo = normalizeCategoryValue(payload?.equipo);
  const source = `${equipo} ${normalizeCategoryValue(payload?.nombre)} ${normalizeCategoryValue(payload?.activo)}`.trim();

  if (/(impresora|escaner|scanner|multifuncional|plotter)/.test(source)) {
    return "Impresora / Escaner";
  }
  if (/(switch|access point|rack|router|firewall|patch panel|servidor|server|ups| ap )/.test(` ${source} `)) {
    return "Infraestructura";
  }
  if (/(telefono|celular|movil|voip|diadema)/.test(source)) {
    return "Telefono";
  }

  return "Equipo de trabajo";
};
const addAreasToMap = (map, entidadId, areaPrincipal, areaSecundaria) => {
  if (!entidadId) return;
  const key = Number(entidadId);
  if (!Number.isInteger(key) || key <= 0) return;
  if (!map.has(key)) {
    map.set(key, { primarias: new Set(), secundarias: new Set() });
  }
  const entry = map.get(key);
  const principal = normalizeAreaValue(areaPrincipal);
  if (principal) entry.primarias.add(principal);
  const secundaria = normalizeAreaValue(areaSecundaria);
  if (secundaria) entry.secundarias.add(secundaria);
};

const normalizeImportPayload = (raw = {}, fallbackEntidadId = null) => {
  const entidadId =
    parsePositiveInteger(raw?.entidad_id) ??
    parsePositiveInteger(raw?.entidadId) ??
    parsePositiveInteger(fallbackEntidadId);

  const activo = normalizeText(raw?.activo || raw?.numeroReporte || "");
  const nombre = normalizeText(raw?.nombre || raw?.activo || "");
  // El sistema mantiene numeroreporte por compatibilidad, pero la unicidad real es por numero de activo.
  const numeroReporte = normalizeNullableText(raw?.numeroReporte ?? raw?.activo ?? "");
  const vidaUtil =
    raw?.vida_util_anios === null || raw?.vida_util_anios === undefined || raw?.vida_util_anios === ""
      ? null
      : Number(raw.vida_util_anios);

  return {
    entidad_id: entidadId,
    sede: normalizeText(raw?.sede),
    numeroReporte,
    categoria_activo: inferCategoriaActivo(raw),
    activo,
    nombre,
    serial: normalizeText(raw?.serial),
    areaPrincipal: normalizeText(raw?.areaPrincipal),
    areaSecundaria: normalizeText(raw?.areaSecundaria),
    equipo: normalizeText(raw?.equipo),
    marca: normalizeText(raw?.marca),
    modelo: normalizeText(raw?.modelo),
    procesador: normalizeText(raw?.procesador),
    tipoRam: normalizeText(raw?.tipoRam),
    ram: normalizeText(raw?.ram),
    tipoDisco: normalizeText(raw?.tipoDisco),
    hdd: normalizeText(raw?.hdd),
    os: normalizeText(raw?.os),
    estado: normalizeText(raw?.estado) || "Disponible",
    ciclo_vida_etapa: normalizeText(raw?.ciclo_vida_etapa),
    fecha_adquisicion: normalizeText(raw?.fecha_adquisicion) || null,
    vida_util_anios: Number.isFinite(vidaUtil) ? vidaUtil : null
  };
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

export async function listarActivos(req, res) {
  if (process.env.NODE_ENV === "test") {
    const store = getTestStore();
    return success(res, store.activos);
  }

  try {
    const usecase = new ListarActivos(repo);
    const activos = await usecase.execute();
    const allowedEntityIds = await getAllowedEntityIds(req);
    if (allowedEntityIds === null) {
      return success(res, activos);
    }

    const filtrados = (Array.isArray(activos) ? activos : []).filter((item) =>
      allowedEntityIds.includes(Number(item?.entidad_id))
    );
    return success(res, filtrados);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function crearActivo(req, res) {
  if (process.env.NODE_ENV === "test") {
    const store = getTestStore();
    const siguienteId = obtenerSiguienteIdDisponible(store.activos);
    const activo = {
      id: siguienteId,
      ...req.body,
      nombre: req.body?.nombre || req.body?.activo || ""
    };
    store.nextActivoId = siguienteId + 1;
    store.activos.push(activo);
    return success(res, activo, "Activo creado", 201);
  }

  try {
    const incomingActivoKey = normalizeActivoKey(req.body?.activo);
    if (incomingActivoKey && typeof repo.findAll === "function") {
      const existentes = await repo.findAll();
      const duplicated = (Array.isArray(existentes) ? existentes : []).some(
        (item) => normalizeActivoKey(item?.activo) === incomingActivoKey
      );
      if (duplicated) {
        return error(res, "El numero de activo ya existe", 400);
      }
    }

    const allowedEntityIds = await getAllowedEntityIds(req);
    const targetEntidadId = Number(req.body?.entidad_id);
    if (
      allowedEntityIds !== null &&
      Number.isInteger(targetEntidadId) &&
      targetEntidadId > 0 &&
      !allowedEntityIds.includes(targetEntidadId)
    ) {
      return error(res, "No tienes acceso a la entidad seleccionada", 403);
    }

    const usecase = new CrearActivo(repo, logUseCase);
    const activo = await usecase.execute(req.body, req.user.id);
    try {
      await notificarAdminsYAutor(req, {
        titulo: "Nuevo activo registrado",
        mensaje: activo?.activo || activo?.nombre || "Activo creado",
        tipo: "ACTIVO",
        url: "/activos"
      });
    } catch {
      // Evitar bloquear la respuesta si falla la notificacion.
    }
    return success(res, activo, "Activo creado", 201);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function importarActivos(req, res) {
  if (process.env.NODE_ENV === "test") {
    const store = getTestStore();
    const activosImport = Array.isArray(req.body?.activos) ? req.body.activos : [];
    const fallbackEntidadId = parsePositiveInteger(req.body?.defaultEntidadId);
    const errores = [];
    const duplicados = [];
    let creados = 0;
    const existingActivos = new Set(
      (Array.isArray(store.activos) ? store.activos : [])
        .map((item) => normalizeActivoKey(item?.activo))
        .filter(Boolean)
    );
    const seenActivos = new Set();

    activosImport.forEach((raw, index) => {
      const payload = normalizeImportPayload(raw, fallbackEntidadId);
      if (!payload.entidad_id) {
        errores.push({ fila: index + 2, mensaje: "Entidad no valida" });
        return;
      }
      if ((!payload.activo && !payload.nombre) || !payload.equipo) {
        errores.push({ fila: index + 2, mensaje: "Campos obligatorios incompletos (activo/nombre y equipo)" });
        return;
      }
      const fila = index + 2;
      const activoKey = normalizeActivoKey(payload?.activo);
      if (activoKey && (existingActivos.has(activoKey) || seenActivos.has(activoKey))) {
        duplicados.push({ fila, mensaje: "Duplicado por numero de activo" });
        return;
      }

      const siguienteId = obtenerSiguienteIdDisponible(store.activos);
      store.nextActivoId = siguienteId + 1;
      store.activos.push({
        id: siguienteId,
        ...payload
      });
      if (activoKey) {
        seenActivos.add(activoKey);
        existingActivos.add(activoKey);
      }
      creados += 1;
    });

    return success(res, {
      total: activosImport.length,
      creados,
      omitidos_duplicados: duplicados.length,
      duplicados,
      errores
    }, "Importacion de activos completada");
  }

  try {
    const activosImport = Array.isArray(req.body?.activos) ? req.body.activos : [];
    if (activosImport.length === 0) {
      return error(res, "Debes enviar al menos un activo para importar", 400);
    }

    const fallbackEntidadId = parsePositiveInteger(req.body?.defaultEntidadId);
    const allowedEntityIds = await getAllowedEntityIds(req);
    const isAdmin = isAdminUser(req);
    const fallbackEntidadImport =
      fallbackEntidadId ||
      (Array.isArray(allowedEntityIds) && allowedEntityIds.length === 1
        ? allowedEntityIds[0]
        : null);
    const pendingAreasByEntidad = new Map();
    const entidadNameCache = new Map();
    if (isAdmin && typeof entidadRepo.findAll === "function") {
      const existentesEntidades = await entidadRepo.findAll();
      (Array.isArray(existentesEntidades) ? existentesEntidades : []).forEach((entidad) => {
        const key = normalizeEntidadName(entidad?.nombre);
        if (key) {
          entidadNameCache.set(key, entidad);
        }
      });
    }
    const resolveEntidadIdFromPayload = async (payload) => {
      const fromId = parsePositiveInteger(payload?.entidad_id);
      if (fromId) {
        return { entidadId: fromId, entidadNombre: normalizeText(payload?.sede) };
      }

      const sede = normalizeText(payload?.sede);
      if (!sede || !isAdmin) {
        return { entidadId: null, entidadNombre: sede };
      }

      const key = normalizeEntidadName(sede);
      let entidad = entidadNameCache.get(key);
      if (!entidad && typeof entidadRepo.findByNombreNormalized === "function") {
        entidad = await entidadRepo.findByNombreNormalized(sede);
      }
      if (!entidad && typeof entidadRepo.create === "function") {
        try {
          entidad = await entidadRepo.create({ nombre: sede, tipo: DEFAULT_ENTIDAD_TIPO });
        } catch (createError) {
          if (typeof entidadRepo.findByNombreNormalized === "function") {
            entidad = await entidadRepo.findByNombreNormalized(sede);
          }
        }
      }
      if (entidad) {
        entidadNameCache.set(key, entidad);
        return { entidadId: Number(entidad.id) || null, entidadNombre: entidad.nombre || sede };
      }

      return { entidadId: null, entidadNombre: sede };
    };
    const usecase = new CrearActivo(repo, logUseCase);
    const errores = [];
    const duplicados = [];
    let creados = 0;
    const existentes = await repo.findAll();
    const existingActivos = new Set(
      (Array.isArray(existentes) ? existentes : [])
        .map((item) => normalizeActivoKey(item?.activo))
        .filter(Boolean)
    );
    const seenActivos = new Set();

    for (let index = 0; index < activosImport.length; index += 1) {
      const raw = activosImport[index];
      const payload = normalizeImportPayload(raw, fallbackEntidadImport);
      const fila = index + 2;

      const resolvedEntidad = await resolveEntidadIdFromPayload(payload);
      if (resolvedEntidad.entidadId) {
        payload.entidad_id = resolvedEntidad.entidadId;
      }
      if (resolvedEntidad.entidadNombre) {
        payload.sede = resolvedEntidad.entidadNombre;
      }

      if (!payload.entidad_id) {
        errores.push({ fila, mensaje: "Entidad no valida o no enviada" });
        continue;
      }

      if (allowedEntityIds !== null && !allowedEntityIds.includes(Number(payload.entidad_id))) {
        errores.push({ fila, mensaje: "No tienes acceso a la entidad de esta fila" });
        continue;
      }

      if ((!payload.activo && !payload.nombre) || !payload.equipo) {
        errores.push({ fila, mensaje: "Campos obligatorios incompletos (activo/nombre y equipo)" });
        continue;
      }

      if (isAdmin) {
        addAreasToMap(pendingAreasByEntidad, payload.entidad_id, payload.areaPrincipal, payload.areaSecundaria);
      }
      const activoKey = normalizeActivoKey(payload?.activo);
      if (activoKey && (existingActivos.has(activoKey) || seenActivos.has(activoKey))) {
        duplicados.push({ fila, mensaje: "Duplicado por numero de activo" });
        continue;
      }

      try {
        await usecase.execute(payload, req.user.id);
        if (activoKey) {
          seenActivos.add(activoKey);
          existingActivos.add(activoKey);
        }
        creados += 1;
      } catch (rowError) {
        const message = rowError?.message || "No se pudo crear el activo";
        const messageText = typeof message === "string" ? message.toLowerCase() : "";
        const isActivoDuplicate = Boolean(
          activoKey &&
          (
            messageText.includes("activos_numeroreporte_key") ||
            messageText.includes("numeroreporte") ||
            messageText.includes("activos_activo_key") ||
            messageText.includes("activo_key")
          )
        );
        if (isActivoDuplicate) {
          duplicados.push({ fila, mensaje: "Duplicado por numero de activo" });
          if (activoKey) {
            seenActivos.add(activoKey);
            existingActivos.add(activoKey);
          }
          continue;
        }
        errores.push({
          fila,
          mensaje: message
        });
      }
    }

    if (
      isAdmin &&
      pendingAreasByEntidad.size > 0 &&
      typeof entidadRepo.getAreasByEntidad === "function" &&
      typeof entidadRepo.setAreasByEntidad === "function"
    ) {
      for (const [entidadId, areas] of pendingAreasByEntidad.entries()) {
        const currentAreas = await entidadRepo.getAreasByEntidad(entidadId);
        const primarias = Array.isArray(currentAreas?.areas_primarias) ? currentAreas.areas_primarias : [];
        const secundarias = Array.isArray(currentAreas?.areas_secundarias) ? currentAreas.areas_secundarias : [];
        const mergedPrimarias = [...primarias, ...areas.primarias];
        const mergedSecundarias = [...secundarias, ...areas.secundarias];
        const shouldUpdate = mergedPrimarias.length > primarias.length || mergedSecundarias.length > secundarias.length;
        if (shouldUpdate) {
          await entidadRepo.setAreasByEntidad(entidadId, {
            areas_primarias: mergedPrimarias,
            areas_secundarias: mergedSecundarias
          });
        }
      }
    }

    const total = activosImport.length;
    const message =
      errores.length > 0
        ? `Importacion parcial: ${creados} creados, ${duplicados.length} duplicados omitidos, ${errores.length} errores de ${total}`
        : `Importacion completada: ${creados} creados, ${duplicados.length} duplicados omitidos de ${total}`;

    return success(res, {
      total,
      creados,
      omitidos_duplicados: duplicados.length,
      duplicados,
      errores
    }, message, 201);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function editarActivo(req, res) {
  if (process.env.NODE_ENV === "test") {
    const store = getTestStore();
    const id = Number(req.params.id);
    const index = store.activos.findIndex((a) => a.id === id);

    if (index === -1) {
      return error(res, "Activo no existe", 404);
    }

    store.activos[index] = { ...store.activos[index], ...req.body };
    return success(res, store.activos[index], "Activo actualizado");
  }

  try {
    const incomingActivoKey = normalizeActivoKey(req.body?.activo);
    if (incomingActivoKey && typeof repo.findAll === "function") {
      const existentes = await repo.findAll();
      const duplicated = (Array.isArray(existentes) ? existentes : []).some((item) => {
        if (Number(item?.id) === Number(req.params.id)) return false;
        return normalizeActivoKey(item?.activo) === incomingActivoKey;
      });
      if (duplicated) {
        return error(res, "El numero de activo ya existe", 400);
      }
    }

    const allowedEntityIds = await getAllowedEntityIds(req);
    if (allowedEntityIds !== null && typeof repo.findById === "function") {
      const actual = await repo.findById(req.params.id);
      if (!actual || !allowedEntityIds.includes(Number(actual?.entidad_id))) {
        return error(res, "No tienes acceso a ese activo", 403);
      }

      const requestedEntidadId = Number(req.body?.entidad_id ?? actual?.entidad_id);
      if (!allowedEntityIds.includes(requestedEntidadId)) {
        return error(res, "No puedes mover el activo a una entidad no asignada", 403);
      }
    }

    const usecase = new EditarActivo(repo, logUseCase);
    const activo = await usecase.execute(req.params.id, req.body, req.user.id);
    return success(res, activo, "Activo actualizado");
  } catch (e) {
    return error(res, e.message);
  }
}

export async function eliminarActivo(req, res) {
  if (process.env.NODE_ENV === "test") {
    const store = getTestStore();
    const id = Number(req.params.id);
    store.activos = store.activos.filter((a) => a.id !== id);
    return success(res, {}, "Activo eliminado");
  }

  try {
    const allowedEntityIds = await getAllowedEntityIds(req);
    if (allowedEntityIds !== null && typeof repo.findById === "function") {
      const actual = await repo.findById(req.params.id);
      if (!actual || !allowedEntityIds.includes(Number(actual?.entidad_id))) {
        return error(res, "No tienes acceso a ese activo", 403);
      }
    }

    const usecase = new EliminarActivo(repo, logUseCase);
    await usecase.execute(req.params.id, req.user.id);
    return success(res, {}, "Activo eliminado");
  } catch (e) {
    return error(res, e.message);
  }
}
