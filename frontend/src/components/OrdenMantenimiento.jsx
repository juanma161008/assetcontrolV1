import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import logo from "../assets/logos/logom5.png";
import "../styles/Orden.css";
import FirmaDigital from "./shared/FirmaDigital";
import { toProperCase } from "../utils/formatters";
import { imageToDataUrl } from "../utils/imageToDataUrl";

// Componente principal de la orden de mantenimiento: guarda borradores, abre modales,
// captura firmas y genera la versión imprimible/PDF.
const FACTURA_STORAGE_PREFIX = "factura_mantenimiento_";
const isKeyboardActivation = (event) => event.key === "Enter" || event.key === " ";

const getDefaultOrderNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `MT-${year}${month}${day}-00001`;
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
  Boolean(String(payload.usuarioFirma || "").trim());

// Texto legal que se muestra antes de habilitar cualquier firma.
const LEGAL_DECLARATION = {
  title: "Declaración Legal y Autorización de Tratamiento de Datos Personales",
  intro:
    "El presente documento tiene como finalidad registrar la ejecución de actividades técnicas, la aceptación por parte del usuario habitual o área responsable y la autorización correspondiente por terceros autorizados, cuando aplique.",
  paragraphs: [
    "Mediante la firma física o digital de este documento, los titulares de la información autorizan de manera previa, expresa, informada e inequívoca el tratamiento de sus datos personales, conforme a lo establecido en la Constitución Política de Colombia, la Ley Estatutaria 1581 de 2012, el Decreto 1377 de 2013, la Ley 527 de 1999 sobre mensajes de datos y firmas digitales, y demás normas concordantes en materia de protección de datos personales y seguridad de la información.",
    "Los datos recolectados serán utilizados únicamente para fines relacionados con la gestión administrativa, control de activos, soporte técnico, mantenimiento, trazabilidad de servicios, validación de identidad, cumplimiento contractual y demás finalidades legítimas asociadas a la operación de la organización."
  ],
  items: [
    "Sus datos serán tratados bajo principios de legalidad, finalidad, libertad, veracidad, transparencia, acceso y seguridad.",
    "Puede ejercer en cualquier momento los derechos de conocer, actualizar, rectificar y suprimir sus datos personales, así como revocar la autorización otorgada, conforme a la normatividad colombiana vigente.",
    "La información suministrada será almacenada y protegida mediante controles administrativos, técnicos y organizacionales orientados a garantizar la confidencialidad, integridad y disponibilidad de la información.",
    "Las firmas digitales, electrónicas o mecanismos de aceptación utilizados en este documento tendrán plena validez jurídica y probatoria conforme a la legislación colombiana aplicable."
  ],
  closing:
    "La aceptación y firma del presente documento constituye constancia de consentimiento para el tratamiento de datos personales y aceptación de las condiciones aquí descritas."
};

