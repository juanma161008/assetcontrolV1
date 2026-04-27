import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import "../../styles/activos.css";
import httpClient from "../../services/httpClient";
import { getCurrentUser, isAuthenticated } from "../../services/authService";
import { hasPermission } from "../../utils/permissions";
import { buildAssetEmailDraft } from "../../utils/email";
import { sendEmailNotification } from "../../services/notificacionService";
import { buildAssetLifeSheetHtml } from "../../utils/assetLifecycle";
import { buildAssetsPdfReportHtml } from "../../utils/assetsReport";
import { buildDocumentEmailHtml } from "../../utils/emailDocuments";
import { toProperCase } from "../../utils/formatters";
import {
  ACTIVO_CATEGORY_OPTIONS,
  CATEGORY_SUMMARY_KEYS,
  EQUIPO_OPTIONS_BY_CATEGORY,
  getCategoriaProfile,
  inferCategoriaActivo,
  normalizeCategoriaActivo
} from "../../utils/activosCategoria";
import logoM5 from "../../assets/logos/logom5.png";
import logoAssetControl from "../../assets/logos/logo-assetcontrol.png";

const INITIAL_FORM = {
  entidad_id: "",
  categoria_activo: "",
  activo: "",
  serial: "",
  nombre: "",
  areaPrincipal: "",
  areaSecundaria: "",
  equipo: "",
  marca: "",
  modelo: "",
  procesador: "",
  tipoRam: "",
  ram: "",
  tipoDisco: "",
  hdd: "",
  os: "",
  estado: "Disponible",
  ciclo_vida_etapa: "",
  fecha_adquisicion: "",
  vida_util_anios: "",
  campos_especificos: {}
};

const OPTIONS = {
  tipoRam: ["DDR3", "DDR3L", "DDR4", "DDR5", "LPDDR4", "LPDDR5"],
  ram: ["4GB", "8GB", "16GB", "32GB", "64GB"],
  tipoDisco: ["SSD", "HDD", "M2"],
  hdd: ["120GB", "128GB", "240GB", "256GB", "480GB", "512GB", "1TB", "2TB"],
  os: ["Windows 10 Pro", "Windows 11 Pro", "Linux", "MacOS"],
  estado: ["Disponible", "Mantenimiento", "Fuera de servicio"],
  cicloVida: ["Planificación", "Adquisición", "Operación", "Mantenimiento", "Renovación", "Baja"]
};

const INITIAL_COLUMN_FILTERS = {
  id: "",
  activo: "",
  categoria: "",
  entidad: "",
  equipo: "",
  marca: "",
  modelo: "",
  serial: "",
  areaPrincipal: "",
  areaSecundaria: "",
  tipoDisco: "",
  hdd: "",
  estado: ""
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isKeyboardActivation = (event) => event.key === "Enter" || event.key === " ";
const normalizeSearchValue = (value = "") =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
const normalizeImportKey = (value = "") => normalizeSearchValue(value).replace(/[^a-z0-9]/g, "");
const toText = (value = "") => String(value ?? "").trim();
const normalizeStatusToken = (value = "") => normalizeImportKey(value);
const parseQuickFilterValue = (value = "") => {
  const [type = "", ...parts] = String(value || "").split("::");
  return {
    type,
    value: parts.join("::")
  };
};
const getEstadoClassName = (estado = "") =>
  `estado-${normalizeSearchValue(estado).replace(/\s+/g, "-") || "sin-estado"}`;
const toPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const toTimestamp = (value) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};
const normalizeCamposEspecificos = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const IMPORT_ACCEPT = ".xlsm,.xlsx,.xls,.csv";
const MENU_ALL_CATEGORY = "all";
const IMPORT_FIELD_ALIASES = {
  entidad_id: ["entidadid", "identidad", "entidad", "sede"],
  numeroReporte: ["numeroreporte", "reporte", "nroreporte", "codigo", "codigoactivo"],
  activo: ["activo", "codigoactivo", "codigoequipo"],
  categoria_activo: ["categoriaactivo", "categoria", "clasificacion", "familia", "linea"],
  serial: ["serial"],
  nombre: ["nombre", "nombredelequipo", "nombreequipo"],
  areaPrincipal: ["areaprincipal", "areaprincip", "areaprincipa", "areaprincipa1", "area"],
  areaSecundaria: ["areasecundaria", "areasecunda", "areasecund", "secundaria"],
  equipo: ["equipo", "tipoequipo"],
  marca: ["marca"],
  modelo: ["modelo"],
  procesador: ["procesador", "procesado", "procesadoi", "cpu"],
  tipoGenerico: ["tipo"],
  tipoRam: ["tiporam", "tipodememoria"],
  ram: ["ram", "capacidadram"],
  tipoDisco: ["tipodisco", "tipodedisco", "thdd", "tipohdd", "tipodiscoduro"],
  hdd: ["hdd", "capacidaddisco", "disco", "discoduro", "capacidaddiscoduro"],
  os: ["os", "sistemaoperativo", "so"],
  estado: ["estado"],
  ciclo_vida_etapa: ["ciclovidaetapa", "etapaciclovida", "ciclodevida"],
  fecha_adquisicion: ["fechaadquisicion", "fechacompra", "fecha", "fecharegistro"],
  vida_util_anios: ["vidautilanios", "vidautilanos", "vidautil"]
};

const RAM_TYPE_SYNONYMS = {
  ddr3l: "DDR3L",
  dd3l: "DDR3L",
  ddr4sodimm: "DDR4",
  soddr4: "DDR4",
  ddr5sodimm: "DDR5",
  soddr5: "DDR5",
  lpddr4x: "LPDDR4",
  lpddr5x: "LPDDR5"
};

const DISK_TYPE_SYNONYMS = {
  solidstate: "SSD",
  solido: "SSD",
  satassd: "SSD",
  discoduro: "HDD",
  harddisk: "HDD",
  m2: "M2",
  nvme: "M2",
  nvmem2: "M2",
  pcie: "M2"
};

const RAM_CAPACITY_SYNONYMS = {
  "4g": "4GB",
  "4gb": "4GB",
  "8g": "8GB",
  "8gb": "8GB",
  "16g": "16GB",
  "16gb": "16GB",
  "32g": "32GB",
  "32gb": "32GB",
  "64g": "64GB",
  "64gb": "64GB"
};

const DISK_CAPACITY_SYNONYMS = {
  "120g": "120GB",
  "120gb": "120GB",
  "128g": "128GB",
  "128gb": "128GB",
  "240g": "240GB",
  "240gb": "240GB",
  "256g": "256GB",
  "256gb": "256GB",
  "480g": "480GB",
  "480gb": "480GB",
  "512g": "512GB",
  "512gb": "512GB",
  "1t": "1TB",
  "1tb": "1TB",
  "2t": "2TB",
  "2tb": "2TB"
};
const EQUIPO_TIPO_CAN_KEEP_NAME = [
  "desktop",
  "destop",
  "laptop",
  "allinone",
  "aio"
];

const OS_SYNONYMS = {
  windows10: "Windows 10 Pro",
  windows10pro: "Windows 10 Pro",
  win10: "Windows 10 Pro",
  win10pro: "Windows 10 Pro",
  windows11: "Windows 11 Pro",
  windows11pro: "Windows 11 Pro",
  win11: "Windows 11 Pro",
  win11pro: "Windows 11 Pro",
  mac: "MacOS",
  macosx: "MacOS"
};

const getCategoriaBadgeClassName = (categoria = "") =>
  `categoria-${normalizeImportKey(normalizeCategoriaActivo(categoria) || "sin-categoria")}`;

const REPORT_COLUMNS = [
  { key: "consecutivo", label: "Id" },
  { key: "activo", label: "Activo" },
  { key: "nombre", label: "Nombre del equipo" },
  { key: "categoria", label: "Categoría" },
  { key: "entidad", label: "Entidad" },
  { key: "equipo", label: "Equipo" },
  { key: "marca", label: "Marca" },
  { key: "modelo", label: "Modelo" },
  { key: "serial", label: "Serial" },
  { key: "area", label: "Área principal" },
  { key: "areaSecundaria", label: "Área secundaria" },
  { key: "tipoDisco", label: "Tipo de disco" },
  { key: "capacidad", label: "Capacidad" },
  { key: "estado", label: "Estado" },
  { key: "fechaRegistro", label: "Fecha registro" }
];

const COLUMN_FILTER_LABELS = {
  id: "Id",
  activo: "Activo",
  categoria: "Categoría",
  entidad: "Entidad",
  equipo: "Equipo",
  marca: "Marca",
  modelo: "Modelo",
  serial: "Serial",
  areaPrincipal: "Área principal",
  areaSecundaria: "Área secundaria",
  tipoDisco: "Tipo de disco",
  hdd: "Capacidad",
  estado: "Estado"
};

const EXPORT_SCOPE_OPTIONS = [
  {
    value: "filtered",
    label: "Filtrados (búsqueda)",
    reportLabel: "Filtrados (búsqueda y filtros)",
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
    reportLabel: "Todos los activos",
    includeFilters: false
  }
];

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

const EXCEL_COLUMN_WIDTHS = {
  consecutivo: 6,
  activo: 14,
  nombre: 28,
  categoria: 18,
  entidad: 22,
  equipo: 18,
  marca: 14,
  modelo: 16,
  serial: 18,
  area: 16,
  areaSecundaria: 18,
  tipoDisco: 16,
  capacidad: 12,
  estado: 14,
  fechaRegistro: 14
};

