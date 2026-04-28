import UsuarioPgRepository from "../../infrastructure/repositories/UsuarioPgRepository.js";
import PermisoPgRepository from "../../infrastructure/repositories/PermisoPgRepository.js";
import LogPgRepository from "../../infrastructure/repositories/LogPgRepository.js";
import RegistrarLog from "../../application/auditoria/RegistrarLog.js";
import { success, error } from "../../utils/response.js";
import hashUtil from "../../utils/hash.js";
import {
  buildPasswordPolicyMessage,
  generateStrongPassword,
  validatePassword
} from "../../utils/passwordPolicy.js";
import {
  assertPasswordNotReused,
  loadRecentPasswordHashes
} from "../../utils/passwordSecurity.js";

const repo = new UsuarioPgRepository();
const permisoRepo = new PermisoPgRepository();
const logUseCase = new RegistrarLog(new LogPgRepository());

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
};

const generarClaveTemporal = () => generateStrongPassword(16);

const construirUsuarioRespuesta = async (user) => {
  const safeUser = sanitizeUser(user);
  if (!safeUser) return null;

  const userResponse = { ...safeUser };

  let debeCambiarPassword = false;
  if (typeof repo.getDebeCambiarPassword === "function") {
    debeCambiarPassword = await repo.getDebeCambiarPassword(safeUser.id);
  }
  if (debeCambiarPassword) {
    userResponse.debe_cambiar_password = true;
  }

  let permisosPersonalizados = null;
  if (typeof permisoRepo.getPermisosByUsuario === "function") {
    permisosPersonalizados = await permisoRepo.getPermisosByUsuario(safeUser.id);
  }
  if (Array.isArray(permisosPersonalizados) && permisosPersonalizados.length) {
    userResponse.permisos_personalizados = permisosPersonalizados;
  }

  if (typeof repo.getEntidadesByUsuario === "function") {
    const entidadesAsignadas = await repo.getEntidadesByUsuario(safeUser.id);
    userResponse.entidades_asignadas = Array.isArray(entidadesAsignadas) ? entidadesAsignadas : [];
  }

  return userResponse;
};

