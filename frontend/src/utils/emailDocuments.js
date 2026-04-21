function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-CO");
}

function formatMultilineText(value) {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

function extractStyleBlocks(html) {
  const source = String(html || "");
  const matches = source.match(/<style[\s\S]*?<\/style>/gi);
  return Array.isArray(matches) ? matches.join("\n") : "";
}

export function extractBodyContent(html) {
  const source = String(html || "");
  const match = source.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const raw = match?.[1] || source;

  return String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+="[^"]*"/gi, "");
}

export function buildCorporateSignatureHtml({
  signatureText = "",
  senderName = "",
  senderRole = "AssetControl | Microcinco S.A.S",
  logoM5 = "",
  logoAssetControl = ""
} = {}) {
  const normalizedSignature = String(signatureText || "").trim();
  const signedBy = String(senderName || "").trim();
  const role = String(senderRole || "").trim();

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #d9e3f5;border-radius:10px;margin-top:20px;font-family:Arial,sans-serif;background:#f8fbff;">
  <tr>
    <td style="padding:16px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        ${logoM5 ? `<img src="${escapeHtml(logoM5)}" alt="Microcinco" style="height:38px;max-width:120px;object-fit:contain;" />` : ""}
        ${logoAssetControl ? `<img src="${escapeHtml(logoAssetControl)}" alt="AssetControl" style="height:38px;max-width:140px;object-fit:contain;" />` : ""}
      </div>
      <div style="font-size:14px;line-height:1.45;color:#1e293b;">
        ${normalizedSignature ? `<div style="margin-bottom:8px;">${formatMultilineText(normalizedSignature)}</div>` : ""}
        ${signedBy ? `<div style="font-weight:700;">${escapeHtml(signedBy)}</div>` : ""}
        ${role ? `<div style="color:#334155;">${escapeHtml(role)}</div>` : ""}
        <div style="margin-top:6px;color:#475569;">www.microcinco.com</div>
      </div>
    </td>
  </tr>
</table>
  `.trim();
}

export function buildDocumentEmailHtml({
  title = "Documento AssetControl",
  introText = "",
  documentHtml = "",
  documentLabel = "Documento",
  signatureText = "",
  logos = {},
  senderName = "",
  senderRole = ""
} = {}) {
  const intro = String(introText || "").trim();
  const documentBody = extractBodyContent(documentHtml);
  const documentStyles = extractStyleBlocks(documentHtml);
  const corporateSignature = buildCorporateSignatureHtml({
    signatureText,
    senderName,
    senderRole,
    logoM5: logos.logoM5 || "",
    logoAssetControl: logos.logoAssetControl || ""
  });

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    ${documentStyles}
    <style>
      .sheet-actions { display: none !important; }
      .bloque.acciones { display: none !important; }
    </style>
  </head>
  <body style="margin:0;padding:18px;background:#eef3fb;font-family:Arial,sans-serif;color:#1e293b;">
    <div style="max-width:980px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:18px;">
      ${intro ? `<div style="font-size:14px;line-height:1.5;margin-bottom:14px;">${formatMultilineText(intro)}</div>` : ""}
      <div style="font-size:13px;font-weight:700;color:#021F59;margin-bottom:8px;">${escapeHtml(documentLabel)}</div>
      <div style="border:1px solid #d9e3f5;border-radius:10px;overflow:hidden;">
        ${documentBody}
      </div>
      ${corporateSignature}
    </div>
  </body>
</html>
  `.trim();
}

export function buildMaintenanceOrderHtml({
  activo = {},
  mantenimiento = {},
  factura = {},
  logos = {},
  numeroOrden = "",
  mantenimientoConsecutivo = null
} = {}) {
  const numeroActivo = activo.activo || activo.nombre || (activo.id ? `ACTIVO #${activo.id}` : "-");
  const numeroReporte =
    mantenimiento.numeroReporte ||
    mantenimiento.numero_reporte ||
    mantenimiento.numeroreporte ||
    "-";

  const numeroFactura = String(factura.numeroFactura || numeroOrden || "-").trim();
  const usuarioNombre = String(factura.usuarioNombre || "-").trim() || "-";
  const usuarioArea = String(factura.usuarioArea || "-").trim() || "-";
  const usuarioCargo = String(factura.usuarioCargo || "-").trim() || "-";
  const autorizaNombre = String(factura.autorizaNombre || "-").trim() || "-";
  const autorizaCargo = String(factura.autorizaCargo || "-").trim() || "-";
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

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Orden de mantenimiento ${escapeHtml(numeroFactura)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #1f2937; }
      .doc { padding: 14px; }
      .header { display: grid; grid-template-columns: 120px 1fr 140px; gap: 10px; align-items: center; border: 2px solid #021F59; border-radius: 10px; padding: 12px; }
      .header img { max-height: 54px; max-width: 100%; object-fit: contain; }
      .title h1 { margin: 0; font-size: 20px; color: #021F59; }
      .title p { margin: 3px 0; font-size: 13px; }
      .section { margin-top: 12px; border: 1px solid #d9e3f5; border-radius: 10px; overflow: hidden; }
      .section h2 { margin: 0; padding: 8px 10px; font-size: 14px; background: #021F59; color: #fff; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 10px; }
      .row { font-size: 13px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #f8fbff; }
      .row b { color: #021F59; }
      .firmas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 10px; }
      .firma-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; background: #f8fbff; font-size: 13px; }
      .legal { margin-top: 12px; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff7ed; color: #7c2d12; font-size: 12px; line-height: 1.45; }
    </style>
  </head>
  <body>
    <div class="doc">
      <section class="header">
        <img src="${escapeHtml(logos.logoM5 || "")}" alt="Microcinco" />
        <div class="title">
          <h1>Orden de mantenimiento</h1>
          <p><b>Factura:</b> ${escapeHtml(numeroFactura)}</p>
          <p><b>Fecha:</b> ${escapeHtml(formatDate(mantenimiento.fecha || factura.fecha || new Date().toISOString()))}</p>
          <p><b>Activo:</b> ${escapeHtml(numeroActivo)}</p>
          <p><b>Número de reporte:</b> ${escapeHtml(numeroReporte)}</p>
        </div>
        <img src="${escapeHtml(logos.logoAssetControl || "")}" alt="AssetControl" />
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
          <div class="row" style="grid-column: span 2;"><b>Descripción:</b> ${escapeHtml(mantenimiento.descripcion || "-")}</div>
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
            <div><b>Quien autoriza</b></div>
            <div>${escapeHtml(autorizaNombre)}</div>
            <div>${escapeHtml(autorizaCargo)}</div>
            <div style="margin-top:8px;">${renderFirma(factura.autorizaFirma, "Sin firma registrada")}</div>
          </div>
        </div>
      </section>

      <div class="legal">
        Al firmar este documento se autoriza el tratamiento de datos personales conforme a HABEAS DATA y se declara que la información registrada no ha sido manipulada indebidamente.
      </div>
    </div>
  </body>
</html>
  `.trim();
}
