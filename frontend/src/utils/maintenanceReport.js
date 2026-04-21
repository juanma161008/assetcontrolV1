const DEFAULT_TITLE = "Reporte de mantenimientos";
const DEFAULT_FOOTER =
  "Documento generado automaticamente por AssetControl para control de mantenimientos.";

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
    return `<tr><td colspan="${colspan}">No hay mantenimientos para el reporte.</td></tr>`;
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

export function buildMaintenancePdfReportHtml({
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
    ? filtrosList.map(escapeHtml).join(" | ")
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
          alert("En la ventana de impresion selecciona 'Guardar como PDF'.");
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
