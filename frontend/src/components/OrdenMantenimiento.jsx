import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import logo from "../assets/logos/logom5.png";
import logoAssetControl from "../assets/logos/logo-assetcontrol.png";
import "../styles/Orden.css";
import FirmaDigital from "./shared/FirmaDigital";
import { toProperCase } from "../utils/formatters";

const FACTURA_STORAGE_PREFIX = "factura_mantenimiento_";
const isKeyboardActivation = (event) => event.key === "Enter" || event.key === " ";

const formatearNumeroFactura = (numero = 1) => String(Math.max(1, Number(numero) || 1)).padStart(2, "0");

const extraerConsecutivoFactura = (value) => {
  const source = String(value || "").trim();
  if (!source) return null;
  if (/^\d+$/.test(source)) {
    const direct = Number(source);
    return Number.isInteger(direct) && direct > 0 ? direct : null;
  }

  const matches = source.match(/\d+/g);
  if (!matches.length) return null;
  const num = Number(matches[matches.length - 1]);
  return Number.isInteger(num) && num > 0 ? num : null;
};

const obtenerSiguienteConsecutivo = (numeros = []) => {
  const usados = new Set(
    (Array.isArray(numeros) ? numeros : [])
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
  );

  let siguiente = 1;
  while (usados.has(siguiente)) {
    siguiente += 1;
  }
  return siguiente;
};

const listarConsecutivosFacturas = (excludeKey = "") => {
  const browserWindow = globalThis.window;
  if (!browserWindow) return [];
  const keys = Object.keys(localStorage).filter((key) =>
    key.startsWith(FACTURA_STORAGE_PREFIX)
  );

  return keys
    .filter((key) => key !== excludeKey)
    .map((key) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "{}");
        return extraerConsecutivoFactura(parsed.numeroFactura);
      } catch {
        return null;
      }
    })
    .filter((item) => Number.isInteger(item) && item > 0);
};

const formatearFecha = (fechaInput) => {
  const fecha = fechaInput ? new Date(fechaInput) : new Date();
  if (Number.isNaN(fecha.getTime())) {
    return new Date().toLocaleDateString("es-ES");
  }
  return fecha.toLocaleDateString("es-ES");
};

const reducirFirma = (dataURL) =>
  new Promise((resolve, reject) => {
    if (!dataURL) {
      resolve("");
      return;
    }

    if (dataURL.includes("image/jpeg")) {
      resolve(dataURL);
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 220;
        canvas.height = 90;
        // Evita fondo negro al exportar firmas con transparencia a JPEG.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = reject;
    img.src = dataURL;
  });

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const facturaTieneFirmasCompletas = (payload = {}) =>
  Boolean(String(payload.usuarioFirma || "").trim() && String(payload.autorizaFirma || "").trim());

const waitForPrintWindowReady = async (printWindow) => {
  if (!printWindow?.document) return;

  const { document: doc } = printWindow;

  await new Promise((resolve) => {
    if (doc.readyState === "complete") {
      resolve();
      return;
    }

    const onLoad = () => resolve();
    printWindow.addEventListener("load", onLoad, { once: true });
    globalThis.setTimeout(resolve, 1800);
  });

  const images = Array.from(doc.images || []);
  await Promise.all(
    images.map((img) => new Promise((resolve) => {
      if (img.complete) {
        resolve();
        return;
      }
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    }))
  );

  await new Promise((resolve) => {
    if (typeof printWindow.requestAnimationFrame === "function") {
      printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(resolve));
      return;
    }
    globalThis.setTimeout(resolve, 180);
  });
};

