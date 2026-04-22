const MAX_ADJUNTO_BYTES = 2 * 1024 * 1024;
const MAX_ADJUNTOS = 4;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp"
]);

export const estimateBase64Bytes = (dataUrl = "") => {
  const parts = String(dataUrl || "").split(",");
  if (parts.length < 2) return 0;
  const base64 = parts[1] || "";
  return Math.floor((base64.length * 3) / 4);
};

export function normalizeAdjuntos(input = []) {
  if (!Array.isArray(input)) return [];

  const normalized = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const dataUrl = String(raw.dataUrl || raw.url || "").trim();
    if (!dataUrl.startsWith("data:") || !dataUrl.includes(";base64,")) continue;

    const type = String(raw.type || "").toLowerCase().trim();
    if (type && !ALLOWED_MIME.has(type)) continue;

    const bytes = Number(raw.size) || estimateBase64Bytes(dataUrl);
    if (!bytes || bytes > MAX_ADJUNTO_BYTES) continue;

    normalized.push({
      name: String(raw.name || "archivo").trim(),
      type: type || "application/octet-stream",
      size: bytes,
      dataUrl
    });

    if (normalized.length >= MAX_ADJUNTOS) break;
  }

  return normalized;
}

export function getAdjuntosMeta(adjuntos = []) {
  const list = normalizeAdjuntos(adjuntos);
  return list.map((item) => ({
    name: item.name,
    type: item.type,
    size: item.size
  }));
}

export const ADJUNTOS_LIMITS = {
  maxAdjuntos: MAX_ADJUNTOS,
  maxBytes: MAX_ADJUNTO_BYTES
};
