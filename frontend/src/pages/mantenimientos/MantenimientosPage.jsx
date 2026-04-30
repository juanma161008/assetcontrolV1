import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../../styles/Mantenimiento.css";
import { MantenimientoService } from "../../domain/mantenimientos/MantenimientoService";
import { getCurrentUser, isAuthenticated } from "../../services/authService";
import { hasPermission } from "../../utils/permissions";
import FacturaMantenimiento from "../../components/OrdenMantenimiento";
import httpClient from "../../services/httpClient";
import { buildMaintenanceEmailDraft } from "../../utils/email";
import { sendEmailNotification } from "../../services/notificacionService";
import { buildDocumentEmailHtml, buildMaintenanceOrderHtml } from "../../utils/emailDocuments";
import { buildMaintenancePdfReportHtml } from "../../utils/maintenanceReport";
import { toProperCase } from "../../utils/formatters";
import useAnimatedPresence from "../../hooks/useAnimatedPresence";
import logoM5 from "../../assets/logos/logom5.png";
import logoAssetControl from "../../assets/logos/logo-assetcontrol.png";
import {
  ACTIVO_CATEGORY_OPTIONS,
  CATEGORY_SUMMARY_KEYS,
  inferCategoriaActivo,
  normalizeCategoriaActivo
} from "../../utils/activosCategoria";

const mantenimientoService = new MantenimientoService();
const DEFAULT_TECNICO = "Microcinco";
const IMPORT_ACCEPT = ".xlsm,.xlsx,.xls,.csv";
const MENU_ALL_CATEGORY = "all";
const MOBILE_BREAKPOINT = 768;
const DIGIT_GROUP_REGEX = /\d+/g;
const DAY_FIRST_DATE_REGEX = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAINTENANCE_EXPORT_SCOPE_OPTIONS = [
  {
    value: "filtered",
    label: "Filtrados (busqueda)",
    reportLabel: "Filtrados (busqueda y filtros)",
    includeFilters: true
  },
  {
    value: "selected",
    label: "Seleccionados",
    reportLabel: "Solo seleccionados",
    includeFilters: false
  },
  {
    value: "all",
    label: "Todos",
    reportLabel: "Todos los mantenimientos",
    includeFilters: false
  }
];
const MAINTENANCE_REPORT_COLUMNS = [
  { key: "consecutivo", label: "Consecutivo" },
  { key: "fecha", label: "Fecha" },
  { key: "numeroReporte", label: "N. reporte" },
  { key: "activo", label: "Activo" },
  { key: "sede", label: "Sede" },
  { key: "area", label: "Area" },
  { key: "equipo", label: "Equipo" },
  { key: "tipo", label: "Tipo" },
  { key: "estado", label: "Estado" },
  { key: "tecnico", label: "Tecnico" },
  { key: "planificacion", label: "Planificacion" },
  { key: "descripcion", label: "Descripcion" },
  { key: "cambioPartes", label: "Cambio de partes" }
];
const MAINTENANCE_EXCEL_COLUMN_WIDTHS = {
  consecutivo: 10,
  fecha: 12,
  numeroReporte: 16,
  activo: 18,
  sede: 18,
  area: 18,
  equipo: 18,
  tipo: 14,
  estado: 14,
  tecnico: 18,
  planificacion: 16,
  descripcion: 32,
  cambioPartes: 28
};
const downloadBlobFile = (blob, filename) => {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
};
const imageToDataUrl = async (src) => {
  if (!src) return "";
  if (String(src).startsWith("data:image")) return src;
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error("No se pudo cargar el logo");
  }
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo convertir el logo"));
    reader.readAsDataURL(blob);
  });
};
const parseExcelImage = (dataUrl) => {
  if (!dataUrl) return null;
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(dataUrl));
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const extension = mime.includes("png")
    ? "png"
    : mime.includes("jpeg") || mime.includes("jpg")
      ? "jpeg"
      : mime.includes("gif")
        ? "gif"
        : "png";
  return { base64: match[2], extension };
};
const toFilenameSlug = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
const getBrowserWindow = () => globalThis.window;
const isValidEmailAddress = (value = "") => {
  const source = String(value || "").trim();
  if (!source || source.includes(" ")) return false;

  const parts = source.split("@");
  if (parts.length !== 2) return false;

  const [localPart, domainPart] = parts;
  if (!localPart || !domainPart || domainPart.startsWith(".") || domainPart.endsWith(".")) {
    return false;
  }

  const domainSections = domainPart.split(".").filter(Boolean);
  return domainSections.length >= 2;
};
const getLastDigitGroup = (value = "") => {
  const source = String(value || "").trim();
  if (!source) return "";

  const regex = new RegExp(DIGIT_GROUP_REGEX);
  let match = regex.exec(source);
  let lastMatch = "";

  while (match) {
    lastMatch = match[0];
    match = regex.exec(source);
  }

  return lastMatch;
};
const getViewportWidth = () => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) return null;
  return Number(browserWindow.innerWidth || 0);
};
const isMobileViewport = () => {
  const viewportWidth = getViewportWidth();
  return viewportWidth !== null && viewportWidth <= MOBILE_BREAKPOINT;
};
const formatTecnicoNombre = (value = "") => {
  const source = String(value || "").trim();
  if (!source) return toProperCase(DEFAULT_TECNICO);
  return toProperCase(source);
};
const normalizeUiToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "-");
const normalizeEstado = (value = "") => String(value || "").trim().toLowerCase();
const normalizeActivoEstado = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "");
const activoEstaFueraServicio = (activo) => {
  const estado = normalizeActivoEstado(activo?.estado);
  return estado === "fueradeservicio" || estado === "baja" || estado === "retirado";
};
const normalizeSearchValue = (value = "") =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .trim();
const normalizeImportKey = (value = "") => normalizeSearchValue(value).replaceAll(/[^a-z0-9]/g, "");
const MANTENIMIENTO_TIPO_PUNTO_RED = "Preventivo Punto De Red";
const MANTENIMIENTO_TIPO_DOBLE = "Preventivo + Correctivo";
const MANTENIMIENTO_TIPO_CRONOGRAMA = "Cronograma";
const MANTENIMIENTO_TIPO_PUNTO_RED_ALIASES = [
  MANTENIMIENTO_TIPO_PUNTO_RED,
  "Punto Red",
  "Punto de Red",
  "Preventivo Punto De Red",
  "Instalacion Punto De Red",
  "Instalación Punto de Red",
  "Instalación Punto De Red"
];
const isPuntoRedTipo = (value = "") =>
  MANTENIMIENTO_TIPO_PUNTO_RED_ALIASES.some(
    (item) => normalizeSearchValue(value) === normalizeSearchValue(item)
  );
const isCronogramaTipo = (value = "") =>
  normalizeSearchValue(value) === normalizeSearchValue(MANTENIMIENTO_TIPO_CRONOGRAMA);
const getEstadoLabel = (mantenimiento = {}) => {
  if (isCronogramaTipo(mantenimiento?.tipo)) return "Programado";
  return String(mantenimiento?.estado || "").trim();
};
const getEstadoLabelOrDash = (mantenimiento = {}) => getEstadoLabel(mantenimiento) || "-";
const getEstadoNormalized = (mantenimiento = {}) => normalizeEstado(getEstadoLabel(mantenimiento));
const getEstadoUiToken = (mantenimiento = {}) => normalizeUiToken(getEstadoLabel(mantenimiento));
const isTipoDoble = (value = "") =>
  normalizeSearchValue(value) === normalizeSearchValue(MANTENIMIENTO_TIPO_DOBLE);
const normalizePuntoRedTipo = (value = "") =>
  isPuntoRedTipo(value) ? MANTENIMIENTO_TIPO_PUNTO_RED : value;
const formatTipoMantenimiento = (value = "") => {
  const source = String(value || "").trim();
  if (!source) return "";
  if (isPuntoRedTipo(source)) return "Punto de Red";
  if (isCronogramaTipo(source)) return "Cronograma";
  const normalized = normalizeSearchValue(source);
  if (normalized === "calibracion") return "Calibración";
  if (normalized === "preventivo") return "Preventivo";
  if (normalized === "correctivo") return "Correctivo";
  if (normalized === "predictivo") return "Predictivo";
  return source;
};
const requiresActivoForTipo = (tipo = "") => !isPuntoRedTipo(tipo) && !isCronogramaTipo(tipo);
const getNumeroReporteLabel = (tipo = "") =>
  isPuntoRedTipo(tipo)
    ? "Código de Punto de Red *"
    : isCronogramaTipo(tipo)
      ? "Área / Dependencia *"
      : "Número de reporte / consecutivo *";
const getNumeroReporteHelp = (tipo = "") =>
  isPuntoRedTipo(tipo)
    ? "Usa el código alfanumérico del Punto de Red. Si lo dejas vacío, el sistema generará un PR automáticamente. Este registro se guarda sin activo asociado."
    : isCronogramaTipo(tipo)
      ? "Registra el área o dependencia para este cronograma. Este registro se guarda sin activo asociado."
      : "Se sugiere el siguiente consecutivo del historial. Puedes modificarlo antes de guardar.";
const formatCategoriaLabel = (value = "") => {
  const normalized = normalizeCategoriaActivo(value);
  if (!normalized) return String(value || "").trim();
  if (normalized === "Impresora / Escaner") return "Impresora / Escáner";
  if (normalized === "Telefono") return "Teléfono";
  return normalized;
};
const matchesAlphanumericReference = (value = "") => /[a-z0-9]/i.test(String(value || "").trim());
const IMPORT_FIELD_ALIASES = {
  fecha: [
    "fecha",
    "fechamantenimiento",
    "fecha_mantenimiento",
    "fechaejecucion",
    "fechaprogramada"
  ],
  numeroReporte: [
    "numeroreporte",
    "numerodereporte",
    "nroreporte",
    "nreporte",
    "noreporte",
    "reporte",
    "numero_reporte",
    "numreporte",
    "reportenumero",
    "numeroreporteot"
  ],
  activo: [
    "activo",
    "activoid",
    "activo_id",
    "idactivo",
    "codigoactivo",
    "codigodeactivo",
    "codactivo",
    "numeroactivo",
    "nroactivo",
    "nrodeactivo",
    "iddeactivo"
  ],
  tipo: [
    "tipo",
    "tipomantenimiento",
    "tipo_mantenimiento",
    "clasemantenimiento",
    "clase",
    "tm",
    "tmantenimiento",
    "tipomtto",
    "tipomto"
  ],
  planificacion: ["planificacion", "programacion", "planificado", "estado_planificacion"],
  estado: ["estado", "estadomantenimiento", "estado_mantenimiento"],
  tecnico: [
    "tecnico",
    "tecnicoasignado",
    "nombretecnico",
    "responsable",
    "tecnicoresponsable"
  ],
  descripcion: [
    "descripcion",
    "detalle",
    "observacion",
    "observaciones",
    "trabajorealizado",
    "descripciontrabajo"
  ]
};
const IMPORT_ALIAS_SETS = Object.fromEntries(
  Object.entries(IMPORT_FIELD_ALIASES).map(([field, aliases]) => [
    field,
    new Set((Array.isArray(aliases) ? aliases : []).map((item) => normalizeImportKey(item)))
  ])
);
const REQUIRED_IMPORT_FIELDS = ["fecha", "numeroReporte", "activo", "tipo"];
const getEstadoInicialByPlanificacion = (planificacion = "") =>
  String(planificacion || "").trim().toLowerCase() === "realizado" ? "Finalizado" : "En proceso";
const getPlanificacionByEstado = (estado = "") =>
  normalizeEstado(estado) === "finalizado" ? "Realizado" : "Programado";
const getNumeroReporteMantenimiento = (mantenimiento = {}) =>
  String(
    mantenimiento.numeroReporte ??
    mantenimiento.numero_reporte ??
    mantenimiento.numeroreporte ??
    ""
  ).trim();
const getPuntoRedActivoLabel = (mantenimiento = {}) => {
  const referencia = getNumeroReporteMantenimiento(mantenimiento);
  return referencia ? `Punto de Red / ${referencia}` : "Punto de Red";
};

const extraerConsecutivo = (value) => {
  const source = String(value || "").trim();
  if (!source) return null;
  if (/^\d+$/.test(source)) return Number(source);

  const lastGroup = getLastDigitGroup(source);
  if (!lastGroup) return null;

  const num = Number(lastGroup);
  return Number.isInteger(num) && num > 0 ? num : null;
};

const obtenerSiguienteConsecutivo = (numeros = []) => {
  const usados = new Set(
    (Array.isArray(numeros) ? numeros : [])
      .map(Number)
      .filter((item) => Number.isInteger(item) && item > 0)
  );

  let siguiente = 1;
  while (usados.has(siguiente)) {
    siguiente += 1;
  }
  return siguiente;
};

const splitReportNumber = (value = "") => {
  const source = String(value || "").trim();
  if (!source) return null;

  const matches = Array.from(source.matchAll(/\d+/g));
  if (matches.length === 0) return null;

  const lastMatch = matches[matches.length - 1];
  const digits = lastMatch[0];
  const index = Number.isInteger(lastMatch.index) ? lastMatch.index : source.lastIndexOf(digits);

  return {
    prefix: source.slice(0, index),
    suffix: source.slice(index + digits.length),
    number: Number(digits),
    width: digits.length
  };
};

const buildDefaultMaintenanceForm = (tecnico = DEFAULT_TECNICO) => ({
  fecha: new Date().toISOString().split("T")[0],
  numeroReporte: "",
  activo: "",
  tipo: "",
  planificacion: "Programado",
  tecnico,
  descripcion: "",
  cambioPartes: ""
});

const toTimestamp = (value) => {
  if (!value) return null;

  const source = String(value).trim();
  if (!source) return null;

  const dayFirst = DAY_FIRST_DATE_REGEX.exec(source);
  if (dayFirst) {
    const [, dd, mm, yyyy] = dayFirst;
    const parsed = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      0,
      0,
      0,
      0
    ).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  const isoDate = ISO_DATE_REGEX.exec(source);
  if (isoDate) {
    const [, yyyy, mm, dd] = isoDate;
    const parsed = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      0,
      0,
      0,
      0
    ).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  const parsed = new Date(source).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const sortMantenimientosByRecency = (items = []) => {
  const source = Array.isArray(items) ? [...items] : [];
  return source.sort((a, b) => {
    const timestampA = toTimestamp(a.fecha) ?? toTimestamp(a.created_at);
    const timestampB = toTimestamp(b.fecha) ?? toTimestamp(b.created_at);
    if (timestampA !== null || timestampB !== null) {
      return (timestampB ?? -Infinity) - (timestampA ?? -Infinity);
    }
    return Number(b.id || 0) - Number(a.id || 0);
  });
};

const inferEstadoByFecha = (fechaValue = "") => {
  const fechaTimestamp = toTimestamp(fechaValue);
  if (fechaTimestamp === null) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return fechaTimestamp <= today.getTime() ? "Finalizado" : "En proceso";
};
const toDateKey = (value = "") => {
  const source = String(value || "").trim();
  if (!source) return "";

  const isoDate = ISO_DATE_REGEX.exec(source);
  if (isoDate) {
    const [, yyyy, mm, dd] = isoDate;
    return `${yyyy}-${mm}-${dd}`;
  }

  const dayFirst = DAY_FIRST_DATE_REGEX.exec(source);
  if (dayFirst) {
    const [, dd, mm, yyyy] = dayFirst;
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }

  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};
const formatDateLabel = (value = "") => {
  const key = toDateKey(value);
  if (!key) return String(value || "").trim();
  const [yyyy, mm, dd] = key.split("-");
  return `${dd}/${mm}/${yyyy}`;
};
const toMonthKey = (value = "") => {
  const key = toDateKey(value);
  if (!key) return "";
  return key.slice(0, 7);
};
const formatMonthLabel = (monthKey = "") => {
  if (!monthKey) return "";
  const [yyyy, mm] = String(monthKey).split("-");
  const year = Number(yyyy);
  const month = Number(mm);
  if (!year || !month) return monthKey;
  const date = new Date(year, month - 1, 1);
  if (Number.isNaN(date.getTime())) return monthKey;
  return date.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
};
const getCurrentMonthKey = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
};

