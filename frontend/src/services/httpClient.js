import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getToken, clearSession } from './authService';

// Crear instancia de axios con configuración base
const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const shouldSkipErrorLog = (config = {}) => {
  if (config?.skipErrorLog) return true;
  const url = String(config?.url || "");
  return url.includes("/api/auditoria/errores");
};

const shouldSkipAuthRedirect = (config = {}) => Boolean(config?.skipAuthRedirect);

// Interceptor de solicitudes
httpClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de respuestas
httpClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (axios.isCancel?.(error) || error?.code === "ERR_CANCELED") {
      return Promise.reject(error);
    }

    // Manejar errores de autenticación
    if (error.response?.status === 401 && !shouldSkipAuthRedirect(error.config)) {
      // Token expirado o inválido
      clearSession();
      globalThis.location.href = "/login";
    }

    const status = error.response?.status ?? null;
    const shouldLog = !shouldSkipErrorLog(error.config) && (status === null || status >= 500);
    if (shouldLog) {
      const payload = {
        mensaje: error.response?.data?.message || error.message || "Error de solicitud",
        detalle: error.response?.data || null,
        origen: "frontend",
        contexto: {
          url: error.config?.url || null,
          method: error.config?.method || null,
          status
        }
      };

      httpClient
        .post("/api/auditoria/errores", payload, { skipErrorLog: true, skipAuthRedirect: true })
        .catch(() => {});
    }

    return Promise.reject(error);
  }
);

export default httpClient;

// Métodos helper
export const get = (url, config = {}) => httpClient.get(url, config);
export const post = (url, data, config = {}) => httpClient.post(url, data, config);
export const put = (url, data, config = {}) => httpClient.put(url, data, config);
export const del = (url, config = {}) => httpClient.delete(url, config);
