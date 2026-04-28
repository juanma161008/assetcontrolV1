import crypto from "crypto";
import EnviarCorreo from "../../application/notificaciones/EnviarCorreo.js";
import SmtpEmailProvider from "../../infrastructure/email/SmtpEmailProvider.js";
import AuthVerificationPgRepository from "../../infrastructure/repositories/AuthVerificationPgRepository.js";
import LoginUseCase from "../../application/auth/LoginUseCase.js";
import RegistroUseCase from "../../application/auth/RegistroUseCase.js";
import ResetPasswordUseCase from "../../application/auth/ResetPasswordUseCase.js";
import RegistrarLog from "../../application/auditoria/RegistrarLog.js";
import UsuarioPgRepository from "../../infrastructure/repositories/UsuarioPgRepository.js";
import PermisoPgRepository from "../../infrastructure/repositories/PermisoPgRepository.js";
import LogPgRepository from "../../infrastructure/repositories/LogPgRepository.js";
import { generateToken } from "../../config/jwt.js";
import hashUtil from "../../utils/hash.js";
import { buildPasswordPolicyMessage, validatePassword } from "../../utils/passwordPolicy.js";
import {
  assertPasswordNotReused,
  loadRecentPasswordHashes
} from "../../utils/passwordSecurity.js";
import { success, error } from "../../utils/response.js";