// Espera a que la ventana de impresión cargue estilos e imágenes antes de lanzar el diálogo.
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
  mantenimientoConsecutivo,
  numeroOrdenSugerido,
  ordenExistente,
  isProcessing,
  bulkSelectionCount,
  bulkSelectionSummary
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

  // Estado local del formulario, los modales y la firma temporal que se está editando.
  const [datosFactura, setDatosFactura] = useState({
    numeroFactura: numeroOrdenSugerido || getDefaultOrderNumber(),
    fecha: fechaFormateadaAuto,
    usuarioNombre: "",
    usuarioArea: "",
    usuarioCargo: "",
    usuarioFirma: ""
  });

  const [bloqueada, setBloqueada] = useState(false);
  const [showLegalConsentModal, setShowLegalConsentModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingSignatureType, setPendingSignatureType] = useState("");
  const [signatureType, setSignatureType] = useState("");
  const [tempSignature, setTempSignature] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState(logo);
  const inputsDisabled = bloqueada || isProcessing;

  // Convierte el logo a data URI: el documento impreso se abre en ventanas/PDF
  // que no siempre resuelven la ruta del asset del propio origen de la app.
  useEffect(() => {
    let cancelado = false;
    imageToDataUrl(logo)
      .then((dataUrl) => {
        if (!cancelado && dataUrl) setLogoDataUrl(dataUrl);
      })
      .catch(() => {
        // Si falla la conversion, se conserva la ruta original del logo.
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Recupera un borrador guardado o crea un nuevo consecutivo cuando no existe información previa.
  useEffect(() => {
    // Si ya existe una orden generada en el servidor para este mantenimiento, prevalece
    // sobre el borrador local: garantiza que se vea "Bloqueada" en cualquier dispositivo.
    if (ordenExistente) {
      setDatosFactura((prev) => ({
        ...prev,
        numeroFactura: ordenExistente.numero || numeroOrdenSugerido || prev.numeroFactura,
        fecha: fechaFormateadaAuto,
        usuarioNombre: ordenExistente.firmante_nombre || "",
        usuarioArea: ordenExistente.firmante_area || "",
        usuarioCargo: ordenExistente.firmante_cargo || "",
        usuarioFirma: ordenExistente.usuario_firma || ""
      }));
      setBloqueada(true);
      return;
    }

    // Sin una orden real en el servidor, el formulario nunca queda "Bloqueada": el
    // bloqueo solo lo determina que la orden ya exista en Ordenes de trabajo, no que
    // haya un borrador local guardado (eso solo se usa para no perder lo ya escrito).
    const guardada = localStorage.getItem(storageKey);
    if (guardada) {
      try {
        const parsed = JSON.parse(guardada);
        const payloadCargado = {
          ...parsed,
          usuarioFirma: parsed.usuarioFirma || parsed.tecnicoFirma || ""
        };
        setDatosFactura((prev) => ({
          ...prev,
          ...payloadCargado,
          numeroFactura: payloadCargado.numeroFactura || numeroOrdenSugerido || prev.numeroFactura,
          fecha: payloadCargado.fecha || prev.fecha
        }));
        setBloqueada(false);
        return;
      } catch {
        // Ignorar JSON dañado.
      }
    }

    setDatosFactura({
      numeroFactura: numeroOrdenSugerido || getDefaultOrderNumber(),
      fecha: fechaFormateadaAuto,
      usuarioNombre: "",
      usuarioArea: "",
      usuarioCargo: "",
      usuarioFirma: ""
    });
    setBloqueada(false);
  }, [storageKey, fechaFormateadaAuto, numeroOrdenSugerido, ordenExistente]);

  // Bloquea el scroll de la pagina cuando hay un modal abierto.
  useEffect(() => {
    if (showSignatureModal || showLegalConsentModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showSignatureModal, showLegalConsentModal]);

  // Normaliza los campos editables y conserva el formato visual del formulario.
  const handleChange = (event) => {
    const { name, value } = event.target;
    const properCaseFields = new Set([
      "usuarioNombre",
      "usuarioArea",
      "usuarioCargo"
    ]);
    const nextValue = properCaseFields.has(name) ? toProperCase(value) : value;
    setDatosFactura((prev) => ({ ...prev, [name]: nextValue }));
  };

  const openSignatureModal = (type) => {
    if (!type || inputsDisabled) return;
    setSignatureType(type);
    setTempSignature(datosFactura[type] || "");
    setShowSignatureModal(true);
  };

  const openLegalConsentModal = (type) => {
    if (inputsDisabled || !type) return;
    setPendingSignatureType(type);
    setShowLegalConsentModal(true);
  };

  const closeLegalConsentModal = () => {
    setShowLegalConsentModal(false);
    setPendingSignatureType("");
  };

  const acceptLegalConsent = () => {
    if (!pendingSignatureType) return;
    const nextType = pendingSignatureType;
    closeLegalConsentModal();
    openSignatureModal(nextType);
  };

  const closeSignatureModal = () => {
    setShowSignatureModal(false);
    setSignatureType("");
    setTempSignature("");
    setPendingSignatureType("");
  };

  const confirmarFirma = async () => {
    if (!tempSignature || !signatureType || isProcessing) return;
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
    if (isProcessing) return;

    const payload = {
      ...datosFactura,
      numeroFactura: datosFactura.numeroFactura || numeroOrdenSugerido || getDefaultOrderNumber(),
      fecha: formatearFecha(datosFactura.fecha || mantenimiento.fecha)
    };

    if (payload.usuarioFirma) {
      payload.usuarioFirma = await reducirFirma(payload.usuarioFirma);
    }

    localStorage.setItem(storageKey, JSON.stringify(payload));
    setDatosFactura(payload);
    // El bloqueo real solo ocurre cuando la orden ya existe en el servidor (Ordenes de
    // trabajo); guardar aqui solo conserva el borrador para no perder lo ya escrito.
    globalThis.alert(
      facturaTieneFirmasCompletas(payload)
        ? "Borrador guardado. Usa \"Generar Orden\" para crear la orden en Órdenes de trabajo."
        : "Orden guardada como borrador. Completa la firma del usuario habitual para poder generarla."
    );
  };

  const desbloquearFactura = () => {
    if (isProcessing) return;

    if (!isAdmin) {
      globalThis.alert("Solo un administrador puede desbloquear la orden.");
      return;
    }
    const ok = globalThis.confirm("¿Deseas desbloquear la orden para editarla?");
    if (!ok) return;
    setBloqueada(false);
  };

  const eliminarFactura = () => {
    if (isProcessing) return;

    if (!isAdmin) {
      globalThis.alert("Solo un administrador puede eliminar los datos bloqueados.");
      return;
    }
    const ok = globalThis.confirm("Se eliminarán los datos guardados de la orden. ¿Continuar?");
    if (!ok) return;

    localStorage.removeItem(storageKey);

    setDatosFactura({
      numeroFactura: numeroOrdenSugerido || getDefaultOrderNumber(),
      fecha: fechaFormateadaAuto,
      usuarioNombre: "",
      usuarioArea: "",
      usuarioCargo: "",
      usuarioFirma: ""
    });
    setBloqueada(false);
  };

  const mantenimientoIdDocumento =
    Number(mantenimientoConsecutivo) > 0
      ? String(mantenimientoConsecutivo)
      : String(mantenimiento.id || "-");
  const tipoMantenimientoNormalizado = String(mantenimiento.tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const cambioPartes = String(mantenimiento.cambio_partes || mantenimiento.cambioPartes || "-").trim() || "-";

  // Construye el HTML final que se abre en la ventana de impresión o PDF.
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
          <title>Orden de mantenimiento ${escapeHtml(datosFactura.numeroFactura || "00")}</title>
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
              <img src="${escapeHtml(logoDataUrl)}" alt="MICROCINCO" />
              <div class="empresa">
                <h2>MICROCINCO S.A.S</h2>
                <p>MEDELLIN, ANTIOQUIA</p>
                <p>MDAITAGUI@MICROCINCO.COM</p>
              </div>
              <div class="info">
                <p><b>Orden N.°:</b> ${escapeHtml(datosFactura.numeroFactura || "-")}</p>
                <p><b>Fecha:</b> ${escapeHtml(formatearFecha(datosFactura.fecha))}</p>
                <p><b>Activo:</b> ${escapeHtml(numeroActivo)}</p>
              </div>
            </section>

            <h1 class="titulo">Orden De Mantenimiento</h1>

            <section class="bloque">
              <h3>Datos Del Activo</h3>
              <div class="grid">
                <div class="item"><b>Activo:</b> ${escapeHtml(activo.activo || activo.nombre || "-")}</div>
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
              <div class="texto"><b>Observaciones:</b> ${escapeHtml(mantenimiento.descripcion || "Sin observaciones")}</div>
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
                  <p><b>Autorización del Interventor</b></p>
                  <p>Pendiente de autorización del interventor de la entidad.</p>
                </div>
              </div>
            </section>

          </div>
        </body>
      </html>`;
  };

  // Abre la vista de impresión y espera a que todo cargue antes de imprimir.
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
    if (isProcessing) return;
    abrirVentanaImpresion("print");
  };

  const descargarPdfNavegador = () => {
    if (isProcessing) return;
    abrirVentanaImpresion("pdf");
  };

  // Genera la orden en el servidor aunque aun no tenga firma: queda guardada como
  // "pendiente por firma" y se puede firmar despues desde Ordenes de trabajo.
  const handleGenerarOrden = () => {
    if (!onOrdenFirmada || isProcessing) return;

    onOrdenFirmada({ ...datosFactura });
  };

  // Muestra la firma guardada o el botón que inicia el flujo de firma.
  const renderSignaturePreview = (signatureData, type) => {
    if (signatureData) {
      return (
        <div className="signature-preview">
          <img src={signatureData} alt="firma" className="signature-preview-img" />
          {!inputsDisabled && (
            <button
              type="button"
              onClick={() => openLegalConsentModal(type)}
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
        onClick={() => openLegalConsentModal(type)}
        disabled={inputsDisabled}
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
  const signatureModalTitleMap = {
    usuarioFirma: "Firma usuario habitual / área"
  };
  const signatureModalTitle = signatureModalTitleMap[signatureType] || "Firma";
  const consentTargetTitle = signatureModalTitleMap[pendingSignatureType] || "Firma";
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
      {/* Encabezado institucional con los datos principales de la factura. */}
      <div className="factura-header">
        <div className="empresa">
          <img src={logo} className="logo" alt="MICROCINCO SAS" />
          <div className="empresa-datos">
            <h2>MICROCINCO S.A.S</h2>
            <p>MEDELLIN, ANTIOQUIA</p>
            <p>MDAITAGUI@MICROCINCO.COM</p>
          </div>
        </div>

        <div className="factura-info">
          <p><strong>Orden N.°:</strong> {datosFactura.numeroFactura}</p>
          <p><strong>Fecha:</strong> {formatearFecha(datosFactura.fecha)}</p>
          <p><strong>Activo:</strong> {numeroActivo}</p>
          <div className="estado-factura">
            <span className={`badge ${bloqueada ? "badge-bloqueada" : "badge-editable"}`}>
              {bloqueada ? (ordenExistente?.estado || "Bloqueada") : "Editable"}
            </span>
          </div>
        </div>
      </div>

      <h1 className="factura-titulo">Orden De Mantenimiento</h1>
      {bulkSelectionCount > 1 && (
        <div className="factura-bulk-banner" role="status" aria-live="polite">
          Se aplicará a {bulkSelectionCount} mantenimientos seleccionados.
          {bulkSelectionSummary ? ` ${bulkSelectionSummary}` : ""}
        </div>
      )}

      {/* Datos del activo que sostienen la orden. */}
      <div className="bloque">
        <h3>Datos Del Activo</h3>
        <div className="grid">
          <p><strong>Activo:</strong> {activo.activo || activo.nombre || "-"}</p>
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

      {/* Datos y firma del usuario habitual. */}
      <div className="bloque">
        <h3>Usuario Habitual</h3>
        <div className="grid">
          <div className="campo">
            <label>Nombre</label>
            <input name="usuarioNombre" value={datosFactura.usuarioNombre} onChange={handleChange} disabled={inputsDisabled} />
          </div>
          <div className="campo">
            <label>Área</label>
            <input name="usuarioArea" value={datosFactura.usuarioArea} onChange={handleChange} disabled={inputsDisabled} />
          </div>
          <div className="campo">
            <label>Cargo</label>
            <input name="usuarioCargo" value={datosFactura.usuarioCargo} onChange={handleChange} disabled={inputsDisabled} />
          </div>
          <div className="campo-firma">
            <label>Firma usuario habitual / área</label>
            {renderSignaturePreview(datosFactura.usuarioFirma, "usuarioFirma")}
            <p className="legal-notice">
              Antes de guardar la firma se mostrará la declaración legal completa para su aceptación.
            </p>
          </div>
        </div>
      </div>

      {/* Tipo de mantenimiento marcado en la orden. */}
      <div className="bloque">
        <h3>Tipo De Mantenimiento</h3>
        <div className="checkboxes">
          <label><input type="checkbox" checked={tipoMantenimientoNormalizado === "preventivo"} readOnly /> Preventivo</label>
          <label><input type="checkbox" checked={tipoMantenimientoNormalizado === "correctivo"} readOnly /> Correctivo</label>
          <label><input type="checkbox" checked={tipoMantenimientoNormalizado === "predictivo"} readOnly /> Predictivo</label>
          <label><input type="checkbox" checked={tipoMantenimientoNormalizado === "calibracion"} readOnly /> Calibración</label>
        </div>
      </div>

      {/* Observaciones del trabajo realizado. */}
      <div className="bloque">
        <h3>Observaciones</h3>
        <div className="grid">
          <p><strong>Cambio de partes:</strong> {cambioPartes}</p>
        </div>
        <textarea className="textarea" value={mantenimiento.descripcion || "Sin observaciones"} readOnly />
      </div>

      {/* Técnico responsable y fecha de intervención. */}
      <div className="bloque">
        <h3>Responsable</h3>
        <div className="grid">
          <p><strong>Técnico Asignado:</strong> {mantenimiento.tecnico || "-"}</p>
          <p><strong>Fecha:</strong> {formatearFecha(mantenimiento.fecha)}</p>
        </div>
      </div>

      {/* Acciones finales: guardar, generar la orden, imprimir o cerrar. */}
      <div className="bloque acciones">
        {!bloqueada ? (
          <div className="botones-bloqueados">
            <button onClick={guardarFactura} className="btn-guardar" type="button" disabled={isProcessing}>
              Guardar Borrador
            </button>
            {onOrdenFirmada && (
              <button
                onClick={handleGenerarOrden}
                className="btn-imprimir"
                type="button"
                disabled={isProcessing}
              >
                {isProcessing
                  ? "Generando..."
                  : datosFactura.usuarioFirma
                    ? "Guardar Y Generar Orden"
                    : "Generar Orden (Pendiente De Firma)"}
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="btn-desbloquear" type="button" disabled={isProcessing}>
                Cerrar
              </button>
            )}
          </div>
        ) : (
          <div className="botones-bloqueados">
            {isAdmin && (
              <button onClick={desbloquearFactura} className="btn-desbloquear" type="button" disabled={isProcessing}>
                Desbloquear (Admin)
              </button>
            )}
            {isAdmin && (
              <button onClick={eliminarFactura} className="btn-eliminar" type="button" disabled={isProcessing}>
                Eliminar Datos (Admin)
              </button>
            )}
            <button onClick={imprimirFactura} className="btn-imprimir" type="button" disabled={isProcessing}>
              Imprimir
            </button>
            <button onClick={descargarPdfNavegador} className="btn-imprimir" type="button" disabled={isProcessing}>
              Generar PDF
            </button>
            {onClose && (
              <button onClick={onClose} className="btn-desbloquear" type="button" disabled={isProcessing}>
                Cerrar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal legal que aparece antes de permitir firmar. */}
      {/* Se renderiza en un portal a document.body para que el position:fixed no quede
          atrapado dentro del contenedor .modal-dialog (tiene transform/will-change y
          rompe el centrado cuando la orden es larga y está scrolleada). */}
      {showLegalConsentModal && typeof document !== "undefined" && createPortal(
        <div
          className="signature-modal-overlay consent-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeLegalConsentModal();
          }}
          onKeyDown={(event) => handleKeyboardAction(event, closeLegalConsentModal)}
          role="button"
          tabIndex={0}
          aria-label="Cerrar consentimiento legal"
        >
          <div
            className="signature-modal-content consent-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-consent-title"
          >
            <div className="signature-modal-header consent-modal-header">
              <h3 id="legal-consent-title" className="consent-modal-title">
                {LEGAL_DECLARATION.title}
              </h3>
              <button className="close-modal" onClick={closeLegalConsentModal} type="button" aria-label="Cerrar">
                Cerrar
              </button>
            </div>
            <div className="signature-modal-body consent-modal-body">
              <p className="consent-modal-intro">{LEGAL_DECLARATION.intro}</p>
              {LEGAL_DECLARATION.paragraphs.map((paragraph) => (
                <p className="consent-modal-text" key={paragraph}>
                  {paragraph}
                </p>
              ))}
              <div className="consent-modal-list-card">
                <p className="consent-modal-list-title">El titular declara conocer que:</p>
                <ul className="consent-modal-list">
                  {LEGAL_DECLARATION.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <p className="consent-modal-closing">{LEGAL_DECLARATION.closing}</p>
              <p className="consent-modal-target">Vas a continuar con: {consentTargetTitle}</p>
            </div>
            <div className="signature-modal-footer consent-modal-footer">
              <button className="btn-confirmar-firma" onClick={acceptLegalConsent} type="button">
                Acepto y continuar
              </button>
              <button className="btn-cancelar-firma" onClick={closeLegalConsentModal} type="button">
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal del lienzo de firma digital (también en portal, ver comentario arriba). */}
      {showSignatureModal && typeof document !== "undefined" && createPortal(
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
                disabled={inputsDisabled}
                label="Dibuja tu firma"
              />
            </div>
            <div className="signature-modal-footer">
              <button className="btn-confirmar-firma" onClick={confirmarFirma} type="button" disabled={!tempSignature || isProcessing}>
                Confirmar
              </button>
              <button className="btn-cancelar-firma" onClick={closeSignatureModal} type="button" disabled={isProcessing}>
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
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
  mantenimientoConsecutivo: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  numeroOrdenSugerido: PropTypes.string,
  ordenExistente: PropTypes.object,
  isProcessing: PropTypes.bool,
  bulkSelectionCount: PropTypes.number,
  bulkSelectionSummary: PropTypes.string
};

FacturaMantenimiento.defaultProps = {
  activo: {},
  mantenimiento: {},
  onClose: null,
  onOrdenFirmada: null,
  isAdmin: false,
  mantenimientoConsecutivo: null,
  numeroOrdenSugerido: "",
  ordenExistente: null,
  isProcessing: false,
  bulkSelectionCount: 0,
  bulkSelectionSummary: ""
};




