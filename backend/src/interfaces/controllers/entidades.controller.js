import CrearEntidad from "../../application/entidades/CrearEntidad.js";
import ListarEntidades from "../../application/entidades/ListarEntidades.js";
import ObtenerEntidad from "../../application/entidades/ObtenerEntidad.js";
import EditarEntidad from "../../application/entidades/EditarEntidad.js";
import EliminarEntidad from "../../application/entidades/EliminarEntidad.js";

import EntidadPgRepository from "../../infrastructure/repositories/EntidadPgRepository.js";
import LogPgRepository from "../../infrastructure/repositories/LogPgRepository.js";
import RegistrarLog from "../../application/auditoria/RegistrarLog.js";

import { success, error } from "../../utils/response.js";

const repo = new EntidadPgRepository();
const logUseCase = new RegistrarLog(new LogPgRepository());
const extractEntityPayload = (body = {}) => ({
  nombre: body.nombre,
  tipo: body.tipo,
  direccion: body.direccion
});

const normalizeAreaList = (raw) => {
  if (Array.isArray(raw)) {
    return [...new Set(raw
      .map((item) => String(item || "").trim().toUpperCase())
      .filter(Boolean))];
  }

  if (typeof raw === "string") {
    return [...new Set(raw
      .split(/[\n,;]+/)
      .map((item) => String(item || "").trim().toUpperCase())
      .filter(Boolean))];
  }

  return [];
};

const extractAreasPayload = (body = {}) => {
  const hasPrimarias = body.areas_primarias !== undefined;
  const hasSecundarias = body.areas_secundarias !== undefined;

  if (!hasPrimarias && !hasSecundarias) {
    return null;
  }

  return {
    areas_primarias: normalizeAreaList(body.areas_primarias),
    areas_secundarias: normalizeAreaList(body.areas_secundarias)
  };
};

const attachAreasToEntity = async (entidad) => {
  if (!entidad) return entidad;
  if (typeof repo.getAreasByEntidad !== "function") {
    return entidad;
  }

  const areas = await repo.getAreasByEntidad(entidad.id);
  return {
    ...entidad,
    areas_primarias: Array.isArray(areas?.areas_primarias) ? areas.areas_primarias : [],
    areas_secundarias: Array.isArray(areas?.areas_secundarias) ? areas.areas_secundarias : []
  };
};

export async function listarEntidades(req, res) {
  try {
    const usecase = new ListarEntidades(repo);
    const entidades = await usecase.execute();
    const enriched = await Promise.all(
      (Array.isArray(entidades) ? entidades : []).map((entidad) => attachAreasToEntity(entidad))
    );
    return success(res, enriched);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function crearEntidad(req, res) {
  try {
    const usecase = new CrearEntidad(repo, logUseCase);
    const entidad = await usecase.execute(extractEntityPayload(req.body), req.user.id);
    const areasPayload = extractAreasPayload(req.body);
    if (areasPayload && typeof repo.setAreasByEntidad === "function") {
      await repo.setAreasByEntidad(entidad.id, areasPayload);
    }

    const entityResponse = await attachAreasToEntity(entidad);
    return success(res, entityResponse, "Entidad creada correctamente", 201);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function obtenerEntidad(req, res) {
  try {
    const usecase = new ObtenerEntidad(repo);
    const entidad = await usecase.execute(req.params.id);
    const entityResponse = await attachAreasToEntity(entidad);
    return success(res, entityResponse);
  } catch (e) {
    return error(res, e.message, e.message === "Entidad no existe" ? 404 : 400);
  }
}

export async function editarEntidad(req, res) {
  try {
    const usecase = new EditarEntidad(repo, logUseCase);
    const entidad = await usecase.execute(
      req.params.id,
      extractEntityPayload(req.body),
      req.user?.id
    );
    const areasPayload = extractAreasPayload(req.body);
    if (areasPayload && typeof repo.setAreasByEntidad === "function") {
      await repo.setAreasByEntidad(req.params.id, areasPayload);
    }

    const entityResponse = await attachAreasToEntity(entidad);
    return success(res, entityResponse, "Entidad actualizada");
  } catch (e) {
    return error(res, e.message, e.message === "Entidad no existe" ? 404 : 400);
  }
}

export async function eliminarEntidad(req, res) {
  try {
    const usecase = new EliminarEntidad(repo, logUseCase);
    await usecase.execute(req.params.id, req.user?.id);
    return success(res, {}, "Entidad eliminada");
  } catch (e) {
    return error(res, e.message, e.message === "Entidad no existe" ? 404 : 400);
  }
}