export default function FacturaMantenimiento({
  activo,
  mantenimiento,
  onClose,
  onOrdenFirmada,
  isAdmin,
  mantenimientoConsecutivo
}) {
  const maintenanceKey = useMemo(
    () => String(mantenimiento.id || "sin-id"),
    [mantenimiento.id]
  );

  const storageKey = `${FACTURA_STORAGE_PREFIX}${maintenanceKey}`;
  const fechaFormateadaAuto = useMemo(
    () => formatearFecha(mantenimiento.fecha),
    [mantenimiento.fecha]
  );

  const [datosFactura, setDatosFactura] = useState({
    numeroFactura: "01",
    fecha: fechaFormateadaAuto,
    usuarioNombre: "",
    usuarioArea: "",
    usuarioCargo: "",
    usuarioFirma: "",
    autorizaNombre: "",
    autorizaCargo: "",
    autorizaFirma: ""
  });

  const [bloqueada, setBloqueada] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureType, setSignatureType] = useState("");
  const [tempSignature, setTempSignature] = useState("");

  useEffect(() => {
    const guardada = localStorage.getItem(storageKey);
    if (guardada) {
      try {
        const parsed = JSON.parse(guardada);
        const payloadCargado = {
          ...parsed,
          usuarioFirma: parsed.usuarioFirma || parsed.tecnicoFirma || "",
          autorizaFirma: parsed.autorizaFirma || ""
        };
        setDatosFactura((prev) => ({
          ...prev,
          ...payloadCargado,
          numeroFactura: payloadCargado.numeroFactura || prev.numeroFactura,
          fecha: payloadCargado.fecha || prev.fecha
        }));
        setBloqueada(facturaTieneFirmasCompletas(payloadCargado));
        return;
      } catch {
        // Ignorar JSON dañado.
      }
    }

    const siguiente = formatearNumeroFactura(
      obtenerSiguienteConsecutivo(listarConsecutivosFacturas(storageKey))
    );
    setDatosFactura({
      numeroFactura: siguiente,
      fecha: fechaFormateadaAuto,
      usuarioNombre: "",
      usuarioArea: "",
      usuarioCargo: "",
      usuarioFirma: "",
      autorizaNombre: "",
      autorizaCargo: "",
      autorizaFirma: ""
    });
    setBloqueada(false);
  }, [storageKey, fechaFormateadaAuto]);

  useEffect(() => {
    if (showSignatureModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showSignatureModal]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    const properCaseFields = new Set([
      "usuarioNombre",
      "usuarioArea",
      "usuarioCargo",
      "autorizaNombre",
      "autorizaCargo"
    ]);
    const nextValue = properCaseFields.has(name) ? toProperCase(value) : value;
    setDatosFactura((prev) => ({ ...prev, [name]: nextValue }));
  };

  const openSignatureModal = (type) => {
    if (bloqueada) return;
    setSignatureType(type);
    setTempSignature(datosFactura[type] || "");
    setShowSignatureModal(true);
  };

  const closeSignatureModal = () => {
    setShowSignatureModal(false);
    setSignatureType("");
    setTempSignature("");
  };

  const confirmarFirma = async () => {
    if (!tempSignature || !signatureType) return;
    if (signatureType === "usuarioFirma" || signatureType === "autorizaFirma") {
      const consentimiento = globalThis.confirm(
        "Aviso legal: Al firmar autorizas el tratamiento de datos personales (Habeas Data) y declaras que la información registrada no será manipulada de forma indebida. ¿Deseas continuar"
      );
      if (!consentimiento) return;
    }

    try {
      const firmaReducida = await reducirFirma(tempSignature);
      setDatosFactura((prev) => ({
        ...prev,
        [signatureType]: firmaReducida
      }));
    } catch {
      setDatosFactura((prev) => ({
        ...prev,
        [signatureType]: tempSignature
      }));
    } finally {
      closeSignatureModal();
    }
  };

  const guardarFactura = async () => {
    const payload = {
      ...datosFactura,
      numeroFactura: datosFactura.numeroFactura || "01",
      fecha: formatearFecha(datosFactura.fecha || mantenimiento.fecha)
    };

    if (payload.usuarioFirma) {
      payload.usuarioFirma = await reducirFirma(payload.usuarioFirma);
    }
    if (payload.autorizaFirma) {
      payload.autorizaFirma = await reducirFirma(payload.autorizaFirma);
    }

    localStorage.setItem(storageKey, JSON.stringify(payload));
    setDatosFactura(payload);
    const bloqueoFinal = facturaTieneFirmasCompletas(payload);
    setBloqueada(bloqueoFinal);
    globalThis.alert(
      bloqueoFinal ? "Factura guardada y bloqueada" : "Factura guardada como borrador. Completa las dos firmas para bloquearla."
    );
  };

  const desbloquearFactura = () => {
    if (!isAdmin) {
      globalThis.alert("Solo un administrador puede desbloquear la factura.");
      return;
    }
    const ok = globalThis.confirm("¿Deseas desbloquear la factura para editarla");
    if (!ok) return;
    setBloqueada(false);
  };

  const eliminarFactura = () => {
    if (!isAdmin) {
      globalThis.alert("Solo un administrador puede eliminar los datos bloqueados.");
      return;
    }
    const ok = globalThis.confirm("Se eliminarán los datos guardados de la factura. ¿Continuar");
    if (!ok) return;

    localStorage.removeItem(storageKey);

    const siguiente = formatearNumeroFactura(
      obtenerSiguienteConsecutivo(listarConsecutivosFacturas(storageKey))
    );
    setDatosFactura({
      numeroFactura: siguiente,
      fecha: fechaFormateadaAuto,
      usuarioNombre: "",
      usuarioArea: "",
      usuarioCargo: "",
      usuarioFirma: "",
      autorizaNombre: "",
      autorizaCargo: "",
      autorizaFirma: ""
    });
    setBloqueada(false);
  };

  let referenciaMantenimiento = "SIN REF";
  if (Number(mantenimientoConsecutivo) > 0) {
    referenciaMantenimiento = `MT-${String(mantenimientoConsecutivo).padStart(4, "0")}`;
  } else if (mantenimiento.id) {
    referenciaMantenimiento = `MT-${String(mantenimiento.id).padStart(4, "0")}`;
  }

  const mantenimientoIdDocumento =
    Number(mantenimientoConsecutivo) > 0
      ? String(mantenimientoConsecutivo)
      : String(mantenimiento.id || "-");
  const tipoMantenimientoNormalizado = String(mantenimiento.tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const cambioPartes = String(mantenimiento.cambio_partes || mantenimiento.cambioPartes || "-").trim() || "-";

  const construirDocumentoImpresion = () => {
    const renderFirma = (firma) => {
      if (!firma) {
        return "<div class='firma-vacia'>Sin firma registrada</div>";
      }
      return `<img src="${escapeHtml(firma)}" alt="firma" class="firma-img" />`;
    };

    return `<!doctype html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Factura ${escapeHtml(datosFactura.numeroFactura || "00")}</title>
          <style>
            * {
              box-sizing: border-box;
            }
            @page {
              size: A4;
              margin: 12mm;
            }
            html,
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              color: #1e293b;
              background: #ffffff;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .doc {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
              border: 1px solid #d9e2f4;
              border-radius: 10px;
              padding: 10px;
            }
            .header {
              display: grid;
              grid-template-columns: 96px minmax(0, 1fr) minmax(0, 220px);
              gap: 10px;
              align-items: center;
              border: 2px solid #021F59;
              border-radius: 10px;
              padding: 10px;
              margin-bottom: 12px;
            }
            .header img {
              width: 100%;
              max-width: 96px;
              max-height: 52px;
              object-fit: contain;
            }
            .empresa,
            .info {
              min-width: 0;
            }
            .empresa h2 {
              margin: 0 0 4px;
              color: #021F59;
              font-size: 18px;
              line-height: 1.2;
              word-break: break-word;
            }
            .empresa p {
              margin: 2px 0;
              font-size: 11px;
              line-height: 1.35;
              overflow-wrap: anywhere;
            }
            .info {
              border: 1px solid #d2dcf1;
              border-radius: 8px;
              padding: 8px;
              background: #F2F2F2;
              font-size: 11px;
            }
            .info p {
              margin: 4px 0;
              line-height: 1.35;
              overflow-wrap: anywhere;
            }
            .titulo {
              text-align: center;
              margin: 0 0 12px;
              padding-bottom: 8px;
              font-size: 20px;
              color: #021F59;
              border-bottom: 2px solid #021F59;
            }
            .bloque {
              border: 1px solid #d9e3f3;
              border-radius: 10px;
              margin-bottom: 10px;
              overflow: hidden;
              break-inside: avoid-page;
              page-break-inside: avoid;
            }
            .bloque h3 {
              margin: 0;
              background: #021F59;
              color: #ffffff;
              padding: 8px 10px;
              font-size: 13px;
              letter-spacing: 0.3px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 8px;
              padding: 10px;
            }
            .item {
              border: 1px solid #e2e8f4;
              border-radius: 8px;
              padding: 8px;
              background: #ffffff;
              font-size: 12px;
              line-height: 1.35;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            .item b {
              color: #021F59;
            }
            .texto {
              padding: 10px;
              white-space: pre-wrap;
              line-height: 1.4;
              font-size: 12px;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            .firmas {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 10px;
              padding: 10px;
            }
            .firma-card {
              border: 1px solid #d9e3f3;
              border-radius: 8px;
              padding: 8px;
              font-size: 12px;
              background: #F2F2F2;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            .firma-card p {
              margin: 2px 0;
            }
            .firma-img {
              display: block;
              margin-top: 8px;
              height: 72px;
              width: auto;
              max-height: 72px;
              max-width: 100%;
              object-fit: contain;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              background: #ffffff;
            }
            .firma-vacia {
              margin-top: 8px;
              border: 1px dashed #94a3b8;
              border-radius: 6px;
              padding: 10px;
              color: #475569;
              background: #ffffff;
            }
            .legal {
              border: 1px solid #fecaca;
              background: #fff1f2;
              color: #881337;
              border-radius: 8px;
              padding: 10px;
              font-size: 11px;
              line-height: 1.4;
            }
            @media (max-width: 900px) {
              .header {
                grid-template-columns: 84px minmax(0, 1fr);
              }
              .info {
                grid-column: 1 / -1;
              }
              .grid,
              .firmas {
                grid-template-columns: 1fr;
              }
            }
            @media print {
              .header {
                display: flex;
                flex-wrap: wrap;
                align-items: flex-start;
                gap: 8px;
              }
              .header img {
                flex: 0 0 90px;
              }
              .empresa {
                flex: 1 1 260px;
              }
              .info {
                flex: 1 1 220px;
                margin-left: auto;
              }
              .grid,
              .firmas {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
              }
              .grid .item {
                width: calc(50% - 4px);
              }
              .firmas .firma-card {
                width: calc(50% - 4px);
              }
              .doc {
                border: none;
                border-radius: 0;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="doc">
            <section class="header">
              <img src="${escapeHtml(logo)}" alt="MICROCINCO" />
              <div class="empresa">
                <h2>MICROCINCO S.A.S</h2>
                <p>MEDELLIN, ANTIOQUIA</p>
                <p>MDAITAGUI@MICROCINCO.COM</p>
              </div>
              <div class="info">
                <p><b>Factura N.°:</b> ${escapeHtml(datosFactura.numeroFactura || "-")}</p>
                <p><b>Fecha:</b> ${escapeHtml(formatearFecha(datosFactura.fecha))}</p>
                <p><b>Referencia:</b> ${escapeHtml(referenciaMantenimiento)}</p>
                <p><b>Activo:</b> ${escapeHtml(numeroActivo)}</p>
                <p><b>Nro Reporte:</b> ${escapeHtml(numeroReporte)}</p>
              </div>
            </section>

            <h1 class="titulo">Orden De Mantenimiento</h1>

            <section class="bloque">
              <h3>Datos Del Activo</h3>
              <div class="grid">
                <div class="item"><b>Activo:</b> ${escapeHtml(activo.activo || activo.nombre || "-")}</div>
                <div class="item"><b>N.º De Reporte:</b> ${escapeHtml(numeroReporte)}</div>
                <div class="item"><b>Serial:</b> ${escapeHtml(activo.serial || "-")}</div>
                <div class="item"><b>Equipo:</b> ${escapeHtml(activo.equipo || "-")}</div>
                <div class="item"><b>Marca / Modelo:</b> ${escapeHtml(activo.marca || "-")} / ${escapeHtml(activo.modelo || "-")}</div>
                <div class="item"><b>Procesador:</b> ${escapeHtml(activo.procesador || "-")}</div>
                <div class="item"><b>Ram / Disco:</b> ${escapeHtml([activo.tipoRam || activo.tiporam, activo.ram].filter(Boolean).join(" ") || "-")} / ${escapeHtml(activo.tipoDisco || activo.tipodisco || "-")} ${escapeHtml(activo.hdd || "")}</div>
                <div class="item"><b>Sistema:</b> ${escapeHtml(activo.os || "-")}</div>
                <div class="item"><b>Sede/Entidad:</b> ${escapeHtml(activo.sede || "-")}</div>
                <div class="item"><b>ÁREA:</b> ${escapeHtml(activo.areaPrincipal || activo.areaprincipal || "-")} ${escapeHtml((activo.areaSecundaria || activo.areasecundaria) ? `- ${activo.areaSecundaria || activo.areasecundaria}` : "")}</div>
                <div class="item"><b>Estado:</b> ${escapeHtml(activo.estado || "-")}</div>
              </div>
            </section>

            <section class="bloque">
              <h3>Intervención Y Responsable</h3>
              <div class="grid">
                <div class="item"><b>Tipo:</b> ${escapeHtml(mantenimiento.tipo || "-")}</div>
                <div class="item"><b>Técnico:</b> ${escapeHtml(mantenimiento.tecnico || "-")}</div>
                <div class="item"><b>Fecha:</b> ${escapeHtml(formatearFecha(mantenimiento.fecha))}</div>
                <div class="item"><b>Id Mantenimiento:</b> ${escapeHtml(mantenimientoIdDocumento)}</div>
                <div class="item" style="grid-column: span 2;"><b>Cambio de partes:</b> ${escapeHtml(cambioPartes)}</div>
              </div>
              <div class="texto"><b>Trabajo Realizado:</b> ${escapeHtml(mantenimiento.descripcion || "Sin descripción")}</div>
            </section>

            <section class="bloque">
              <h3>FIRMAS</h3>
              <div class="firmas">
                <div class="firma-card">
                  <p><b>Usuario Habitual / Área</b></p>
                  <p>${escapeHtml(datosFactura.usuarioNombre || "-")}</p>
                  <p>${escapeHtml(datosFactura.usuarioArea || "-")} ${escapeHtml(datosFactura.usuarioCargo ? `- ${datosFactura.usuarioCargo}` : "")}</p>
                  ${renderFirma(datosFactura.usuarioFirma)}
                </div>
                <div class="firma-card">
                  <p><b>Quien Autoriza</b></p>
                  <p>${escapeHtml(datosFactura.autorizaNombre || "-")}</p>
                  <p>${escapeHtml(datosFactura.autorizaCargo || "-")}</p>
                  ${renderFirma(datosFactura.autorizaFirma)}
                </div>
              </div>
            </section>

            <section class="legal">
              Al firmar este documento, el usuario habitual/área y quien autoriza aceptan el tratamiento de datos personales conforme a Habeas Data y declaran que la información no ha sido manipulada de forma indebida.
            </section>
          </div>
        </body>
      </html>`;
  };

  const abrirVentanaImpresion = async (modo = "print") => {
    const html = construirDocumentoImpresion();

    const printWindow = globalThis.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
      globalThis.alert("No se pudo abrir la vista de impresión. Habilita ventanas emergentes.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    if (modo === "pdf") {
      globalThis.alert("Se abrirá la vista para generar PDF. En el cuadro de impresión selecciona 'Guardar como PDF'.");
    }

    await waitForPrintWindowReady(printWindow);
    printWindow.focus();
    printWindow.print();
  };

  const imprimirFactura = () => {
    abrirVentanaImpresion("print");
  };

  const descargarPdfNavegador = () => {
    abrirVentanaImpresion("pdf");
  };

  const handleGenerarOrden = () => {
    if (!onOrdenFirmada) return;
    if (!datosFactura.usuarioFirma || !datosFactura.autorizaFirma) {
      globalThis.alert("Debes registrar las firmas del usuario habitual/area y de quien autoriza.");
      return;
    }

    if (!String(datosFactura.autorizaNombre || "").trim() || !String(datosFactura.autorizaCargo || "").trim()) {
      globalThis.alert("Debes registrar nombre y cargo de quien autoriza.");
      return;
    }

    const usuarioHabitual = String(datosFactura.usuarioNombre || "").trim().toLowerCase();
    const autorizaNombre = String(datosFactura.autorizaNombre || "").trim().toLowerCase();
    if (usuarioHabitual && autorizaNombre && usuarioHabitual === autorizaNombre) {
      globalThis.alert("Quien autoriza debe ser diferente al usuario habitual.");
      return;
    }

    onOrdenFirmada({
      ...datosFactura,
      usuarioFirma: datosFactura.usuarioFirma,
      autorizaFirma: datosFactura.autorizaFirma
    });
  };

  const renderSignaturePreview = (signatureData, type) => {
    if (signatureData) {
      return (
        <div className="signature-preview">
          <img src={signatureData} alt="firma" className="signature-preview-img" />
          {!bloqueada && (
            <button
              type="button"
              onClick={() => openSignatureModal(type)}
              className="btn-firmar"
            >
              Firmar De Nuevo
            </button>
          )}
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => openSignatureModal(type)}
        disabled={bloqueada}
        className="btn-firmar"
      >
        Firmar
      </button>
    );
  };

  const numeroActivo =
    activo.activo ||
    activo.nombre ||
    (isAdmin && activo.id ? `Activo #${activo.id}` : "Activo");
  const numeroReporte =
    mantenimiento.numeroReporte ||
    mantenimiento.numero_reporte ||
    mantenimiento.numeroreporte ||
    "-";
  const signatureModalTitleMap = {
    usuarioFirma: "Firma usuario habitual / área",
    autorizaFirma: "Firma de quien autoriza"
  };
  const signatureModalTitle = signatureModalTitleMap[signatureType] || "Firma";
  const handleKeyboardAction = (event, action) => {
    if (event.target !== event.currentTarget) return;
    if (!isKeyboardActivation(event)) return;
    event.preventDefault();
    action();
  };

  return (
    <div className="factura" id="factura-print">
      {onClose && (
        <button type="button" className="factura-close-btn" onClick={onClose} aria-label="Cerrar">
          Cerrar
        </button>
      )}
      <div className="factura-header">
        <div className="empresa">
          <img src={logo} className="logo" alt="MICROCINCO SAS" />
          <div className="empresa-datos">
            <h2>MICROCINCO S.A.S</h2>
            <p>MEDELLIN, ANTIOQUIA</p>
            <p>MDAITAGUI@MICROCINCO.COM</p>
          </div>
        </div>

        <div className="empresa-secundaria">
          <img src={logoAssetControl} className="logo-secundario" alt="AssetControl" />
        </div>

        <div className="factura-info">
          <p><strong>Factura N.°:</strong> {datosFactura.numeroFactura}</p>
          <p><strong>Fecha:</strong> {formatearFecha(datosFactura.fecha)}</p>
          <p><strong>Referencia:</strong> {referenciaMantenimiento}</p>
          <p><strong>Activo:</strong> {numeroActivo}</p>
          <p><strong>Nro Reporte:</strong> {numeroReporte}</p>
          <div className="estado-factura">
            <span className={`badge ${bloqueada ? "badge-bloqueada" : "badge-editable"}`}>
              {bloqueada ? "Bloqueada" : "Editable"}
            </span>
          </div>
        </div>
      </div>

      <h1 className="factura-titulo">Orden De Mantenimiento</h1>

      <div className="bloque">
        <h3>Datos Del Activo</h3>
        <div className="grid">
          <p><strong>Activo:</strong> {activo.activo || activo.nombre || "-"}</p>
          <p><strong>N.º De Reporte:</strong> {numeroReporte}</p>
          <p><strong>Serial:</strong> {activo.serial || "-"}</p>
          <p><strong>Equipo:</strong> {activo.equipo || "-"}</p>
          <p><strong>Marca:</strong> {activo.marca || "-"}</p>
          <p><strong>Modelo:</strong> {activo.modelo || "-"}</p>
          <p><strong>Procesador:</strong> {activo.procesador || "-"}</p>
          <p><strong>RAM:</strong> {[activo.tipoRam || activo.tiporam, activo.ram].filter(Boolean).join(" ") || "-"}</p>
          <p><strong>Disco:</strong> {activo.tipoDisco || activo.tipodisco || "-"}</p>
          <p><strong>Capacidad:</strong> {activo.hdd || "-"}</p>
          <p><strong>Sistema:</strong> {activo.os || "-"}</p>
          <p><strong>Sede/Entidad:</strong> {activo.sede || "-"}</p>
          <p><strong>Área:</strong> {activo.areaPrincipal || activo.areaprincipal || "-"} {activo.areaSecundaria || activo.areasecundaria ? `- ${activo.areaSecundaria || activo.areasecundaria}` : ""}</p>
          <p><strong>Estado:</strong> {activo.estado || "-"}</p>
        </div>
      </div>

      <div className="bloque">
        <h3>Usuario Habitual</h3>
        <div className="grid">
          <div className="campo">
            <label>Nombre</label>
            <input name="usuarioNombre" value={datosFactura.usuarioNombre} onChange={handleChange} disabled={bloqueada} />
          </div>
          <div className="campo">
            <label>Área</label>
            <input name="usuarioArea" value={datosFactura.usuarioArea} onChange={handleChange} disabled={bloqueada} />
          </div>
          <div className="campo">
            <label>Cargo</label>
            <input name="usuarioCargo" value={datosFactura.usuarioCargo} onChange={handleChange} disabled={bloqueada} />
          </div>
          <div className="campo-firma">
            <label>Firma usuario habitual / área</label>
            {renderSignaturePreview(datosFactura.usuarioFirma, "usuarioFirma")}
            <p className="legal-notice">
              Al firmar, el usuario habitual o responsable de área acepta el tratamiento de Habeas Data y declara que no ha manipulado indebidamente la información del activo.
            </p>
          </div>
        </div>
      </div>

      <div className="bloque">
        <h3>Autorización</h3>
        <div className="grid">
          <div className="campo">
            <label>Nombre de quien autoriza</label>
            <input name="autorizaNombre" value={datosFactura.autorizaNombre} onChange={handleChange} disabled={bloqueada} />
          </div>
          <div className="campo">
            <label>Cargo de quien autoriza</label>
            <input name="autorizaCargo" value={datosFactura.autorizaCargo} onChange={handleChange} disabled={bloqueada} />
          </div>
          <div className="campo-firma">
            <label>Firma de quien autoriza</label>
            {renderSignaturePreview(datosFactura.autorizaFirma, "autorizaFirma")}
          </div>
        </div>
      </div>

      <div className="bloque">
        <h3>Tipo De Mantenimiento</h3>
        <div className="checkboxes">
          <label><input type="checkbox" checked={tipoMantenimientoNormalizado === "preventivo"} readOnly /> Preventivo</label>
          <label><input type="checkbox" checked={tipoMantenimientoNormalizado === "correctivo"} readOnly /> Correctivo</label>
          <label><input type="checkbox" checked={tipoMantenimientoNormalizado === "predictivo"} readOnly /> Predictivo</label>
          <label><input type="checkbox" checked={tipoMantenimientoNormalizado === "calibracion"} readOnly /> Calibración</label>
        </div>
      </div>

      <div className="bloque">
        <h3>Trabajo Realizado</h3>
        <div className="grid">
          <p><strong>Cambio de partes:</strong> {cambioPartes}</p>
        </div>
        <textarea className="textarea" value={mantenimiento.descripcion || "Sin descripción"} readOnly />
      </div>

      <div className="bloque">
        <h3>Responsable</h3>
        <div className="grid">
          <p><strong>Técnico Asignado:</strong> {mantenimiento.tecnico || "-"}</p>
          <p><strong>Fecha:</strong> {formatearFecha(mantenimiento.fecha)}</p>
        </div>
      </div>

      <div className="bloque legal-block">
        <h3>Declaración Legal</h3>
        <p className="legal-copy">
          Este documento registra la intervención técnica, la aceptación del usuario habitual o área responsable y la autorización de un tercero autorizado. Las firmas digitales tienen validez de consentimiento para tratamiento de datos personales conforme a Habeas Data y políticas de seguridad de la información.
        </p>
      </div>

      <div className="bloque acciones">
        {!bloqueada ? (
          <button onClick={guardarFactura} className="btn-guardar" type="button">
            Guardar Y Bloquear
          </button>
        ) : (
          <div className="botones-bloqueados">
            {isAdmin && (
              <button onClick={desbloquearFactura} className="btn-desbloquear" type="button">
                Desbloquear (Admin)
              </button>
            )}
            {isAdmin && (
              <button onClick={eliminarFactura} className="btn-eliminar" type="button">
                Eliminar Datos (Admin)
              </button>
            )}
            <button onClick={imprimirFactura} className="btn-imprimir" type="button">
              Imprimir
            </button>
            <button onClick={descargarPdfNavegador} className="btn-imprimir" type="button">
              Generar PDF
            </button>
            {onOrdenFirmada && (
                <button
                  onClick={handleGenerarOrden}
                  className="btn-imprimir"
                  type="button"
                  disabled={!datosFactura.usuarioFirma || !datosFactura.autorizaFirma}
                >
                  Generar Orden (Con PDF)
                </button>
            )}
            {onClose && (
              <button onClick={onClose} className="btn-desbloquear" type="button">
                Cerrar
              </button>
            )}
          </div>
        )}
      </div>

      {showSignatureModal && (
        <div
          className="signature-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeSignatureModal();
          }}
          onKeyDown={(event) => handleKeyboardAction(event, closeSignatureModal)}
          role="button"
          tabIndex={0}
          aria-label="Cerrar modal de firma"
        >
          <div className="signature-modal-content" role="dialog" aria-modal="true">
            <div className="signature-modal-header">
              <h3>
                {signatureModalTitle}
              </h3>
              <button className="close-modal" onClick={closeSignatureModal} type="button" aria-label="Cerrar">
                Cerrar
              </button>
            </div>
            <div className="signature-modal-body">
              <FirmaDigital
                value={tempSignature}
                onChange={setTempSignature}
                disabled={bloqueada}
                label="Dibuja tu firma"
              />
            </div>
            <div className="signature-modal-footer">
              <button className="btn-confirmar-firma" onClick={confirmarFirma} type="button" disabled={!tempSignature}>
                Confirmar
              </button>
              <button className="btn-cancelar-firma" onClick={closeSignatureModal} type="button">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

FacturaMantenimiento.propTypes = {
  activo: PropTypes.object,
  mantenimiento: PropTypes.object,
  onClose: PropTypes.func,
  onOrdenFirmada: PropTypes.func,
  isAdmin: PropTypes.bool,
  mantenimientoConsecutivo: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};

FacturaMantenimiento.defaultProps = {
  activo: {},
  mantenimiento: {},
  onClose: null,
  onOrdenFirmada: null,
  isAdmin: false,
  mantenimientoConsecutivo: null
};




