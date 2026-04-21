// Servicio de autenticación

import httpClient from './httpClient';

const USER_KEY = 'user';
const SESSION_KEY = 'session';
const LAST_ACTIVITY_KEY = 'lastActivity';
const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 30;

const parseTimeoutFromEnv = () => {
  try {
    const raw = Number(import.meta.env.VITE_INACTIVITY_TIMEOUT_MINUTES);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INACTIVITY_TIMEOUT_MINUTES;
  } catch {
    return DEFAULT_INACTIVITY_TIMEOUT_MINUTES;
  }
};

export const INACTIVITY_TIMEOUT_MINUTES = parseTimeoutFromEnv();
export const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;

/**
 * Obtener la sesión actual del usuario
 */
export function getSession() {
  try {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch {
    // Error getting session - removed console.error for SonarQube
    return null;
  }
}

/**
 * Guardar sesión de usuario
 */
export function setSession(userData) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  } catch {
    // Error setting session - removed console.error for SonarQube
  }
}

/**
 * Verificar si el usuario está autenticado
 */
export function isAuthenticated() {
  const session = getSession();
  if (!session?.token) return false;

  if (isSessionExpired()) {
    clearSession();
    return false;
  }

  return true;
}

/**
 * Obtener el token de autenticación
 */
export function getToken() {
  const session = getSession();
  return session?.token || null;
}

/**
 * Limpiar sesión del usuario
 */
export function clearSession() {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    // Error clearing session - removed console.error for SonarQube
  }
}

/**
 * Obtener información del usuario actual
 */
export function getCurrentUser() {
  const session = getSession();
  return session?.user || null;
}

/**
 * Actualizar tiempo de última actividad
 */
export function updateLastActivity() {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch {
    // Error updating last activity - removed console.error for SonarQube
  }
}

export function getLastActivity() {
  try {
    const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function isSessionExpired(referenceTime = Date.now()) {
  const lastActivity = getLastActivity();
  if (!lastActivity) return false;
  return referenceTime - lastActivity >= INACTIVITY_TIMEOUT_MS;
}

/**
 * Login de usuario
 */
export async function login(email, password) {
  try {
    const response = await httpClient.post('/api/auth/login', { email, password });
    const { user, token } = response.data.data;
    setSession({ user, token });
    updateLastActivity();
    return { success: true, user, token };
  } catch (error) {
    return { success: false, error: error?.response?.data?.message || 'Error en login' };
  }
}

/**
 * Registro de usuario
 */
export async function register(userData) {
  try {
    const response = await httpClient.post('/api/auth/registro', userData);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error?.response?.data?.message || 'Error en registro' };
  }
}

/**
 * Obtener información del usuario actual desde el servidor
 */
export async function fetchCurrentUser() {
  try {
    const response = await httpClient.get('/api/auth/me');
    const user = response.data.data;
    const session = getSession() || {};
    setSession({ ...session, user });
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error?.response?.data?.message || 'Error obteniendo usuario' };
  }
}

/**
 * Resetear contraseña (solo para admins)
 */
export async function resetPassword(userId, newPassword, temporal) {
  try {
    const payload = { userId, newPassword };
    if (temporal !== undefined) {
      payload.temporal = temporal;
    }
    const response = await httpClient.post('/api/auth/reset-password', payload);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error?.response?.data?.message || 'Error reseteando contrasena' };
  }
}

/**
 * Solicitar recuperacion de usuario por correo
 */
export async function requestUsernameRecovery(email) {
  try {
    const response = await httpClient.post('/api/auth/forgot-username/request', { email });
    return { success: true, data: response.data, message: response.data?.message };
  } catch (error) {
    return {
      success: false,
      error: error?.response?.data?.message || 'Error solicitando recuperacion de usuario'
    };
  }
}

/**
 * Verificar codigo de recuperacion de usuario
 */
export async function verifyUsernameRecovery(email, code) {
  try {
    const response = await httpClient.post('/api/auth/forgot-username/verify', { email, code });
    return { success: true, data: response.data, message: response.data?.message };
  } catch (error) {
    return {
      success: false,
      error: error?.response?.data?.message || 'Error verificando el codigo'
    };
  }
}

/**
 * Cambiar contraseña del usuario autenticado
 */
export async function changePassword(currentPassword, newPassword, confirmPassword) {
  try {
    const response = await httpClient.post('/api/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error?.response?.data?.message || 'Error cambiando contraseña' };
  }
}

/**
 * Actualizar nombre y correo del usuario autenticado
 */
export async function updateProfile(nombre, email) {
  try {
    const response = await httpClient.put('/api/auth/me', { nombre, email });
    const user = response.data.data;
    if (user) {
      const session = getSession() || {};
      setSession({ ...session, user });
    }
    return { success: true, user, data: response.data };
  } catch (error) {
    return { success: false, error: error?.response?.data?.message || 'Error actualizando perfil' };
  }
}

/**
 * Actualizar datos del usuario en sesion
 */
export function updateCurrentUser(nextUser) {
  const session = getSession();
  if (!session?.token) return;
  setSession({
    ...session,
    user: {
      ...(session.user || {}),
      ...(nextUser || {})
    }
  });
}

/**
 * Logout
 */
export function logout() {
  clearSession();
  globalThis.location.href = "/login";
}
