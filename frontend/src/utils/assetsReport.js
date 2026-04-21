const DEFAULT_TITLE = "Reporte de activos";
const DEFAULT_FOOTER =
  "Documento generado automáticamente por AssetControl para análisis de inventario.";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatReportDateTime = (value) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("es-CO");
};

const normalizeFilters = (filters = []) => {
  if (!Array.isArray(filters)) return [];
  return filters.map((item) => String(item || "").trim()).filter(Boolean);
};

const buildTableHead = (columns = []) =>
  columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");

const buildTableRows = (rows = [], columns = []) => {
  if (!rows.length) {
    const colspan = Math.max(columns.length, 1);
    return `<tr><td colspan="${colspan}">No hay activos para el reporte.</td></tr>`;
  }

  return rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${escapeHtml(row?.[column.key] ?? "-")}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
};

const IMAGE_EXTENSION_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/webp": "webp"
};

const parseDataUrl = (value) => {
  if (!value) return null;
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(value));
  if (!match) return null;
  return {
    mime: match[1].toLowerCase(),
    base64: match[2]
  };
};

const chunkBase64 = (value, size = 76) => {
  const clean = String(value || "").replace(/\s/g, "");
  if (!clean) return "";
  const parts = [];
  for (let i = 0; i < clean.length; i += size) {
    parts.push(clean.slice(i, i + size));
  }
  return parts.join("\r\n");
};

const buildExcelMhtml = (html, images = []) => {
  const boundary = `----=_NextPart_${Date.now().toString(16)}`;
  const normalizedHtml = String(html || "").replace(/\r?\n/g, "\r\n");
  const lines = [
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=\"utf-8\"",
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizedHtml
  ];

  images.forEach((image) => {
    if (!image?.base64) return;
    lines.push(
      `--${boundary}`,
      `Content-Type: ${image.mime}`,
      "Content-Transfer-Encoding: base64",
      `Content-Location: ${image.location}`,
      "",
      chunkBase64(image.base64)
    );
  });

  lines.push(`--${boundary}--`, "");
  return lines.join("\r\n");
};

