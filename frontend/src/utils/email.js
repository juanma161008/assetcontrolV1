function sanitize(value, fallback = "-") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value).trim();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-CO");
}

export function buildAssetEmailDraft(asset = {}, maintenanceHistory = []) {
  const assetData = asset && typeof asset === "object" ? asset : {};
  const numeroActivo =
    assetData.activo ||
    assetData.nombre ||
    (assetData.id ? `ACTIVO #${assetData.id}` : "ACTIVO");

  const normalizedHistory = Array.isArray(maintenanceHistory) ? maintenanceHistory : [];
  const lastEntries = normalizedHistory.slice(0, 5);

  const lines = [
    "Hola,",
    "",
    "Comparto el resumen del activo:",
    "",
    `Numero activo: ${sanitize(assetData.activo, numeroActivo)}`,
    `Entidad/Sede: ${sanitize(assetData.sede)}`,
    `Nombre del equipo: ${sanitize(assetData.nombre)}`,
    `Equipo: ${sanitize(assetData.equipo)}`,
    `Marca/Modelo: ${sanitize(assetData.marca)} / ${sanitize(assetData.modelo)}`,
    `Estado: ${sanitize(assetData.estado)}`,
    `Fecha registro: ${formatDate(assetData.created_at)}`
  ];

  if (lastEntries.length) {
    lines.push("", "Ultimos mantenimientos:");
    lastEntries.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${formatDate(item.fecha)} | ${sanitize(item.tipo)} | ${sanitize(item.estado)} | ${sanitize(item.tecnico)}`
      );
    });
  }

  lines.push("", "Mensaje generado desde AssetControl.");

  return {
    subject: `Resumen de activo ${numeroActivo}`,
    body: lines.join("\n")
  };
}

export function buildMaintenanceEmailDraft(maintenance = {}, asset = null) {
  const maintenanceData = maintenance && typeof maintenance === "object" ? maintenance : {};
  const assetData = asset && typeof asset === "object" ? asset : {};
  const numeroActivo =
    maintenanceData.activo ||
    assetData.activo ||
    assetData.nombre ||
    (maintenanceData.activo_id ? `ACTIVO #${maintenanceData.activo_id}` : "ACTIVO");
  const numeroReporte = sanitize(
    maintenanceData.numeroReporte ||
    maintenanceData.numero_reporte ||
    maintenanceData.numeroreporte
  );

  const lines = [
    "Hola,",
    "",
    "Comparto el detalle del mantenimiento:",
    "",
    `ID mantenimiento: ${sanitize(maintenanceData.id)}`,
    `Nro reporte: ${numeroReporte}`,
    `Fecha: ${formatDate(maintenanceData.fecha)}`,
    `Activo: ${sanitize(numeroActivo)}`,
    `Tipo: ${sanitize(maintenanceData.tipo)}`,
    `Estado: ${sanitize(maintenanceData.estado, "En proceso")}`,
    `Técnico: ${sanitize(maintenanceData.tecnico)}`,
    `Descripcion: ${sanitize(maintenanceData.descripcion)}`
  ];

  if (Object.keys(assetData).length > 0) {
    lines.push(`Equipo asociado: ${sanitize(assetData.equipo)} ${sanitize(assetData.marca)} ${sanitize(assetData.modelo)}`);
  }

  lines.push("", "Mensaje generado desde AssetControl.");

  return {
    subject: `Mantenimiento ${sanitize(maintenanceData.id, "sin-id")} - ${sanitize(numeroActivo)}`,
    body: lines.join("\n")
  };
}

export function buildMailtoLink({ to = "", subject = "", body = "" }) {
  const base = `mailto:${encodeURIComponent(to)}`;
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  return `${base}${params.toString()}`;
}

export function openEmailDraft(draft, to = "") {
  const browserWindow = globalThis.window;
  if (!browserWindow) return;
  const link = buildMailtoLink({
    to,
    subject: draft.subject || "",
    body: draft.body || ""
  });
  browserWindow.location.href = link;
}
