function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-CO");
}

// Espejo de frontend/src/utils/emailDocuments.js (buildMaintenanceOrderHtml): el backend
// no puede importar codigo del frontend, asi que esta plantilla se mantiene duplicada a
// proposito para que el PDF del respaldo automatico luzca igual al documento que ve el
// usuario en la app (con firmas de imagen y el mismo diseño).
export function buildMaintenanceOrderHtml({
  activo = {},
  mantenimiento = {},
  factura = {},
  logos = {},
  numeroOrden = "",
  mantenimientoConsecutivo = null
} = {}) {
  const numeroActivo = activo.activo || activo.nombre || (activo.id ? `ACTIVO #${activo.id}` : "-");
  const numeroOrdenDocumento = String(factura.numeroOrden || factura.numeroFactura || numeroOrden || "-").trim();
  const usuarioNombre = String(factura.usuarioNombre || "-").trim() || "-";
  const usuarioArea = String(factura.usuarioArea || "-").trim() || "-";
  const usuarioCargo = String(factura.usuarioCargo || "-").trim() || "-";
  const cambioPartes = String(mantenimiento.cambio_partes || mantenimiento.cambioPartes || "-").trim() || "-";

  const idMantenimientoDocumento =
    Number(mantenimientoConsecutivo) > 0
      ? String(mantenimientoConsecutivo)
      : String(mantenimiento.id || "-");

  const renderFirma = (firma, fallback) => {
    if (firma) {
      return `<img src="${escapeHtml(firma)}" alt="firma" style="max-height:72px;max-width:220px;object-fit:contain;border:1px solid #cbd5e1;border-radius:8px;padding:4px;background:#fff;" />`;
    }

    return `<div style="padding:10px;border:1px dashed #94a3b8;border-radius:8px;color:#475569;">${escapeHtml(fallback)}</div>`;
  };

  const estadoOrdenDocumento = String(factura.estadoOrden || "").trim();
  const renderAutorizacionInterventor = () => {
    if (estadoOrdenDocumento === "Aprobada" && factura.interventorNombre) {
      return `
        <div>${escapeHtml(factura.interventorNombre)}</div>
        <div style="margin-top:8px;">${renderFirma(factura.interventorFirma, "Sin firma registrada")}</div>
      `;
    }

    if (estadoOrdenDocumento === "Rechazada por Interventor") {
      return `
        <div>Rechazada por ${escapeHtml(factura.interventorNombre || "el interventor")}.</div>
        ${factura.comentarioInterventor ? `<div style="margin-top:6px;color:#991b1b;">${escapeHtml(factura.comentarioInterventor)}</div>` : ""}
      `;
    }

    return "<div>Pendiente de autorización del interventor de la entidad.</div>";
  };

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Orden de mantenimiento ${escapeHtml(numeroOrdenDocumento)}</title>
    <style>
      * { box-sizing: border-box; }
      @page { size: A4; margin: 12mm; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: Arial, sans-serif;
        color: #1f2937;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .doc { padding: 14px; max-width: 100%; }
      .header { display: grid; grid-template-columns: 100px minmax(0, 200px) minmax(0, 1fr); gap: 10px; align-items: center; border: 2px solid #021F59; border-radius: 10px; padding: 12px; }
      .header img { max-height: 54px; max-width: 100%; object-fit: contain; }
      .empresa { min-width: 0; font-size: 11px; line-height: 1.35; color: #334155; }
      .empresa strong { display: block; font-size: 13px; color: #021F59; margin-bottom: 2px; }
      .title { min-width: 0; }
      .title h1 { margin: 0; font-size: 20px; color: #021F59; }
      .title p { margin: 3px 0; font-size: 13px; }
      @media (max-width: 700px) {
        .header { grid-template-columns: 80px minmax(0, 1fr); }
        .empresa { grid-column: 1 / -1; }
      }
      .section { margin-top: 12px; border: 1px solid #d9e3f5; border-radius: 10px; overflow: hidden; break-inside: avoid-page; page-break-inside: avoid; }
      .section h2 { margin: 0; padding: 8px 10px; font-size: 14px; background: #021F59; color: #fff; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 10px; }
      .row { font-size: 13px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #f8fbff; overflow-wrap: anywhere; }
      .row b { color: #021F59; }
      .firmas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 10px; }
      .firma-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; background: #f8fbff; font-size: 13px; overflow-wrap: anywhere; }
      @media print {
        .grid, .firmas { display: flex; flex-wrap: wrap; gap: 8px; }
        .grid .row { width: calc(50% - 4px); }
        .firmas .firma-card { width: calc(50% - 6px); }
      }
    </style>
  </head>
  <body>
    <div class="doc">
      <section class="header">
        <img src="${escapeHtml(logos.logoM5 || "")}" alt="Microcinco" />
        <div class="empresa">
          <strong>Microcinco S.A.S</strong>
          <div>NIT: 811023500-2</div>
          <div>mdaitagui@microcinco.com</div>
        </div>
        <div class="title">
          <h1>Orden de mantenimiento</h1>
          <p><b>Orden:</b> ${escapeHtml(numeroOrdenDocumento)}</p>
          <p><b>Fecha:</b> ${escapeHtml(formatDate(mantenimiento.fecha || factura.fecha || new Date().toISOString()))}</p>
          <p><b>Activo:</b> ${escapeHtml(numeroActivo)}</p>
        </div>
      </section>

      <section class="section">
        <h2>Datos del activo</h2>
        <div class="grid">
          <div class="row"><b>Activo:</b> ${escapeHtml(activo.activo || activo.nombre || "-")}</div>
          <div class="row"><b>Serial:</b> ${escapeHtml(activo.serial || "-")}</div>
          <div class="row"><b>Equipo:</b> ${escapeHtml(activo.equipo || "-")}</div>
          <div class="row"><b>Marca / modelo:</b> ${escapeHtml(activo.marca || "-")} / ${escapeHtml(activo.modelo || "-")}</div>
          <div class="row"><b>Procesador:</b> ${escapeHtml(activo.procesador || "-")}</div>
          <div class="row"><b>RAM / disco:</b> ${escapeHtml([activo.tipoRam || activo.tiporam, activo.ram].filter(Boolean).join(" ") || "-")} / ${escapeHtml(activo.tipoDisco || activo.tipodisco || "-")} ${escapeHtml(activo.hdd || "")}</div>
          <div class="row"><b>Sistema operativo:</b> ${escapeHtml(activo.os || "-")}</div>
          <div class="row"><b>Área / entidad:</b> ${escapeHtml(activo.areaPrincipal || activo.areaprincipal || "-")} / ${escapeHtml(activo.sede || "-")}</div>
        </div>
      </section>

      <section class="section">
        <h2>Intervención técnica</h2>
        <div class="grid">
          <div class="row"><b>Tipo:</b> ${escapeHtml(mantenimiento.tipo || "-")}</div>
          <div class="row"><b>Estado:</b> ${escapeHtml(mantenimiento.estado || "-")}</div>
          <div class="row"><b>Técnico:</b> ${escapeHtml(mantenimiento.tecnico || "-")}</div>
          <div class="row"><b>ID mantenimiento:</b> ${escapeHtml(idMantenimientoDocumento)}</div>
          <div class="row" style="grid-column: span 2;"><b>Cambio de partes:</b> ${escapeHtml(cambioPartes)}</div>
          <div class="row" style="grid-column: span 2;"><b>Observaciones:</b> ${escapeHtml(mantenimiento.descripcion || "-")}</div>
        </div>
      </section>

      <section class="section">
        <h2>Firmas y autorización</h2>
        <div class="firmas">
          <div class="firma-card">
            <div><b>Usuario habitual / área</b></div>
            <div>${escapeHtml(usuarioNombre)}</div>
            <div>${escapeHtml(usuarioArea)}${usuarioCargo && usuarioCargo !== "-" ? ` - ${escapeHtml(usuarioCargo)}` : ""}</div>
            <div style="margin-top:8px;">${renderFirma(factura.usuarioFirma, "Sin firma registrada")}</div>
          </div>
          <div class="firma-card">
            <div><b>Autorización del interventor</b></div>
            ${renderAutorizacionInterventor()}
          </div>
        </div>
      </section>

    </div>
  </body>
</html>
  `.trim();
}