export function buildAssetsPdfReportHtml({
  columns = [],
  rows = [],
  entidadNombre = "",
  generatedAt = new Date(),
  filtros = [],
  logos = {},
  titulo = DEFAULT_TITLE,
  footer = DEFAULT_FOOTER
} = {}) {
  const headerCells = buildTableHead(columns);
  const bodyRows = buildTableRows(rows, columns);
  const filtrosList = normalizeFilters(filtros);
  const filtrosText = filtrosList.length
    ? filtrosList.map(escapeHtml).join(" · ")
    : "Sin filtros aplicados";
  const totalRegistros = rows.length;
  const logoM5 = logos?.logoM5
    ? `<img src="${escapeHtml(logos.logoM5)}" alt="MICROCINCO" />`
    : `<div class="logo-placeholder"></div>`;
  const logoAssetControl = logos?.logoAssetControl
    ? `<img src="${escapeHtml(logos.logoAssetControl)}" alt="AssetControl" />`
    : `<div class="logo-placeholder"></div>`;

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(titulo)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        margin: 16px;
        color: #0f172a;
        background: #f8fafc;
      }
      .sheet-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-bottom: 16px;
      }
      .btn-print, .btn-download {
        border: none;
        padding: 10px 16px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-print {
        background: #0f2d5c;
        color: #fff;
      }
      .btn-download {
        background: #16a34a;
        color: #fff;
      }
      .brand-header {
        display: grid;
        grid-template-columns: 120px 1fr 120px;
        align-items: center;
        gap: 16px;
        background: #fff;
        padding: 16px;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
      }
      .brand-header img {
        max-width: 120px;
        max-height: 52px;
        object-fit: contain;
      }
      .logo-placeholder {
        width: 120px;
        height: 52px;
      }
      .header-title {
        text-align: center;
      }
      .header-title h1 {
        margin: 0;
        font-size: 20px;
        color: #0f2d5c;
      }
      .header-title div {
        font-size: 12px;
        color: #475569;
      }
      .filters {
        margin: 16px 0 12px;
        font-size: 12px;
        color: #334155;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        background: #fff;
        border-radius: 12px;
        overflow: hidden;
        table-layout: fixed;
      }
      th, td {
        border: 1px solid #d6deea;
        padding: 8px;
        font-size: 12px;
        text-align: left;
        vertical-align: top;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      th {
        background: #021f59;
        color: #fff;
        white-space: normal;
      }
      thead {
        display: table-header-group;
      }
      tr {
        page-break-inside: avoid;
      }
      tbody tr:nth-child(even) {
        background: #f1f5f9;
      }
      .footer {
        margin-top: 18px;
        font-size: 12px;
        color: #475569;
      }
      @media print {
        * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        body {
          margin: 8px;
          background: #fff;
        }
        .sheet-actions {
          display: none !important;
        }
        th {
          background: #021f59 !important;
          color: #fff !important;
        }
        .brand-header {
          grid-template-columns: 90px 1fr 90px;
          padding: 10px;
          gap: 10px;
        }
        .brand-header img {
          max-width: 90px;
          max-height: 40px;
        }
        .header-title h1 {
          font-size: 14px;
        }
        .header-title div,
        .filters,
        .footer {
          font-size: 10px;
        }
        th, td {
          padding: 4px 6px;
          font-size: 9px;
        }
      }
    </style>
    <script>
      function imprimirReporte() {
        globalThis.print();
      }
      function descargarReportePdf() {
        globalThis.print();
        setTimeout(function () {
          alert("En la ventana de impresión selecciona 'Guardar como PDF'.");
        }, 200);
      }
    </script>
  </head>
  <body>
    <div class="sheet-actions">
      <button type="button" class="btn-print" onclick="imprimirReporte()">IMPRIMIR</button>
      <button type="button" class="btn-download" onclick="descargarReportePdf()">DESCARGAR PDF</button>
    </div>

    <section class="brand-header">
      ${logoM5}
      <div class="header-title">
        <h1>${escapeHtml(titulo)}</h1>
        <div>Entidad: ${escapeHtml(entidadNombre || "Todas las entidades")}</div>
        <div>Generado: ${escapeHtml(formatReportDateTime(generatedAt))}</div>
        <div>Total registros: ${escapeHtml(totalRegistros)}</div>
      </div>
      ${logoAssetControl}
    </section>

    <div class="filters">
      <strong>Filtros:</strong> ${filtrosText}
    </div>

    <table>
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>

    <p class="footer">${escapeHtml(footer)}</p>
  </body>
</html>
  `.trim();
}

export function buildAssetsExcelReportHtml({
  columns = [],
  rows = [],
  entidadNombre = "",
  generatedAt = new Date(),
  filtros = [],
  logos = {},
  titulo = DEFAULT_TITLE
} = {}) {
  const headerCells = buildTableHead(columns);
  const bodyRows = buildTableRows(rows, columns);
  const filtrosList = normalizeFilters(filtros);
  const filtrosText = filtrosList.length
    ? filtrosList.map(escapeHtml).join(" | ")
    : "Sin filtros aplicados";
  const totalRegistros = rows.length;
  const excelImages = [];
  const buildExcelLogo = (logoData, altText, fallbackName) => {
    if (!logoData) return "";
    const parsed = parseDataUrl(logoData);
    const safeAlt = escapeHtml(altText);

    if (parsed) {
      const extension = IMAGE_EXTENSION_BY_MIME[parsed.mime] || "png";
      const location = `${fallbackName}.${extension}`;
      excelImages.push({
        location,
        mime: parsed.mime,
        base64: parsed.base64
      });
      return `<img src="${location}" width="120" height="46" alt="${safeAlt}" />`;
    }

    return `<img src="${escapeHtml(logoData)}" width="120" height="46" alt="${safeAlt}" />`;
  };
  const logoM5 = buildExcelLogo(logos?.logoM5, "MICROCINCO", "logo-m5");
  const logoAssetControl = buildExcelLogo(
    logos?.logoAssetControl,
    "AssetControl",
    "logo-assetcontrol"
  );

  const html = `
<!doctype html>
<html lang="es"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: Calibri, Arial, sans-serif;
        color: #0f172a;
        margin: 12px;
      }
      .report-header {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .report-header td {
        border: none;
        vertical-align: middle;
      }
      .report-title {
        font-size: 16px;
        font-weight: 700;
        color: #0f2d5c;
        margin-bottom: 2px;
        line-height: 1.2;
      }
      .meta {
        font-size: 11px;
        color: #475569;
        line-height: 1.2;
      }
      .filters {
        font-size: 11px;
        color: #334155;
      }
      .logo-img {
        display: block;
        max-width: 120px;
        max-height: 46px;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      th, td {
        border: 1px solid #d0d7e2;
        padding: 6px 8px;
        font-size: 11px;
        mso-number-format: '\\@';
      }
      th {
        background: #021f59;
        color: #fff;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <table class="report-header">
      <colgroup>
        <col style="width: 140px;" />
        <col />
        <col style="width: 140px;" />
      </colgroup>
      <tr style="height: 56px;">
        <td style="text-align: left;">${logoM5.replace("<img ", "<img class=\"logo-img\" ")}</td>
        <td style="text-align: center;">
          <div class="report-title">${escapeHtml(titulo)}</div>
          <div class="meta">Entidad: ${escapeHtml(entidadNombre || "Todas las entidades")}</div>
          <div class="meta">Generado: ${escapeHtml(formatReportDateTime(generatedAt))}</div>
          <div class="meta">Total registros: ${escapeHtml(totalRegistros)}</div>
        </td>
        <td style="text-align: right;">${logoAssetControl.replace("<img ", "<img class=\"logo-img\" ")}</td>
      </tr>
    </table>

    <table style="width: 100%; border-collapse: collapse; margin-top: 6px;">
      <tr>
        <td style="border: none; padding: 4px 0;" class="filters">
          <strong>Filtros:</strong> ${filtrosText}
        </td>
      </tr>
    </table>

    <table style="margin-top: 6px;">
      <tr>${headerCells}</tr>
      ${bodyRows}
    </table>
  </body>
</html>
  `.trim();

  return buildExcelMhtml(html, excelImages);
}