export default function ActivosPage({ selectedEntidadId, selectedEntidadNombre }) {
  const currentUser = getCurrentUser();
  const canCreate = hasPermission(currentUser, "CREAR_ACTIVO");
  const canEdit = hasPermission(currentUser, "EDITAR_ACTIVO");
  const canDelete = hasPermission(currentUser, "ADMIN_TOTAL");
  const isAdmin = canDelete;
  const canRequestBaja = hasPermission(currentUser, "VER_ACTIVOS");
  const canSelectRows = hasPermission(currentUser, "VER_ACTIVOS");
  const entidadActivaId = String(selectedEntidadId ?? "").trim();

  const [activos, setActivos] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editId, setEditId] = useState(null);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [activosQuickFilter, setActivosQuickFilter] = useState("");
  const [activosFilterEstado, setActivosFilterEstado] = useState("");
  const [activosFilterCategoria, setActivosFilterCategoria] = useState("");
  const [activosFilterTipoDisco, setActivosFilterTipoDisco] = useState("");
  const [activosFilterOs, setActivosFilterOs] = useState("");
  const [activosFilterAreaPrincipal, setActivosFilterAreaPrincipal] = useState("");
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [dashboardFocusKey, setDashboardFocusKey] = useState("fueraServicio");
  const [categoriaMenu, setCategoriaMenu] = useState("");
  const [columnFilters, setColumnFilters] = useState(INITIAL_COLUMN_FILTERS);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportScope, setExportScope] = useState("filtered");
  const [selectedActivosIds, setSelectedActivosIds] = useState([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to: "",
    subject: "",
    message: "",
    signature: ""
  });
  const [bajas, setBajas] = useState([]);
  const [isLoadingBajas, setIsLoadingBajas] = useState(false);
  const [bajaError, setBajaError] = useState("");
  const [showBajaModal, setShowBajaModal] = useState(false);
  const [isSubmittingBaja, setIsSubmittingBaja] = useState(false);
  const [bajaForm, setBajaForm] = useState({
    activo: null,
    motivo: "",
    adjuntos: []
  });

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [modalActivo, setModalActivo] = useState(null);
  const [historialMantenimientos, setHistorialMantenimientos] = useState([]);
  const [isLoadingHistorial, setIsLoadingHistorial] = useState(false);
  const importInputRef = useRef(null);
  const reportLogoCacheRef = useRef(null);
  const MAX_BAJA_ADJUNTOS = 4;
  const MAX_BAJA_BYTES = 2 * 1024 * 1024;
  const ALLOWED_BAJA_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp"
  ];

  const normalizarActivo = useCallback((raw = {}) => {
    const normalizeCatalogInline = (value = "", options = [], synonyms = {}) => {
      const rawValue = toText(value);
      if (!rawValue) return "";
      const normalizedRaw = normalizeImportKey(rawValue);
      const byCatalog = options.find((item) => normalizeImportKey(item) === normalizedRaw);
      if (byCatalog) return byCatalog;
      const bySynonym = synonyms[normalizedRaw];
      if (bySynonym) return bySynonym;
      return toProperCase(rawValue);
    };
    const tipoRamRaw = raw.tipoRam ?? raw.tiporam ?? "";
    const tipoDiscoRaw = raw.tipoDisco ?? raw.tipodisco ?? "";
    return {
      ...raw,
      areaPrincipal: raw.areaPrincipal ?? raw.areaprincipal ?? "",
      areaSecundaria: raw.areaSecundaria ?? raw.areasecundaria ?? "",
      tipoRam: normalizeCatalogInline(tipoRamRaw, OPTIONS.tipoRam, RAM_TYPE_SYNONYMS),
      tipoDisco: normalizeCatalogInline(tipoDiscoRaw, OPTIONS.tipoDisco, DISK_TYPE_SYNONYMS),
      categoria_activo:
        normalizeCategoriaActivo(raw.categoria_activo ?? raw.categoriaActivo ?? raw.categoria ?? "") ||
        inferCategoriaActivo(raw),
      campos_especificos: normalizeCamposEspecificos(
        raw.campos_especificos ?? raw.camposEspecificos ?? raw.detalles ?? {}
      ),
      activo: raw.activo ?? "",
      nombre: raw.nombre ?? "",
      ciclo_vida_etapa: raw.ciclo_vida_etapa ?? raw.cicloVidaEtapa ?? "",
      fecha_adquisicion: raw.fecha_adquisicion ?? raw.fechaAdquisicion ?? "",
      vida_util_anios: raw.vida_util_anios ?? raw.vidaUtilAnios ?? ""
    };
  }, []);

  const entidadesOrdenadas = useMemo(() => {
    const source = Array.isArray(entidades) ? entidades : [];
    return [...source].sort((a, b) =>
      String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" })
    );
  }, [entidades]);

  const entidadPorId = useMemo(() => {
    return entidadesOrdenadas.reduce((acc, entidad) => {
      acc[String(entidad.id)] = entidad;
      return acc;
    }, {});
  }, [entidadesOrdenadas]);

  const entidadIdByNormalizedName = useMemo(() => {
    return entidadesOrdenadas.reduce((acc, entidad) => {
      const key = normalizeSearchValue(entidad.nombre || "");
      if (key) {
        acc[key] = Number(entidad.id);
      }
      return acc;
    }, {});
  }, [entidadesOrdenadas]);

  const entidadIdByCompactName = useMemo(() => {
    return entidadesOrdenadas.reduce((acc, entidad) => {
      const key = normalizeImportKey(entidad.nombre || "");
      if (key) {
        acc[key] = Number(entidad.id);
      }
      return acc;
    }, {});
  }, [entidadesOrdenadas]);

  const resolveEntidadIdFromName = useCallback((value = "") => {
    const normalizedValue = normalizeSearchValue(value);
    if (!normalizedValue) return null;

    const byNormalized = entidadIdByNormalizedName[normalizedValue];
    if (byNormalized) return byNormalized;

    const compactValue = normalizeImportKey(value);
    const byCompact = entidadIdByCompactName[compactValue];
    if (byCompact) return byCompact;

    const partialMatch = entidadesOrdenadas.find((entidad) => {
      const normalizedEntidad = normalizeSearchValue(entidad.nombre || "");
      const compactEntidad = normalizeImportKey(entidad.nombre || "");
      return (
        normalizedEntidad.includes(normalizedValue) ||
        normalizedValue.includes(normalizedEntidad) ||
        compactEntidad.includes(compactValue) ||
        compactValue.includes(compactEntidad)
      );
    });
    return Number(partialMatch.id) || null;
  }, [entidadIdByCompactName, entidadIdByNormalizedName, entidadesOrdenadas]);

  const activosFiltradosPorEntidad = useMemo(() => {
    if (!entidadActivaId) return activos;
    return (Array.isArray(activos) ? activos : []).filter(
      (item) => String(item.entidad_id || "") === entidadActivaId
    );
  }, [activos, entidadActivaId]);

  const activosEstadoOptions = useMemo(() => {
    const source = Array.isArray(activosFiltradosPorEntidad) ? activosFiltradosPorEntidad : [];
    return Array.from(
      new Set(
        source
          .map((item) => String(item.estado || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [activosFiltradosPorEntidad]);

  const activosCategoriaOptions = useMemo(() => {
    const source = Array.isArray(activosFiltradosPorEntidad) ? activosFiltradosPorEntidad : [];
    const inferredOptions = source
      .map((item) => inferCategoriaActivo(item))
      .filter(Boolean);

    return Array.from(
      new Set([
        ...ACTIVO_CATEGORY_OPTIONS.map((item) => item.value),
        ...inferredOptions
      ])
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [activosFiltradosPorEntidad]);

  const activosTipoDiscoOptions = useMemo(() => {
    const source = Array.isArray(activosFiltradosPorEntidad) ? activosFiltradosPorEntidad : [];
    return Array.from(
      new Set(
        source
          .map((item) => String(item.tipoDisco || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [activosFiltradosPorEntidad]);

  const activosOsOptions = useMemo(() => {
    const source = Array.isArray(activosFiltradosPorEntidad) ? activosFiltradosPorEntidad : [];
    return Array.from(
      new Set(
        source
          .map((item) => String(item.os || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [activosFiltradosPorEntidad]);

  const activosAreaPrincipalOptions = useMemo(() => {
    const source = Array.isArray(activosFiltradosPorEntidad) ? activosFiltradosPorEntidad : [];
    return Array.from(
      new Set(
        source
          .map((item) => String(item.areaPrincipal || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [activosFiltradosPorEntidad]);

  const activosQuickFilterOptions = useMemo(() => {
    const options = [{ value: "", label: "Vista general de activos" }];

    activosEstadoOptions.forEach((option) => {
      options.push({ value: `estado::${option}`, label: `Estado: ${option}` });
    });
    activosCategoriaOptions.forEach((option) => {
      options.push({ value: `categoria::${option}`, label: `Categoria: ${option}` });
    });
    activosAreaPrincipalOptions.forEach((option) => {
      options.push({ value: `area::${option}`, label: `Área principal: ${option}` });
    });
    activosTipoDiscoOptions.forEach((option) => {
      options.push({ value: `disco::${option}`, label: `Disco: ${option}` });
    });
    activosOsOptions.forEach((option) => {
      options.push({ value: `os::${option}`, label: `Sistema: ${option}` });
    });

    return options;
  }, [
    activosAreaPrincipalOptions,
    activosCategoriaOptions,
    activosEstadoOptions,
    activosOsOptions,
    activosTipoDiscoOptions
  ]);

  const activosQuickFilterLabel = useMemo(() => {
    return activosQuickFilterOptions.find((option) => option.value === activosQuickFilter)?.label || "Vista general de activos";
  }, [activosQuickFilter, activosQuickFilterOptions]);

  const activosDashboardGroups = useMemo(() => {
    const source = Array.isArray(activosFiltradosPorEntidad) ? activosFiltradosPorEntidad : [];
    return {
      total: source,
      disponibles: source.filter((item) => normalizeStatusToken(item.estado) === "disponible"),
      mantenimiento: source.filter((item) => normalizeStatusToken(item.estado) === "mantenimiento"),
      fueraServicio: source.filter((item) => normalizeStatusToken(item.estado) === "fueradeservicio"),
      trabajo: source.filter((item) => inferCategoriaActivo(item) === "Equipo de trabajo"),
      impresion: source.filter((item) => inferCategoriaActivo(item) === "Impresora / Escaner"),
      infraestructura: source.filter((item) => inferCategoriaActivo(item) === "Infraestructura"),
      telefonia: source.filter((item) => inferCategoriaActivo(item) === "Telefono")
    };
  }, [activosFiltradosPorEntidad]);

  const activosDashboardSummary = useMemo(() => {
    return {
      total: activosDashboardGroups.total.length,
      disponibles: activosDashboardGroups.disponibles.length,
      mantenimiento: activosDashboardGroups.mantenimiento.length,
      fueraServicio: activosDashboardGroups.fueraServicio.length,
      trabajo: activosDashboardGroups.trabajo.length,
      impresion: activosDashboardGroups.impresion.length,
      infraestructura: activosDashboardGroups.infraestructura.length,
      telefonia: activosDashboardGroups.telefonia.length
    };
  }, [activosDashboardGroups]);

  const dashboardFocusConfig = useMemo(() => ({
    total: {
      title: "Panorama general de activos",
      description: "Consulta la entidad completa sin depender solo de la tabla.",
      count: activosDashboardSummary.total,
      tone: "neutral"
    },
    disponibles: {
      title: "Equipos disponibles",
      description: "Inventario operativo listo para asignacion o uso.",
      count: activosDashboardSummary.disponibles,
      tone: "success"
    },
    mantenimiento: {
      title: "Equipos en mantenimiento",
      description: "Activos con intervencion tecnica en curso.",
      count: activosDashboardSummary.mantenimiento,
      tone: "warning"
    },
    fueraServicio: {
      title: "Equipos fuera de servicio",
      description: "Casos criticos para reposicion, reparacion o baja.",
      count: activosDashboardSummary.fueraServicio,
      tone: "danger"
    },
    trabajo: {
      title: "Equipos de trabajo",
      description: "Computadores, portatiles y equipos de usuario final.",
      count: activosDashboardSummary.trabajo,
      tone: "neutral"
    },
    impresion: {
      title: "Impresoras y escaneres",
      description: "Dispositivos de impresion, digitalizacion y multifuncionales.",
      count: activosDashboardSummary.impresion,
      tone: "warning"
    },
    infraestructura: {
      title: "Infraestructura",
      description: "Switch, AP, rack, router y demas equipos de red.",
      count: activosDashboardSummary.infraestructura,
      tone: "danger"
    },
    telefonia: {
      title: "Telefonos",
      description: "Telefonia IP, moviles corporativos y accesorios de voz.",
      count: activosDashboardSummary.telefonia,
      tone: "success"
    }
  }), [activosDashboardSummary]);

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
    return Number.isInteger(consecutivo) ? consecutivo : "-";
  }, [consecutivoPorActivoId]);

  const formatActivoLabel = useCallback((activoId, fallback = "Activo") => {
    const parsed = Number(activoId);
    if (isAdmin && Number.isFinite(parsed) && parsed > 0) {
      return `Activo #${parsed}`;
    }
    const consecutivo = obtenerConsecutivoActivo(activoId);
    if (consecutivo && consecutivo !== "-") {
      return `Activo ${consecutivo}`;
    }
    return fallback;
  }, [isAdmin, obtenerConsecutivoActivo]);

  const formatBajaActivoLabel = useCallback((baja = {}) => {
    const nombre = baja.activo_codigo || baja.activo_nombre;
    if (nombre) return nombre;
    return formatActivoLabel(baja.activo_id, "Activo");
  }, [formatActivoLabel]);

  const targetEntidadId = String(form.entidad_id || entidadActivaId || "").trim();
  const primaryAreaOptions = useMemo(() => {
    const entidadTarget = entidadPorId[targetEntidadId];
    const source = Array.isArray(entidadTarget?.areas_primarias) ? entidadTarget.areas_primarias : [];
    const unique = [
      ...new Set(
        source
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    ];
    return unique.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [entidadPorId, targetEntidadId]);

  const secondaryAreaOptions = useMemo(() => {
    const entidadTarget = entidadPorId[targetEntidadId];
    const source = Array.isArray(entidadTarget?.areas_secundarias) ? entidadTarget.areas_secundarias : [];
    const unique = [
      ...new Set(
        source
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    ];
    return unique.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [entidadPorId, targetEntidadId]);

  let areaPrincipalPlaceholder = "Área Principal *";
  if (!targetEntidadId) {
    areaPrincipalPlaceholder = "Selecciona Primero La Entidad";
  } else if (primaryAreaOptions.length === 0) {
    areaPrincipalPlaceholder = "Sin Áreas Primarias Configuradas";
  }

  let areaSecundariaPlaceholder = "Área Secundaria";
  if (!targetEntidadId) {
    areaSecundariaPlaceholder = "Selecciona Primero La Entidad";
  } else if (secondaryAreaOptions.length === 0) {
    areaSecundariaPlaceholder = "Sin Áreas Secundarias Configuradas";
  }

  const modalTitle = editId ? "Editar Activo" : "Nuevo Activo";
  let submitButtonLabel = "Agregar activo";
  if (isSubmitting) {
    submitButtonLabel = "Guardando...";
  } else if (editId) {
    submitButtonLabel = "Actualizar activo";
  }

  const categoriaActiva = normalizeCategoriaActivo(form.categoria_activo) || "";
  const categoriaProfile = getCategoriaProfile(categoriaActiva);
  const equipoSuggestions = categoriaActiva ? (EQUIPO_OPTIONS_BY_CATEGORY[categoriaActiva] || []) : [];
  const categoriaMenuLabel = categoriaMenu === MENU_ALL_CATEGORY ? "Todos los activos" : categoriaMenu;
  const shouldShowActivosContent = Boolean(categoriaMenu);
  const categoriaMenuFilter =
    categoriaMenu && categoriaMenu !== MENU_ALL_CATEGORY ? normalizeCategoriaActivo(categoriaMenu) : "";
  const modalCategoriaProfile = modalActivo ? getCategoriaProfile(inferCategoriaActivo(modalActivo)) : null;
  const modalExtraFields = modalCategoriaProfile?.extraFields || [];
  const modalCamposEspecificos =
    modalActivo?.campos_especificos && typeof modalActivo.campos_especificos === "object"
      ? modalActivo.campos_especificos
      : {};

  const obtenerNombreEntidad = useCallback(
    (activo) => {
      if (activo.entidad_id == null) return activo.sede || "Sin entidad";
      return entidadPorId[String(activo.entidad_id)]?.nombre || activo.sede || "Sin entidad";
    },
    [entidadPorId]
  );

  const cargarEntidades = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const response = await httpClient.get("/api/entidades");
      const data = response.data.data || response.data || [];
      setEntidades(Array.isArray(data) ? data : []);
    } catch {
      setEntidades([]);
    }
  }, []);

  const cargarActivos = useCallback(async () => {
    if (!isAuthenticated()) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await httpClient.get("/api/activos");
      const data = response.data.data || response.data || [];
      setActivos((Array.isArray(data) ? data : []).map((item) => normalizarActivo(item)));
    } catch {
      setActivos([]);
    } finally {
      setIsLoading(false);
    }
  }, [normalizarActivo]);

  const cargarBajas = useCallback(async () => {
    if (!isAuthenticated()) {
      return;
    }

    try {
      setIsLoadingBajas(true);
      setBajaError("");
      const response = await httpClient.get("/api/activos/bajas");
      const data = response.data.data || response.data || [];
      setBajas(Array.isArray(data) ? data : []);
    } catch (err) {
      setBajaError(err?.response?.data?.message || "No se pudieron cargar las bajas de activos.");
      setBajas([]);
    } finally {
      setIsLoadingBajas(false);
    }
  }, []);

  useEffect(() => {
    cargarActivos();
    cargarEntidades();
    cargarBajas();
  }, [cargarActivos, cargarEntidades, cargarBajas]);

  useEffect(() => {
    if (!showFormModal || editId) return;
    if (!entidadActivaId) return;
    setForm((prev) => {
      if (String(prev.entidad_id || "") === entidadActivaId) return prev;
      return {
        ...prev,
        entidad_id: entidadActivaId,
        areaPrincipal: "",
        areaSecundaria: ""
      };
    });
  }, [showFormModal, editId, entidadActivaId]);

  useEffect(() => {
    setActivosQuickFilter("");
    setActivosFilterEstado("");
    setActivosFilterCategoria("");
    setActivosFilterTipoDisco("");
    setActivosFilterOs("");
    setActivosFilterAreaPrincipal("");
    setShowColumnFilters(false);
    setCategoriaMenu("");
  }, [entidadActivaId]);

  useEffect(() => {
    const fallbackKey = activosDashboardSummary.fueraServicio > 0
      ? "fueraServicio"
      : activosDashboardSummary.mantenimiento > 0
        ? "mantenimiento"
        : activosDashboardSummary.disponibles > 0
          ? "disponibles"
          : "total";

    setDashboardFocusKey((prev) => {
      if (prev === "total") return fallbackKey;
      if ((activosDashboardGroups[prev] || []).length > 0) return prev;
      return fallbackKey;
    });
  }, [activosDashboardGroups, activosDashboardSummary]);

  const formatFecha = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("es-CO");
  };

  const modalInfoRows = modalActivo
    ? [
      { label: "Id", value: obtenerConsecutivoActivo(modalActivo.id) },
      { label: "Activo", value: modalActivo.activo || modalActivo.nombre || "-" },
      { label: "Categoría", value: inferCategoriaActivo(modalActivo) },
      { label: "Entidad", value: obtenerNombreEntidad(modalActivo) },
      { label: "Equipo", value: modalActivo.equipo || "-" },
      { label: "Nombre del equipo", value: modalActivo.nombre || "-" },
      { label: "Serial", value: modalActivo.serial || "-" },
      { label: "Marca", value: modalActivo.marca || "-" },
      { label: "Modelo", value: modalActivo.modelo || "-" },
      { label: "Procesador", value: modalActivo.procesador || "-" },
      { label: "Área principal", value: modalActivo.areaPrincipal || "-" },
      { label: "Área secundaria", value: modalActivo.areaSecundaria || "-" },
      { label: "Tipo RAM", value: modalActivo.tipoRam || "-" },
      { label: "Capacidad RAM", value: modalActivo.ram || "-" },
      { label: "Tipo disco", value: modalActivo.tipoDisco || "-" },
      { label: "Capacidad disco", value: modalActivo.hdd || "-" },
      { label: "Sistema operativo", value: modalActivo.os || "-" },
      { label: "Estado", value: modalActivo.estado || "-" },
      { label: "Fecha de registro", value: formatFecha(modalActivo.created_at) }
    ]
    : [];

  const modalExtraRows = modalExtraFields.map((field) => ({
    key: field.key,
    label: field.label,
    value: modalCamposEspecificos[field.key] || "-"
  }));

  const buildReportRows = (source = []) => {
    const items = Array.isArray(source) ? source : [];
    return items.map((item) => ({
      consecutivo: obtenerConsecutivoActivo(item.id),
      activo: item.activo || "-",
      nombre: item.nombre || "-",
      categoria: inferCategoriaActivo(item),
      entidad: obtenerNombreEntidad(item),
      equipo: item.equipo || "-",
      marca: item.marca || "-",
      modelo: item.modelo || "-",
      serial: item.serial || "-",
      area: item.areaPrincipal || "-",
      areaSecundaria: item.areaSecundaria || "-",
      tipoDisco: item.tipoDisco || "-",
      capacidad: item.hdd || "-",
      estado: item.estado || "-",
      fechaRegistro: formatFecha(item.created_at || item.updated_at || item.fecha_adquisicion)
    }));
  };

  const buildReportFilters = (scopeLabel, includeFilters = true) => {
    const filters = [];
    if (scopeLabel) filters.push(`Alcance: ${scopeLabel}`);
    if (!includeFilters) return filters;
    if (search) filters.push(`Búsqueda: ${search}`);
    if (categoriaMenuFilter) filters.push(`Categoría menú: ${categoriaMenuLabel}`);
    if (activosFilterEstado) filters.push(`Estado: ${activosFilterEstado}`);
    if (activosFilterCategoria) filters.push(`Categoría: ${activosFilterCategoria}`);
    if (activosFilterTipoDisco) filters.push(`Tipo de disco: ${activosFilterTipoDisco}`);
    if (activosFilterOs) filters.push(`Sistema operativo: ${activosFilterOs}`);
    if (activosFilterAreaPrincipal) filters.push(`Área principal: ${activosFilterAreaPrincipal}`);

    Object.entries(columnFilters).forEach(([key, value]) => {
      if (!value) return;
      const label = COLUMN_FILTER_LABELS[key] || key;
      filters.push(`Columna ${label}: ${value}`);
    });

    return filters;
  };

  const getReportLogos = async () => {
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
  };

  const getEntidadNombreReporte = () =>
    selectedEntidadNombre ||
    entidadPorId[entidadActivaId]?.nombre ||
    "Todas las entidades";

  const handleExportExcelReport = async () => {
    const reportSource = exportScopeConfig.source;
    if (reportSource.length === 0) {
      const emptyMessage =
        exportScopeConfig.value === "selected"
          ? "Selecciona al menos un activo para exportar."
          : "No hay activos para exportar.";
      setError(emptyMessage);
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

      const worksheet = workbook.addWorksheet("Activos");
      const rows = buildReportRows(reportSource);
      const filtros = buildReportFilters(
        exportScopeConfig.reportLabel,
        exportScopeConfig.includeFilters
      );
      const filtrosText = filtros.length ? filtros.join(" | ") : "Sin filtros aplicados";
      const entidadNombre = getEntidadNombreReporte();
      const generadoText = `Generado: ${formatFecha(new Date())}`;
      const totalText = `Total registros: ${rows.length}`;

      const lastColumn = REPORT_COLUMNS.length;
      const leftLogoEnd = 2;
      const rightLogoStart = Math.max(lastColumn - 1, leftLogoEnd + 1);
      const centerStart = leftLogoEnd + 1;
      const centerEnd = rightLogoStart - 1;

      worksheet.columns = REPORT_COLUMNS.map((column) => ({
        key: column.key,
        width: EXCEL_COLUMN_WIDTHS[column.key] || 14,
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
      titleCell.value = "Reporte de activos";
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

      REPORT_COLUMNS.forEach((column, index) => {
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
        REPORT_COLUMNS.forEach((column, colIndex) => {
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
      const scopeSuffix =
        exportScopeConfig.value === "selected"
          ? "seleccionados"
          : exportScopeConfig.value === "all"
            ? "todos"
            : "filtrados";
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `reporte-activos-${scopeSuffix}-${stamp}.xlsx`;
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

  const handleExportPdfReport = () => {
    const reportSource = exportScopeConfig.source;
    if (reportSource.length === 0) {
      const emptyMessage =
        exportScopeConfig.value === "selected"
          ? "Selecciona al menos un activo para exportar."
          : "No hay activos para exportar.";
      setError(emptyMessage);
      setSuccess("");
      return;
    }

    setIsExportingPdf(true);
    setError("");
    setSuccess("");

    try {
      const rows = buildReportRows(reportSource);
      const filtros = buildReportFilters(
        exportScopeConfig.reportLabel,
        exportScopeConfig.includeFilters
      );
      const reporteHtml = buildAssetsPdfReportHtml({
        columns: REPORT_COLUMNS,
        rows,
        entidadNombre: getEntidadNombreReporte(),
        generatedAt: new Date(),
        filtros,
        logos: {
          logoM5,
          logoAssetControl
        }
      });
      const printWindow = globalThis.open("", "_blank", "width=1200,height=900");
      if (!printWindow) {
        const stamp = new Date().toISOString().slice(0, 10);
        const blob = new Blob([reporteHtml], { type: "text/html;charset=utf-8" });
        const scopeSuffix =
          exportScopeConfig.value === "selected"
            ? "seleccionados"
            : exportScopeConfig.value === "all"
              ? "todos"
              : "filtrados";
        downloadBlobFile(blob, `reporte-activos-${scopeSuffix}-${stamp}.html`);
        setSuccess(
          "No se pudo abrir ventana emergente. Se descargó el reporte en HTML para imprimir o guardar PDF."
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

  const handleChange = (event) => {
    const { name, value } = event.target;
    const isSelectField = event.target.tagName === "SELECT";
    const properCaseFields = new Set([
      "activo",
      "equipo",
      "marca",
      "procesador"
    ]);
    let nextValue = !isSelectField && properCaseFields.has(name) ? toProperCase(value) : value;

    if (name === "nombre") {
      nextValue = String(value || "").toUpperCase();
    }

    if (name === "serial") {
      nextValue = String(value || "").toUpperCase();
    }

    if (name === "vida_util_anios") {
      nextValue = value.replace(/[^\d]/g, "");
    }

    setForm((prev) => {
      if (name === "categoria_activo") {
        const normalizedCategory = normalizeCategoriaActivo(nextValue);
        const profile = getCategoriaProfile(normalizedCategory);
        return {
          ...prev,
          categoria_activo: normalizedCategory,
          equipo: "",
          campos_especificos: {},
          ...(profile.showsComputeFields ? {} : {
            procesador: "",
            tipoRam: "",
            ram: "",
            tipoDisco: "",
            hdd: "",
            os: ""
          })
        };
      }

      if (name === "entidad_id") {
        return {
          ...prev,
          entidad_id: nextValue,
          areaPrincipal: "",
          areaSecundaria: ""
        };
      }
      return { ...prev, [name]: nextValue };
    });
  };

  const handleExtraFieldChange = (event) => {
    const { name, value } = event.target;
    const key = String(name || "").replace(/^extra__/, "");
    if (!key) return;
    setForm((prev) => ({
      ...prev,
      campos_especificos: {
        ...(prev.campos_especificos || {}),
        [key]: value
      }
    }));
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditId(null);
  };

  const openNewActivoForm = () => {
    if (!canCreate) return;
    const normalizedCategory =
      categoriaMenu && categoriaMenu !== MENU_ALL_CATEGORY
        ? normalizeCategoriaActivo(categoriaMenu)
        : "";
    const categoriaProfileNext = normalizedCategory ? getCategoriaProfile(normalizedCategory) : null;
    setEditId(null);
    setForm({
      ...INITIAL_FORM,
      categoria_activo: normalizedCategory,
      campos_especificos: {},
      ...(categoriaProfileNext && !categoriaProfileNext.showsComputeFields
        ? {
          procesador: "",
          tipoRam: "",
          ram: "",
          tipoDisco: "",
          hdd: "",
          os: ""
        }
        : {})
    });
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    if (isSubmitting) return;
    setShowFormModal(false);
    resetForm();
  };

  const closeDetailModal = useCallback(() => {
    setShowEmailModal(false);
    setShowDetailModal(false);
    setModalActivo(null);
    setHistorialMantenimientos([]);
  }, []);

  const handleKeyboardAction = useCallback((event, action) => {
    if (event.target !== event.currentTarget) return;
    if (!isKeyboardActivation(event)) return;
    event.preventDefault();
    action();
  }, []);

  const validateForm = () => {
    const profile = getCategoriaProfile(form.categoria_activo);
    const required = profile.requiredFields;
    const labels = {
      categoria_activo: "categoría",
      entidad_id: "entidad",
      areaPrincipal: "área principal",
      equipo: "tipo de equipo",
      marca: "marca",
      modelo: "modelo",
      serial: "serial"
    };
    for (const field of required) {
      if (!form[field]) {
        setError(`El campo ${labels[field] || field} es requerido`);
        return false;
      }
    }

    const extraRequired = (profile.extraFields || []).filter((field) => field.required);
    for (const field of extraRequired) {
      const value = String(form.campos_especificos?.[field.key] || "").trim();
      if (!value) {
        setError(`El campo ${field.label || field.key} es requerido`);
        return false;
      }
    }

    if (!String(form.activo || "").trim() && !String(form.nombre || "").trim()) {
      setError("Debes registrar al menos el código del activo o el nombre del equipo");
      return false;
    }

    const normalizedPrimary = normalizeSearchValue(form.areaPrincipal || "");
    const primaryMatches = primaryAreaOptions.some(
      (item) => normalizeSearchValue(item) === normalizedPrimary
    );
    if (!primaryMatches) {
      setError("El área principal debe estar configurada por la entidad seleccionada");
      return false;
    }

    const normalizedSecondary = normalizeSearchValue(form.areaSecundaria || "");
    const secondaryMatches = secondaryAreaOptions.some(
      (item) => normalizeSearchValue(item) === normalizedSecondary
    );
    if (form.areaSecundaria && !secondaryMatches) {
      setError("El área secundaria debe estar configurada por la entidad seleccionada");
      return false;
    }

    const normalizedActivo = String(form.activo || "").trim().toLowerCase();
    const duplicated = normalizedActivo && activos.some((item) => {
      if (Number(item.id) === Number(editId)) return false;
      return String(item.activo || "").toLowerCase() === normalizedActivo;
    });

    if (duplicated) {
      setError(`El activo ${form.activo} ya existe`);
      return false;
    }

    return true;
  };

  const persistActivo = async () => {
    const entidad = entidadPorId[String(form.entidad_id)];
    const categoriaActivaPayload = normalizeCategoriaActivo(form.categoria_activo) || inferCategoriaActivo(form);
    const categoriaProfilePayload = getCategoriaProfile(categoriaActivaPayload);
    const camposEspecificosPayload = (categoriaProfilePayload.extraFields || []).reduce((acc, field) => {
      const rawValue = form.campos_especificos?.[field.key];
      const value = rawValue === null || rawValue === undefined ? "" : String(rawValue).trim();
      if (value) {
        acc[field.key] = value;
      }
      return acc;
    }, {});
    const payload = {
      entidad_id: form.entidad_id ? Number(form.entidad_id) : null,
      sede: entidad.nombre || "",
      categoria_activo: categoriaActivaPayload,
      activo: String(form.activo || "").trim(),
      serial: String(form.serial || "").trim().toUpperCase(),
      nombre: String(form.nombre || "").trim().toUpperCase(),
      areaPrincipal: String(form.areaPrincipal || "").trim(),
      areaSecundaria: String(form.areaSecundaria || "").trim(),
      equipo: String(form.equipo || "").trim(),
      marca: String(form.marca || "").trim(),
      modelo: String(form.modelo || "").trim(),
      procesador: categoriaProfilePayload.showsComputeFields ? String(form.procesador || "").trim() : "",
      tipoRam: categoriaProfilePayload.showsComputeFields ? String(form.tipoRam || "").trim() : "",
      ram: categoriaProfilePayload.showsComputeFields ? String(form.ram || "").trim() : "",
      tipoDisco: categoriaProfilePayload.showsComputeFields ? String(form.tipoDisco || "").trim() : "",
      hdd: categoriaProfilePayload.showsComputeFields ? String(form.hdd || "").trim() : "",
      os: categoriaProfilePayload.showsComputeFields ? String(form.os || "").trim() : "",
      estado: String(form.estado || "Disponible").trim(),
      ciclo_vida_etapa: form.ciclo_vida_etapa || null,
      fecha_adquisicion: form.fecha_adquisicion || null,
      vida_util_anios: form.vida_util_anios ? Number(form.vida_util_anios) : null,
      campos_especificos: camposEspecificosPayload
    };

    if (editId) {
      const response = await httpClient.put(`/api/activos/${editId}`, payload);
      setSuccess(response.data.message || "Activo actualizado");
    } else {
      await httpClient.post("/api/activos", payload);
      setSuccess("Activo creado correctamente");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) return;
    if (!editId && !canCreate) return setError("No tienes permiso para crear activos");
    if (editId && !canEdit) return setError("No tienes permiso para editar activos");

    setIsSubmitting(true);
    try {
      await persistActivo();
      await cargarActivos();
      await cargarEntidades();
      setShowFormModal(false);
      resetForm();
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || "Error al guardar activo";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getImportValueByAliases = useCallback((normalizedRow, aliases = []) => {
    for (const alias of aliases) {
      const value = normalizedRow[alias];
      if (value === null || value === undefined) continue;
      const text = toText(value);
      if (text) return text;
    }
    return "";
  }, []);

  const normalizeCatalogValue = useCallback((value = "", options = [], synonyms = {}) => {
    const raw = toText(value);
    if (!raw) return "";

    const normalizedRaw = normalizeImportKey(raw);
    const byCatalog = options.find((item) => normalizeImportKey(item) === normalizedRaw);
    if (byCatalog) return byCatalog;

    const bySynonym = synonyms[normalizedRaw];
    if (bySynonym) return bySynonym;

    return toProperCase(raw);
  }, []);

  const normalizeProperCaseValue = useCallback((value = "") => {
    const raw = toText(value);
    return raw ? toProperCase(raw) : "";
  }, []);

  const normalizeUppercaseValue = useCallback((value = "") => {
    const raw = toText(value);
    return raw ? raw.toUpperCase() : "";
  }, []);

  const normalizeDateValue = useCallback((value = "") => {
    const raw = toText(value);
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const normalizeAreaByCatalog = useCallback((value = "", options = []) => {
    const raw = toText(value);
    if (!raw) return "";
    const normalizedRaw = normalizeImportKey(raw);
    const byCatalog = (Array.isArray(options) ? options : []).find(
      (item) => normalizeImportKey(item) === normalizedRaw
    );
    return byCatalog || toProperCase(raw);
  }, []);

  const normalizeImportRow = useCallback((row = {}, defaultEntidadId = null) => {
    const normalizedRow = Object.entries(row || {}).reduce((acc, [key, value]) => {
      const normalizedKey = normalizeImportKey(key);
      if (normalizedKey) {
        acc[normalizedKey] = value;
      }
      return acc;
    }, {});

    const entidadRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.entidad_id);
    const entidadById = toPositiveInteger(entidadRaw);
    const entidadByName = resolveEntidadIdFromName(entidadRaw);
    const entidadId = entidadById || entidadByName || toPositiveInteger(defaultEntidadId);
    const entidadSeleccionada = entidadPorId[String(entidadId || "")] || null;
    const sede = toText(entidadSeleccionada.nombre || entidadRaw);
    const numeroReporteRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.numeroReporte);
    const activoRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.activo);
    const categoriaRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.categoria_activo);
    const nombreRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.nombre);
    const areaPrincipalRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.areaPrincipal);
    const areaSecundariaRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.areaSecundaria);
    const tipoRamRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.tipoRam);
    const ramRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.ram);
    const tipoGenericoRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.tipoGenerico);
    const tipoDiscoRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.tipoDisco);
    const hddRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.hdd);
    const osRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.os);
    const estadoRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.estado);
    const cicloVidaRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.ciclo_vida_etapa);
    const fechaAdquisicionRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.fecha_adquisicion);
    const marcaRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.marca);
    const modeloRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.modelo);
    const equipoRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.equipo);
    const procesadorRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.procesador);
    const serialRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.serial);
    const vidaUtilRaw = getImportValueByAliases(normalizedRow, IMPORT_FIELD_ALIASES.vida_util_anios);
    const vidaUtil = toPositiveInteger(String(vidaUtilRaw).replace(/[^\d]/g, ""));
    const areaPrincipalCatalog = Array.isArray(entidadSeleccionada.areas_primarias) ? entidadSeleccionada.areas_primarias : [];
    const areaSecundariaCatalog = Array.isArray(entidadSeleccionada.areas_secundarias) ? entidadSeleccionada.areas_secundarias : [];
    const inferTipoRam = (value = "") => {
      const normalized = normalizeImportKey(value);
      if (!normalized) return "";
      const byCatalog = OPTIONS.tipoRam.find((item) => normalizeImportKey(item) === normalized);
      return byCatalog || RAM_TYPE_SYNONYMS[normalized] || "";
    };
    const inferTipoDisco = (value = "") => {
      const normalized = normalizeImportKey(value);
      if (!normalized) return "";
      const byCatalog = OPTIONS.tipoDisco.find((item) => normalizeImportKey(item) === normalized);
      return byCatalog || DISK_TYPE_SYNONYMS[normalized] || "";
    };
    const tipoRamResolved = tipoRamRaw || inferTipoRam(tipoGenericoRaw);
    const tipoDiscoResolved = tipoDiscoRaw || inferTipoDisco(tipoGenericoRaw);
    const activo = normalizeProperCaseValue(activoRaw || numeroReporteRaw);
    const equipoToken = normalizeImportKey(equipoRaw);
    const puedeConservarNombre = EQUIPO_TIPO_CAN_KEEP_NAME.some((tipo) => equipoToken.includes(tipo));
    const nombreBase = puedeConservarNombre
      ? (nombreRaw || activoRaw || numeroReporteRaw)
      : (equipoRaw || nombreRaw || activoRaw || numeroReporteRaw);
    const nombre = normalizeUppercaseValue(nombreBase);
    const serial = normalizeUppercaseValue(serialRaw);
    const categoria_activo =
      normalizeCategoriaActivo(categoriaRaw) ||
      inferCategoriaActivo({
        equipo: equipoRaw,
        nombre,
        activo,
        marca: marcaRaw,
        modelo: modeloRaw,
        procesador: procesadorRaw,
        tipoRam: tipoRamResolved,
        ram: ramRaw,
        tipoDisco: tipoDiscoResolved,
        hdd: hddRaw,
        os: osRaw
      });

    return {
      entidad_id: entidadId,
      sede,
      categoria_activo,
      activo,
      serial,
      nombre,
      areaPrincipal: normalizeAreaByCatalog(areaPrincipalRaw, areaPrincipalCatalog),
      areaSecundaria: normalizeAreaByCatalog(areaSecundariaRaw, areaSecundariaCatalog),
      equipo: normalizeProperCaseValue(equipoRaw),
      marca: normalizeProperCaseValue(marcaRaw),
      modelo: toText(modeloRaw),
      procesador: normalizeProperCaseValue(procesadorRaw),
      tipoRam: normalizeCatalogValue(tipoRamResolved, OPTIONS.tipoRam, RAM_TYPE_SYNONYMS),
      ram: normalizeCatalogValue(ramRaw, OPTIONS.ram, RAM_CAPACITY_SYNONYMS),
      tipoDisco: normalizeCatalogValue(tipoDiscoResolved, OPTIONS.tipoDisco, DISK_TYPE_SYNONYMS),
      hdd: normalizeCatalogValue(hddRaw, OPTIONS.hdd, DISK_CAPACITY_SYNONYMS),
      os: normalizeCatalogValue(osRaw, OPTIONS.os, OS_SYNONYMS),
      estado: normalizeCatalogValue(estadoRaw, OPTIONS.estado) || "Disponible",
      ciclo_vida_etapa: normalizeCatalogValue(cicloVidaRaw, OPTIONS.cicloVida),
      fecha_adquisicion: normalizeDateValue(fechaAdquisicionRaw),
      vida_util_anios: vidaUtil || null
    };
  }, [
    entidadPorId,
    getImportValueByAliases,
    normalizeAreaByCatalog,
    normalizeCatalogValue,
    normalizeDateValue,
    normalizeProperCaseValue,
    normalizeUppercaseValue,
    resolveEntidadIdFromName
  ]);

  const openImportDialog = () => {
    if (!canCreate) {
      setError("No tienes permiso para importar activos");
      return;
    }
    importInputRef.current.click();
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const extension = String(file.name || "")
      .toLowerCase()
      .split(".")
      .pop();
    if (!["xlsm", "xlsx", "xls", "csv"].includes(extension || "")) {
      setError("Formato no soportado. Usa XLSM, XLSX, XLS o CSV.");
      return;
    }

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
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: false });
      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        setError("El archivo no tiene filas de datos.");
        return;
      }

      const defaultEntidadFromContext = toPositiveInteger(entidadActivaId || form.entidad_id || "");
      const defaultEntidadFromCatalog =
        entidadesOrdenadas.length === 1 ? toPositiveInteger(entidadesOrdenadas[0].id) : null;
      const defaultEntidadId = defaultEntidadFromContext || defaultEntidadFromCatalog;
      const hasEntidadColumn = rawRows.some((row) =>
        Object.keys(row || {}).some((key) =>
          IMPORT_FIELD_ALIASES.entidad_id.includes(normalizeImportKey(key))
        )
      );

      if (!defaultEntidadId && !hasEntidadColumn) {
        setError("No se detecto entidad en el archivo. Selecciona una entidad antes de importar o agrega la columna Entidad/Entidad Id.");
        return;
      }

      const activosImport = rawRows.map((row) => normalizeImportRow(row, defaultEntidadId));
      const response = await httpClient.post("/api/activos/import", {
        activos: activosImport,
        defaultEntidadId
      });

      const data = response.data.data || {};
      const total = Number(data.total || activosImport.length);
      const creados = Number(data.creados || 0);
      const errores = Array.isArray(data.errores) ? data.errores : [];
      const omitidosDuplicados = Number(data.omitidos_duplicados || 0);

      await cargarActivos();
      await cargarEntidades();

      if (errores.length > 0) {
        const resumenErrores = errores
          .slice(0, 5)
          .map((item) => `Fila ${item.fila}: ${item.mensaje}`)
          .join(" | ");
        const detalleDuplicados = omitidosDuplicados > 0 ? ` Duplicados omitidos: ${omitidosDuplicados}.` : "";
        setError(`Importación parcial. Creados ${creados}/${total}.${detalleDuplicados} Errores: ${errores.length}. ${resumenErrores}`);
        if (omitidosDuplicados > 0) {
          setSuccess(`Se omitieron ${omitidosDuplicados} filas duplicadas automaticamente.`);
        }
      } else {
        const detalleDuplicados = omitidosDuplicados > 0 ? ` Se omitieron ${omitidosDuplicados} duplicados.` : "";
        setSuccess(`Importacion completada. Creados ${creados} activos.${detalleDuplicados}`);
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || "Error al importar archivo";
      setError(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleEdit = (activo, event) => {
    event?.stopPropagation?.();
    if (!canEdit) return setError("No tienes permiso para editar activos");

    const item = normalizarActivo(activo);
    const entidadBySede = entidadesOrdenadas.find((e) => e.nombre === item.sede);
    const entidadId = String(item.entidad_id ?? entidadBySede?.id ?? "");
    setEditId(item.id);
    setForm({
      ...INITIAL_FORM,
      ...item,
      entidad_id: entidadId,
      vida_util_anios: item.vida_util_anios ? String(item.vida_util_anios) : ""
    });
    setShowFormModal(true);
  };

  const handleDelete = async (activoId, event, options = {}) => {
    event?.stopPropagation?.();
    if (!canDelete) return setError("No tienes permiso para eliminar activos");
    const shouldConfirm = options.confirm !== false;
    const isConfirmed = shouldConfirm ? globalThis.confirm("¿Estás seguro de eliminar este activo") : true;
    if (!isConfirmed) return;

    const isDeletingDetailActivo =
      showDetailModal && modalActivo && Number(modalActivo.id) === Number(activoId);

    setError("");
    setSuccess("");
    try {
      const response = await httpClient.delete(`/api/activos/${activoId}`);
      setSuccess(response.data.message || "Activo eliminado");
      setSelectedActivosIds((prev) => prev.filter((id) => Number(id) !== Number(activoId)));
      if (isDeletingDetailActivo) closeDetailModal();
      await cargarActivos();
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || "Error al eliminar activo";
      setError(message);
    }
  };

  const cargarHistorialActivo = async (activoId) => {
    if (!activoId) return setHistorialMantenimientos([]);
    setIsLoadingHistorial(true);
    try {
      const response = await httpClient.get("/api/mantenimientos");
      const data = response.data.data || response.data || [];
      const historial = (Array.isArray(data) ? data : [])
        .filter((mantenimiento) => Number(mantenimiento.activo_id) === Number(activoId))
        .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
      setHistorialMantenimientos(historial);
    } catch {
      setHistorialMantenimientos([]);
    } finally {
      setIsLoadingHistorial(false);
    }
  };

  const abrirDetalleActivo = async (activo) => {
    const item = normalizarActivo(activo);
    setError("");
    setSuccess("");
    setModalActivo(item);
    setShowDetailModal(true);
    await cargarHistorialActivo(item.id);
  };

  const handleActivoRowKeyDown = (event, activo) => {
    handleKeyboardAction(event, () => {
      abrirDetalleActivo(activo);
    });
  };

  const abrirModalCorreo = () => {
    if (!modalActivo || isSendingEmail) return;

    const draft = buildAssetEmailDraft(modalActivo, historialMantenimientos);
    const firmaDefault = [
      "Cordialmente,",
      currentUser.nombre || "Usuario AssetControl",
      "AssetControl | Microcinco S.A.S"
    ].join("\n");

    setEmailForm({
      to: "",
      subject: draft.subject,
      message: draft.body,
      signature: firmaDefault
    });
    setShowEmailModal(true);
  };

  const cerrarModalCorreo = () => {
    if (isSendingEmail) return;
    setShowEmailModal(false);
  };

  const handleEmailChange = (event) => {
    const { name, value } = event.target;
    setEmailForm((prev) => ({ ...prev, [name]: value }));
  };

  const enviarActivoPorCorreo = async () => {
    if (!modalActivo || isSendingEmail) return;
    const to = String(emailForm.to || "").trim();
    const subject = String(emailForm.subject || "").trim();
    const message = String(emailForm.message || "").trim();
    const signature = String(emailForm.signature || "").trim();

    if (!EMAIL_REGEX.test(to)) {
      setError("Correo destino inválido");
      return;
    }
    if (!subject) {
      setError("El asunto es obligatorio");
      return;
    }

    setIsSendingEmail(true);
    setError("");

    try {
      const documentHtml = buildAssetLifeSheetHtml({
        asset: modalActivo,
        historial: historialMantenimientos,
        entidadNombre: obtenerNombreEntidad(modalActivo),
        logos: {
          logoM5,
          logoAssetControl
        }
      });

      const fallbackDraft = buildAssetEmailDraft(modalActivo, historialMantenimientos);
      const introText = [
        message,
        "Se comparte la hoja de vida completa del activo en formato documento HTML."
      ]
        .filter(Boolean)
        .join("\n\n");
      const finalText = [
        message || "Se comparte la hoja de vida completa del activo.",
        "",
        fallbackDraft.body,
        signature ? `\n${signature}` : ""
      ]
        .filter(Boolean)
        .join("\n");

      const activoDocLabelBase = modalActivo.activo || modalActivo.nombre;
      const activoDocConsecutivo = obtenerConsecutivoActivo(modalActivo.id);
      const activoDocFallback =
        isAdmin && modalActivo.id
          ? `#${modalActivo.id}`
          : activoDocConsecutivo && activoDocConsecutivo !== "-"
            ? String(activoDocConsecutivo)
            : "";
      const activoDocLabel = activoDocLabelBase || activoDocFallback;

      const html = buildDocumentEmailHtml({
        title: subject,
        introText,
        documentHtml,
        documentLabel: activoDocLabel
          ? `Hoja de vida del activo ${activoDocLabel}`
          : "Hoja de vida del activo",
        signatureText: signature,
        logos: {
          logoM5,
          logoAssetControl
        },
        senderName: currentUser.nombre || ""
      });

      const result = await sendEmailNotification({ to, subject, text: finalText, html });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(`Correo enviado a ${to}`);
      setShowEmailModal(false);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const buildSearchIndex = useCallback((item = {}) => {
    const entidadNombre = obtenerNombreEntidad(item);
    const camposEspecificos =
      item.campos_especificos && typeof item.campos_especificos === "object"
        ? Object.values(item.campos_especificos)
        : [];
    return normalizeSearchValue([
      item.id,
      item.activo,
      inferCategoriaActivo(item),
      entidadNombre,
      item.nombre,
      item.equipo,
      item.serial,
      item.marca,
      item.modelo,
      item.procesador,
      item.areaPrincipal,
      item.areaSecundaria,
      item.tipoRam,
      item.ram,
      item.tipoDisco,
      item.hdd,
      item.os,
      item.estado,
      ...camposEspecificos
    ].filter(Boolean).join(" "));
  }, [obtenerNombreEntidad]);

  const updateColumnFilter = useCallback((key, value) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const normalizedColumnFilters = useMemo(() => {
    return {
      id: normalizeSearchValue(columnFilters.id),
      activo: normalizeSearchValue(columnFilters.activo),
      categoria: normalizeSearchValue(columnFilters.categoria),
      entidad: normalizeSearchValue(columnFilters.entidad),
      equipo: normalizeSearchValue(columnFilters.equipo),
      marca: normalizeSearchValue(columnFilters.marca),
      modelo: normalizeSearchValue(columnFilters.modelo),
      serial: normalizeSearchValue(columnFilters.serial),
      areaPrincipal: normalizeSearchValue(columnFilters.areaPrincipal),
      areaSecundaria: normalizeSearchValue(columnFilters.areaSecundaria),
      tipoDisco: normalizeSearchValue(columnFilters.tipoDisco),
      hdd: normalizeSearchValue(columnFilters.hdd),
      estado: normalizeSearchValue(columnFilters.estado)
    };
  }, [columnFilters]);


  const applyActivosQuickFilter = useCallback((value = "", options = {}) => {
    const { resetSearch = false, resetColumnFilters = false } = options;
    const { type, value: filterValue } = parseQuickFilterValue(value);

    setActivosQuickFilter(value);
    setActivosFilterEstado("");
    setActivosFilterCategoria("");
    setActivosFilterTipoDisco("");
    setActivosFilterOs("");
    setActivosFilterAreaPrincipal("");

    if (resetSearch) {
      setSearch("");
    }
    if (resetColumnFilters) {
      setColumnFilters(INITIAL_COLUMN_FILTERS);
    }

    if (type === "estado") {
      setActivosFilterEstado(filterValue);
      return;
    }
    if (type === "categoria") {
      setActivosFilterCategoria(filterValue);
      const normalizedCategory = normalizeCategoriaActivo(filterValue);
      if (normalizedCategory) {
        setCategoriaMenu(normalizedCategory);
      }
      return;
    }
    if (type === "disco") {
      setActivosFilterTipoDisco(filterValue);
      return;
    }
    if (type === "os") {
      setActivosFilterOs(filterValue);
      return;
    }
    if (type === "area") {
      setActivosFilterAreaPrincipal(filterValue);
    }
  }, []);

  const handleDashboardQuickFilter = useCallback((focusKey, quickFilterValue = "") => {
    setDashboardFocusKey(focusKey);
    applyActivosQuickFilter(quickFilterValue, {
      resetSearch: true,
      resetColumnFilters: true
    });
  }, [applyActivosQuickFilter]);

  const filteredActivos = useMemo(() => {
    const term = normalizeSearchValue(deferredSearch);
    const source = term
      ? activosFiltradosPorEntidad.filter((item) => buildSearchIndex(item).includes(term))
      : [...activosFiltradosPorEntidad];
    const filteredByControls = source.filter((item) => {
      if (categoriaMenuFilter && inferCategoriaActivo(item) !== categoriaMenuFilter) {
        return false;
      }
      if (
        activosFilterEstado &&
        normalizeStatusToken(item.estado) !== normalizeStatusToken(activosFilterEstado)
      ) {
        return false;
      }

      if (
        !categoriaMenuFilter &&
        activosFilterCategoria &&
        normalizeSearchValue(inferCategoriaActivo(item)) !== normalizeSearchValue(activosFilterCategoria)
      ) {
        return false;
      }

      if (
        activosFilterTipoDisco &&
        normalizeSearchValue(item.tipoDisco) !== normalizeSearchValue(activosFilterTipoDisco)
      ) {
        return false;
      }

      if (
        activosFilterOs &&
        normalizeSearchValue(item.os) !== normalizeSearchValue(activosFilterOs)
      ) {
        return false;
      }

      if (
        activosFilterAreaPrincipal &&
        normalizeSearchValue(item.areaPrincipal) !== normalizeSearchValue(activosFilterAreaPrincipal)
      ) {
        return false;
      }

      if (normalizedColumnFilters.id) {
        const consecutivo = obtenerConsecutivoActivo(item.id);
        const matchesId =
          normalizeSearchValue(item.id).includes(normalizedColumnFilters.id) ||
          normalizeSearchValue(consecutivo).includes(normalizedColumnFilters.id);
        if (!matchesId) return false;
      }

      if (
        normalizedColumnFilters.activo &&
        !normalizeSearchValue(item.activo).includes(normalizedColumnFilters.activo)
      ) {
        return false;
      }

      if (
        normalizedColumnFilters.categoria &&
        !normalizeSearchValue(inferCategoriaActivo(item)).includes(normalizedColumnFilters.categoria)
      ) {
        return false;
      }

      if (
        normalizedColumnFilters.entidad &&
        !normalizeSearchValue(obtenerNombreEntidad(item)).includes(normalizedColumnFilters.entidad)
      ) {
        return false;
      }

      if (
        normalizedColumnFilters.equipo &&
        !normalizeSearchValue(item.equipo).includes(normalizedColumnFilters.equipo)
      ) {
        return false;
      }

      if (
        normalizedColumnFilters.marca &&
        !normalizeSearchValue(item.marca).includes(normalizedColumnFilters.marca)
      ) {
        return false;
      }

      if (
        normalizedColumnFilters.modelo &&
        !normalizeSearchValue(item.modelo).includes(normalizedColumnFilters.modelo)
      ) {
        return false;
      }

      if (
        normalizedColumnFilters.serial &&
        !normalizeSearchValue(item.serial).includes(normalizedColumnFilters.serial)
      ) {
        return false;
      }

      if (
        normalizedColumnFilters.areaPrincipal &&
        !normalizeSearchValue(item.areaPrincipal).includes(normalizedColumnFilters.areaPrincipal)
      ) {
        return false;
      }

      if (
        normalizedColumnFilters.areaSecundaria &&
        !normalizeSearchValue(item.areaSecundaria).includes(normalizedColumnFilters.areaSecundaria)
      ) {
        return false;
      }

      if (
        normalizedColumnFilters.tipoDisco &&
        !normalizeSearchValue(item.tipoDisco).includes(normalizedColumnFilters.tipoDisco)
      ) {
        return false;
      }

      if (
        normalizedColumnFilters.hdd &&
        !normalizeSearchValue(item.hdd).includes(normalizedColumnFilters.hdd)
      ) {
        return false;
      }

      if (
        normalizedColumnFilters.estado &&
        !normalizeSearchValue(item.estado).includes(normalizedColumnFilters.estado)
      ) {
        return false;
      }

      return true;
    });

    return filteredByControls.sort((a, b) => {
      const timestampA =
        toTimestamp(a.created_at) ??
        toTimestamp(a.updated_at) ??
        toTimestamp(a.fecha_adquisicion);
      const timestampB =
        toTimestamp(b.created_at) ??
        toTimestamp(b.updated_at) ??
        toTimestamp(b.fecha_adquisicion);

      if (timestampA !== null || timestampB !== null) {
        return (timestampB ?? -Infinity) - (timestampA ?? -Infinity);
      }
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [
    activosFiltradosPorEntidad,
    deferredSearch,
    buildSearchIndex,
    activosFilterEstado,
    activosFilterCategoria,
    activosFilterTipoDisco,
    activosFilterOs,
    activosFilterAreaPrincipal,
    categoriaMenuFilter,
    normalizedColumnFilters,
    obtenerConsecutivoActivo,
    obtenerNombreEntidad
  ]);

  const bajasByActivo = useMemo(() => {
    const map = new Map();
    (Array.isArray(bajas) ? bajas : []).forEach((baja) => {
      const activoId = Number(baja.activo_id);
      if (!Number.isFinite(activoId)) return;
      const prev = map.get(activoId);
      if (!prev) {
        map.set(activoId, baja);
        return;
      }
      const prevDate = new Date(prev.creado_en || prev.actualizado_en || 0).getTime();
      const nextDate = new Date(baja.creado_en || baja.actualizado_en || 0).getTime();
      if (nextDate >= prevDate) {
        map.set(activoId, baja);
      }
    });
    return map;
  }, [bajas]);

  const clearActivosFilters = () => {
    setSearch("");
    setActivosQuickFilter("");
    setActivosFilterEstado("");
    setActivosFilterCategoria("");
    setActivosFilterTipoDisco("");
    setActivosFilterOs("");
    setActivosFilterAreaPrincipal("");
    setColumnFilters(INITIAL_COLUMN_FILTERS);
    setShowColumnFilters(false);
  };

  const handleCategoriaMenuSelect = (value) => {
    if (!value) return;
    clearActivosFilters();
    if (value === MENU_ALL_CATEGORY) {
      setCategoriaMenu(MENU_ALL_CATEGORY);
      setDashboardFocusKey("total");
      return;
    }
    const normalized = normalizeCategoriaActivo(value);
    if (!normalized) return;
    setCategoriaMenu(normalized);
    setDashboardFocusKey(CATEGORY_SUMMARY_KEYS[normalized] || "total");
  };

  const resetCategoriaMenu = () => {
    setCategoriaMenu("");
    clearActivosFilters();
  };

  const openBajaModal = (activo) => {
    if (!activo) return;
    setBajaForm({ activo, motivo: "", adjuntos: [] });
    setBajaError("");
    setShowBajaModal(true);
  };

  const closeBajaModal = () => {
    setShowBajaModal(false);
    setBajaError("");
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });

  const buildBajaAdjunto = async (file) => {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl
    };
  };

  const normalizeBajaAdjuntos = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const filterBajaAdjuntos = (files = []) => {
    const accepted = [];
    const rejects = [];

    Array.from(files).forEach((file) => {
      if (!ALLOWED_BAJA_TYPES.includes(file.type)) {
        rejects.push(`Tipo no permitido: ${file.name}`);
        return;
      }
      if (file.size > MAX_BAJA_BYTES) {
        rejects.push(`Archivo muy grande: ${file.name}`);
        return;
      }
      accepted.push(file);
    });

    return { accepted, rejects };
  };

  const handleBajaAdjuntosChange = async (event) => {
    const files = event.target.files || [];
    if (!files.length) return;

    const { accepted, rejects } = filterBajaAdjuntos(files);
    if (rejects.length) {
      setBajaError(rejects.join(". "));
    }

    const current = bajaForm.adjuntos || [];
    const availableSlots = Math.max(0, MAX_BAJA_ADJUNTOS - current.length);
    const toProcess = accepted.slice(0, availableSlots);
    if (!toProcess.length) return;

    const payloads = await Promise.all(toProcess.map(buildBajaAdjunto));
    setBajaForm((prev) => ({
      ...prev,
      adjuntos: [...current, ...payloads]
    }));
    event.target.value = "";
  };

  const removeBajaAdjunto = (index) => {
    setBajaForm((prev) => ({
      ...prev,
      adjuntos: (prev.adjuntos || []).filter((_, idx) => idx !== index)
    }));
  };

  const handleSubmitBaja = async () => {
    if (!bajaForm.activo) return;
    if (!bajaForm.motivo.trim()) {
      setBajaError("Debes describir el motivo de la baja.");
      return;
    }

    try {
      setIsSubmittingBaja(true);
      setBajaError("");
      await httpClient.post("/api/activos/bajas", {
        activo_id: bajaForm.activo.id,
        motivo: bajaForm.motivo,
        evidencia: bajaForm.adjuntos
      });
      setShowBajaModal(false);
      await cargarActivos();
      await cargarBajas();
    } catch (err) {
      setBajaError(err?.response?.data?.message || "No se pudo enviar la solicitud de baja.");
    } finally {
      setIsSubmittingBaja(false);
    }
  };

  const handleApproveBaja = async (baja) => {
    if (!baja?.id) return;
    try {
      await httpClient.patch(`/api/activos/bajas/${baja.id}/aprobar`, {});
      await cargarActivos();
      await cargarBajas();
    } catch (err) {
      setBajaError(err?.response?.data?.message || "No se pudo aprobar la baja.");
    }
  };

  const handleRejectBaja = async (baja) => {
    if (!baja?.id) return;
    const comentario = globalThis.prompt("Motivo del rechazo (opcional):") || "";
    try {
      await httpClient.patch(`/api/activos/bajas/${baja.id}/rechazar`, {
        respuesta_admin: comentario
      });
      await cargarBajas();
    } catch (err) {
      setBajaError(err?.response?.data?.message || "No se pudo rechazar la baja.");
    }
  };

  const filteredActivosIds = useMemo(
    () =>
      filteredActivos
        .map((item) => Number(item.id))
        .filter((id) => Number.isInteger(id) && id > 0),
    [filteredActivos]
  );

  const selectedActivosSet = useMemo(
    () => new Set(selectedActivosIds.map(Number)),
    [selectedActivosIds]
  );

  const selectedActivos = useMemo(() => {
    if (selectedActivosSet.size === 0) return [];
    const source = Array.isArray(activosFiltradosPorEntidad) ? activosFiltradosPorEntidad : [];
    return source.filter((item) => selectedActivosSet.has(Number(item.id)));
  }, [activosFiltradosPorEntidad, selectedActivosSet]);

  const exportScopeConfig = useMemo(() => {
    const option =
      EXPORT_SCOPE_OPTIONS.find((item) => item.value === exportScope) || EXPORT_SCOPE_OPTIONS[0];

    let source = filteredActivos;
    if (option.value === "all") {
      source = activosFiltradosPorEntidad;
    } else if (option.value === "selected") {
      source = selectedActivos;
    }

    return {
      ...option,
      source: Array.isArray(source) ? source : []
    };
  }, [exportScope, filteredActivos, activosFiltradosPorEntidad, selectedActivos]);

  const exportScopeCounts = useMemo(() => {
    return {
      filtered: filteredActivos.length,
      selected: selectedActivos.length,
      all: Array.isArray(activosFiltradosPorEntidad) ? activosFiltradosPorEntidad.length : 0
    };
  }, [filteredActivos, selectedActivos, activosFiltradosPorEntidad]);

  const exportFilters = useMemo(() => (
    buildReportFilters(exportScopeConfig.reportLabel, exportScopeConfig.includeFilters)
  ), [
    buildReportFilters,
    exportScopeConfig,
    search,
    categoriaMenuFilter,
    activosFilterEstado,
    activosFilterCategoria,
    activosFilterTipoDisco,
    activosFilterOs,
    activosFilterAreaPrincipal,
    columnFilters
  ]);

  const exportFiltersTitle = exportFilters.length
    ? exportFilters.join(" | ")
    : "Sin filtros aplicados";
  const exportFiltersSummary = exportFilters.length > 4
    ? `${exportFilters.slice(0, 4).join(" | ")} | +${exportFilters.length - 4}`
    : exportFiltersTitle;



  const allVisibleSelected =
    filteredActivosIds.length > 0 && filteredActivosIds.every((id) => selectedActivosSet.has(id));

  const toggleActivoSelection = (activoId, event) => {
    event?.stopPropagation?.();
    if (!canSelectRows) return;
    const normalizedId = Number(activoId);
    if (!Number.isInteger(normalizedId) || normalizedId <= 0) return;
    setSelectedActivosIds((prev) => {
      const exists = prev.some((id) => Number(id) === normalizedId);
      if (exists) {
        return prev.filter((id) => Number(id) !== normalizedId);
      }
      return [...prev, normalizedId];
    });
  };

  const toggleSelectAllVisible = () => {
    if (!canSelectRows) return;
    setSelectedActivosIds((prev) => {
      const prevSet = new Set(prev.map(Number));
      const shouldSelectAll = filteredActivosIds.some((id) => !prevSet.has(id));

      if (shouldSelectAll) {
        filteredActivosIds.forEach((id) => prevSet.add(id));
        return Array.from(prevSet);
      }

      return prev.filter((id) => !filteredActivosIds.includes(Number(id)));
    });
  };

  const handleDeleteSelected = async () => {
    if (!canDelete) {
      setError("No tienes permiso para eliminar activos");
      return;
    }

    const selectedIds = selectedActivosIds
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);

    if (selectedIds.length === 0) {
      setError("Selecciona al menos un activo para eliminar.");
      return;
    }

    const confirmed = globalThis.confirm(`¿Eliminar ${selectedIds.length} activos seleccionados?`);
    if (!confirmed) {
      return;
    }

    setIsBulkDeleting(true);
    setError("");
    setSuccess("");

    try {
      let deletedCount = 0;
      const failed = [];

      for (const id of selectedIds) {
        try {
          await httpClient.delete(`/api/activos/${id}`);
          deletedCount += 1;
        } catch (err) {
          failed.push({
            id,
            message: err?.response?.data?.message || err?.response?.data?.error || "Error al eliminar"
          });
        }
      }

      if (showDetailModal && modalActivo && selectedIds.includes(Number(modalActivo.id))) {
        closeDetailModal();
      }

      setSelectedActivosIds((prev) =>
        prev.filter((id) => !selectedIds.includes(Number(id)))
      );
      await cargarActivos();

      if (failed.length > 0) {
        const resumenFallos = failed
          .slice(0, 3)
          .map((item, index) => {
            if (isAdmin) {
              return `ID ${item.id}: ${item.message}`;
            }
            const consecutivo = obtenerConsecutivoActivo(item.id);
            const label = consecutivo && consecutivo !== "-" ? `Activo ${consecutivo}` : `Activo ${index + 1}`;
            return `${label}: ${item.message}`;
          })
          .join(" | ");
        setError(`Eliminación parcial: ${deletedCount}/${selectedIds.length}. ${resumenFallos}`);
      } else {
        setSuccess(`Se eliminaron ${deletedCount} activos.`);
      }
    } finally {
      setIsBulkDeleting(false);
    }
  };

  useEffect(() => {
    const validIds = new Set(
      (Array.isArray(activos) ? activos : [])
        .map((item) => Number(item.id))
        .filter((id) => Number.isInteger(id) && id > 0)
    );

    setSelectedActivosIds((prev) => {
      const next = prev.filter((id) => validIds.has(Number(id)));
      if (next.length === prev.length) return prev;
      return next;
    });
  }, [activos]);

  useEffect(() => {
    if (!showDetailModal || !modalActivo.id) return;
    const existsInList = activos.some((item) => Number(item.id) === Number(modalActivo.id));
    if (!existsInList) closeDetailModal();
  }, [activos, showDetailModal, modalActivo, closeDetailModal]);

  const generarHojaDeVida = () => {
    if (!modalActivo) return;
    const html = buildAssetLifeSheetHtml({
      asset: modalActivo,
      historial: historialMantenimientos,
      entidadNombre: obtenerNombreEntidad(modalActivo),
      logos: {
        logoM5,
        logoAssetControl
      }
    });

    const printWindow = globalThis.open("", "_blank", "width=1100,height=850");
    if (!printWindow) {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const downloadBase = modalActivo.activo || modalActivo.nombre;
      const downloadFallback =
        isAdmin && modalActivo.id
          ? String(modalActivo.id)
          : obtenerConsecutivoActivo(modalActivo.id);
      link.download = `hoja-de-vida-${downloadBase || downloadFallback || "activo"}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      setSuccess("No se pudo abrir ventana emergente. Se descargó la hoja de vida en HTML para imprimir o guardar PDF.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setSuccess("Vista previa de hoja de vida abierta. Desde esa ventana puedes imprimir o guardar en PDF.");
  };

  if (isLoading) {
    return (
      <div className="container-activos">
        <div className="loading">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="container-activos">
      <div className="activos-topbar">
        <h1>Gestión De Activos</h1>
        <div className="activos-topbar-actions">
          {canCreate && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept={IMPORT_ACCEPT}
                onChange={handleImportFileChange}
                style={{ display: "none" }}
              />
              <button
                type="button"
                className="btn-submit btn-open-form"
                onClick={openImportDialog}
                disabled={isImporting}
              >
                {isImporting ? "Importando..." : "Importar"}
              </button>
            </>
          )}
          {canCreate && (
            <button type="button" className="btn-submit btn-open-form" onClick={openNewActivoForm}>
              Nuevo Activo
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="btn-delete-selected"
              onClick={handleDeleteSelected}
              disabled={isBulkDeleting || selectedActivosIds.length === 0}
            >
              {isBulkDeleting ? "Eliminando..." : `Eliminar Seleccionados (${selectedActivosIds.length})`}
            </button>
          )}
          <span className="activos-counter">{filteredActivos.length} activos visibles</span>
        </div>
      </div>

      <section className="export-panel" aria-label="Exportacion de activos">
        <div className="export-panel-header">
          <div>
            <h3>Exportacion de activos</h3>
            <p>Genera reportes en PDF o Excel con el alcance que necesitas.</p>
          </div>
          <div className="export-panel-metrics">
            <div className="export-metric">
              <span>Registros</span>
              <strong>{exportScopeConfig.source.length}</strong>
            </div>
            <div className="export-metric">
              <span>Alcance</span>
              <strong>{exportScopeConfig.label}</strong>
            </div>
          </div>
        </div>
        <div className="export-panel-body">
          <div className="export-panel-section">
            <span className="export-panel-label">Alcance</span>
            <div className="export-chip-group" role="group" aria-label="Seleccionar alcance">
              {EXPORT_SCOPE_OPTIONS.map((option) => {
                const count = exportScopeCounts[option.value] ?? 0;
                const isActive = exportScope === option.value;
                const isDisabled = option.value === "selected" && selectedActivos.length === 0;
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
            {exportScope === "selected" && selectedActivos.length === 0 && (
              <div className="export-panel-hint">
                Selecciona activos en la tabla para habilitar este alcance.
              </div>
            )}
          </div>
          <div className="export-panel-section export-panel-actions">
            <button
              type="button"
              className="btn-export btn-export-excel"
              onClick={handleExportExcelReport}
              disabled={isExportingExcel || exportScopeConfig.source.length === 0}
            >
              {isExportingExcel ? "Generando Excel..." : "Exportar Excel"}
            </button>
            <button
              type="button"
              className="btn-export btn-export-pdf"
              onClick={handleExportPdfReport}
              disabled={isExportingPdf || exportScopeConfig.source.length === 0}
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

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {!shouldShowActivosContent && (
        <section className="activos-category-menu">
          <div className="activos-category-menu-header">
            <div>
              <h2>Categorias de activos</h2>
            </div>
          </div>
          <div className="activos-category-strip">
            <button
              type="button"
              className="asset-category-card tone-all"
              onClick={() => handleCategoriaMenuSelect(MENU_ALL_CATEGORY)}
            >
              <span>Todos los activos</span>
              <strong>{activosDashboardSummary.total}</strong>
            </button>
            {ACTIVO_CATEGORY_OPTIONS.map((category) => {
              const focusKey = CATEGORY_SUMMARY_KEYS[category.value] || "total";
              const categoryCount = activosDashboardSummary[focusKey] || 0;

              return (
                <button
                  key={`menu-category-card-${category.value}`}
                  type="button"
                  className={`asset-category-card tone-${category.tone}`}
                  onClick={() => handleCategoriaMenuSelect(category.value)}
                >
                  <span>{category.value}</span>
                  <strong>{categoryCount}</strong>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {shouldShowActivosContent && (
        <>
          <div className="activos-category-banner">
            <div>
              <span>Categoria seleccionada</span>
              <strong>{categoriaMenuLabel}</strong>
            </div>
            <button type="button" className="activos-category-reset" onClick={resetCategoriaMenu}>
              Cambiar categoria
            </button>
          </div>
          <section className="activos-dashboard">
        <div className="activos-dashboard-hero">
          <div>
            <h2>Resumen de activos</h2>
            {entidadActivaId && (
              <p className="activos-scope-label">
                Entidad activa: <strong>{selectedEntidadNombre || `Entidad #${entidadActivaId}`}</strong>
              </p>
            )}
          </div>
          <div className="activos-dashboard-cards">
            <button
              type="button"
              className={`asset-stat-card ${dashboardFocusKey === "total" ? "is-active" : ""}`}
              onClick={() => handleDashboardQuickFilter("total")}
            >
              <span>Total registrados</span>
              <strong>{activosDashboardSummary.total}</strong>
            </button>
            <button
              type="button"
              className={`asset-stat-card asset-stat-card-success ${dashboardFocusKey === "disponibles" ? "is-active" : ""}`}
              onClick={() => handleDashboardQuickFilter("disponibles", "estado::Disponible")}
            >
              <span>Disponibles</span>
              <strong>{activosDashboardSummary.disponibles}</strong>
            </button>
            <button
              type="button"
              className={`asset-stat-card asset-stat-card-warning ${dashboardFocusKey === "mantenimiento" ? "is-active" : ""}`}
              onClick={() => handleDashboardQuickFilter("mantenimiento", "estado::Mantenimiento")}
            >
              <span>Mantenimiento</span>
              <strong>{activosDashboardSummary.mantenimiento}</strong>
            </button>
            <button
              type="button"
              className={`asset-stat-card asset-stat-card-danger ${dashboardFocusKey === "fueraServicio" ? "is-active" : ""}`}
              onClick={() => handleDashboardQuickFilter("fueraServicio", "estado::Fuera de servicio")}
            >
              <span>Fuera de servicio</span>
              <strong>{activosDashboardSummary.fueraServicio}</strong>
            </button>
          </div>
        </div>
        <div className="activos-dashboard-note">
          <span className={`asset-panel-counter tone-${dashboardFocusConfig[dashboardFocusKey]?.tone || "neutral"}`}>
            {dashboardFocusConfig[dashboardFocusKey]?.count || 0}
          </span>
          <div>
            <strong>{dashboardFocusConfig[dashboardFocusKey]?.title || "Panorama general de activos"}</strong>
            <p>{dashboardFocusConfig[dashboardFocusKey]?.description || "Selecciona un contador para aplicar el filtro principal."}</p>
          </div>
        </div>
        <div className="activos-category-strip">
          {ACTIVO_CATEGORY_OPTIONS.map((category) => {
            const focusKey = CATEGORY_SUMMARY_KEYS[category.value] || "total";
            const categoryCount = activosDashboardSummary[focusKey] || 0;

            return (
              <button
                key={`category-card-${category.value}`}
                type="button"
                className={`asset-category-card tone-${category.tone} ${dashboardFocusKey === focusKey ? "is-active" : ""}`}
                onClick={() => handleDashboardQuickFilter(focusKey, `categoria::${category.value}`)}
              >
                <span>{category.value}</span>
                <strong>{categoryCount}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <div className="activos-query-toolbar">
        <div className="activos-query-search">
          <label htmlFor="activos-global-search">Busqueda global</label>
          <input
            id="activos-global-search"
            type="text"
            placeholder="Buscar por activo, categoria, equipo, serial, marca, modelo, area principal o secundaria, RAM, disco o sistema..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="search-input"
          />
        </div>

        <div className="activos-filters-bar">
          <div className="activos-filter-stack">
            <label htmlFor="activos-quick-filter" className="activos-filter-label">Filtro principal</label>
            <select
              id="activos-quick-filter"
              className="activos-filter-select"
              value={activosQuickFilter}
              onChange={(event) => applyActivosQuickFilter(event.target.value)}
              aria-label="Filtro principal de activos"
            >
              {activosQuickFilterOptions.map((option) => (
                <option key={`quick-filter-${option.value || 'all'}`} value={option.value}>{option.label}</option>
              ))}
            </select>
            <small>
              {activosQuickFilter
                ? `Aplicando: ${activosQuickFilterLabel}`
                : "Un solo filtro rapido agrupa estado, categoria, area, disco y sistema operativo."}
            </small>
          </div>

          <button
            type="button"
            className={`activos-filter-toggle ${showColumnFilters ? "is-active" : ""}`}
            onClick={() => setShowColumnFilters((prev) => !prev)}
          >
            {showColumnFilters ? "Ocultar filtros avanzados" : "Mostrar filtros avanzados"}
          </button>

          <button type="button" className="activos-filter-reset" onClick={clearActivosFilters}>
            Limpiar filtros
          </button>
        </div>
      </div>


      <div className="tabla-container">
        <table className="tabla-activos">
          <thead>
            <tr>
              {canSelectRows && (
                <th>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    onClick={(event) => event.stopPropagation()}
                    aria-label="Seleccionar todos"
                  />
                </th>
              )}
              <th>Id</th>
              <th>Activo</th>
              <th>Categoría</th>
              <th>Entidad</th>
              <th>Equipo</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Serial</th>
              <th>Área principal</th>
              <th>Área secundaria</th>
              <th>Tipo De Disco</th>
              <th>Capacidad</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
            {showColumnFilters && (
            <tr className="activos-filters-row">
              {canSelectRows && <th />}
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar Id"
                  value={columnFilters.id}
                  onChange={(event) => updateColumnFilter("id", event.target.value)}
                  aria-label="Filtrar por Id"
                />
              </th>
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar activo"
                  value={columnFilters.activo}
                  onChange={(event) => updateColumnFilter("activo", event.target.value)}
                  aria-label="Filtrar por activo"
                />
              </th>
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar categoría"
                  value={columnFilters.categoria}
                  onChange={(event) => updateColumnFilter("categoria", event.target.value)}
                  aria-label="Filtrar por categoría"
                />
              </th>
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar entidad"
                  value={columnFilters.entidad}
                  onChange={(event) => updateColumnFilter("entidad", event.target.value)}
                  aria-label="Filtrar por entidad"
                />
              </th>
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar equipo"
                  value={columnFilters.equipo}
                  onChange={(event) => updateColumnFilter("equipo", event.target.value)}
                  aria-label="Filtrar por equipo"
                />
              </th>
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar marca"
                  value={columnFilters.marca}
                  onChange={(event) => updateColumnFilter("marca", event.target.value)}
                  aria-label="Filtrar por marca"
                />
              </th>
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar modelo"
                  value={columnFilters.modelo}
                  onChange={(event) => updateColumnFilter("modelo", event.target.value)}
                  aria-label="Filtrar por modelo"
                />
              </th>
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar serial"
                  value={columnFilters.serial}
                  onChange={(event) => updateColumnFilter("serial", event.target.value)}
                  aria-label="Filtrar por serial"
                />
              </th>
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar área principal"
                  value={columnFilters.areaPrincipal}
                  onChange={(event) => updateColumnFilter("areaPrincipal", event.target.value)}
                  aria-label="Filtrar por área principal"
                />
              </th>
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar área secundaria"
                  value={columnFilters.areaSecundaria}
                  onChange={(event) => updateColumnFilter("areaSecundaria", event.target.value)}
                  aria-label="Filtrar por área secundaria"
                />
              </th>
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar tipo"
                  value={columnFilters.tipoDisco}
                  onChange={(event) => updateColumnFilter("tipoDisco", event.target.value)}
                  aria-label="Filtrar por tipo de disco"
                />
              </th>
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar capacidad"
                  value={columnFilters.hdd}
                  onChange={(event) => updateColumnFilter("hdd", event.target.value)}
                  aria-label="Filtrar por capacidad"
                />
              </th>
              <th>
                <input
                  type="text"
                  className="activos-column-filter"
                  placeholder="Filtrar estado"
                  value={columnFilters.estado}
                  onChange={(event) => updateColumnFilter("estado", event.target.value)}
                  aria-label="Filtrar por estado"
                />
              </th>
              <th />
            </tr>
            )}
          </thead>
          <tbody>
            {filteredActivos.length === 0 ? (
              <tr>
                <td colSpan={canSelectRows ? 15 : 14} className="no-data">No hay activos para mostrar</td>
              </tr>
            ) : (
              filteredActivos.map((item) => {
                const bajaInfo = bajasByActivo.get(Number(item.id));
                const bajaEstado = String(bajaInfo?.estado || "").toUpperCase();
                const bajaPendiente = bajaEstado === "PENDIENTE";
                const bajaAprobada = bajaEstado === "APROBADO";
                const bajaRechazada = bajaEstado === "RECHAZADO";
                const activoFueraServicio = ["fueradeservicio", "baja", "retirado"].includes(
                  normalizeStatusToken(item.estado)
                );
                return (
                <tr
                  key={item.id}
                  onClick={() => abrirDetalleActivo(item)}
                  onKeyDown={(event) => handleActivoRowKeyDown(event, item)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver detalle del activo ${item.activo || obtenerConsecutivoActivo(item.id)}`}
                >
                  {canSelectRows && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedActivosSet.has(Number(item.id))}
                        onChange={(event) => toggleActivoSelection(item.id, event)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Seleccionar activo ${obtenerConsecutivoActivo(item.id)}`}
                      />
                    </td>
                  )}
                  <td>{obtenerConsecutivoActivo(item.id)}</td>
                  <td>{item.activo || item.nombre || "-"}</td>
                  <td>
                    <span className={`categoria-badge ${getCategoriaBadgeClassName(inferCategoriaActivo(item))}`}>
                      {inferCategoriaActivo(item)}
                    </span>
                  </td>
                  <td><span className="sede-badge">{obtenerNombreEntidad(item)}</span></td>
                  <td>{item.equipo || "-"}</td>
                  <td>{item.marca || "-"}</td>
                  <td>{item.modelo || "-"}</td>
                  <td>{item.serial || "-"}</td>
                  <td>{item.areaPrincipal || "-"}</td>
                  <td>{item.areaSecundaria || "-"}</td>
                  <td><span className="tipo-disco-badge">{item.tipoDisco || "N/A"}</span></td>
                  <td>{item.hdd || "N/A"}</td>
                  <td><span className={`estado-badge ${getEstadoClassName(item.estado)}`}>{item.estado || "-"}</span></td>
                  <td className="actions-cell">
                    {canEdit && (
                      <button
                        type="button"
                        className="btn-action-icon btn-action-edit"
                        onClick={(event) => handleEdit(item, event)}
                        title="Editar activo"
                        aria-label="Editar activo"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                          <path
                            d="M4 16.75V20h3.25L19.81 7.44a1.5 1.5 0 0 0 0-2.12l-1.13-1.13a1.5 1.5 0 0 0-2.12 0L4 16.75Z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                          />
                          <path
                            d="m13.5 4.5 6 6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="btn-action-icon btn-action-delete"
                        onClick={(event) => handleDelete(item.id, event)}
                        title="Eliminar activo"
                        aria-label="Eliminar activo"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                          <path
                            d="M4.5 7h15M9 7V5.75A1.75 1.75 0 0 1 10.75 4h2.5A1.75 1.75 0 0 1 15 5.75V7m-7.5 0 .6 11.25A1.5 1.5 0 0 0 9.6 19.75h4.8a1.5 1.5 0 0 0 1.5-1.5L16.5 7"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path d="M10 11v5M14 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                    {!isAdmin && canRequestBaja && (
                      activoFueraServicio ? (
                        <span className="baja-pill approved">Fuera de servicio</span>
                      ) : bajaPendiente ? (
                        <span className="baja-pill pending">Baja pendiente</span>
                      ) : bajaAprobada ? (
                        <span className="baja-pill approved">Baja aprobada</span>
                      ) : bajaRechazada ? (
                        <span className="baja-pill rejected">Baja rechazada</span>
                      ) : (
                        <button
                          type="button"
                          className="btn-action-icon btn-action-baja"
                          onClick={(event) => {
                            event.stopPropagation();
                            openBajaModal(item);
                          }}
                          title="Solicitar baja"
                          aria-label="Solicitar baja"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                            <path
                              d="M12 3.75 20.25 18H3.75L12 3.75Z"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinejoin="round"
                            />
                            <path d="M12 8.25v5.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <path
                              d="M12 16.75h.01"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      )
                    )}
                    {isAdmin && bajaEstado && (
                      <span className={`baja-pill ${bajaPendiente ? "pending" : bajaAprobada ? "approved" : "rejected"}`}>
                        {bajaEstado}
                      </span>
                    )}
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>

      {(isAdmin || bajas.length > 0) && (
        <section className="baja-panel">
          <div className="baja-panel-header">
            <div>
              <h3>Solicitudes de baja</h3>
              <p>Flujo de aprobacion de activos dados de baja.</p>
            </div>
            {isLoadingBajas && <span className="baja-status">Actualizando...</span>}
          </div>

          {bajaError && <div className="alert alert-error">{bajaError}</div>}

          {bajas.length === 0 ? (
            <p className="no-data">No hay solicitudes registradas.</p>
          ) : (
            <div className="baja-table-wrapper">
              <table className="baja-table">
                <thead>
                  <tr>
                    {isAdmin && <th>ID</th>}
                    <th>Activo</th>
                    <th>Motivo</th>
                    <th>Estado</th>
                    <th>Solicitado por</th>
                    <th>Fecha</th>
                    <th>Evidencia</th>
                    {isAdmin && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {bajas.map((baja) => {
                    const adjuntos = normalizeBajaAdjuntos(baja.evidencia);
                    return (
                      <tr key={`baja-${baja.id}`}>
                        {isAdmin && <td>{baja.id}</td>}
                        <td>{formatBajaActivoLabel(baja)}</td>
                        <td>{baja.motivo}</td>
                        <td>
                          <span className={`baja-pill ${String(baja.estado || "").toLowerCase()}`}>
                            {String(baja.estado || "").toUpperCase()}
                          </span>
                        </td>
                        <td>{baja.solicitado_por_nombre || "Usuario"}</td>
                        <td>{formatFecha(baja.creado_en)}</td>
                        <td>
                          {adjuntos.length === 0 ? (
                            <span className="baja-empty">Sin evidencia</span>
                          ) : (
                            <div className="baja-evidencia">
                              {adjuntos.map((file, index) => (
                                <a
                                  key={`baja-${baja.id}-file-${index}`}
                                  href={file.dataUrl}
                                  className="baja-link"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {file.name || `Archivo ${index + 1}`}
                                </a>
                              ))}
                            </div>
                          )}
                        </td>
                        {isAdmin && (
                          <td>
                            {String(baja.estado || "").toUpperCase() === "PENDIENTE" ? (
                              <div className="baja-actions">
                                <button type="button" onClick={() => handleApproveBaja(baja)}>
                                  Aprobar
                                </button>
                                <button type="button" onClick={() => handleRejectBaja(baja)}>
                                  Rechazar
                                </button>
                              </div>
                            ) : (
                              <span className="baja-empty">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
        </>
      )}

      {showBajaModal && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeBajaModal();
          }}
          onKeyDown={(event) => handleKeyboardAction(event, closeBajaModal)}
          role="button"
          tabIndex={0}
          aria-label="Cerrar solicitud de baja"
        >
          <div className="modal-content modal-form-content" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Solicitar baja de activo</h2>
              <button
                type="button"
                className="close-btn close-btn-compact close-btn-icon"
                onClick={closeBajaModal}
                aria-label="Cerrar modal"
                title="Cerrar"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="baja-modal-body">
              <div className="baja-modal-asset">
                <strong>{bajaForm.activo?.activo || bajaForm.activo?.nombre || "Activo"}</strong>
                <span>{bajaForm.activo?.equipo || ""}</span>
              </div>

              {bajaError && <div className="alert alert-error">{bajaError}</div>}

              <label>
                Motivo de la baja
                <textarea
                  rows="3"
                  value={bajaForm.motivo}
                  onChange={(event) =>
                    setBajaForm((prev) => ({ ...prev, motivo: event.target.value }))
                  }
                ></textarea>
              </label>

              <div className="baja-adjuntos">
                <label>
                  Evidencia (max {MAX_BAJA_ADJUNTOS})
                  <input
                    type="file"
                    multiple
                    accept={ALLOWED_BAJA_TYPES.join(",")}
                    onChange={handleBajaAdjuntosChange}
                    disabled={isSubmittingBaja || (bajaForm.adjuntos || []).length >= MAX_BAJA_ADJUNTOS}
                  />
                </label>
                {(bajaForm.adjuntos || []).length > 0 && (
                  <div className="attachment-list">
                    {(bajaForm.adjuntos || []).map((adjunto, index) => (
                      <div key={`${adjunto.name}-${index}`} className="attachment-item">
                        <span>{adjunto.name}</span>
                        <button
                          type="button"
                          onClick={() => removeBajaAdjunto(index)}
                          disabled={isSubmittingBaja}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="baja-modal-actions">
                <button type="button" className="btn-delete" onClick={closeBajaModal}>
                  Cancelar
                </button>
                <button type="button" className="btn-action" onClick={handleSubmitBaja} disabled={isSubmittingBaja}>
                  {isSubmittingBaja ? "Enviando..." : "Enviar solicitud"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFormModal && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeFormModal();
          }}
          onKeyDown={(event) => handleKeyboardAction(event, closeFormModal)}
          role="button"
          tabIndex={0}
          aria-label="Cerrar formulario de activo"
        >
          <div className="modal-content modal-form-content" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>{modalTitle}</h2>
              <button
                type="button"
                className="close-btn close-btn-compact close-btn-icon"
                onClick={closeFormModal}
                aria-label="Cerrar modal"
                title="Cerrar"
              >
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
              <form className="form-activo" onSubmit={handleSubmit}>
                <div className="entidad-select-container">
                  <label htmlFor="entidad-select" className="sede-label">Entidad *</label>
                  <select
                    id="entidad-select"
                    name="entidad_id"
                    value={form.entidad_id}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    className="form-field entidad-select"
                    required
                  >
                    <option value="" disabled hidden>Selecciona Una Entidad</option>
                    {entidadesOrdenadas.map((entidad) => (
                      <option key={entidad.id} value={String(entidad.id)}>{entidad.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-section asset-category-panel">
                  <h3>Clasificación del activo</h3>
                  <p className="asset-form-profile-copy">{categoriaProfile.description}</p>
                  <div className="form-row">
                    <select
                      name="categoria_activo"
                      value={form.categoria_activo}
                      onChange={handleChange}
                      className="form-field"
                      required
                      disabled={isSubmitting}
                    >
                      <option value="" disabled hidden>Categoria del activo *</option>
                      {ACTIVO_CATEGORY_OPTIONS.map((item) => (
                        <option key={`category-${item.value}`} value={item.value}>{item.value}</option>
                      ))}
                    </select>
                    <input
                      name="equipo"
                      value={form.equipo}
                      onChange={handleChange}
                      placeholder={categoriaActiva ? "Tipo de equipo *" : "Selecciona primero la categoria"}
                      className="form-field"
                      list="equipos-por-categoria"
                      required
                      disabled={isSubmitting || !categoriaActiva}
                    />
                    <datalist id="equipos-por-categoria">
                      {equipoSuggestions.map((item) => (
                        <option key={`equipo-suggestion-${item}`} value={item} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="form-row">
                  <input name="activo" value={form.activo} onChange={handleChange} placeholder="Código del activo (opcional)" className="form-field" />
                  <input name="serial" value={form.serial} onChange={handleChange} placeholder={categoriaProfile.requiredFields.includes("serial") ? "Serial *" : "Serial"} className="form-field" />
                </div>
                <div className="form-row">
                  <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Nombre del equipo o dispositivo" className="form-field" />
                  <select name="estado" value={form.estado} onChange={handleChange} className="form-field">
                    {OPTIONS.estado.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <select
                    name="areaPrincipal"
                    value={form.areaPrincipal}
                    onChange={handleChange}
                    className="form-field"
                    required
                    disabled={isSubmitting || !targetEntidadId || primaryAreaOptions.length === 0}
                  >
                    <option value="" disabled hidden>
                      {areaPrincipalPlaceholder}
                    </option>
                    {primaryAreaOptions.map((item) => (
                      <option key={`principal-${item}`} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select
                    name="areaSecundaria"
                    value={form.areaSecundaria}
                    onChange={handleChange}
                    className="form-field"
                    disabled={isSubmitting || !targetEntidadId || secondaryAreaOptions.length === 0}
                  >
                    <option value="" disabled hidden>
                      {areaSecundariaPlaceholder}
                    </option>
                    {secondaryAreaOptions.map((item) => (
                      <option key={`secundaria-${item}`} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <input name="marca" value={form.marca} onChange={handleChange} placeholder="Marca *" required className="form-field" />
                  <input name="modelo" value={form.modelo} onChange={handleChange} placeholder="Modelo *" required className="form-field" />
                </div>

                {categoriaProfile.showsComputeFields && (
                  <>
                    <div className="form-row">
                      <input name="procesador" value={form.procesador} onChange={handleChange} placeholder="Procesador" className="form-field" />
                      <select name="tipoRam" value={form.tipoRam} onChange={handleChange} className="form-field">
                        <option value="" disabled hidden>Tipo De RAM</option>
                        {OPTIONS.tipoRam.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                      <select name="ram" value={form.ram} onChange={handleChange} className="form-field">
                        <option value="" disabled hidden>Capacidad RAM</option>
                        {OPTIONS.ram.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                    <div className="form-row">
                      <select name="tipoDisco" value={form.tipoDisco} onChange={handleChange} className="form-field">
                        <option value="" disabled hidden>Tipo De Disco</option>
                        {OPTIONS.tipoDisco.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                      <select name="hdd" value={form.hdd} onChange={handleChange} className="form-field">
                        <option value="" disabled hidden>Capacidad De Disco</option>
                        {OPTIONS.hdd.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                    <div className="form-row">
                      <select name="os" value={form.os} onChange={handleChange} className="form-field">
                        <option value="" disabled hidden>Sistema Operativo</option>
                        {OPTIONS.os.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {categoriaProfile.extraFields && categoriaProfile.extraFields.length > 0 && (
                  <div className="form-section">
                    <h3>Campos especificos por categoria</h3>
                    <div className="form-row form-row-grid">
                      {categoriaProfile.extraFields.map((field) => (
                        <input
                          key={`extra-field-${field.key}`}
                          name={`extra__${field.key}`}
                          value={form.campos_especificos?.[field.key] ?? ""}
                          onChange={handleExtraFieldChange}
                          placeholder={`${field.label}${field.required ? " *" : ""}`}
                          className="form-field"
                          disabled={isSubmitting}
                          aria-label={field.label}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="form-section">
                  <h3>Información Adicional</h3>
                  <div className="form-row">
                    <input
                      type="date"
                      name="fecha_adquisicion"
                      value={form.fecha_adquisicion || ""}
                      onChange={handleChange}
                      className="form-field"
                    />
                    <input
                      name="vida_util_anios"
                      value={form.vida_util_anios}
                      onChange={handleChange}
                      placeholder="Vida Útil (Años)"
                      className="form-field"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div className="form-buttons">
                  <button type="submit" className="btn-submit" disabled={isSubmitting}>
                    {submitButtonLabel}
                  </button>
                  <button type="button" className="btn-cancelar" onClick={closeFormModal} disabled={isSubmitting}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && modalActivo && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDetailModal();
          }}
          onKeyDown={(event) => handleKeyboardAction(event, closeDetailModal)}
          role="button"
          tabIndex={0}
          aria-label="Cerrar detalle del activo"
        >
          <div className="modal-content" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Detalle Del Activo</h2>
              <button
                type="button"
                className="close-btn close-btn-compact close-btn-icon"
                onClick={closeDetailModal}
                aria-label="Cerrar modal"
                title="Cerrar"
              >
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
              <div className="modal-info-table-wrap">
                <table className="modal-info-table">
                  <tbody>
                    {modalInfoRows.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {modalExtraFields.length > 0 && (
                <>
                  <h3 className="modal-section-title">Campos específicos</h3>
                  <div className="modal-info-table-wrap">
                    <table className="modal-info-table">
                      <tbody>
                        {modalExtraRows.map((row) => (
                          <tr key={`modal-extra-${row.key}`}>
                            <th scope="row">{row.label}</th>
                            <td>{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <h3 className="modal-section-title">Histórico de mantenimientos</h3>
              <div className="table-responsive">
                <table className="tabla-historico">
                  <thead>
                    <tr><th>Fecha</th><th>Tipo</th><th>Técnico</th><th>Estado</th><th>Cambio de partes</th><th>Descripción</th></tr>
                  </thead>
                  <tbody>
                    {isLoadingHistorial ? (
                      <tr><td colSpan="6">Cargando histórico...</td></tr>
                    ) : historialMantenimientos.length === 0 ? (
                      <tr><td colSpan="6">No hay mantenimientos para este activo.</td></tr>
                    ) : (
                      historialMantenimientos.map((item) => (
                        <tr key={item.id}>
                          <td>{formatFecha(item.fecha)}</td>
                          <td>{item.tipo || "-"}</td>
                          <td>{item.tecnico || "-"}</td>
                          <td>{item.estado || "-"}</td>
                          <td>{item.cambio_partes || item.cambioPartes || "-"}</td>
                          <td>{item.descripcion || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              {canEdit && (
                <button
                  type="button"
                  className="btn-submit"
                  onClick={() => {
                    const activoToEdit = modalActivo;
                    closeDetailModal();
                    handleEdit(activoToEdit);
                  }}
                >
                  Editar
                </button>
              )}
              {canDelete && <button type="button" className="btn-pdf" onClick={() => handleDelete(modalActivo.id)}>Eliminar</button>}
              <button type="button" className="btn-email" onClick={abrirModalCorreo} disabled={isSendingEmail}>
                {isSendingEmail ? "Enviando..." : "Enviar Por Correo"}
              </button>
              <button type="button" className="btn-hoja-vida" onClick={generarHojaDeVida}>
                Generar Hoja De Vida
              </button>
              <button type="button" className="btn-cerrar" onClick={closeDetailModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div
          className="modal-overlay email-compose-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) cerrarModalCorreo();
          }}
          onKeyDown={(event) => handleKeyboardAction(event, cerrarModalCorreo)}
          role="button"
          tabIndex={0}
          aria-label="Cerrar formulario de correo"
        >
          <div className="modal-content email-compose-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Enviar Hoja De Vida Por Correo</h2>
              <button type="button" className="close-btn" onClick={cerrarModalCorreo} disabled={isSendingEmail} aria-label="Cerrar">
                Cerrar
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <input
                  className="form-field"
                  name="to"
                  type="email"
                  placeholder="Correo Destino"
                  value={emailForm.to}
                  onChange={handleEmailChange}
                  disabled={isSendingEmail}
                />
              </div>
              <div className="form-row">
                <input
                  className="form-field"
                  name="subject"
                  type="text"
                  placeholder="Asunto"
                  value={emailForm.subject}
                  onChange={handleEmailChange}
                  disabled={isSendingEmail}
                />
              </div>
              <div className="form-row">
                <textarea
                  className="form-field email-compose-textarea"
                  name="message"
                  placeholder="Mensaje (Opcional)"
                  value={emailForm.message}
                  onChange={handleEmailChange}
                  disabled={isSendingEmail}
                />
              </div>
              <div className="form-row">
                <textarea
                  className="form-field email-compose-signature"
                  name="signature"
                  placeholder="Firma De Correo"
                  value={emailForm.signature}
                  onChange={handleEmailChange}
                  disabled={isSendingEmail}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-email" onClick={enviarActivoPorCorreo} disabled={isSendingEmail}>
                {isSendingEmail ? "Enviando..." : "Enviar"}
              </button>
              <button type="button" className="btn-cerrar" onClick={cerrarModalCorreo} disabled={isSendingEmail}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






ActivosPage.propTypes = {
  selectedEntidadId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selectedEntidadNombre: PropTypes.string
};