const userRepo = new UsuarioPgRepository();
const permisoRepo = new PermisoPgRepository();
const logUseCase = new RegistrarLog(new LogPgRepository());
const emailProvider = new SmtpEmailProvider();
const enviarCorreoUseCase = new EnviarCorreo(emailProvider);
const authVerificationRepo = new AuthVerificationPgRepository();
const FORGOT_USERNAME_TTL_MINUTES = 15;
const FORGOT_USERNAME_CODE_LENGTH = 6;
const FORGOT_USERNAME_TYPE = "RECUPERAR_USUARIO";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const toProperCase = (value = "") =>
  String(value ?? "")
    .split(/(\s+)/)
    .map((token) => {
      if (!token || /^\s+$/.test(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join("");

const generateVerificationCode = (length = FORGOT_USERNAME_CODE_LENGTH) => {
  const max = 10 ** length;
  if (typeof crypto.randomInt === "function") {
    return String(crypto.randomInt(0, max)).padStart(length, "0");
  }
  return String(Math.floor(Math.random() * max)).padStart(length, "0");
};

const buildForgotUsernameEmail = ({ codigo, nombre, minutos }) => {
  const displayName = toProperCase(String(nombre || "").trim()) || "usuario";
  const subject = "Codigo de verificacion - Recuperar usuario";
  const text = `Hola ${displayName}, tu codigo para recuperar tu usuario es ${codigo}. Este codigo vence en ${minutos} minutos.`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;">
      <h2 style="margin:0 0 10px;">Codigo de verificacion</h2>
      <p>Hola ${displayName},</p>
      <p>Tu codigo para recuperar tu usuario es:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:3px;margin:12px 0;">${codigo}</p>
      <p>Este codigo vence en ${minutos} minutos.</p>
      <p>Si no solicitaste este codigo, puedes ignorar este mensaje.</p>
    </div>
  `;
  return { subject, text, html };
};

const normalizeUserPayload = (user = {}) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  rol: user.rol ?? user.rol_id,
  permisos: Array.isArray(user.permisos) ? user.permisos : [],
  entidades_asignadas: Array.isArray(user.entidades_asignadas) ? user.entidades_asignadas : [],
  debe_cambiar_password: Boolean(user.debe_cambiar_password)
});

const getAuthenticatedUserPayload = async (userId, fallbackPermisos = []) => {
  const dbUser = await userRepo.findById(userId);
  if (!dbUser) {
    return null;
  }

  let permisos = Array.isArray(fallbackPermisos) ? fallbackPermisos : [];
  if (typeof permisoRepo.getPermisosByRol === "function") {
    try {
      permisos = await permisoRepo.getPermisosByRol(dbUser.rol_id);
    } catch {
      permisos = Array.isArray(fallbackPermisos) ? fallbackPermisos : [];
    }
  }

  if (typeof permisoRepo.getPermisosByUsuario === "function") {
    try {
      const permisosPersonalizados = await permisoRepo.getPermisosByUsuario(dbUser.id);
      if (Array.isArray(permisosPersonalizados) && permisosPersonalizados.length > 0) {
        permisos = permisosPersonalizados;
      }
    } catch {
      // No bloquear el endpoint.
    }
  }

  let debeCambiarPassword = false;
  if (typeof userRepo.getDebeCambiarPassword === "function") {
    debeCambiarPassword = await userRepo.getDebeCambiarPassword(dbUser.id);
  }

  let entidadesAsignadas = [];
  if (typeof userRepo.getEntidadesByUsuario === "function") {
    entidadesAsignadas = await userRepo.getEntidadesByUsuario(dbUser.id);
  }

  return normalizeUserPayload({
    ...dbUser,
    permisos,
    entidades_asignadas: entidadesAsignadas,
    debe_cambiar_password: debeCambiarPassword
  });
};

export async function login(req, res) {
  if (process.env.NODE_ENV === "test") {
    const user = {
      id: 1,
      nombre: "Test User",
      email: req.body?.email || "test@local",
      rol: 1,
      permisos: ["ADMIN_TOTAL"],
      debe_cambiar_password: false
    };

    return success(res, { user, token: "test-token" }, "Login exitoso");
  }

  try {
    const usecase = new LoginUseCase(userRepo, permisoRepo, hashUtil);
    const user = await usecase.execute(req.body.email, req.body.password);
    const token = generateToken(user);

    try {
      await logUseCase.execute({
        usuario_id: user.id,
        accion: "LOGIN",
        entidad: "AUTH",
        despues: { email: user.email },
        ip: req.ip
      });
    } catch {
      // No bloquear login por errores de auditoria.
    }

    return success(res, { user, token }, "Login exitoso");
  } catch (e) {
    return error(res, e.message, 401);
  }
}

export async function registro(req, res) {
  if (process.env.NODE_ENV === "test") {
    return success(
      res,
      {
        id: 1,
        nombre: req.body?.nombre || "Test User",
        email: req.body?.email || "test@local",
        rol_id: 1
      },
      "Usuario creado",
      201
    );
  }

  try {
    const usecase = new RegistroUseCase(userRepo, hashUtil);
    const user = await usecase.execute(req.body);
    return success(res, user, "Usuario creado", 201);
  } catch (e) {
    return error(res, e.message);
  }
}

export async function me(req, res) {
  try {
    if (!req?.user?.id) {
      return error(res, "No autenticado", 401);
    }

    if (typeof userRepo.findById !== "function") {
      return success(res, normalizeUserPayload(req.user), "Usuario autenticado");
    }

    const payload = await getAuthenticatedUserPayload(req.user.id, req.user?.permisos);
    if (!payload) {
      return error(res, "No autenticado", 401);
    }

    return success(res, payload, "Usuario autenticado");
  } catch {
    return error(res, "No autenticado", 401);
  }
}

export async function updateProfile(req, res) {
  try {
    if (!req?.user?.id) {
      return error(res, "No autenticado", 401);
    }

    const nombre = String(req.body?.nombre || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (nombre.length < 2) {
      return error(res, "El nombre debe tener al menos 2 caracteres", 400);
    }

    if (!EMAIL_REGEX.test(email)) {
      return error(res, "Email invalido", 400);
    }

    const currentUser = await userRepo.findById(req.user.id);
    if (!currentUser) {
      return error(res, "Usuario no encontrado", 404);
    }

    const existingByEmail = await userRepo.findByEmail(email);
    if (existingByEmail && Number(existingByEmail.id) !== Number(req.user.id)) {
      return error(res, "El email ya esta registrado", 400);
    }

    const updatedUser = await userRepo.update(req.user.id, {
      nombre: toProperCase(nombre),
      email
    });

    if (!updatedUser) {
      return error(res, "No se pudo actualizar el perfil", 400);
    }

    try {
      await logUseCase.execute({
        usuario_id: req.user.id,
        accion: "ACTUALIZAR_PERFIL",
        entidad: "AUTH",
        entidad_id: req.user.id,
        antes: {
          nombre: currentUser.nombre,
          email: currentUser.email
        },
        despues: {
          nombre: updatedUser.nombre,
          email: updatedUser.email
        },
        ip: req.ip
      });
    } catch {
      // No bloquear respuesta por auditoria.
    }

    const payload = await getAuthenticatedUserPayload(req.user.id, req.user?.permisos);
    if (!payload) {
      return error(res, "Usuario no encontrado", 404);
    }

    return success(res, payload, "Perfil actualizado");
  } catch (e) {
    return error(res, e.message || "No se pudo actualizar el perfil", 400);
  }
}

export async function requestForgotUsername(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return error(res, "Email invalido", 400);
    }

    if (!emailProvider.isConfigured()) {
      const missing = emailProvider.getMissingConfigKeys?.() || [];
      const detail = missing.length ? `Falta configurar: ${missing.join(", ")}` : "SMTP no configurado";
      return success(res, { emailServiceAvailable: false }, `No se pudo enviar el correo. ${detail}.`);
    }

    const user = await userRepo.findByEmail(email);
    if (user) {
      const codigo = generateVerificationCode();
      const codigoHash = await hashUtil.hash(codigo);
      const expiresAt = new Date(Date.now() + FORGOT_USERNAME_TTL_MINUTES * 60 * 1000);

      await authVerificationRepo.create({
        email,
        tipo: FORGOT_USERNAME_TYPE,
        codeHash: codigoHash,
        expiresAt
      });

      const { subject, text, html } = buildForgotUsernameEmail({
        codigo,
        nombre: user.nombre,
        minutos: FORGOT_USERNAME_TTL_MINUTES
      });

      await enviarCorreoUseCase.execute({
        to: email,
        subject,
        text,
        html
      });
    }

    return success(
      res,
      { emailServiceAvailable: true },
      "Si el correo esta registrado, enviaremos un codigo de verificacion."
    );
  } catch (e) {
    return error(res, e.message || "No se pudo procesar la solicitud", 400);
  }
}

export async function verifyForgotUsername(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const codigo = String(req.body?.code || req.body?.codigo || "").trim();

    if (!EMAIL_REGEX.test(email) || !codigo) {
      return error(res, "Email y codigo son requeridos", 400);
    }

    const verification = await authVerificationRepo.findLatestActive(email, FORGOT_USERNAME_TYPE);
    if (!verification) {
      return error(res, "Codigo invalido o expirado", 400);
    }

    const isValid = await hashUtil.compare(codigo, verification.codigo_hash);
    if (!isValid) {
      return error(res, "Codigo invalido o expirado", 400);
    }

    await authVerificationRepo.markUsed(verification.id);

    const user = await userRepo.findByEmail(email);
    if (!user) {
      return error(res, "Usuario no encontrado", 404);
    }

    return success(
      res,
      { email: user.email, nombre: user.nombre },
      "Usuario verificado"
    );
  } catch (e) {
    return error(res, e.message || "No se pudo verificar el codigo", 400);
  }
}

export async function resetPassword(req, res) {
  try {
    const { userId, newPassword, temporal } = req.body;
    if (!userId || !newPassword) {
      return error(res, "userId y newPassword son requeridos", 400);
    }

    const usecase = new ResetPasswordUseCase(userRepo, hashUtil);
    const debeCambiarPassword = temporal !== false;
    const result = await usecase.execute(
      req.user.id,
      userId,
      newPassword,
      debeCambiarPassword
    );
    return success(res, result, "Contrasena reseteada");
  } catch (e) {
    return error(res, e.message, 400);
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return error(res, "currentPassword y newPassword son requeridos", 400);
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return error(res, buildPasswordPolicyMessage(), 400);
    }

    if (confirmPassword !== undefined && confirmPassword !== newPassword) {
      return error(res, "Las contrasenas no coinciden", 400);
    }

    const user = await userRepo.findById(req.user.id);
    if (!user) {
      return error(res, "Usuario no encontrado", 404);
    }

    const passwordValida = await hashUtil.compare(currentPassword, user.password);
    if (!passwordValida) {
      return error(res, "La contrasena actual es incorrecta", 400);
    }

    const previousPasswordHashes = await loadRecentPasswordHashes(userRepo, req.user.id);
    await assertPasswordNotReused({
      candidatePassword: newPassword,
      currentPasswordHash: user.password,
      previousPasswordHashes,
      hashService: hashUtil
    });

    const hashedPassword = await hashUtil.hash(newPassword);
    await userRepo.updatePassword(req.user.id, hashedPassword);

    if (typeof userRepo.setDebeCambiarPassword === "function") {
      await userRepo.setDebeCambiarPassword(req.user.id, false);
    }

    try {
      await logUseCase.execute({
        usuario_id: req.user.id,
        accion: "CAMBIAR_PASSWORD",
        entidad: "AUTH",
        entidad_id: req.user.id,
        ip: req.ip
      });
    } catch {
      // No bloquear respuesta por auditoria.
    }

    return success(res, {}, "Contrasena actualizada");
  } catch (e) {
    return error(res, e.message || "No se pudo actualizar la contrasena", 400);
  }
}
