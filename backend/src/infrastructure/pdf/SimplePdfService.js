import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { buildMaintenanceOrderHtml } from "./maintenanceOrderHtml.js";
import resolveChromiumPath from "./resolveChromiumPath.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let logoM5DataUrl = null;
function getLogoM5DataUrl() {
  if (!logoM5DataUrl) {
    const buffer = fs.readFileSync(path.join(__dirname, "assets", "logom5.png"));
    logoM5DataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
  }
  return logoM5DataUrl;
}

function mapDocumentoData(datos, orden) {
  return {
    numeroOrden: datos.numero,
    mantenimientoConsecutivo: datos.mantenimiento_id,
    activo: {
      id: datos.activo_id,
      activo: datos.activo,
      nombre: datos.activo_nombre,
      serial: datos.serial,
      equipo: datos.equipo,
      marca: datos.marca,
      modelo: datos.modelo,
      procesador: datos.procesador,
      ram: datos.ram,
      tiporam: datos.tiporam,
      tipodisco: datos.tipodisco,
      hdd: datos.hdd,
      os: datos.os,
      areaprincipal: datos.areaprincipal,
      areasecundaria: datos.areasecundaria,
      sede: datos.sede || datos.entidad_nombre,
      estado: datos.activo_estado
    },
    mantenimiento: {
      id: datos.mantenimiento_id,
      tipo: datos.mantenimiento_tipo,
      estado: orden?.estado,
      tecnico: datos.tecnico_nombre,
      fecha: datos.mantenimiento_fecha,
      cambio_partes: datos.cambio_partes,
      descripcion: datos.mantenimiento_descripcion
    },
    factura: {
      numeroFactura: datos.numero,
      numeroOrden: datos.numero,
      fecha: datos.orden_fecha,
      usuarioNombre: datos.firmante_nombre || "",
      usuarioArea: datos.firmante_area || "",
      usuarioCargo: datos.firmante_cargo || "",
      usuarioFirma: datos.usuario_firma || "",
      estadoOrden: orden?.estado,
      interventorNombre: datos.interventor_nombre || "",
      interventorFirma: datos.interventor_firma || "",
      comentarioInterventor: datos.comentario_interventor || ""
    }
  };
}

async function renderHtmlToPdf(html) {
  const executablePath = resolveChromiumPath();
  const browser = await puppeteer.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({ printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}

// Renderiza la orden con Puppeteer usando la misma plantilla HTML que ve el usuario
// (logo, tarjetas, firmas como imagen), en vez de un texto plano, para que el PDF del
// respaldo automatico y el de descarga individual sean el documento real de la orden.
export default class SimplePdfService {
  constructor(ordenRepo) {
    this.ordenRepo = ordenRepo;
  }

  async generar(orden = {}) {
    const datos = await this.ordenRepo.findDocumentData(orden.id);
    if (!datos) {
      throw new Error(`No se encontro informacion del documento para la orden ${orden?.numero || orden?.id}`);
    }

    const html = buildMaintenanceOrderHtml({
      ...mapDocumentoData(datos, orden),
      logos: { logoM5: getLogoM5DataUrl() }
    });

    return renderHtmlToPdf(html);
  }
}