export async function crearUsuario(req, res) {
  try {
    const data = req.body || {};
    const nombre = String(data.nombre || "").trim().toUpperCase();
    const email = String(data.email || "").trim().toLowerCase();
    const rolId = Number(data.rol_id) || 3;
    const temporal = data.temporal !== false;

    let passwordPlano = String(data.password || "").trim();
    if (!passwordPlano && temporal) {
      passwordPlano = generarClaveTemporal();
    }

    if (!passwordPlano) {
      return error(res, "La contraseña es requerida", 400);
    }

    const passwordValidation = validatePassword(passwordPlano);
    if (!passwordValidation.valid) {
      return error(res, buildPasswordPolicyMessage(), 400);
    }

    const hashedPassword = await hashUtil.hash(passwordPlano);
    const entidadesAsignadas = Array.isArray(data.entidades_asignadas)
      ? data.entidades_asignadas
      : [];

    const user = await repo.create({
      nombre,
      email,
      password: hashedPassword,
      rol_id: rolId
    });

    if (typeof repo.setDebeCambiarPassword === "function") {
      await repo.setDebeCambiarPassword(user.id, temporal);
    }

    if (Array.isArray(data.permisos) && typeof permisoRepo.setPermisosByUsuario === "function") {
      await permisoRepo.setPermisosByUsuario(user.id, data.permisos);
    }

    if (typeof repo.setEntidadesByUsuario === "function") {
      await repo.setEntidadesByUsuario(user.id, entidadesAsignadas);
    }

    await logUseCase.execute({
      usuarioId: req.user.id,
      accion: "CREAR",
      entidad: "USUARIO",
      entidadId: user.id,
      detalles: { email: user.email }
    });

    const userResponse = await construirUsuarioRespuesta(user);
    if (temporal) {
      userResponse.clave_temporal = passwordPlano;
    }

    return success(res, userResponse, "Usuario creado", 201);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function listarUsuarios(req, res) {
  try {
    const usuarios = await repo.findAll();
    const enriched = await Promise.all(
      usuarios.map((usuario) => construirUsuarioRespuesta(usuario))
    );
    return success(res, enriched);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function editarUsuario(req, res) {
  try {
    const userId = Number(req.params.id);
    const data = { ...(req.body || {}) };
    const entidadesPayload = data.entidades_asignadas;
    delete data.entidades_asignadas;

    if (data.password !== undefined) {
      const candidatePassword = String(data.password || "").trim();
      if (candidatePassword) {
        const currentUser = await repo.findById(userId);
        if (!currentUser) {
          return error(res, "Usuario no encontrado", 404);
        }

        const passwordValidation = validatePassword(candidatePassword);
        if (!passwordValidation.valid) {
          return error(res, buildPasswordPolicyMessage(), 400);
        }

        const previousPasswordHashes = await loadRecentPasswordHashes(repo, userId);
        await assertPasswordNotReused({
          candidatePassword,
          currentPasswordHash: currentUser.password,
          previousPasswordHashes,
          hashService: hashUtil
        });

        data.password = await hashUtil.hash(candidatePassword);
      } else {
        delete data.password;
      }
    }

    if (data.email) {
      data.email = String(data.email).trim().toLowerCase();
    }

    if (data.nombre) {
      data.nombre = String(data.nombre).trim().toUpperCase();
    }

    const user = await repo.update(userId, data);

    if (data.temporal !== undefined && typeof repo.setDebeCambiarPassword === "function") {
      await repo.setDebeCambiarPassword(userId, Boolean(data.temporal));
    }

    if (Array.isArray(data.permisos) && typeof permisoRepo.setPermisosByUsuario === "function") {
      await permisoRepo.setPermisosByUsuario(userId, data.permisos);
    }

    if (data.permisos === null && typeof permisoRepo.clearPermisosByUsuario === "function") {
      await permisoRepo.clearPermisosByUsuario(userId);
    }

    if (entidadesPayload !== undefined && typeof repo.setEntidadesByUsuario === "function") {
      const entidadesFinales = Array.isArray(entidadesPayload) ? entidadesPayload : [];
      await repo.setEntidadesByUsuario(userId, entidadesFinales);
    }

    await logUseCase.execute({
      usuarioId: req.user.id,
      accion: "EDITAR",
      entidad: "USUARIO",
      entidadId: user?.id || userId,
      detalles: { email: user?.email }
    });

    const userResponse = await construirUsuarioRespuesta(user || { id: userId });
    return success(res, userResponse, "Usuario actualizado");
  } catch (e) {
    return error(res, e.message);
  }
}

export async function eliminarUsuario(req, res) {
  try {
    const userId = Number(req.params.id);

    if (Number(req.user.id) === userId) {
      return error(res, "No puedes eliminar tu propio usuario", 400);
    }

    const user = await repo.findById(userId);
    await repo.delete(userId);

    await logUseCase.execute({
      usuarioId: req.user.id,
      accion: "ELIMINAR",
      entidad: "USUARIO",
      entidadId: userId,
      detalles: { email: user?.email }
    });

    return success(res, {}, "Usuario eliminado");
  } catch (e) {
    return error(res, e.message);
  }
}

export async function obtenerUsuario(req, res) {
  try {
    const user = await repo.findById(req.params.id);
    const userResponse = await construirUsuarioRespuesta(user);
    return success(res, userResponse);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function listarRoles(req, res) {
  try {
    const roles = await repo.findRoles();
    return success(res, roles);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function listarCatalogoPermisos(req, res) {
  try {
    const permisos = await permisoRepo.getPermisosCatalogo();
    return success(res, permisos);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function actualizarPermisosUsuario(req, res) {
  try {
    const userId = Number(req.params.id);
    const permisos = req.body?.permisos;

    if (!Array.isArray(permisos)) {
      return error(res, "permisos debe ser un arreglo", 400);
    }

    const usuarioObjetivo = await repo.findById(userId);
    if (!usuarioObjetivo) {
      return error(res, "Usuario no existe", 404);
    }

    const permisosAntes = await permisoRepo.getPermisosByUsuario(userId);
    const permisosActualizados = await permisoRepo.setPermisosByUsuario(userId, permisos);

    await logUseCase.execute({
      usuarioId: req.user.id,
      accion: "ACTUALIZAR_PERMISOS",
      entidad: "USUARIO",
      entidadId: userId,
      detalles: {
        actor: {
          id: req.user?.id ?? null,
          nombre: req.user?.nombre ?? null,
          email: req.user?.email ?? null
        },
        objetivo: {
          id: usuarioObjetivo.id,
          nombre: usuarioObjetivo.nombre,
          email: usuarioObjetivo.email,
          rol_id: usuarioObjetivo.rol_id
        },
        permisos_antes: Array.isArray(permisosAntes) ? permisosAntes : [],
        permisos_despues: permisosActualizados
      }
    });

    const user = await repo.findById(userId);
    const userResponse = await construirUsuarioRespuesta(user);
    return success(res, userResponse, "Permisos actualizados");
  } catch (e) {
    return error(res, e.message);
  }
}
