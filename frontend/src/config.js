// Configuración de la API
// URL base del backend
const explicitApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

const browserWindow = globalThis.window;

const runtimeProtocol =
  browserWindow?.location?.protocol === "https:" ? "https:" : "http:";

const runtimeHostname =
  browserWindow?.location?.hostname || "localhost";

const fallbackApiBaseUrl = `${runtimeProtocol}//${runtimeHostname}:5000`;

export const API_BASE_URL = explicitApiBaseUrl || fallbackApiBaseUrl;