export default function MantenimientosPage({ selectedEntidadId }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const importInputRef = useRef(null);
  const reportLogoCacheRef = useRef(null);
  const openFromQueryRef = useRef(false);
  const currentUser = getCurrentUser();
  const isAdmin = hasPermission(currentUser, "ADMIN_TOTAL");
  const entidadActivaId = String(selectedEntidadId ?? "").trim();
  const currentUserTecnico = formatTecnicoNombre(currentUser.nombre || "");
  const currentUserTecnicoNormalized = normalizeSearchValue(currentUserTecnico);
  const defaultTecnico = currentUserTecnico || formatTecnicoNombre(DEFAULT_TECNICO);

  const [mantenimientos, setMantenimientos] = useState([]);
  const [activos, setActivos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [buscar, setBuscar] = useState("");
  const deferredBuscar = useDeferredValue(buscar);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroTecnico, setFiltroTecnico] = useState("");
  const [filtroActivoId, setFiltroActivoId] = useState("");
  const [filtroEntidadId, setFiltroEntidadId] = useState("");
  const [filtroEquipo, setFiltroEquipo] = useState("");
  const [categoriaMenu, setCategoriaMenu] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toast, setToast] = useState(null);
  const lastAlertRef = useRef({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedMantenimientosIds, setSelectedMantenimientosIds] = useState([]);
  const [exportScope, setExportScope] = useState("filtered");
  const [exportMonth, setExportMonth] = useState("");
  const [exportEquipo, setExportEquipo] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalReady, setCreateModalReady] = useState(false);
  const [modalMantenimiento, setModalMantenimiento] = useState(null);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() => isMobileViewport());

  const [form, setForm] = useState(() => buildDefaultMaintenanceForm(defaultTecnico));
  const [doubleFormDrafts, setDoubleFormDrafts] = useState(null);
  const [activoInputNuevo, setActivoInputNuevo] = useState("");
  const resetCreateModalState = useCallback(() => {
    setForm(buildDefaultMaintenanceForm(defaultTecnico));
    setActivoInputNuevo("");
    setDoubleFormDrafts(null);
    setIsCreating(false);
    setCreateModalReady(false);
  }, [defaultTecnico]);
  const resetDetailModalState = useCallback(() => {
    setModalMantenimiento(null);
    setShowFacturaModal(false);
    setError("");
    setSuccess("");
    setIsOrderLoading(false);
    setIsSendingEmail(false);
  }, []);
  const createModalPresence = useAnimatedPresence(showCreateModal, 220, resetCreateModalState);
  const detailModalPresence = useAnimatedPresence(showModal, 220, resetDetailModalState);
  useEffect(() => {
    if (!showCreateModal) {
      setCreateModalReady(false);
      return undefined;
    }

    const raf = globalThis.requestAnimationFrame?.(() => {
      setCreateModalReady(true);
    });

    if (typeof raf !== "number") {
      setCreateModalReady(true);
      return undefined;
    }

    return () => {
      globalThis.cancelAnimationFrame?.(raf);
    };
  }, [showCreateModal]);
  useEffect(() => {
    const body = globalThis?.document?.body;
    if (!body) return undefined;

    const shouldLockBody = createModalPresence.isMounted || detailModalPresence.isMounted;
    if (shouldLockBody) {
      body.classList.add("modal-open");
    } else {
      body.classList.remove("modal-open");
    }

    return () => {
      body.classList.remove("modal-open");
    };
  }, [createModalPresence.isMounted, detailModalPresence.isMounted]);
  const categoriaMenuLabel =
    categoriaMenu === MENU_ALL_CATEGORY ? "Todos los mantenimientos" : formatCategoriaLabel(categoriaMenu);
  const shouldShowMantenimientoContent = Boolean(categoriaMenu);

  const tecnicosAsignadosEntidad = useMemo(() => {
    if (!isAdmin) return [];

    const source = Array.isArray(usuarios) ? usuarios : [];
    return source
      .filter((usuario) => {
        const rolId = Number(usuario?.rol_id);
        if (rolId !== 2) return false;

        if (!entidadActivaId) return true;
        const entidadesAsignadas = Array.isArray(usuario?.entidades_asignadas)
          ? usuario.entidades_asignadas
          : [];

        return entidadesAsignadas.some((entidad) => {
          const entidadId = String(entidad?.id ?? entidad ?? "").trim();
          return entidadId === entidadActivaId;
        });
      })
      .map((usuario) => ({
        id: Number(usuario?.id),
        nombre: formatTecnicoNombre(usuario?.nombre || "")
      }))
      .filter((usuario) => Number.isInteger(usuario.id) && usuario.id > 0 && usuario.nombre)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [isAdmin, usuarios, entidadActivaId]);

  const tecnicoIdByNombre = useMemo(() => {
    return tecnicosAsignadosEntidad.reduce((acc, tecnico) => {
      const normalizedName = normalizeSearchValue(tecnico.nombre);
      if (!normalizedName || Object.hasOwn(acc, normalizedName)) {
        return acc;
      }
      acc[normalizedName] = tecnico.id;
      return acc;
    }, {});
  }, [tecnicosAsignadosEntidad]);

  const tecnicoOptions = useMemo(() => {
    const fallbackOptions = [currentUserTecnico, DEFAULT_TECNICO];
    const source = isAdmin && tecnicosAsignadosEntidad.length > 0
      ? tecnicosAsignadosEntidad.map((item) => item.nombre)
      : fallbackOptions;

    return Array.from(
      new Set(
        source
          .map((item) => formatTecnicoNombre(item))
          .filter(Boolean)
      )
    );
  }, [isAdmin, tecnicosAsignadosEntidad, currentUserTecnico]);

  const modalTecnicoOptions = useMemo(() => {
    const tecnicoModalActualRaw = String(modalMantenimiento?.tecnico || "").trim();
    if (!tecnicoModalActualRaw) return tecnicoOptions;
    const tecnicoModalActual = formatTecnicoNombre(tecnicoModalActualRaw);

    const tecnicoExiste = tecnicoOptions.some(
      (item) => normalizeSearchValue(item) === normalizeSearchValue(tecnicoModalActual)
    );
    if (tecnicoExiste) return tecnicoOptions;

    return [tecnicoModalActual, ...tecnicoOptions];
  }, [modalMantenimiento, tecnicoOptions]);

  const resolveTecnicoIdByNombre = useCallback((nombreTecnico = "", fallbackTecnicoId = null) => {
    const normalizedName = normalizeSearchValue(nombreTecnico);
    const parsedFallbackId = Number(fallbackTecnicoId);
    const safeFallbackId = Number.isInteger(parsedFallbackId) && parsedFallbackId > 0
      ? parsedFallbackId
      : null;
    if (!normalizedName) return safeFallbackId;

    if (isAdmin) {
      return tecnicoIdByNombre[normalizedName] ?? safeFallbackId;
    }

    if (currentUserTecnicoNormalized && normalizedName === currentUserTecnicoNormalized) {
      return currentUser.id ?? safeFallbackId;
    }

    return safeFallbackId;
  }, [isAdmin, tecnicoIdByNombre, currentUserTecnicoNormalized, currentUser.id]);

  const activosById = useMemo(() => {
    return (Array.isArray(activos) ? activos : []).reduce((acc, activo) => {
      acc[String(activo.id)] = activo;
      return acc;
    }, {});
  }, [activos]);

  const activosFiltradosPorEntidad = useMemo(() => {
    if (!entidadActivaId) return activos;
    return (Array.isArray(activos) ? activos : []).filter(
      (activo) => String(activo.entidad_id || "") === entidadActivaId
    );
  }, [activos, entidadActivaId]);

  const mantenimientosFiltradosPorEntidad = useMemo(() => {
    const source = Array.isArray(mantenimientos) ? mantenimientos : [];
    if (!entidadActivaId) return source;
    return source.filter((m) => {
      const activoRelacionado = activosById[String(m.activo_id)];
      if (!activoRelacionado) return false;
      return String(activoRelacionado.entidad_id || "") === entidadActivaId;
    });
  }, [mantenimientos, entidadActivaId, activosById]);

  const consecutivoPorActivoId = useMemo(() => {
    const source = Array.isArray(activosFiltradosPorEntidad) ? [...activosFiltradosPorEntidad] : [];
    source.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    return source.reduce((acc, item, index) => {
      if (item.id == null) return acc;
      acc[String(item.id)] = index + 1;
      return acc;
    }, {});
  }, [activosFiltradosPorEntidad]);

  const obtenerConsecutivoActivo = useCallback((activoId) => {
    const consecutivo = consecutivoPorActivoId[String(activoId || "")];
    return Number.isInteger(consecutivo) ? consecutivo : null;
  }, [consecutivoPorActivoId]);

  const consecutivoPorMantenimientoId = useMemo(() => {
    const source = sortMantenimientosByRecency(mantenimientosFiltradosPorEntidad);
    return source.reduce((acc, item, index) => {
      if (item.id == null) return acc;
      acc[String(item.id)] = index + 1;
      return acc;
    }, {});
  }, [mantenimientosFiltradosPorEntidad]);

  const obtenerConsecutivoMantenimiento = (id) => {
    const consecutivo = consecutivoPorMantenimientoId[String(id)];
    return Number.isInteger(consecutivo) ? consecutivo : null;
  };

  const numeroActivo = useCallback((mantenimiento) => {
    if (mantenimiento.activo_id != null) {
      const activo = activosById[String(mantenimiento.activo_id)];
      if (activo?.activo) {
        return activo.activo;
      }
      if (activo?.nombre) {
        return activo.nombre;
      }
      if (activo?.id != null) {
        if (isAdmin) {
          return `Activo #${activo.id}`;
        }
        const consecutivo = obtenerConsecutivoActivo(activo.id);
        return consecutivo ? `Activo ${consecutivo}` : "Activo";
      }
    }
    if (mantenimiento.activo) return mantenimiento.activo;
    if (isPuntoRedTipo(mantenimiento.tipo)) {
      return getPuntoRedActivoLabel(mantenimiento);
    }
    if (isCronogramaTipo(mantenimiento.tipo)) {
      return getNumeroReporteMantenimiento(mantenimiento) || "Cronograma";
    }
    if (mantenimiento.activo_id == null) return "-";
    if (isAdmin) {
      return `Activo #${mantenimiento.activo_id}`;
    }
    const consecutivo = obtenerConsecutivoActivo(mantenimiento.activo_id);
    return consecutivo ? `Activo ${consecutivo}` : "Activo";
  }, [activosById, isAdmin, obtenerConsecutivoActivo]);

  const getMantenimientoCategoria = useCallback((mantenimiento) => {
    if (isPuntoRedTipo(mantenimiento.tipo)) return "Infraestructura";
    if (isCronogramaTipo(mantenimiento.tipo)) return "Cronograma";
    const activoRelacionado = activosById[String(mantenimiento.activo_id || "")];
    return activoRelacionado ? inferCategoriaActivo(activoRelacionado) : "Equipo de trabajo";
  }, [activosById]);

  const getMantenimientoEquipo = useCallback((mantenimiento) => {
    const activoRelacionado = activosById[String(mantenimiento.activo_id || "")];
    const rawEquipo = String(activoRelacionado?.equipo || "").trim();
    if (rawEquipo) return toProperCase(rawEquipo);
    if (isPuntoRedTipo(mantenimiento.tipo)) return "Punto de Red";
    if (isCronogramaTipo(mantenimiento.tipo)) return "Cronograma";
    return "";
  }, [activosById]);

  const getMantenimientoSede = useCallback((mantenimiento) => {
    const activoRelacionado = activosById[String(mantenimiento.activo_id || "")];
    return String(activoRelacionado?.sede || "").trim();
  }, [activosById]);

  const getMantenimientoArea = useCallback((mantenimiento) => {
    const activoRelacionado = activosById[String(mantenimiento.activo_id || "")];
    return String(
      activoRelacionado?.areaPrincipal ||
      activoRelacionado?.areaSecundaria ||
      ""
    ).trim();
  }, [activosById]);

  const mantenimientoCategoriaSummary = useMemo(() => {
    const source = Array.isArray(mantenimientosFiltradosPorEntidad) ? mantenimientosFiltradosPorEntidad : [];
    const summary = {
      total: source.length,
      trabajo: 0,
      impresion: 0,
      infraestructura: 0,
      telefonia: 0
    };
    source.forEach((item) => {
      const categoria = getMantenimientoCategoria(item);
      const key = CATEGORY_SUMMARY_KEYS[categoria] || "trabajo";
      if (Object.prototype.hasOwnProperty.call(summary, key)) {
        summary[key] += 1;
      }
    });
    return summary;
  }, [mantenimientosFiltradosPorEntidad, getMantenimientoCategoria]);

  const etiquetaActivoOption = useCallback((activo) => {
    const consecutivo = obtenerConsecutivoActivo(activo.id);
    const fallback = isAdmin
      ? `Activo #${activo.id}`
      : consecutivo
        ? `Activo ${consecutivo}`
        : "Activo";
    const numeroActivoLabel = activo.activo || activo.nombre || fallback;
    const equipo = activo.equipo || activo.nombre || "";
    const equipoLabel = equipo ? ` - ${equipo}` : "";
    return `${numeroActivoLabel}${equipoLabel}`;
  }, [isAdmin, obtenerConsecutivoActivo]);

  const activosOpcionesNuevo = useMemo(() => {
    const source = Array.isArray(activosFiltradosPorEntidad) ? activosFiltradosPorEntidad : [];
    return source
      .map((activo) => ({
        id: String(activo.id || ""),
        label: `${etiquetaActivoOption(activo)}${isAdmin ? ` [ID ${activo.id}]` : ""}`
      }))
      .filter((item) => item.id && item.label)
      .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  }, [activosFiltradosPorEntidad, etiquetaActivoOption, isAdmin]);

  const mantenimientoTipoOptions = useMemo(() => {
    const source = Array.isArray(mantenimientosFiltradosPorEntidad) ? mantenimientosFiltradosPorEntidad : [];
    return Array.from(
      new Set(
        source
          .map((item) => String(item.tipo || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [mantenimientosFiltradosPorEntidad]);

  const mantenimientoEstadoOptions = useMemo(() => {
    const source = Array.isArray(mantenimientosFiltradosPorEntidad) ? mantenimientosFiltradosPorEntidad : [];
    return Array.from(
      new Set(
        source
          .map((item) => getEstadoLabel(item))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [mantenimientosFiltradosPorEntidad]);

  const mantenimientoTecnicoOptions = useMemo(() => {
    const source = Array.isArray(mantenimientosFiltradosPorEntidad) ? mantenimientosFiltradosPorEntidad : [];
    return Array.from(
      new Set(
        source
          .map((item) => formatTecnicoNombre(item.tecnico || DEFAULT_TECNICO))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [mantenimientosFiltradosPorEntidad]);

  const mantenimientoActivoOptions = useMemo(() => {
    const source = Array.isArray(activosFiltradosPorEntidad) ? activosFiltradosPorEntidad : [];
    return source
      .filter((activo) => !activoEstaFueraServicio(activo))
      .map((activo) => ({
        id: String(activo.id || "").trim(),
        label: etiquetaActivoOption(activo)
      }))
      .filter((item) => item.id && item.label)
      .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  }, [activosFiltradosPorEntidad, etiquetaActivoOption]);

  const mantenimientoEquipoOptions = useMemo(() => {
    const source = Array.isArray(mantenimientosFiltradosPorEntidad) ? mantenimientosFiltradosPorEntidad : [];
    const counts = new Map();

    source.forEach((mantenimiento) => {
      if (categoriaMenu && categoriaMenu !== MENU_ALL_CATEGORY) {
        const categoria = getMantenimientoCategoria(mantenimiento);
        if (normalizeCategoriaActivo(categoria) !== normalizeCategoriaActivo(categoriaMenu)) {
          return;
        }
      }
      const label = getMantenimientoEquipo(mantenimiento);
      if (!label) return;
      const key = normalizeSearchValue(label);
      if (!key) return;
      const current = counts.get(key) || { value: label, label, count: 0 };
      current.count += 1;
      if (!counts.has(key)) {
        counts.set(key, current);
      }
    });

    return Array.from(counts.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "es", { sensitivity: "base" })
    );
  }, [
    mantenimientosFiltradosPorEntidad,
    categoriaMenu,
    getMantenimientoCategoria,
    getMantenimientoEquipo
  ]);

  const mantenimientoEntidadOptions = useMemo(() => {
    if (!isAdmin) return [];

    const source = Array.isArray(mantenimientosFiltradosPorEntidad) ? mantenimientosFiltradosPorEntidad : [];
    const byId = source.reduce((acc, mantenimiento) => {
      const activoRelacionado = activosById[String(mantenimiento.activo_id || "")];
      const entidadId = String(activoRelacionado?.entidad_id || "").trim();
      if (!entidadId || acc.has(entidadId)) {
        return acc;
      }

      const entidadNombre = String(activoRelacionado?.sede || "").trim();
      acc.set(entidadId, entidadNombre ? toProperCase(entidadNombre) : `Entidad #${entidadId}`);
      return acc;
    }, new Map());

    return Array.from(byId.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [isAdmin, mantenimientosFiltradosPorEntidad, activosById]);

  const buildPuntoRedNumeroReporte = useCallback(() => {
    const source = Array.isArray(mantenimientos) ? mantenimientos : [];
    const consecutivos = source
      .filter((item) => isPuntoRedTipo(item.tipo))
      .map((item) => extraerConsecutivo(getNumeroReporteMantenimiento(item)))
      .filter((value) => Number.isInteger(value) && value > 0);
    const siguiente = obtenerSiguienteConsecutivo(consecutivos);
    return `PR.${String(siguiente).padStart(3, "0")}`;
  }, [mantenimientos]);

  const buildGeneralNumeroReporte = useCallback((offset = 0) => {
    const source = sortMantenimientosByRecency(mantenimientos);
    const prioritized = source.filter((item) => !isPuntoRedTipo(item.tipo) && !isCronogramaTipo(item.tipo));
    const fallbackSource = prioritized.length ? prioritized : source;

    for (const item of fallbackSource) {
      const parts = splitReportNumber(getNumeroReporteMantenimiento(item));
      if (!parts || !Number.isFinite(parts.number) || parts.number <= 0) {
        continue;
      }

      const nextNumber = parts.number + 1 + offset;
      return `${parts.prefix}${String(nextNumber).padStart(parts.width, "0")}${parts.suffix}`;
    }

    return `REP-${String(offset + 1).padStart(3, "0")}`;
  }, [mantenimientos]);

  const buildDoubleFormDrafts = useCallback(() => ({
    preventivo: {
      numeroReporte: buildGeneralNumeroReporte(0),
      descripcion: "",
      cambioPartes: ""
    },
    correctivo: {
      numeroReporte: buildGeneralNumeroReporte(1),
      descripcion: "",
      cambioPartes: ""
    }
  }), [buildGeneralNumeroReporte]);

  const equipoLabelModal = useMemo(() => {
    if (!modalMantenimiento) return "";
    if (isPuntoRedTipo(modalMantenimiento.tipo)) return "Punto de Red";
    if (isCronogramaTipo(modalMantenimiento.tipo)) return "Cronograma";
    const activoSeleccionado = activosById[String(modalMantenimiento.activo_id || "")];
    const equipoRaw = String(activoSeleccionado?.equipo || activoSeleccionado?.nombre || "").trim();
    return equipoRaw ? toProperCase(equipoRaw) : "";
  }, [modalMantenimiento, activosById]);

  const obtenerActivoMantenimiento = (mantenimiento) => {
    if (!mantenimiento.activo_id) {
      if (isPuntoRedTipo(mantenimiento?.tipo)) {
        const referencia = getNumeroReporteMantenimiento(mantenimiento);
        return {
          activo: referencia || "PUNTO-RED",
          nombre: "Punto de Red",
          equipo: "Punto de Red",
          serial: referencia || "-",
          marca: "Infraestructura",
          modelo: "Red",
          areaPrincipal: "Redes",
          estado: mantenimiento?.estado || "En proceso"
        };
      }
      if (isCronogramaTipo(mantenimiento?.tipo)) {
        const referencia = getNumeroReporteMantenimiento(mantenimiento) || "CRONOGRAMA";
        return {
          activo: referencia,
          nombre: referencia,
          equipo: "Cronograma",
          serial: referencia,
          marca: "Programado",
          modelo: "General",
          areaPrincipal: "Cronograma",
          estado: mantenimiento?.estado || "Pendiente"
        };
      }
      return null;
    }
    return activosById[String(mantenimiento.activo_id)] || null;
  };

  const activosImportables = useMemo(() => {
    return Array.isArray(activosFiltradosPorEntidad) ? activosFiltradosPorEntidad : [];
  }, [activosFiltradosPorEntidad]);

  const activosByNormalizedRef = useMemo(() => {
    return activosImportables.reduce((acc, activo) => {
      const keys = [
        String(activo.id || ""),
        String(activo.activo || ""),
        String(activo.equipo || ""),
        String(activo.nombre || "")
      ];

      keys.forEach((key) => {
        const normalizedKey = normalizeSearchValue(key);
        if (normalizedKey && !acc[normalizedKey]) {
          acc[normalizedKey] = Number(activo.id);
        }
      });
      return acc;
    }, {});
  }, [activosImportables]);

  const pickImportValue = (row = {}, aliasSet = new Set()) => {
    const entries = Object.entries(row || {});
    for (const [rawKey, rawValue] of entries) {
      const normalizedKey = normalizeImportKey(rawKey);
      if (aliasSet.has(normalizedKey)) {
        return String(rawValue ?? "").trim();
      }
    }
    return "";
  };

  const normalizeImportDate = (value = "") => {
    const source = String(value || "").trim();
    if (!source) return "";

    const ddmmyyyy = DAY_FIRST_DATE_REGEX.exec(source);
    if (ddmmyyyy) {
      const [, dd, mm, yyyy] = ddmmyyyy;
      return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }

    const direct = new Date(source);
    if (!Number.isNaN(direct.getTime())) {
      return direct.toISOString().slice(0, 10);
    }

    return source;
  };

  const resolveActivoIdFromImport = (value = "") => {
    const source = String(value || "").trim();
    if (!source) return null;

    const asNumber = Number(source);
    if (Number.isInteger(asNumber) && asNumber > 0 && activosById[String(asNumber)]) {
      return asNumber;
    }

    const normalized = normalizeSearchValue(source);
    if (!normalized) return null;

    if (activosByNormalizedRef[normalized]) {
      return activosByNormalizedRef[normalized];
    }

    const partial = activosImportables.find((activo) => {
      const fields = [activo.activo, activo.equipo, activo.nombre].map((item) =>
        normalizeSearchValue(item || "")
      );
      return fields.some((item) => item && (item.includes(normalized) || normalized.includes(item)));
    });

    return partial ? Number(partial.id) : null;
  };

  const buildImportPayload = (row = {}) => {
    const fechaRaw = pickImportValue(row, IMPORT_ALIAS_SETS.fecha);
    const numeroReporteRaw = pickImportValue(row, IMPORT_ALIAS_SETS.numeroReporte);
    const activoRaw = pickImportValue(row, IMPORT_ALIAS_SETS.activo);
    const tipoRaw = pickImportValue(row, IMPORT_ALIAS_SETS.tipo);
    const estadoRaw = pickImportValue(row, IMPORT_ALIAS_SETS.estado);
    const planificacionRaw = pickImportValue(row, IMPORT_ALIAS_SETS.planificacion);
    const tecnicoRaw = pickImportValue(row, IMPORT_ALIAS_SETS.tecnico);
    const descripcionRaw = pickImportValue(row, IMPORT_ALIAS_SETS.descripcion);

    const fecha = normalizeImportDate(fechaRaw);
    const numeroReporte = String(numeroReporteRaw || "").trim();
    const activoId = resolveActivoIdFromImport(activoRaw);
    const tipo = normalizePuntoRedTipo(toProperCase(tipoRaw || ""));
    const estadoPorFecha = inferEstadoByFecha(fecha);
    const estado = estadoRaw
      ? toProperCase(estadoRaw)
      : (estadoPorFecha || getEstadoInicialByPlanificacion(planificacionRaw || "Programado"));
    const tecnico = formatTecnicoNombre(tecnicoRaw || "");
    const descripcion = String(descripcionRaw || "").trim();

    return {
      fecha,
      numeroReporte,
      activo_id: activoId ? Number(activoId) : null,
      tipo,
      estado,
      tecnico,
      tecnico_id: resolveTecnicoIdByNombre(tecnico),
      descripcion
    };
  };

  const openImportDialog = () => {
    if (!hasPermission(currentUser, "CREAR_MANTENIMIENTO")) {
      setError("No tienes permiso para importar mantenimientos");
      return;
    }
    importInputRef.current?.click();
  };

  const extractImportRowsFromSheet = (sheet, XLSX) => {
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false
    });

    if (!Array.isArray(matrix) || matrix.length === 0) {
      return { rows: [], firstDataRowNumber: 2 };
    }

    let headerRowIndex = -1;
    for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 25); rowIndex += 1) {
      const row = Array.isArray(matrix[rowIndex]) ? matrix[rowIndex] : [];
      const normalizedHeaders = row.map((cell) => normalizeImportKey(cell)).filter(Boolean);
      if (normalizedHeaders.length === 0) continue;

      const matchCount = REQUIRED_IMPORT_FIELDS.reduce((count, field) => {
        const aliasSet = IMPORT_ALIAS_SETS[field];
        const matched = normalizedHeaders.some((header) => aliasSet.has(header));
        return count + (matched ? 1 : 0);
      }, 0);

      if (matchCount >= 2) {
        headerRowIndex = rowIndex;
        break;
      }
    }

    if (headerRowIndex < 0) {
      return { rows: [], firstDataRowNumber: 2 };
    }

    const headersRaw = Array.isArray(matrix[headerRowIndex]) ? matrix[headerRowIndex] : [];
    const headers = headersRaw.map((cell, index) => {
      const label = String(cell ?? "").trim();
      return label || `columna_${index + 1}`;
    });

    const dataRows = matrix
      .slice(headerRowIndex + 1)
      .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim() !== ""));

    const rows = dataRows.map((row) =>
      headers.reduce((acc, header, index) => {
        acc[header] = row[index] ?? "";
        return acc;
      }, {})
    );

    return {
      rows,
      firstDataRowNumber: headerRowIndex + 2
    };
  };

  const isImportPayloadComplete = (payload = {}) => {
    if (!payload.fecha || !payload.numeroReporte || !payload.tipo) {
      return false;
    }

    return isPuntoRedTipo(payload.tipo) || isCronogramaTipo(payload.tipo)
      ? true
      : Boolean(payload.activo_id);
  };

  const importMaintenanceRows = async (rows = [], firstDataRowNumber = 2) => {
    let creados = 0;
    const errores = [];
    let lastFechaImport = "";

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const fila = firstDataRowNumber + index;
      const payload = buildImportPayload(row);

      if (!payload.fecha && lastFechaImport) {
        payload.fecha = lastFechaImport;
      }
      if (payload.fecha) {
        lastFechaImport = payload.fecha;
      }

      if (!isImportPayloadComplete(payload)) {
        errores.push({ fila, mensaje: "Faltan campos obligatorios para importar el mantenimiento." });
        continue;
      }

      try {
        await mantenimientoService.create(payload);
        creados += 1;
      } catch (err) {
        const mensaje = err?.response?.data?.message || err?.response?.data?.error || "Error al crear";
        errores.push({ fila, mensaje });
      }
    }

    return { creados, errores };
  };

  const buildImportFeedback = (createdCount, totalRows, errors = []) => {
    if (!errors.length) {
      return {
        type: "success",
        message: `Importación completada. Creados ${createdCount} mantenimientos.`
      };
    }

    const resumen = errors
      .slice(0, 5)
      .map((item) => `Fila ${item.fila}: ${item.mensaje}`)
      .join(" | ");

    return {
      type: "error",
      message: `Importación parcial. Creados ${createdCount}/${totalRows}. Errores: ${errors.length}. ${resumen}`
    };
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setSuccess("");
    setIsImporting(true);

    try {
      const XLSX = await import("xlsx");
      const content = await file.arrayBuffer();
      const workbook = XLSX.read(content, { type: "array", cellDates: false });
      const firstSheetName = workbook.SheetNames?.[0];
      if (!firstSheetName) {
        setError("El archivo no contiene hojas para importar.");
        return;
      }

      const firstSheet = workbook.Sheets[firstSheetName];
      const { rows, firstDataRowNumber } = extractImportRowsFromSheet(firstSheet, XLSX);
      if (!Array.isArray(rows) || rows.length === 0) {
        setError("No se detectaron encabezados válidos o filas para importar. Verifica títulos como Fecha, Número de reporte, Activo y Tipo.");
        return;
      }

      const { creados, errores } = await importMaintenanceRows(rows, firstDataRowNumber);
      await cargarMantenimientos();

      const feedback = buildImportFeedback(creados, rows.length, errores);
      if (feedback.type === "error") {
        setError(feedback.message);
      } else {
        setSuccess(feedback.message);
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || "Error al importar archivo.";
      setError(message);
    } finally {
      setIsImporting(false);
    }
  };


  const cargarMantenimientos = async () => {
    if (!isAuthenticated()) {
      setMantenimientos([]);
      return;
    }

    try {
      const data = await mantenimientoService.getAll();
      const normalizados = (Array.isArray(data) ? data : []).map((item) => ({
        ...item,
        numeroReporte: getNumeroReporteMantenimiento(item),
        tipo: normalizePuntoRedTipo(item.tipo || ""),
        tecnico: formatTecnicoNombre(item.tecnico || DEFAULT_TECNICO)
      }));
      setMantenimientos(normalizados);
    } catch (err) {
      if (err?.response?.status !== 401) {
        setMantenimientos([]);
      }
    }
  };

  const cargarActivos = async () => {
    if (!isAuthenticated()) {
      setActivos([]);
      return;
    }

    try {
      const response = await httpClient.get("/api/activos");
      const data = response.data.data || response.data || [];
      const normalizados = (Array.isArray(data) ? data : []).map((activo) => ({
        ...activo,
        areaPrincipal: activo.areaPrincipal ?? activo.areaprincipal ?? "",
        areaSecundaria: activo.areaSecundaria ?? activo.areasecundaria ?? "",
        tipoDisco: activo.tipoDisco ?? activo.tipodisco ?? ""
      }));
      setActivos(normalizados);
    } catch (err) {
      if (err?.response?.status !== 401) {
        setActivos([]);
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      const cargarUsuariosPromise = (async () => {
        if (!isAuthenticated() || !isAdmin) {
          setUsuarios([]);
          return;
        }

        try {
          const response = await httpClient.get("/api/usuarios");
          const data = response.data.data || response.data || [];
          setUsuarios(Array.isArray(data) ? data : []);
        } catch {
          setUsuarios([]);
        }
      })();

      await Promise.all([cargarMantenimientos(), cargarActivos(), cargarUsuariosPromise]);
      setIsLoading(false);
    };
    init();
  }, [isAdmin]);

  useEffect(() => {
    const browserWindow = getBrowserWindow();
    if (!browserWindow) return undefined;

    const syncViewport = () => {
      setIsMobileLayout(isMobileViewport());
    };

    syncViewport();
    browserWindow.addEventListener("resize", syncViewport);
    browserWindow.addEventListener("orientationchange", syncViewport);

    return () => {
      browserWindow.removeEventListener("resize", syncViewport);
      browserWindow.removeEventListener("orientationchange", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!entidadActivaId) return;
    setForm((prev) => {
      if (!prev.activo) return prev;
      const activoSeleccionado = activosById[String(prev.activo)];
      if (String(activoSeleccionado?.entidad_id || "") === entidadActivaId) {
        return prev;
      }
      setActivoInputNuevo("");
      return { ...prev, activo: "" };
    });
  }, [entidadActivaId, activosById]);

  useEffect(() => {
    setFiltroTipo("");
    setFiltroEstado("");
    setFiltroTecnico("");
    setFiltroActivoId("");
    setFiltroEntidadId("");
    setCategoriaMenu("");
  }, [entidadActivaId]);

  useEffect(() => {
    if (tecnicoOptions.length === 0) return;

    setForm((prev) => {
      const tecnicoActual = String(prev.tecnico || "").trim();
      const tecnicoCanonico = tecnicoOptions.find(
        (item) => normalizeSearchValue(item) === normalizeSearchValue(tecnicoActual)
      );

      if (tecnicoCanonico) {
        if (tecnicoActual === tecnicoCanonico) return prev;
        return {
          ...prev,
          tecnico: tecnicoCanonico
        };
      }

      return {
        ...prev,
        tecnico: tecnicoOptions[0]
      };
    });
  }, [tecnicoOptions]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (!error && !success) {
      lastAlertRef.current = { type: "", message: "" };
      return;
    }

    if (error) {
      if (lastAlertRef.current.type === "error" && lastAlertRef.current.message === error) return;
      lastAlertRef.current = { type: "error", message: error };
      setToast({ tone: "error", message: error });
      return;
    }

    if (success) {
      if (lastAlertRef.current.type === "success" && lastAlertRef.current.message === success) return;
      lastAlertRef.current = { type: "success", message: success };
      setToast({ tone: "success", message: success });
    }
  }, [error, success]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextValue = value;
    const normalizedValue = name === "tipo" ? normalizePuntoRedTipo(nextValue) : nextValue;
    const isDoubleSelected = name === "tipo" && isTipoDoble(normalizedValue);
    const isSpecialTipo = name === "tipo" && (isPuntoRedTipo(normalizedValue) || isCronogramaTipo(normalizedValue));

    setForm((prev) => {
      const nextForm = {
        ...prev,
        [name]: normalizedValue,
        ...(isSpecialTipo ? { activo: "" } : {})
      };

      if (name === "tipo") {
        const previousNumeroReporte = String(prev.numeroReporte || "").trim();
        if (isDoubleSelected) {
          nextForm.numeroReporte = "";
        } else if (isPuntoRedTipo(normalizedValue) && !previousNumeroReporte) {
          nextForm.numeroReporte = buildPuntoRedNumeroReporte();
        } else if (!isSpecialTipo && !previousNumeroReporte) {
          nextForm.numeroReporte = buildGeneralNumeroReporte();
        }
      }

      return nextForm;
    });

    if (name === "tipo") {
      if (isDoubleSelected) {
        setDoubleFormDrafts(buildDoubleFormDrafts());
      } else {
        setDoubleFormDrafts(null);
      }
    }

    if (name === "tipo" && (isSpecialTipo || isDoubleSelected)) {
      setActivoInputNuevo("");
    }
  };

  const handleActivoInputChange = (event) => {
    const nextText = event.target.value;
    setActivoInputNuevo(nextText);

    const normalized = String(nextText || "").trim().toLowerCase();
    const exacta = activosOpcionesNuevo.find(
      (item) => String(item.label || "").trim().toLowerCase() === normalized
    );

    setForm((prev) => ({
      ...prev,
      activo: exacta ? String(exacta.id) : ""
    }));
  };

  const handleSelectCreateActivo = useCallback((option) => {
    if (!option) return;
    setForm((prev) => ({
      ...prev,
      activo: String(option.id || "")
    }));
    setActivoInputNuevo(option.label || "");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isCreating) {
      setToast({ tone: "info", message: "Ya hay un guardado en curso. Espera un momento." });
      return;
    }
    setError("");
    setSuccess("");
    setToast(null);
    setIsCreating(true);

    if (!hasPermission(currentUser, "CREAR_MANTENIMIENTO")) {
      setError("No tienes permiso para crear mantenimientos");
      setIsCreating(false);
      return;
    }

    const activoEsObligatorio = requiresActivoForTipo(form.tipo);
    const isDoubleSelected = isTipoDoble(form.tipo);
    const activoId = form.activo ? Number(form.activo) : null;

    if (!form.fecha || !form.tipo || !form.planificacion || (activoEsObligatorio && !form.activo)) {
      setError("Campos obligatorios incompletos");
      setIsCreating(false);
      return;
    }

    if (
      activoEsObligatorio &&
      !activosOpcionesNuevo.some((item) => String(item.id) === String(form.activo))
    ) {
      setError("Debes seleccionar un activo existente desde la lista.");
      setIsCreating(false);
      return;
    }

    const fechaKey = toDateKey(form.fecha);
    if (activoId && fechaKey) {
      const duplicados = (Array.isArray(mantenimientos) ? mantenimientos : []).filter((item) => {
        const itemActivoId = Number(item.activo_id ?? item.activoId ?? item.activo ?? 0);
        if (!itemActivoId || itemActivoId !== activoId) return false;
        return toDateKey(item.fecha) === fechaKey;
      });

      if (duplicados.length > 0) {
        const activoRef = activosById[String(activoId)];
        const activoLabel = activoRef ? etiquetaActivoOption(activoRef) : `Activo #${activoId}`;
        const plural = duplicados.length > 1;
        const confirmed = globalThis.confirm(
          `Ya existe${plural ? "n" : ""} ${duplicados.length} mantenimiento${plural ? "s" : ""} ` +
          `para ${activoLabel} en la fecha ${formatDateLabel(fechaKey)}. ` +
          "¿Deseas guardarlo de todas formas?"
        );
        if (!confirmed) {
          setIsCreating(false);
          return;
        }
      }
    }

    const backlogTimer = setTimeout(() => {
      setToast({
        tone: "warning",
        message: "Guardando... puede tardar un poco si hay varias solicitudes en cola (backlog)."
      });
    }, 4000);

    try {
      const estadoInicial = getEstadoInicialByPlanificacion(form.planificacion);
      const tecnicoNombre = formatTecnicoNombre(form.tecnico || "");
      const tecnicoId = resolveTecnicoIdByNombre(tecnicoNombre);
      const basePayload = {
        fecha: form.fecha,
        activo_id: activoEsObligatorio ? Number(form.activo) : null,
        tecnico: tecnicoNombre,
        tecnico_id: tecnicoId,
        estado: estadoInicial
      };

      if (isDoubleSelected) {
        const drafts = doubleFormDrafts || buildDoubleFormDrafts();
        const preventivoNumero = String(drafts?.preventivo?.numeroReporte || "").trim() || buildGeneralNumeroReporte(0);
        const correctivoNumero = String(drafts?.correctivo?.numeroReporte || "").trim() || buildGeneralNumeroReporte(1);
        const preventivoDescripcion = String(drafts?.preventivo?.descripcion || form.descripcion || "").trim();
        const correctivoDescripcion = String(drafts?.correctivo?.descripcion || form.descripcion || "").trim();
        const preventivoCambioPartes = String(drafts?.preventivo?.cambioPartes || form.cambioPartes || "").trim();
        const correctivoCambioPartes = String(drafts?.correctivo?.cambioPartes || form.cambioPartes || "").trim();

        if (!preventivoNumero || !correctivoNumero) {
          setError("Los dos formularios requieren número de reporte.");
          setIsCreating(false);
          return;
        }

        const creados = [];
        for (const payload of [
          {
            ...basePayload,
            tipo: "Preventivo",
            numeroReporte: preventivoNumero,
            descripcion: preventivoDescripcion,
            cambio_partes: preventivoCambioPartes
          },
          {
            ...basePayload,
            tipo: "Correctivo",
            numeroReporte: correctivoNumero,
            descripcion: correctivoDescripcion,
            cambio_partes: correctivoCambioPartes
          }
        ]) {
          const creado = await mantenimientoService.create(payload);
          creados.push(creado);
        }

        clearTimeout(backlogTimer);
        const createdIds = creados
          .map((item) => item?.id)
          .filter((id) => id !== null && id !== undefined);
        const createdLabel = createdIds.length > 0 ? createdIds.join(" y ") : "-";
        setSuccess(
          isAdmin
            ? `Mantenimientos creados - ID ${createdLabel}`
            : "Mantenimientos creados correctamente"
        );
        setToast({
          tone: "success",
          message: isAdmin
            ? `Mantenimientos guardados correctamente (ID ${createdLabel})`
            : "Mantenimientos guardados correctamente"
        });
        setShowCreateModal(false);
        await cargarMantenimientos();
        return;
      }

      let numeroReporteValue = String(form.numeroReporte || "").trim();
      if (isPuntoRedTipo(form.tipo) && !numeroReporteValue) {
        numeroReporteValue = buildPuntoRedNumeroReporte();
        setForm((prev) => ({ ...prev, numeroReporte: numeroReporteValue }));
      } else if (!isCronogramaTipo(form.tipo) && !numeroReporteValue) {
        numeroReporteValue = buildGeneralNumeroReporte();
        setForm((prev) => ({ ...prev, numeroReporte: numeroReporteValue }));
      }

      if (!numeroReporteValue) {
        setError("Campos obligatorios incompletos");
        setIsCreating(false);
        return;
      }

      if (isPuntoRedTipo(form.tipo) && !matchesAlphanumericReference(numeroReporteValue)) {
        setError("Para Punto de Red debes registrar una referencia alfanumérica válida.");
        setIsCreating(false);
        return;
      }

      const payload = {
        ...basePayload,
        tipo: normalizePuntoRedTipo(form.tipo),
        numeroReporte: numeroReporteValue,
        descripcion: String(form.descripcion || "").trim(),
        cambio_partes: String(form.cambioPartes || "").trim()
      };

      const creado = await mantenimientoService.create(payload);
      clearTimeout(backlogTimer);
      const createdLabel = creado?.id ?? "-";
      setSuccess(isAdmin ? `Mantenimiento creado - ID ${createdLabel}` : "Mantenimiento creado");
      setToast({
        tone: "success",
        message: isAdmin
          ? `Mantenimiento guardado correctamente (ID ${createdLabel})`
          : "Mantenimiento guardado correctamente"
      });
      setShowCreateModal(false);
      await cargarMantenimientos();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || "Error al crear mantenimiento");
    } finally {
      clearTimeout(backlogTimer);
      setIsCreating(false);
    }
  };

  const formatFecha = (f) => {
    if (!f) return "-";
    const d = new Date(f);
    if (Number.isNaN(d.getTime())) return f;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const abrirModal = useCallback((m) => {
    if (!m) return;
    const tecnicoActual = formatTecnicoNombre(m.tecnico || "");
    const tecnicoInicial = tecnicoActual || tecnicoOptions[0] || defaultTecnico;
    setModalMantenimiento({
      ...m,
      numeroReporte: getNumeroReporteMantenimiento(m),
      tecnico: tecnicoInicial,
      fecha: String(m.fecha || "").split("T")[0],
      cambio_partes: m.cambio_partes ?? m.cambioPartes ?? ""
    });
    setShowModal(true);
  }, [defaultTecnico, tecnicoOptions]);

  const cerrarModal = useCallback(() => {
    setShowModal(false);
    setShowFacturaModal(false);
  }, []);

  useEffect(() => {
    if (openFromQueryRef.current) return;
    const rawId = searchParams.get("openId");
    if (!rawId) return;
    const openId = Number(rawId);
    if (!Number.isFinite(openId)) return;
    if (isLoading) return;

    const list = Array.isArray(mantenimientos) ? mantenimientos : [];
    const found = list.find((item) => Number(item.id) === openId);
    if (!found) return;

    openFromQueryRef.current = true;
    abrirModal(found);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("openId");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, isLoading, mantenimientos, abrirModal]);

  const handleActualizar = async () => {
    if (!modalMantenimiento.id) return;

    if (!hasPermission(currentUser, "EDITAR_MANTENIMIENTO")) {
      setError("No tienes permiso para editar mantenimientos");
      return;
    }

    const tecnicoNombre = formatTecnicoNombre(modalMantenimiento.tecnico || "");
    const tecnicoIdPayload = resolveTecnicoIdByNombre(tecnicoNombre, modalMantenimiento.tecnico_id);

    const payload = {
      fecha: modalMantenimiento.fecha,
      numeroReporte: String(modalMantenimiento.numeroReporte || "").trim(),
      tipo: modalMantenimiento.tipo,
      descripcion: modalMantenimiento.descripcion,
      cambio_partes: String(modalMantenimiento.cambio_partes || modalMantenimiento.cambioPartes || "").trim(),
      tecnico: tecnicoNombre,
      tecnico_id: tecnicoIdPayload,
      activo_id: modalMantenimiento.activo_id ? Number(modalMantenimiento.activo_id) : null,
      estado: modalMantenimiento.estado
    };

    try {
      await mantenimientoService.update(modalMantenimiento.id, payload);
      setSuccess("Actualizado correctamente");
      setTimeout(async () => {
        cerrarModal();
        await cargarMantenimientos();
      }, 900);
    } catch (err) {
      let errorMsg = err?.response?.data?.message || err?.response?.data?.error || "Error al actualizar";
      if (
        typeof errorMsg === "string" &&
        (
          errorMsg.includes("viola la llave foranea") ||
          errorMsg.includes("viola la llave foránea") ||
          errorMsg.includes("violates foreign key constraint")
        )
      ) {
        errorMsg = "No se puede actualizar: el registro está vinculado a otros datos (órdenes, etc.).";
      }
      setError(errorMsg);
    }
  };

  const eliminarMantenimientoById = async (mantenimientoId, { closeAfter = false } = {}) => {
    if (!mantenimientoId) return;

    if (!hasPermission(currentUser, "ELIMINAR_MANTENIMIENTO")) {
      setError("No tienes permiso para eliminar mantenimientos");
      return;
    }

    if (!globalThis.confirm("¿Eliminar mantenimiento?")) return;

    try {
      await mantenimientoService.delete(mantenimientoId);
      setSuccess("Eliminado correctamente");
      setTimeout(async () => {
        if (closeAfter) {
          cerrarModal();
        }
        await cargarMantenimientos();
      }, 900);
    } catch (err) {
      let errorMsg = err?.response?.data?.message || err?.response?.data?.error || "Error al eliminar";
      if (
        typeof errorMsg === "string" &&
        (
          errorMsg.includes("viola la llave foranea") ||
          errorMsg.includes("viola la llave foránea") ||
          errorMsg.includes("violates foreign key constraint")
        )
      ) {
        errorMsg = "No se puede eliminar: el mantenimiento está asociado a una orden de trabajo.";
      }
      setError(errorMsg);
    }
  };

  const handleEliminar = async () => {
    if (!modalMantenimiento.id) return;
    await eliminarMantenimientoById(modalMantenimiento.id, { closeAfter: true });
  };

  const buildFallbackOrdenNumero = (mantenimientoConsecutivo) => (
    `OT-MANT-${mantenimientoConsecutivo}-${String(Date.now()).slice(-5)}`
  );

  const obtenerNumeroOrdenFactura = async (numeroBase, mantenimientoConsecutivo) => {
    if (numeroBase) {
      return `OT-${numeroBase}`.replaceAll(/\s+/g, "-");
    }

    let numero = buildFallbackOrdenNumero(mantenimientoConsecutivo);

    try {
      const responseOrdenes = await httpClient.get("/api/ordenes");
      const ordenes = responseOrdenes.data.data || responseOrdenes.data || [];
      const usados = (Array.isArray(ordenes) ? ordenes : [])
        .map((item) => extraerConsecutivo(item.numero))
        .filter((item) => Number.isInteger(item) && item > 0);
      const siguiente = obtenerSiguienteConsecutivo(usados);
      numero = `OT-${String(siguiente).padStart(2, "0")}`;
    } catch {
      // Si falla consulta de ordenes, mantiene fallback OT-MANT-...
    }

    return numero;
  };

  const firmarOrdenSiAplica = async (ordenId, firmaBase64) => {
    if (!firmaBase64 || !ordenId) {
      return { firmaAplicada: false, warningFirma: "" };
    }

    try {
      await httpClient.post(`/api/ordenes/${ordenId}/firmar`, { firmaBase64 });
      return { firmaAplicada: true, warningFirma: "" };
    } catch (firmaErr) {
      return {
        firmaAplicada: false,
        warningFirma:
          firmaErr?.response?.data?.message ||
          firmaErr?.response?.data?.error ||
          "No se pudo aplicar la firma"
      };
    }
  };

  const guardarOrdenPdfLocal = (orden, numeroOrden, facturaPayload, mantenimientoConsecutivo) => {
    if (!orden.id) return;

    const activo = obtenerActivoMantenimiento(modalMantenimiento) || {};
    const mantenimientoDocumento = {
      ...modalMantenimiento,
      id: mantenimientoConsecutivo
    };

    const payloadOrdenPdf = {
      ordenId: orden.id,
      numero: orden.numero || numeroOrden,
      activo,
      mantenimiento: mantenimientoDocumento,
      factura: facturaPayload,
      mantenimientoConsecutivo,
      documentoHtml: buildMaintenanceOrderHtml({
        activo,
        mantenimiento: mantenimientoDocumento,
        factura: facturaPayload || {},
        numeroOrden: orden.numero || numeroOrden,
        mantenimientoConsecutivo,
        logos: {
          logoM5,
          logoAssetControl
        }
      })
    };

    localStorage.setItem(`orden_pdf_${orden.id}`, JSON.stringify(payloadOrdenPdf));
  };

  const notificarResultadoOrden = (orden, firmaBase64, firmaAplicada, warningFirma) => {
    const identificadorOrden = orden.numero || `#${orden.id}`;

    if (firmaBase64 && !firmaAplicada) {
      setError(`Orden creada: ${identificadorOrden}, pero sin firma. ${warningFirma}`);
      return;
    }

    const sufijo = firmaAplicada ? " (FIRMADA)" : "";
    setSuccess(`Orden creada: ${identificadorOrden}${sufijo}`);
  };

  const generarOrdenConFactura = async (facturaPayload = {}) => {
    if (!modalMantenimiento.id || isOrderLoading) return;
    setError("");
    setSuccess("");
    setIsOrderLoading(true);

    try {
      const mantenimientoConsecutivo =
        obtenerConsecutivoMantenimiento(modalMantenimiento.id) || modalMantenimiento.id;
      const firmaBase64 = facturaPayload.autorizaFirma || facturaPayload.usuarioFirma || "";
      const numeroBase = String(facturaPayload.numeroFactura || "").trim();
      const numero = await obtenerNumeroOrdenFactura(numeroBase, mantenimientoConsecutivo);
      const response = await httpClient.post("/api/ordenes", {
        numero,
        fecha: new Date().toISOString().slice(0, 10),
        estado: "Generada",
        mantenimientos: [modalMantenimiento.id]
      });

      const orden = response.data.data || response.data;
      const { firmaAplicada, warningFirma } = await firmarOrdenSiAplica(orden.id, firmaBase64);

      guardarOrdenPdfLocal(orden, numero, facturaPayload, mantenimientoConsecutivo);
      notificarResultadoOrden(orden, firmaBase64, firmaAplicada, warningFirma);
      setShowFacturaModal(false);
      setTimeout(() => {
        cerrarModal();
        navigate("/ordenes");
      }, 900);
    } catch (err) {
      if (err?.response?.status === 403) {
        setError("No tienes permiso para generar o firmar ?rdenes.");
        return;
      }
      setError(err?.response?.data?.message || err?.response?.data?.error || "Error al generar la orden");
    } finally {
      setIsOrderLoading(false);
    }
  };


  const abrirFactura = () => {
    setError("");
    setSuccess("");
    setShowFacturaModal(true);
  };

  const enviarMantenimientoPorCorreo = async () => {
    if (!modalMantenimiento || isSendingEmail) return;
    const to = String(globalThis.prompt("Ingresa el correo destino") || "").trim();
    if (!to) return;
    if (!isValidEmailAddress(to)) {
      setError("Correo destino invalido");
      return;
    }

    const activoRelacionado = obtenerActivoMantenimiento(modalMantenimiento);
    const draft = buildMaintenanceEmailDraft(modalMantenimiento, activoRelacionado);
    const facturaStorageKey = `factura_mantenimiento_${String(modalMantenimiento.id || "sin-id")}`;
    let facturaData = {};
    try {
      facturaData = JSON.parse(localStorage.getItem(facturaStorageKey) || "{}");
    } catch {
      facturaData = {};
    }

    const numeroFactura = String(facturaData.numeroFactura || "").trim();
    const mantenimientoConsecutivo =
      obtenerConsecutivoMantenimiento(modalMantenimiento.id) || modalMantenimiento.id;
    const numeroOrden = numeroFactura ? `OT-${numeroFactura}` : `OT-MANT-${String(mantenimientoConsecutivo || "SIN-ID")}`;
    const subject = `Orden de mantenimiento ${numeroOrden}`;
    const mantenimientoDocumento = {
      ...modalMantenimiento,
      id: mantenimientoConsecutivo
    };
    const ordenHtml = buildMaintenanceOrderHtml({
      activo: activoRelacionado || {},
      mantenimiento: mantenimientoDocumento,
      factura: facturaData || {},
      numeroOrden,
      mantenimientoConsecutivo,
      logos: {
        logoM5,
        logoAssetControl
      }
    });

    const signatureText = [
      "Cordialmente,",
      currentUser.nombre || "Usuario AssetControl",
      "AssetControl | Microcinco S.A.S"
    ].join("\n");

    const html = buildDocumentEmailHtml({
      title: subject,
      introText: "Se comparte la ORDEN DE MANTENIMIENTO completa en formato documento HTML.",
      documentHtml: ordenHtml,
      documentLabel: `Orden ${numeroOrden}`,
      signatureText,
      senderName: currentUser.nombre || "",
      senderRole: "AssetControl | Microcinco S.A.S",
      logos: {
        logoM5,
        logoAssetControl
      }
    });

    const textFallback = [
      draft.body,
      "",
      `Orden: ${numeroOrden}`,
      "Documento completo enviado en formato HTML."
    ].join("\n");

    setIsSendingEmail(true);
    setError("");

    try {
      const result = await sendEmailNotification({
        to,
        subject,
        text: textFallback,
        html
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(`Correo enviado a ${to}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const cerrarFactura = () => {
    setShowFacturaModal(false);
  };

  const buildMantenimientoSearchText = useCallback((mantenimiento) => {
    const numeroReporte = getNumeroReporteMantenimiento(mantenimiento);
    const activoRelacionado = activosById[String(mantenimiento.activo_id || "")];
    const entidadNombre = String(activoRelacionado?.sede || "").trim();
    const entidadId = String(activoRelacionado?.entidad_id || "").trim();

    return normalizeSearchValue([
      mantenimiento.id,
      numeroReporte,
      numeroActivo(mantenimiento),
      entidadNombre,
      entidadId ? `Entidad #${entidadId}` : "",
      mantenimiento.tipo,
      getEstadoLabel(mantenimiento),
      formatTecnicoNombre(mantenimiento.tecnico || DEFAULT_TECNICO),
      mantenimiento.descripcion,
      mantenimiento.cambio_partes,
      mantenimiento.fecha
    ].join(" "));
  }, [activosById, numeroActivo]);

  const mantenimientoSearchIndex = useMemo(() => {
    const term = normalizeSearchValue(deferredBuscar);
    if (!term) return new Map();
    const map = new Map();
    (Array.isArray(mantenimientosFiltradosPorEntidad) ? mantenimientosFiltradosPorEntidad : []).forEach(
      (mantenimiento) => {
        const key = String(mantenimiento.id || "");
        if (!key) return;
        map.set(key, buildMantenimientoSearchText(mantenimiento));
      }
    );
    return map;
  }, [mantenimientosFiltradosPorEntidad, buildMantenimientoSearchText, deferredBuscar]);

  const matchesMantenimientoFilters = useCallback((mantenimiento, term, options = {}) => {
    const { ignoreEquipo = false } = options;
    const activoRelacionado = activosById[String(mantenimiento.activo_id || "")];
    const entidadId = String(activoRelacionado?.entidad_id || "").trim();

    if (term) {
      const searchIndex =
        mantenimientoSearchIndex.get(String(mantenimiento.id || "")) ||
        buildMantenimientoSearchText(mantenimiento);

      if (!searchIndex.includes(term)) {
        return false;
      }
    }

    if (categoriaMenu && categoriaMenu !== MENU_ALL_CATEGORY) {
      const categoria = getMantenimientoCategoria(mantenimiento);
      if (normalizeCategoriaActivo(categoria) !== normalizeCategoriaActivo(categoriaMenu)) {
        return false;
      }
    }

    if (filtroTipo && normalizeSearchValue(mantenimiento.tipo) !== normalizeSearchValue(filtroTipo)) {
      return false;
    }

    if (filtroEstado && getEstadoNormalized(mantenimiento) !== normalizeEstado(filtroEstado)) {
      return false;
    }

    if (
      filtroTecnico &&
      normalizeSearchValue(formatTecnicoNombre(mantenimiento.tecnico || DEFAULT_TECNICO)) !== normalizeSearchValue(filtroTecnico)
    ) {
      return false;
    }

    if (!ignoreEquipo && filtroEquipo) {
      const equipo = getMantenimientoEquipo(mantenimiento);
      if (normalizeSearchValue(equipo) !== normalizeSearchValue(filtroEquipo)) {
        return false;
      }
    }

    if (filtroActivoId && String(mantenimiento.activo_id || "") !== String(filtroActivoId)) {
      return false;
    }

    if (isAdmin && filtroEntidadId && entidadId !== String(filtroEntidadId)) {
      return false;
    }

    return true;
  }, [
    activosById,
    buildMantenimientoSearchText,
    filtroEquipo,
    filtroActivoId,
    filtroEntidadId,
    filtroEstado,
    filtroTecnico,
    filtroTipo,
    categoriaMenu,
    getMantenimientoEquipo,
    getMantenimientoCategoria,
    isAdmin,
    mantenimientoSearchIndex
  ]);

  const filtrados = useMemo(() => {
    const term = normalizeSearchValue(deferredBuscar);
    const source = mantenimientosFiltradosPorEntidad.filter((mantenimiento) =>
      matchesMantenimientoFilters(mantenimiento, term)
    );

    return sortMantenimientosByRecency(source);
  }, [
    deferredBuscar,
    mantenimientosFiltradosPorEntidad,
    matchesMantenimientoFilters
  ]);

  const clearMantenimientoFilters = () => {
    setBuscar("");
    setFiltroTipo("");
    setFiltroEstado("");
    setFiltroTecnico("");
    setFiltroEquipo("");
    setFiltroActivoId("");
    setFiltroEntidadId("");
  };

  const handleCategoriaMenuSelect = (value) => {
    if (!value) return;
    clearMantenimientoFilters();
    if (value === MENU_ALL_CATEGORY) {
      setCategoriaMenu(MENU_ALL_CATEGORY);
      return;
    }
    const normalized = normalizeCategoriaActivo(value);
    if (!normalized) return;
    setCategoriaMenu(normalized);
  };

  const resetCategoriaMenu = () => {
    setCategoriaMenu("");
    clearMantenimientoFilters();
  };

  const filteredMantenimientosIds = useMemo(
    () =>
      filtrados
        .map((item) => Number(item.id))
        .filter((id) => Number.isInteger(id) && id > 0),
    [filtrados]
  );

  const selectedMantenimientosSet = useMemo(
    () => new Set(selectedMantenimientosIds.map(Number)),
    [selectedMantenimientosIds]
  );

  const selectedMantenimientos = useMemo(() => {
    if (selectedMantenimientosSet.size === 0) return [];
    const source = Array.isArray(mantenimientosFiltradosPorEntidad) ? mantenimientosFiltradosPorEntidad : [];
    return source.filter((item) => selectedMantenimientosSet.has(Number(item.id)));
  }, [mantenimientosFiltradosPorEntidad, selectedMantenimientosSet]);

  const exportScopeConfig = useMemo(() => {
    const option =
      MAINTENANCE_EXPORT_SCOPE_OPTIONS.find((item) => item.value === exportScope) ||
      MAINTENANCE_EXPORT_SCOPE_OPTIONS[0];

    let source = filtrados;
    if (option.value === "all") {
      source = mantenimientosFiltradosPorEntidad;
    } else if (option.value === "selected") {
      source = selectedMantenimientos;
    }

    return {
      ...option,
      source: Array.isArray(source) ? source : []
    };
  }, [exportScope, filtrados, mantenimientosFiltradosPorEntidad, selectedMantenimientos]);

  const exportScopeCounts = useMemo(() => {
    return {
      filtered: filtrados.length,
      selected: selectedMantenimientos.length,
      all: Array.isArray(mantenimientosFiltradosPorEntidad) ? mantenimientosFiltradosPorEntidad.length : 0
    };
  }, [filtrados, selectedMantenimientos, mantenimientosFiltradosPorEntidad]);

  const exportEquipoConfig = useMemo(() => {
    if (!exportEquipo) return { type: "", value: "" };
    const [type, ...rest] = String(exportEquipo).split(":");
    const value = rest.join(":");
    return { type, value };
  }, [exportEquipo]);

  const exportEquipoLabel = useMemo(() => {
    if (!exportEquipoConfig.type) return "";
    if (exportEquipoConfig.type === "equipo") {
      return exportEquipoConfig.value;
    }
    if (exportEquipoConfig.type === "activo") {
      const match = activosOpcionesNuevo.find((item) => item.id === exportEquipoConfig.value);
      return match?.label || `Activo #${exportEquipoConfig.value}`;
    }
    return exportEquipoConfig.value;
  }, [exportEquipoConfig, activosOpcionesNuevo]);

  const exportMantenimientos = useMemo(() => {
    const source = exportScopeConfig.source;
    if (!source.length) return [];
    return source.filter((mantenimiento) => {
      if (exportMonth) {
        const monthKey = toMonthKey(mantenimiento.fecha);
        if (monthKey !== exportMonth) return false;
      }
      if (exportEquipoConfig.type === "equipo") {
        const equipo = getMantenimientoEquipo(mantenimiento);
        if (normalizeSearchValue(equipo) !== normalizeSearchValue(exportEquipoConfig.value)) {
          return false;
        }
      }
      if (exportEquipoConfig.type === "activo") {
        if (String(mantenimiento.activo_id || "") !== String(exportEquipoConfig.value)) {
          return false;
        }
      }
      return true;
    });
  }, [
    exportScopeConfig,
    exportMonth,
    exportEquipoConfig,
    getMantenimientoEquipo
  ]);

  const exportFilters = useMemo(() => {
    const filters = [];
    if (exportScopeConfig.reportLabel) {
      filters.push(`Alcance: ${exportScopeConfig.reportLabel}`);
    }
    if (exportMonth) {
      const label = formatMonthLabel(exportMonth);
      filters.push(`Mes: ${label || exportMonth}`);
    }
    if (exportEquipoLabel) {
      filters.push(`Equipo: ${exportEquipoLabel}`);
    }
    if (!exportScopeConfig.includeFilters) return filters;
    if (buscar) filters.push(`Busqueda: ${buscar}`);
    if (categoriaMenu && categoriaMenu !== MENU_ALL_CATEGORY) {
      filters.push(`Categoria: ${categoriaMenuLabel}`);
    }
    if (filtroTipo) {
      filters.push(`Tipo: ${formatTipoMantenimiento(filtroTipo) || filtroTipo}`);
    }
    if (filtroEstado) filters.push(`Estado: ${filtroEstado}`);
    if (filtroTecnico) filters.push(`Tecnico: ${filtroTecnico}`);
    if (filtroEquipo) filters.push(`Filtro equipo: ${filtroEquipo}`);
    if (filtroActivoId) {
      const activoFiltro = activosById[String(filtroActivoId)];
      const activoLabel = activoFiltro ? etiquetaActivoOption(activoFiltro) : `Activo #${filtroActivoId}`;
      filters.push(`Filtro activo: ${activoLabel}`);
    }
    if (isAdmin && filtroEntidadId) {
      const entidadOption = mantenimientoEntidadOptions.find(
        (option) => String(option.id) === String(filtroEntidadId)
      );
      const entidadLabel = entidadOption?.nombre || `Entidad #${filtroEntidadId}`;
      filters.push(`Entidad: ${entidadLabel}`);
    }
    return filters;
  }, [
    exportScopeConfig,
    exportMonth,
    exportEquipoLabel,
    buscar,
    categoriaMenu,
    categoriaMenuLabel,
    filtroTipo,
    filtroEstado,
    filtroTecnico,
    filtroEquipo,
    filtroActivoId,
    filtroEntidadId,
    activosById,
    etiquetaActivoOption,
    isAdmin,
    mantenimientoEntidadOptions
  ]);

  const exportFiltersTitle = exportFilters.length
    ? exportFilters.join(" | ")
    : "Sin filtros aplicados";
  const exportFiltersSummary = exportFilters.length > 4
    ? `${exportFilters.slice(0, 4).join(" | ")} | +${exportFilters.length - 4}`
    : exportFiltersTitle;

  const allVisibleMantenimientosSelected =
    filteredMantenimientosIds.length > 0 &&
    filteredMantenimientosIds.every((id) => selectedMantenimientosSet.has(id));

  const toggleMantenimientoSelection = (mantenimientoId, event) => {
    if (event?.stopPropagation) event.stopPropagation();
    if (!hasPermission(currentUser, "ELIMINAR_MANTENIMIENTO")) return;

    const normalizedId = Number(mantenimientoId);
    if (!Number.isInteger(normalizedId) || normalizedId <= 0) return;

    setSelectedMantenimientosIds((prev) => {
      const exists = prev.some((id) => Number(id) === normalizedId);
      if (exists) {
        return prev.filter((id) => Number(id) !== normalizedId);
      }
      return [...prev, normalizedId];
    });
  };

  const toggleSelectAllVisibleMantenimientos = () => {
    if (!hasPermission(currentUser, "ELIMINAR_MANTENIMIENTO")) return;

    setSelectedMantenimientosIds((prev) => {
      const prevSet = new Set(prev.map(Number));
      const shouldSelectAll = filteredMantenimientosIds.some((id) => !prevSet.has(id));

      if (shouldSelectAll) {
        filteredMantenimientosIds.forEach((id) => prevSet.add(id));
        return Array.from(prevSet);
      }

      return prev.filter((id) => !filteredMantenimientosIds.includes(Number(id)));
    });
  };

  const handleDeleteSelectedMantenimientos = async () => {
    if (!hasPermission(currentUser, "ELIMINAR_MANTENIMIENTO")) {
      setError("No tienes permiso para eliminar mantenimientos");
      return;
    }

    const selectedIds = selectedMantenimientosIds
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);

    if (selectedIds.length === 0) {
      setError("Selecciona al menos un mantenimiento para eliminar.");
      return;
    }

    const confirmed = globalThis.confirm(`¿Eliminar ${selectedIds.length} mantenimientos seleccionados?`);
    if (!confirmed) return;

    setIsBulkDeleting(true);
    setError("");
    setSuccess("");

    try {
      let deletedCount = 0;
      const failed = [];

      for (const id of selectedIds) {
        try {
          await mantenimientoService.delete(id);
          deletedCount += 1;
        } catch (err) {
          failed.push({
            id,
            message: err?.response?.data?.message || err?.response?.data?.error || "Error al eliminar"
          });
        }
      }

      if (showModal && modalMantenimiento?.id && selectedIds.includes(Number(modalMantenimiento.id))) {
        cerrarModal();
      }

      setSelectedMantenimientosIds((prev) =>
        prev.filter((id) => !selectedIds.includes(Number(id)))
      );
      await cargarMantenimientos();

      if (failed.length > 0) {
        const resumenFallos = failed
          .slice(0, 3)
          .map((item, index) => {
            if (isAdmin) {
              return `ID ${item.id}: ${item.message}`;
            }
            const consecutivo = obtenerConsecutivoMantenimiento(item.id);
            const label = consecutivo ? `Mantenimiento ${consecutivo}` : `Mantenimiento ${index + 1}`;
            return `${label}: ${item.message}`;
          })
          .join(" | ");
        setError(`Eliminación parcial: ${deletedCount}/${selectedIds.length}. ${resumenFallos}`);
      } else {
        setSuccess(`Se eliminaron ${deletedCount} mantenimientos.`);
      }
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const buildMaintenanceReportRows = useCallback((items = []) => {
    const source = Array.isArray(items) ? items : [];
    return source.map((mantenimiento) => ({
      consecutivo: obtenerConsecutivoMantenimiento(mantenimiento.id) || "-",
      fecha: formatFecha(mantenimiento.fecha),
      numeroReporte: getNumeroReporteMantenimiento(mantenimiento) || "-",
      activo: numeroActivo(mantenimiento) || "-",
      sede: getMantenimientoSede(mantenimiento) || "-",
      area: getMantenimientoArea(mantenimiento) || "-",
      equipo: getMantenimientoEquipo(mantenimiento) || "-",
      tipo: formatTipoMantenimiento(mantenimiento.tipo) || "-",
      estado: getEstadoLabelOrDash(mantenimiento),
      tecnico: formatTecnicoNombre(mantenimiento.tecnico || DEFAULT_TECNICO),
      planificacion: getPlanificacionByEstado(mantenimiento.estado),
      descripcion: mantenimiento.descripcion || "-",
      cambioPartes: mantenimiento.cambio_partes || mantenimiento.cambioPartes || "-"
    }));
  }, [
    obtenerConsecutivoMantenimiento,
    formatFecha,
    numeroActivo,
    getMantenimientoSede,
    getMantenimientoArea,
    getMantenimientoEquipo
  ]);

  const getReportLogos = useCallback(async () => {
    if (reportLogoCacheRef.current) return reportLogoCacheRef.current;
    const [logoM5Data, logoAssetControlData] = await Promise.all([
      imageToDataUrl(logoM5),
      imageToDataUrl(logoAssetControl)
    ]);
    const logos = {
      logoM5: logoM5Data,
      logoAssetControl: logoAssetControlData
    };
    reportLogoCacheRef.current = logos;
    return logos;
  }, []);

  const getEntidadNombreReporte = () => {
    if (!entidadActivaId) return "Todas las entidades";
    const source = Array.isArray(activosFiltradosPorEntidad) ? activosFiltradosPorEntidad : [];
    const entidadNombre = String(source[0]?.sede || "").trim();
    return entidadNombre || `Entidad #${entidadActivaId}`;
  };

  const buildExportFilenameSuffix = () => {
    const scopeSuffix =
      exportScopeConfig.value === "selected"
        ? "seleccionados"
        : exportScopeConfig.value === "all"
          ? "todos"
          : "filtrados";
    const parts = [scopeSuffix];
    if (exportMonth) parts.push(`mes-${exportMonth}`);
    if (exportEquipoLabel) parts.push(`equipo-${toFilenameSlug(exportEquipoLabel)}`);
    return parts.filter(Boolean).join("-");
  };

  const handleUseCurrentMonth = () => {
    setExportMonth(getCurrentMonthKey());
  };

  const handleClearExportFilters = () => {
    setExportMonth("");
    setExportEquipo("");
  };

  const handleExportMaintenanceExcel = async () => {
    if (exportMantenimientos.length === 0) {
      setError("No hay mantenimientos para exportar con el alcance seleccionado.");
      setSuccess("");
      return;
    }

    setIsExportingExcel(true);
    setError("");
    setSuccess("");

    try {
      const excelImport = await import("exceljs/dist/exceljs.min.js");
      const ExcelJS = excelImport?.default || excelImport;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "AssetControl";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Mantenimientos");
      const rows = buildMaintenanceReportRows(exportMantenimientos);
      const filtrosText = exportFilters.length ? exportFilters.join(" | ") : "Sin filtros aplicados";
      const entidadNombre = getEntidadNombreReporte();
      const generadoText = `Generado: ${formatFecha(new Date())}`;
      const totalText = `Total registros: ${rows.length}`;

      const lastColumn = MAINTENANCE_REPORT_COLUMNS.length;
      const leftLogoEnd = 2;
      const rightLogoStart = Math.max(lastColumn - 1, leftLogoEnd + 1);
      const centerStart = leftLogoEnd + 1;
      const centerEnd = rightLogoStart - 1;

      worksheet.columns = MAINTENANCE_REPORT_COLUMNS.map((column) => ({
        key: column.key,
        width: MAINTENANCE_EXCEL_COLUMN_WIDTHS[column.key] || 14,
        style: { alignment: { vertical: "middle", wrapText: true } }
      }));

      worksheet.mergeCells(1, centerStart, 1, centerEnd);
      worksheet.mergeCells(2, centerStart, 2, centerEnd);
      worksheet.mergeCells(3, centerStart, 3, centerEnd);
      worksheet.mergeCells(4, 1, 4, lastColumn);

      worksheet.getRow(1).height = 32;
      worksheet.getRow(2).height = 18;
      worksheet.getRow(3).height = 18;
      worksheet.getRow(4).height = 18;
      worksheet.getRow(5).height = 22;

      const titleCell = worksheet.getCell(1, centerStart);
      titleCell.value = "Reporte de mantenimientos";
      titleCell.font = { size: 15, bold: true, color: { argb: "FF0F2D5C" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };

      const entidadCell = worksheet.getCell(2, centerStart);
      entidadCell.value = `Entidad: ${entidadNombre || "Todas las entidades"}`;
      entidadCell.font = { size: 11, color: { argb: "FF475569" } };
      entidadCell.alignment = { horizontal: "center", vertical: "middle" };

      const metaCell = worksheet.getCell(3, centerStart);
      metaCell.value = `${generadoText} | ${totalText}`;
      metaCell.font = { size: 11, color: { argb: "FF475569" } };
      metaCell.alignment = { horizontal: "center", vertical: "middle" };

      const filterCell = worksheet.getCell(4, 1);
      filterCell.value = `Filtros: ${filtrosText}`;
      filterCell.font = { size: 11, color: { argb: "FF334155" } };
      filterCell.alignment = { horizontal: "left", vertical: "middle" };

      const headerRowIndex = 5;
      const headerRow = worksheet.getRow(headerRowIndex);
      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF021F59" } };
      const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      const headerBorder = {
        top: { style: "thin", color: { argb: "FFD6DEEA" } },
        left: { style: "thin", color: { argb: "FFD6DEEA" } },
        bottom: { style: "thin", color: { argb: "FFD6DEEA" } },
        right: { style: "thin", color: { argb: "FFD6DEEA" } }
      };

      MAINTENANCE_REPORT_COLUMNS.forEach((column, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = column.label;
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = headerBorder;
      });

      const dataStartRow = headerRowIndex + 1;
      rows.forEach((rowData, idx) => {
        const rowIndex = dataStartRow + idx;
        const row = worksheet.getRow(rowIndex);
        MAINTENANCE_REPORT_COLUMNS.forEach((column, colIndex) => {
          const cell = row.getCell(colIndex + 1);
          cell.value = rowData[column.key] ?? "-";
          cell.border = headerBorder;
        });
        if (idx % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
          });
        }
      });

      worksheet.views = [{ state: "frozen", ySplit: headerRowIndex }];

      const logos = await getReportLogos();
      const leftLogo = parseExcelImage(logos.logoM5);
      const rightLogo = parseExcelImage(logos.logoAssetControl);

      if (leftLogo) {
        const logoId = workbook.addImage({
          base64: leftLogo.base64,
          extension: leftLogo.extension
        });
        worksheet.addImage(logoId, `A1:B3`);
      }

      if (rightLogo) {
        const logoId = workbook.addImage({
          base64: rightLogo.base64,
          extension: rightLogo.extension
        });
        const rightCol = String.fromCharCode(64 + rightLogoStart);
        const rightColEnd = String.fromCharCode(64 + lastColumn);
        worksheet.addImage(logoId, `${rightCol}1:${rightColEnd}3`);
      }

      if (!leftLogo || !rightLogo) {
        setError("No se pudieron cargar ambos logos. Verifica los archivos de logo.");
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `reporte-mantenimientos-${buildExportFilenameSuffix()}-${stamp}.xlsx`;
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      downloadBlobFile(blob, filename);
      setSuccess(`Reporte Excel generado en .xlsx (${rows.length} registros).`);
    } catch {
      setError("No se pudo generar el reporte Excel en .xlsx.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportMaintenancePdf = () => {
    if (exportMantenimientos.length === 0) {
      setError("No hay mantenimientos para exportar con el alcance seleccionado.");
      setSuccess("");
      return;
    }

    setIsExportingPdf(true);
    setError("");
    setSuccess("");

    try {
      const rows = buildMaintenanceReportRows(exportMantenimientos);
      const reporteHtml = buildMaintenancePdfReportHtml({
        columns: MAINTENANCE_REPORT_COLUMNS,
        rows,
        entidadNombre: getEntidadNombreReporte(),
        generatedAt: new Date(),
        filtros: exportFilters,
        logos: {
          logoM5,
          logoAssetControl
        }
      });

      const printWindow = globalThis.open("", "_blank", "width=1200,height=900");
      if (!printWindow) {
        const stamp = new Date().toISOString().slice(0, 10);
        const blob = new Blob([reporteHtml], { type: "text/html;charset=utf-8" });
        downloadBlobFile(blob, `reporte-mantenimientos-${buildExportFilenameSuffix()}-${stamp}.html`);
        setSuccess(
          "No se pudo abrir ventana emergente. Se descargo el reporte en HTML para imprimir o guardar PDF."
        );
        return;
      }

      printWindow.document.open();
      printWindow.document.write(reporteHtml);
      printWindow.document.close();
      printWindow.focus();
      setSuccess("Vista previa del reporte abierta. Desde esa ventana puedes imprimir o guardar en PDF.");
    } catch {
      setError("No se pudo generar el reporte PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  useEffect(() => {
    const validIds = new Set(
      (Array.isArray(mantenimientosFiltradosPorEntidad) ? mantenimientosFiltradosPorEntidad : [])
        .map((item) => Number(item.id))
        .filter((id) => Number.isInteger(id) && id > 0)
    );

    setSelectedMantenimientosIds((prev) => {
      const next = prev.filter((id) => validIds.has(Number(id)));
      if (next.length === prev.length) return prev;
      return next;
    });
  }, [mantenimientosFiltradosPorEntidad]);

  const stats = useMemo(() => {
    const source = Array.isArray(mantenimientosFiltradosPorEntidad) ? mantenimientosFiltradosPorEntidad : [];
    const total = source.length;
    const enProceso = source.filter((item) => {
      const estado = getEstadoNormalized(item);
      return estado === "en proceso" || estado === "pendiente";
    }).length;
    const finalizados = source.filter((item) => getEstadoNormalized(item) === "finalizado").length;
    const pendientes = source.filter((item) => getEstadoNormalized(item) === "pendiente").length;
    return { total, enProceso, finalizados, pendientes };
  }, [mantenimientosFiltradosPorEntidad]);

  const mantenimientosDestacados = useMemo(() => {
    return filtrados.slice(0, 6).map((item) => ({
      ...item,
      activoLabel: numeroActivo(item),
      cambioPartes: item.cambio_partes || item.cambioPartes || "Sin cambio de partes"
    }));
  }, [filtrados, numeroActivo]);

  const openCreateModal = () => {
    setError("");
    setSuccess("");
    setCreateModalReady(false);
    setForm(buildDefaultMaintenanceForm(tecnicoOptions[0] || defaultTecnico));
    setActivoInputNuevo("");
    setDoubleFormDrafts(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setCreateModalReady(false);
    setShowCreateModal(false);
  };

  useEffect(() => {
    if (!showCreateModal) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCreateModal();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [showCreateModal]);

  const updateDoubleDraftField = useCallback((draftKey, field, value) => {
    setDoubleFormDrafts((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [draftKey]: {
          ...(prev[draftKey] || {}),
          [field]: value
        }
      };
    });
  }, []);

  const maintenanceTypeOptions = useMemo(() => ([
    "Preventivo",
    "Correctivo",
    "Predictivo",
    "Calibracion",
    MANTENIMIENTO_TIPO_PUNTO_RED,
    MANTENIMIENTO_TIPO_CRONOGRAMA
  ]), []);
  const maintenanceTypeCreateOptions = useMemo(() => ([
    "Preventivo",
    "Correctivo",
    MANTENIMIENTO_TIPO_DOBLE,
    "Predictivo",
    "Calibracion",
    MANTENIMIENTO_TIPO_PUNTO_RED,
    MANTENIMIENTO_TIPO_CRONOGRAMA
  ]), []);

  const selectedCreateActivoOption = useMemo(() => {
    const selectedId = String(form.activo || "");
    if (!selectedId) return null;
    return (Array.isArray(activosOpcionesNuevo) ? activosOpcionesNuevo : []).find(
      (item) => String(item.id || "") === selectedId
    ) || null;
  }, [activosOpcionesNuevo, form.activo]);

  const createModalActivosMatches = useMemo(() => {
    if (!createModalReady) return [];

    const query = normalizeSearchValue(activoInputNuevo);
    if (!query) return [];

    const selectedLabel = String(selectedCreateActivoOption?.label || "").trim();
    if (selectedLabel && normalizeSearchValue(selectedLabel) === query) {
      return [];
    }

    const source = Array.isArray(activosOpcionesNuevo) ? activosOpcionesNuevo : [];
    return source
      .filter((item) => {
        const haystack = normalizeSearchValue(`${item.label} ${item.id}`);
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [createModalReady, activoInputNuevo, activosOpcionesNuevo, selectedCreateActivoOption]);

  const createActivoField = (() => {
    if (isPuntoRedTipo(form.tipo)) {
      return (
        <div className="maintenance-form-field">
          <span className="maintenance-field-label">Activo asociado</span>
          <small>Este Punto de Red se identifica con el código del reporte y no requiere activo. Si lo dejas vacío, el sistema generará un PR automáticamente.</small>
        </div>
      );
    }

    if (isCronogramaTipo(form.tipo)) {
      return (
        <div className="maintenance-form-field">
          <span className="maintenance-field-label">Activo asociado</span>
          <small>Este cronograma es general por área y no requiere activo asociado.</small>
        </div>
      );
    }

    return (
      <div className="maintenance-form-field activo-picker-field">
        <label htmlFor="create-mantenimiento-activo-input">Activo asociado *</label>
        <input
          id="create-mantenimiento-activo-input"
          type="text"
          className="activo-picker-input"
          placeholder={createModalReady ? "Buscar y seleccionar activo *" : "Cargando activos..."}
          value={activoInputNuevo}
          onChange={handleActivoInputChange}
          aria-label="Activo"
          required
        />
        {createModalReady && activoInputNuevo.trim() && createModalActivosMatches.length > 0 && (
          <div className="activo-picker-results" role="listbox" aria-label="Resultados de activos">
            {createModalActivosMatches.map((item) => (
              <button
                key={`nuevo-activo-modal-${item.id}`}
                type="button"
                className="activo-picker-option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelectCreateActivo(item)}
              >
                <span className="activo-picker-option-label">{item.label}</span>
                <span className="activo-picker-option-meta">ID {item.id}</span>
              </button>
            ))}
          </div>
        )}
        {createModalReady && activoInputNuevo.trim() && createModalActivosMatches.length === 0 && (
          <small className="activo-picker-empty">No hay coincidencias para esa búsqueda.</small>
        )}
        {createModalReady && !activoInputNuevo.trim() && (
          <small className="activo-picker-hint">Escribe para buscar un activo y seleccionar solo uno de la lista.</small>
        )}
      </div>
    );
  })();

  if (isLoading) {
    return (
      <div className="container-mantenimiento">
        <div className="loading">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="container-mantenimiento">
      <input
        ref={importInputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        onChange={handleImportFileChange}
        style={{ display: "none" }}
      />
      {toast && (
        <div className="toast-stack" role="status" aria-live="polite">
          <div className={`toast-message ${toast.tone || "info"}`}>
            <span className="toast-text">{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => setToast(null)}
              aria-label="Cerrar mensaje"
            >
              X
            </button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Gestión de mantenimientos</h1>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {hasPermission(currentUser, "CREAR_MANTENIMIENTO") && (
            <button type="button" className="btn-action" onClick={openImportDialog} disabled={isImporting}>
              {isImporting ? "Importando..." : "Importar"}
            </button>
          )}
          {hasPermission(currentUser, "CREAR_MANTENIMIENTO") && (
            <button type="button" className="btn-submit" onClick={openCreateModal}>
              Nuevo mantenimiento
            </button>
          )}
          {hasPermission(currentUser, "ELIMINAR_MANTENIMIENTO") && (
            <button
              type="button"
              className="btn-action"
              onClick={handleDeleteSelectedMantenimientos}
              disabled={isBulkDeleting || selectedMantenimientosIds.length === 0}
            >
              {isBulkDeleting ? "Eliminando..." : `Eliminar seleccionados (${selectedMantenimientosIds.length})`}
            </button>
          )}
          <button type="button" className="btn-action" onClick={() => navigate("/cronograma")}>
            Ver cronograma
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
        <div className="alert alert-success" style={{ margin: 0 }}>
          Total: {stats.total}
        </div>
        <div className="alert" style={{ margin: 0, backgroundColor: "var(--brand-tint)", border: "1px solid var(--brand-tint-strong)", color: "var(--brand-700)" }}>
          Pendientes: {stats.pendientes}
        </div>
        <div className="alert" style={{ margin: 0, backgroundColor: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412" }}>
          En proceso: {stats.enProceso}
        </div>
        <div className="alert" style={{ margin: 0, backgroundColor: "#ecfdf5", border: "1px solid #86efac", color: "#14532d" }}>
          Finalizados: {stats.finalizados}
        </div>
      </div>

      <section className="export-panel" aria-label="Exportacion de mantenimientos">
        <div className="export-panel-header">
          <div>
            <h3>Exportacion de mantenimientos</h3>
            <p>Filtra por mes o equipo y genera PDF o Excel en segundos.</p>
          </div>
          <div className="export-panel-metrics">
            <div className="export-metric">
              <span>Registros</span>
              <strong>{exportMantenimientos.length}</strong>
            </div>
            <div className="export-metric">
              <span>Alcance</span>
              <strong>{exportScopeConfig.label}</strong>
            </div>
          </div>
        </div>
        <div className="export-panel-body export-panel-body-wide">
          <div className="export-panel-section">
            <span className="export-panel-label">Alcance</span>
            <div className="export-chip-group" role="group" aria-label="Seleccionar alcance">
              {MAINTENANCE_EXPORT_SCOPE_OPTIONS.map((option) => {
                const count = exportScopeCounts[option.value] ?? 0;
                const isActive = exportScope === option.value;
                const isDisabled = option.value === "selected" && selectedMantenimientos.length === 0;
                return (
                  <button
                    key={`export-chip-${option.value}`}
                    type="button"
                    className={`export-chip ${isActive ? "is-active" : ""}`}
                    onClick={() => setExportScope(option.value)}
                    aria-pressed={isActive}
                    disabled={isDisabled}
                    title={option.reportLabel}
                  >
                    <span>{option.label}</span>
                    <span className="export-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>
            {exportScope === "selected" && selectedMantenimientos.length === 0 && (
              <div className="export-panel-hint">
                Selecciona mantenimientos en la tabla para habilitar este alcance.
              </div>
            )}
          </div>
          <div className="export-panel-section">
            <span className="export-panel-label">Filtros rapidos</span>
            <div className="export-panel-filters">
              <div className="export-field">
                <label htmlFor="export-month">Mes</label>
                <input
                  id="export-month"
                  type="month"
                  value={exportMonth}
                  onChange={(event) => setExportMonth(event.target.value)}
                />
                <div className="export-field-actions">
                  <button type="button" className="export-mini-btn" onClick={handleUseCurrentMonth}>
                    Mes actual
                  </button>
                  <button type="button" className="export-mini-btn" onClick={handleClearExportFilters}>
                    Limpiar
                  </button>
                </div>
              </div>
              <div className="export-field">
                <label htmlFor="export-equipo">Equipo o activo</label>
                <select
                  id="export-equipo"
                  value={exportEquipo}
                  onChange={(event) => setExportEquipo(event.target.value)}
                >
                  <option value="">Todos los equipos</option>
                  {mantenimientoEquipoOptions.length > 0 && (
                    <optgroup label="Equipos (tipo)">
                      {mantenimientoEquipoOptions.map((option) => (
                        <option key={`export-equipo-${option.value}`} value={`equipo:${option.value}`}>
                          {option.label} ({option.count})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {activosOpcionesNuevo.length > 0 && (
                    <optgroup label="Activos especificos">
                      {activosOpcionesNuevo.map((option) => (
                        <option key={`export-activo-${option.id}`} value={`activo:${option.id}`}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>
          </div>
          <div className="export-panel-section export-panel-actions">
            <button
              type="button"
              className="btn-export btn-export-excel"
              onClick={handleExportMaintenanceExcel}
              disabled={isExportingExcel || exportMantenimientos.length === 0}
            >
              {isExportingExcel ? "Generando Excel..." : "Exportar Excel"}
            </button>
            <button
              type="button"
              className="btn-export btn-export-pdf"
              onClick={handleExportMaintenancePdf}
              disabled={isExportingPdf || exportMantenimientos.length === 0}
            >
              {isExportingPdf ? "Generando PDF..." : "Exportar PDF"}
            </button>
            <div className="export-panel-hint">
              Se abre una vista previa para imprimir o guardar en PDF.
            </div>
          </div>
        </div>
        <div className="export-panel-summary" title={exportFiltersTitle}>
          <strong>Filtros:</strong> {exportFiltersSummary}
        </div>
      </section>

      {!shouldShowMantenimientoContent && (
        <section className="maintenance-category-menu">
          <div className="maintenance-category-menu-header">
            <div>
              <h2>Categorías de mantenimiento</h2>
            </div>
          </div>
          <div className="maintenance-category-strip">
            <button
              type="button"
              className="maintenance-category-card tone-all"
              onClick={() => handleCategoriaMenuSelect(MENU_ALL_CATEGORY)}
            >
              <span>Todos los mantenimientos</span>
              <strong>{mantenimientoCategoriaSummary.total}</strong>
            </button>
            {ACTIVO_CATEGORY_OPTIONS.map((category) => {
              const key = CATEGORY_SUMMARY_KEYS[category.value] || "trabajo";
              const count = mantenimientoCategoriaSummary[key] || 0;
              return (
                <button
                  key={`menu-mant-category-${category.value}`}
                  type="button"
                  className={`maintenance-category-card tone-${category.tone}`}
                  onClick={() => handleCategoriaMenuSelect(category.value)}
                >
                  <span>{formatCategoriaLabel(category.value)}</span>
                  <strong>{count}</strong>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {shouldShowMantenimientoContent && (
        <>
          <div className="maintenance-category-banner">
            <div>
              <span>Categoría seleccionada</span>
              <strong>{categoriaMenuLabel}</strong>
            </div>
            <button type="button" className="maintenance-category-reset" onClick={resetCategoriaMenu}>
              Cambiar categoría
            </button>
          </div>
          <section className="maintenance-overview">
        <article className="maintenance-overview-card">
          <h3>Seguimiento rápido</h3>
          <p>Abre los mantenimientos críticos o identifica de inmediato qué partes se cambiaron.</p>
        </article>
        <article className="maintenance-overview-card maintenance-overview-card-list">
          <h3>Últimos registros visibles</h3>
          <div className="maintenance-highlight-list">
            {mantenimientosDestacados.length ? (
              mantenimientosDestacados.map((item) => (
                <button
                  key={`mant-dest-${item.id}`}
                  type="button"
                  className={`maintenance-highlight-card estado-${getEstadoUiToken(item)}`}
                  onClick={() => abrirModal(item)}
                >
                  <strong>{item.activoLabel}</strong>
                  <span>{formatTipoMantenimiento(item.tipo) || "Mantenimiento"} | {formatFecha(item.fecha)}</span>
                  <small>{item.cambioPartes}</small>
                </button>
              ))
            ) : (
              <p className="no-data">No hay mantenimientos para mostrar.</p>
            )}
          </div>
        </article>
      </section>

      <input
        className="search-input"
        placeholder="Buscar..."
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
      />

      <div className="mantenimiento-filters-bar">
        <select
          className="mantenimiento-filter-select"
          value={filtroTipo}
          onChange={(event) => setFiltroTipo(event.target.value)}
          aria-label="Filtrar mantenimientos por tipo"
        >
          <option value="">Todos los tipos</option>
          {mantenimientoTipoOptions.map((option) => (
            <option key={`filtro-tipo-${option}`} value={option}>
              {formatTipoMantenimiento(option) || option}
            </option>
          ))}
        </select>

        <select
          className="mantenimiento-filter-select"
          value={filtroEstado}
          onChange={(event) => setFiltroEstado(event.target.value)}
          aria-label="Filtrar mantenimientos por estado"
        >
          <option value="">Todos los estados</option>
          {mantenimientoEstadoOptions.map((option) => (
            <option key={`filtro-estado-${option}`} value={option}>{option}</option>
          ))}
        </select>

        <select
          className="mantenimiento-filter-select"
          value={filtroTecnico}
          onChange={(event) => setFiltroTecnico(event.target.value)}
          aria-label="Filtrar mantenimientos por técnico"
        >
          <option value="">Todos los técnicos</option>
          {mantenimientoTecnicoOptions.map((option) => (
            <option key={`filtro-tecnico-${option}`} value={option}>{option}</option>
          ))}
        </select>

        <select
          className="mantenimiento-filter-select"
          value={filtroEquipo}
          onChange={(event) => setFiltroEquipo(event.target.value)}
          aria-label="Filtrar mantenimientos por equipo"
        >
          <option value="">Todos los equipos</option>
          {mantenimientoEquipoOptions.map((option) => (
            <option key={`filtro-equipo-${option.value}`} value={option.value}>
              {option.label} ({option.count})
            </option>
          ))}
        </select>

        <select
          className="mantenimiento-filter-select"
          value={filtroActivoId}
          onChange={(event) => setFiltroActivoId(event.target.value)}
          aria-label="Filtrar mantenimientos por activo"
        >
          <option value="">Todos los activos</option>
          {mantenimientoActivoOptions.map((option) => (
            <option key={`filtro-activo-${option.id}`} value={option.id}>{option.label}</option>
          ))}
        </select>

        {isAdmin && (
          <select
            className="mantenimiento-filter-select"
            value={filtroEntidadId}
            onChange={(event) => setFiltroEntidadId(event.target.value)}
            aria-label="Filtrar mantenimientos por entidad"
          >
            <option value="">Todas las entidades</option>
            {mantenimientoEntidadOptions.map((option) => (
              <option key={`filtro-entidad-${option.id}`} value={option.id}>
                {option.nombre}
              </option>
            ))}
          </select>
        )}

        <button type="button" className="mantenimiento-filter-reset" onClick={clearMantenimientoFilters}>
          Limpiar filtros
        </button>
      </div>

      <div className="table-container">
        <table className="tabla-mantenimiento">
          <thead>
            <tr>
              {hasPermission(currentUser, "ELIMINAR_MANTENIMIENTO") && (
                <th>
                  <input
                    type="checkbox"
                    checked={allVisibleMantenimientosSelected}
                    onChange={toggleSelectAllVisibleMantenimientos}
                    aria-label="Seleccionar todos los mantenimientos visibles"
                  />
                </th>
              )}
              <th>Consecutivo</th>
              <th>Fecha</th>
              <th>N.º reporte</th>
              <th>N.º activo</th>
              <th>Tipo de equipo</th>
              <th>Tipo</th>
              <th>Cambio de partes</th>
              <th>Planificación</th>
              <th>Estado</th>
              <th>Técnico</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((m) => (
              <tr key={m.id}>
                {hasPermission(currentUser, "ELIMINAR_MANTENIMIENTO") && (
                  <td data-label="SELECCIONAR">
                    <input
                      type="checkbox"
                      checked={selectedMantenimientosSet.has(Number(m.id))}
                      onChange={(event) => toggleMantenimientoSelection(m.id, event)}
                      aria-label={`Seleccionar mantenimiento ${obtenerConsecutivoMantenimiento(m.id) || m.id}`}
                    />
                  </td>
                )}
                <td data-label="CONSECUTIVO">{obtenerConsecutivoMantenimiento(m.id) || "-"}</td>
                <td data-label="FECHA">{formatFecha(m.fecha)}</td>
                <td data-label="N.º REPORTE">{getNumeroReporteMantenimiento(m) || "-"}</td>
                <td data-label="N.º ACTIVO">{numeroActivo(m)}</td>
                <td data-label="TIPO DE EQUIPO">{getMantenimientoEquipo(m) || "-"}</td>
                <td data-label="TIPO">{formatTipoMantenimiento(m.tipo) || "-"}</td>
                <td data-label="CAMBIO DE PARTES">{m.cambio_partes || m.cambioPartes || "-"}</td>
                <td data-label="Planificación">{getPlanificacionByEstado(m.estado)}</td>
                <td data-label="ESTADO">
                  <span className={`estado-pill estado-${getEstadoUiToken(m)}`}>
                    {getEstadoLabelOrDash(m)}
                  </span>
                </td>
                <td data-label="TÉCNICO">{formatTecnicoNombre(m.tecnico || DEFAULT_TECNICO)}</td>
                <td data-label="ACCIONES" className="actions-cell">
                  <div className="table-actions">
                    <button
                      type="button"
                      className="btn-action btn-action-icon"
                      onClick={() => abrirModal(m)}
                      aria-label="Editar mantenimiento"
                      title="Editar"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M3 21l3.75-.75L19.5 7.5l-3-3L3.75 17.25 3 21z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <path d="M14.5 4.5l3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                    {hasPermission(currentUser, "ELIMINAR_MANTENIMIENTO") && (
                      <button
                        type="button"
                        className="btn-action btn-action-icon btn-action-danger"
                        onClick={() => eliminarMantenimientoById(m.id)}
                        aria-label="Eliminar mantenimiento"
                        title="Eliminar"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 7h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path
                            d="M6 7l1 12h10l1-12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                          <path d="M9 7V4h6v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M10 11v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M14 11v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}

      {createModalPresence.isMounted && hasPermission(currentUser, "CREAR_MANTENIMIENTO") && (
        <div
          className="modal-overlay maintenance-create-overlay"
          data-state={createModalPresence.phase}
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeCreateModal();
            }
          }}
          >
          <div
            className="modal-content maintenance-create-modal maintenance-create-dialog"
            data-state={createModalPresence.phase}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-maintenance-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="maintenance-modal-head">
              <div>
                <h2 id="create-maintenance-title">Crear mantenimiento</h2>
                <p>Para Punto de Red usa el tipo especial. Si dejas el código vacío, el sistema generará un PR automáticamente y lo guardará sin activo asociado.</p>
              </div>
              <button type="button" className="maintenance-modal-close" onClick={closeCreateModal} aria-label="Cerrar modal">
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <form className="form-mantenimiento form-mantenimiento-modal" onSubmit={handleSubmit}>
                <div className="maintenance-form-field">
                  <label htmlFor="create-mantenimiento-fecha">Fecha</label>
                  <input id="create-mantenimiento-fecha" type="date" name="fecha" value={form.fecha} onChange={handleChange} aria-label="Fecha" />
                </div>
                {!isTipoDoble(form.tipo) && (
                  <div className="maintenance-form-field">
                    <label htmlFor="create-mantenimiento-reporte">{getNumeroReporteLabel(form.tipo)}</label>
                    <input
                      id="create-mantenimiento-reporte"
                      type="text"
                      name="numeroReporte"
                      value={form.numeroReporte}
                      onChange={handleChange}
                      placeholder={getNumeroReporteLabel(form.tipo)}
                      aria-label="Número de reporte"
                      required
                    />
                    <small>{getNumeroReporteHelp(form.tipo)}</small>
                  </div>
                )}
                {createActivoField}
                <div className="maintenance-form-field">
                  <label htmlFor="create-mantenimiento-tipo">Tipo</label>
                  <select id="create-mantenimiento-tipo" name="tipo" value={form.tipo} onChange={handleChange} aria-label="Tipo">
                    <option value="">Tipo</option>
                    {maintenanceTypeCreateOptions.map((item) => (
                      <option key={`tipo-mantenimiento-${item}`} value={item}>
                        {formatTipoMantenimiento(item) || item}
                      </option>
                    ))}
                  </select>
                  <small>La opción "Preventivo + Correctivo" abre dos formularios en la misma pantalla.</small>
                </div>
                <div className="maintenance-form-field">
                  <label htmlFor="create-mantenimiento-planificacion">Planificación</label>
                  <select id="create-mantenimiento-planificacion" name="planificacion" value={form.planificacion} onChange={handleChange} aria-label="Planificación">
                    <option value="Programado">Programado</option>
                    <option value="Realizado">Finalizado</option>
                  </select>
                </div>
                <div className="maintenance-form-field">
                  <label htmlFor="create-mantenimiento-tecnico">Técnico</label>
                  <select id="create-mantenimiento-tecnico" name="tecnico" value={form.tecnico} onChange={handleChange} aria-label="Técnico">
                    {tecnicoOptions.map((item) => (
                      <option key={`tecnico-opcion-modal-${item}`} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                {isTipoDoble(form.tipo) ? (
                  <>
                    <div className="maintenance-dual-note">
                      <strong>Modo doble activo.</strong>
                      <span>Se crearán dos registros relacionados, uno preventivo y uno correctivo, en la misma pantalla.</span>
                    </div>
                    <div className="maintenance-dual-grid">
                      {[
                        { key: "preventivo", label: "Preventivo", hint: "Primer registro" },
                        { key: "correctivo", label: "Correctivo", hint: "Segundo registro" }
                      ].map((draftConfig) => {
                        const draft = doubleFormDrafts?.[draftConfig.key] || {};
                        return (
                          <article key={`draft-${draftConfig.key}`} className={`maintenance-dual-card maintenance-dual-card-${draftConfig.key}`}>
                            <div className="maintenance-dual-card-head">
                              <div>
                                <span>{draftConfig.label}</span>
                                <small>{draftConfig.hint}</small>
                              </div>
                              <strong>{draft.numeroReporte ? draft.numeroReporte : "Sin consecutivo"}</strong>
                            </div>
                            <div className="maintenance-form-field">
                              <label htmlFor={`create-mantenimiento-${draftConfig.key}-reporte`}>Número de reporte / consecutivo</label>
                              <input
                                id={`create-mantenimiento-${draftConfig.key}-reporte`}
                                type="text"
                                value={draft.numeroReporte || ""}
                                onChange={(event) => updateDoubleDraftField(draftConfig.key, "numeroReporte", event.target.value)}
                                placeholder="Consecutivo editable"
                                aria-label={`Número de reporte ${draftConfig.label}`}
                                required
                              />
                              <small>Puedes cambiarlo sin perder la sugerencia automática.</small>
                            </div>
                            <div className="maintenance-form-field">
                              <label htmlFor={`create-mantenimiento-${draftConfig.key}-cambio`}>Cambio de partes</label>
                              <textarea
                                id={`create-mantenimiento-${draftConfig.key}-cambio`}
                                value={draft.cambioPartes || ""}
                                onChange={(event) => updateDoubleDraftField(draftConfig.key, "cambioPartes", event.target.value)}
                                placeholder="Cambio de partes / repuestos instalados"
                                aria-label={`Cambio de partes ${draftConfig.label}`}
                              />
                            </div>
                            <div className="maintenance-form-field maintenance-form-field-wide">
                              <label htmlFor={`create-mantenimiento-${draftConfig.key}-descripcion`}>Descripción</label>
                              <textarea
                                id={`create-mantenimiento-${draftConfig.key}-descripcion`}
                                value={draft.descripcion || ""}
                                onChange={(event) => updateDoubleDraftField(draftConfig.key, "descripcion", event.target.value)}
                                placeholder={`Descripción ${draftConfig.label.toLowerCase()}`}
                                aria-label={`Descripción ${draftConfig.label}`}
                              />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="maintenance-form-field maintenance-form-field-wide">
                      <label htmlFor="create-mantenimiento-cambio-partes">Cambio de partes</label>
                      <textarea
                        id="create-mantenimiento-cambio-partes"
                        name="cambioPartes"
                        value={form.cambioPartes}
                        onChange={handleChange}
                        placeholder="Cambio de partes / repuestos instalados"
                        aria-label="Cambio de partes"
                      />
                    </div>
                    <div className="maintenance-form-field maintenance-form-field-wide">
                      <label htmlFor="create-mantenimiento-descripcion">Descripción</label>
                      <textarea
                        id="create-mantenimiento-descripcion"
                        name="descripcion"
                        value={form.descripcion}
                        onChange={handleChange}
                        placeholder="Descripción"
                        aria-label="Descripción"
                      />
                    </div>
                  </>
                )}
                <div className="form-mantenimiento-modal-actions">
                  <button type="submit" className="btn-submit" disabled={isCreating}>
                    {isCreating ? "Guardando..." : "Crear mantenimiento"}
                  </button>
                  <button type="button" className="btn-cancelar" onClick={closeCreateModal}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {detailModalPresence.isMounted && modalMantenimiento && (
        <div
          className="modal-overlay maintenance-detail-overlay"
          data-state={detailModalPresence.phase}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              cerrarModal();
            }
          }}
        >
          <dialog
            className={`modal-dialog ${showFacturaModal ? "modal-dialog-factura" : ""}`}
            open
            data-state={detailModalPresence.phase}
            role="dialog"
            aria-modal="true"
            aria-labelledby="maintenance-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
          {showFacturaModal ? (
            <FacturaMantenimiento
              activo={obtenerActivoMantenimiento(modalMantenimiento) || {}}
              mantenimiento={modalMantenimiento}
              isAdmin={isAdmin}
              mantenimientoConsecutivo={obtenerConsecutivoMantenimiento(modalMantenimiento.id)}
              onClose={cerrarFactura}
              onOrdenFirmada={async (facturaPayload) => {
                if (!facturaPayload.usuarioFirma || !facturaPayload.autorizaFirma) {
                  setError("Se requieren las firmas del usuario habitual/area y de quien autoriza.");
                  return;
                }
                const usuarioHabitual = String(facturaPayload.usuarioNombre || "").trim().toLowerCase();
                const autorizaNombre = String(facturaPayload.autorizaNombre || "").trim().toLowerCase();
                if (usuarioHabitual && autorizaNombre && usuarioHabitual === autorizaNombre) {
                  setError("Quien autoriza debe ser una persona diferente al usuario habitual.");
                  return;
                }
                await generarOrdenConFactura(facturaPayload);
              }}
            />
          ) : (
            <>
              <div className="maintenance-modal-body" data-state={detailModalPresence.phase}>
                <div className="maintenance-modal-shell">
                  <div className="maintenance-modal-head">
                    <div>
                      <h2 id="maintenance-detail-title">
                        Detalle de mantenimiento #
                        {obtenerConsecutivoMantenimiento(modalMantenimiento.id) || modalMantenimiento.id}
                      </h2>
                      <p>Edita datos del mantenimiento y genera la orden desde la factura oficial.</p>
                    </div>
                    <button type="button" className="maintenance-modal-close" onClick={cerrarModal} aria-label="Cerrar modal">
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  <div className="maintenance-modal-grid">
                    <div className="maintenance-field">
                      <label htmlFor="detail-mantenimiento-activo">
                        {isPuntoRedTipo(modalMantenimiento.tipo) || isCronogramaTipo(modalMantenimiento.tipo)
                          ? "Activo asociado (opcional)"
                          : "Activo asociado"}
                      </label>
                      <select
                        id="detail-mantenimiento-activo"
                        value={modalMantenimiento.activo_id || ""}
                        onChange={(e) =>
                          setModalMantenimiento({
                            ...modalMantenimiento,
                            activo_id: e.target.value ? Number(e.target.value) : null
                          })
                        }
                      >
                        <option value="">Selecciona un activo</option>
                        {activosFiltradosPorEntidad.map((activo) => (
                          <option key={activo.id} value={activo.id}>
                            {etiquetaActivoOption(activo)}
                          </option>
                        ))}
                      </select>
                      {isPuntoRedTipo(modalMantenimiento.tipo) && (
                        <small>Si este registro es un Punto de Red, puede quedar sin activo asociado.</small>
                      )}
                      {isCronogramaTipo(modalMantenimiento.tipo) && (
                        <small>Los cronogramas generales se guardan sin activo asociado.</small>
                      )}
                    </div>

                  <div className="maintenance-field">
                    <label htmlFor="detail-mantenimiento-equipo">Tipo de equipo</label>
                    <input
                      id="detail-mantenimiento-equipo"
                      type="text"
                      value={equipoLabelModal || "-"}
                      readOnly
                    />
                  </div>

                  <div className="maintenance-field">
                    <label htmlFor="detail-mantenimiento-fecha">Fecha</label>
                    <input
                      id="detail-mantenimiento-fecha"
                      type="date"
                      value={modalMantenimiento.fecha || ""}
                      onChange={(e) =>
                        setModalMantenimiento({
                          ...modalMantenimiento,
                          fecha: e.target.value
                        })
                      }
                    />
                  </div>

                  <div className="maintenance-field">
                    <label htmlFor="detail-mantenimiento-reporte">Número de reporte</label>
                    <input
                      id="detail-mantenimiento-reporte"
                      type="text"
                      value={modalMantenimiento.numeroReporte || ""}
                      onChange={(e) =>
                        setModalMantenimiento({
                          ...modalMantenimiento,
                          numeroReporte: e.target.value
                        })
                      }
                    />
                  </div>

                  <div className="maintenance-field">
                    <label htmlFor="detail-mantenimiento-tipo">Tipo</label>
                    <select
                      id="detail-mantenimiento-tipo"
                      value={modalMantenimiento.tipo || ""}
                      onChange={(e) =>
                        setModalMantenimiento({
                          ...modalMantenimiento,
                          tipo: e.target.value
                        })
                      }
                    >
                      <option value="">Tipo</option>
                      {maintenanceTypeOptions.map((item) => (
                        <option key={`modal-tipo-${item}`} value={item}>
                          {formatTipoMantenimiento(item) || item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="maintenance-field">
                    <label htmlFor="detail-mantenimiento-estado">Estado</label>
                    <select
                      id="detail-mantenimiento-estado"
                      value={modalMantenimiento.estado || "En proceso"}
                      onChange={(e) =>
                        setModalMantenimiento({
                          ...modalMantenimiento,
                          estado: e.target.value
                        })
                      }
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="En proceso">En proceso</option>
                      <option value="Finalizado">Finalizado</option>
                    </select>
                  </div>

                  <div className="maintenance-field maintenance-field-wide">
                    <label htmlFor="detail-mantenimiento-tecnico">Técnico</label>
                    <select
                      id="detail-mantenimiento-tecnico"
                      value={formatTecnicoNombre(modalMantenimiento.tecnico || DEFAULT_TECNICO)}
                      onChange={(e) =>
                        setModalMantenimiento({
                          ...modalMantenimiento,
                          tecnico: e.target.value
                        })
                      }
                    >
                      {modalTecnicoOptions.map((item) => (
                        <option key={`modal-tecnico-opcion-${item}`} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div className="maintenance-field maintenance-field-wide">
                    <label htmlFor="detail-mantenimiento-cambio-partes">Cambio de partes</label>
                    <textarea
                      id="detail-mantenimiento-cambio-partes"
                      value={modalMantenimiento.cambio_partes || modalMantenimiento.cambioPartes || ""}
                      onChange={(e) =>
                        setModalMantenimiento({
                          ...modalMantenimiento,
                          cambio_partes: e.target.value
                        })
                      }
                    />
                  </div>

                  <div className="maintenance-field maintenance-field-wide">
                    <label htmlFor="detail-mantenimiento-descripcion">Descripción</label>
                    <textarea
                      id="detail-mantenimiento-descripcion"
                      value={modalMantenimiento.descripcion || ""}
                      onChange={(e) =>
                        setModalMantenimiento({
                          ...modalMantenimiento,
                          descripcion: e.target.value
                        })
                      }
                    />
                  </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-factura" onClick={abrirFactura} disabled={isOrderLoading}>
                  Factura / Pdf / Orden
                </button>
                <button
                  type="button"
                  className="btn-orden"
                  onClick={enviarMantenimientoPorCorreo}
                  disabled={isOrderLoading || isSendingEmail}
                >
                  {isSendingEmail ? "Enviando..." : "Enviar Por Correo"}
                </button>
                {hasPermission(currentUser, "EDITAR_MANTENIMIENTO") && (
                  <button type="button" className="btn-actualizar" onClick={handleActualizar} disabled={isOrderLoading}>
                    Guardar
                  </button>
                )}
                {hasPermission(currentUser, "ELIMINAR_MANTENIMIENTO") && (
                  <button type="button" className="btn-eliminar" onClick={handleEliminar} disabled={isOrderLoading}>
                    Eliminar
                  </button>
                )}
                <button type="button" className="btn-cancelar" onClick={cerrarModal}>
                  Cerrar
                </button>
              </div>
            </>
          )}
          </dialog>
        </div>
      )}
    </div>
  );
}


MantenimientosPage.propTypes = {
  selectedEntidadId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};
