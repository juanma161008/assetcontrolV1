import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import httpClient from "../../services/httpClient";
import { getCurrentUser, isAuthenticated } from "../../services/authService";
import { hasPermission } from "../../utils/permissions";
import "../../styles/Cronograma.css";

const WEEK_DAYS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

const DAY_FIRST_DATE_REGEX = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})/;
const PERIODIC_MONTHS = 6;
const PERIODIC_LOOKAHEAD_MONTHS = 6;
const PERIODIC_DUPLICATE_WINDOW_DAYS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CRONOGRAMA_RANGE_REGEX = /Rango:\s*(\d{2}\/\d{2}\/\d{4})\s*al\s*(\d{2}\/\d{2}\/\d{4})/i;
const SPANISH_MONTHS = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11
};

const toDateKey = (value) => {
  const source = String(value || "").trim();
  if (!source) return "";

  const isoMatch = ISO_DATE_REGEX.exec(source);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }

  const dayFirst = DAY_FIRST_DATE_REGEX.exec(source);
  if (dayFirst) {
    const [, day, month, year] = dayFirst;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeText = (value = "") => String(value || "").trim().toLowerCase();
const normalizeEstado = (value = "") => normalizeText(value);
const normalizeTipo = (value = "") => normalizeText(value);
const stripAccents = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const normalizeHeader = (value = "") => stripAccents(value).trim().toLowerCase();
const isPuntoRedTipo = (value = "") => normalizeTipo(value).includes("punto de red");
const isCronogramaTipo = (value = "") => normalizeTipo(value) === "cronograma";
const normalizeActivoEstado = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
const isActivoFueraServicio = (activo) => {
  const estado = normalizeActivoEstado(activo?.estado);
  return estado === "fueradeservicio" || estado === "baja" || estado === "retirado";
};
const isPreventivoTipo = (value = "") => normalizeTipo(value).includes("preventivo");

const parseDateValue = (value) => {
  const key = toDateKey(value);
  if (!key) return null;
  const [year, month, day] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
};

const addMonthsSafe = (date, months) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const target = new Date(year, month + months, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, maxDay));
  return target;
};

const buildPeriodicNumeroReporte = (activoId, dateKey) => {
  const safeActivo = String(activoId || "0").padStart(4, "0");
  const safeDate = String(dateKey || "").replace(/-/g, "");
  return `SEM-${safeActivo}-${safeDate || "00000000"}`;
};

const parseCount = (value) => {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const extractYearFromRows = (rows = []) => {
  for (const row of rows) {
    const rowText = (Array.isArray(row) ? row : [])
      .map((cell) => String(cell || ""))
      .join(" ");
    const match = rowText.match(/\b(20\d{2})\b/);
    if (match) return Number(match[1]);
  }
  return new Date().getFullYear();
};

const parseCronogramaRange = (value, fallbackYear) => {
  const raw = normalizeHeader(value);
  if (!raw) return null;
  const yearMatch = raw.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : fallbackYear;
  const monthKey = Object.keys(SPANISH_MONTHS).find((key) => raw.includes(key));

  if (!monthKey) {
    const key = toDateKey(value);
    if (!key) return null;
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return null;
    return { start: date, end: date };
  }

  const numbers = raw.match(/\d{1,2}/g)?.map(Number).filter((n) => n >= 1 && n <= 31) ?? [];
  if (numbers.length === 0) return null;
  const startDay = numbers[0];
  const endDay = numbers[1] ?? numbers[0];
  const monthIndex = SPANISH_MONTHS[monthKey];
  const start = new Date(year, monthIndex, startDay);
  const end = new Date(year, monthIndex, endDay);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end < start) return { start, end: start };
  return { start, end };
};

const buildDateRange = (start, end) => {
  const days = [];
  if (!start || !end) return days;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const limit = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cursor <= limit) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const getCurrentWeekRange = () => {
  const now = new Date();
  const start = new Date(now);
  const dayOfWeek = start.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  start.setDate(start.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const isSameDate = (dateA, dateB) => toDateKey(dateA) === toDateKey(dateB);

const getEstadoClass = (estado = "") => {
  const normalized = String(estado ?? "").toLowerCase().trim();
  if (!normalized) return "sin-estado";
  return normalized.split(/\s+/).join("-");
};

const getEstadoLabelForItem = (mantenimiento) => {
  if (mantenimiento && isCronogramaTipo(mantenimiento.tipo)) return "Programado";
  return mantenimiento?.estado || "-";
};

const getEstadoClassForItem = (mantenimiento) => {
  if (mantenimiento && isCronogramaTipo(mantenimiento.tipo)) return "programado";
  return getEstadoClass(mantenimiento?.estado);
};

const formatDateLabel = (value = "") => {
  const key = toDateKey(value);
  if (!key) return String(value || "").trim();
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
};

const buildCronogramaDescription = ({
  area = "",
  dispositivos = "",
  counts = {},
  start = null,
  end = null,
  note = "",
  entityLabel = ""
} = {}) => {
  const countParts = [
    `Cómputo ${Number(counts.computo || 0)}`,
    `Rack ${Number(counts.rack || 0)}`,
    `Switch ${Number(counts.switch || 0)}`,
    `Impresoras ${Number(counts.impresoras || 0)}`,
    `Escáner ${Number(counts.escaner || 0)}`,
    `Ergotrones ${Number(counts.ergotrones || 0)}`
  ].join(", ");

  return [
    entityLabel ? `Entidad: ${String(entityLabel).trim()}` : "",
    `Área: ${String(area || "").trim()}`,
    String(dispositivos || "").trim() ? `Dispositivos: ${String(dispositivos || "").trim()}` : "",
    `Cantidades: ${countParts}`,
    start && end ? `Rango: ${formatDateLabel(start)} al ${formatDateLabel(end)}` : "",
    String(note || "").trim() ? `Observación: ${String(note || "").trim()}` : ""
  ]
    .filter(Boolean)
    .join(" | ");
};

const buildDefaultCronogramaForm = () => {
  const { start, end } = getCurrentWeekRange();
  return {
    area: "",
    fechaInicio: toDateKey(start),
    fechaFin: toDateKey(end),
    dispositivos: "",
    computo: "",
    rack: "",
    switch: "",
    impresoras: "",
    escaner: "",
    ergotrones: "",
    notas: ""
  };
};

const getCronogramaRangeLabel = (descripcion = "") => {
  const match = CRONOGRAMA_RANGE_REGEX.exec(String(descripcion || ""));
  if (!match) return "";
  return `${match[1]} al ${match[2]}`;
};

const getCronogramaShortDescription = (descripcion = "") => {
  const source = String(descripcion || "").trim();
  if (!source) return "";
  const parts = source.split("|").map((item) => item.trim()).filter(Boolean);
  if (parts.length === 0) return source;
  return parts.slice(0, 2).join(" | ");
};

const getPlanificacionByEstado = (estado = "") =>
  String(estado || "").toLowerCase().trim() === "finalizado" ? "Realizado" : "Programado";

const getNumeroReporteMantenimiento = (mantenimiento = {}) =>
  String(
    mantenimiento.numeroReporte ??
    mantenimiento.numero_reporte ??
    mantenimiento.numeroreporte ??
    ""
  ).trim();

export default function CronogramaPage({ selectedEntidadId }) {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const canCreate = hasPermission(currentUser, "CREAR_MANTENIMIENTO");
  const canEdit = hasPermission(currentUser, "EDITAR_MANTENIMIENTO");
  const canDelete = hasPermission(currentUser, "ELIMINAR_MANTENIMIENTO");
  const entidadActivaId = String(selectedEntidadId || "").trim();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [mantenimientos, setMantenimientos] = useState([]);
  const [activosById, setActivosById] = useState({});
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [filters, setFilters] = useState({
    texto: "",
    tipo: "",
    estado: ""
  });
  const [showPeriodic, setShowPeriodic] = useState(true);
  const [periodicInfo, setPeriodicInfo] = useState("");
  const [periodicError, setPeriodicError] = useState("");
  const [isGeneratingPeriodic, setIsGeneratingPeriodic] = useState(false);
  const [importInfo, setImportInfo] = useState("");
  const [importError, setImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [bulkInfo, setBulkInfo] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSelectingDays, setIsSelectingDays] = useState(false);
  const [selectedDayKeys, setSelectedDayKeys] = useState([]);
  const cronogramaFileRef = useRef(null);
  const [reminderError, setReminderError] = useState("");
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [selectedMantenimiento, setSelectedMantenimiento] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const loadData = async () => {
    if (!isAuthenticated()) {
      setIsLoading(false);
      return;
    }

    try {
      setError("");
      const [mantenimientosResponse, activosResponse] = await Promise.all([
        httpClient.get("/api/mantenimientos"),
        httpClient.get("/api/activos")
      ]);

      const mantData = mantenimientosResponse.data.data || mantenimientosResponse.data || [];
      const activosData = activosResponse.data.data || activosResponse.data || [];

      const activosMap = (Array.isArray(activosData) ? activosData : []).reduce((acc, activo) => {
        acc[String(activo.id)] = {
          ...activo,
          activo: activo.activo ?? "",
          equipo: activo.equipo ?? ""
        };
        return acc;
      }, {});

      setActivosById(activosMap);
      setMantenimientos(Array.isArray(mantData) ? mantData : []);
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo cargar el cronograma");
      setMantenimientos([]);
      setActivosById({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const body = globalThis?.document?.body;
    if (!body) return undefined;
    if (isDetailOpen) {
      body.classList.add("modal-open");
    } else {
      body.classList.remove("modal-open");
    }
    return () => {
      body.classList.remove("modal-open");
    };
  }, [isDetailOpen]);

  const getActivoLabel = useCallback((mantenimiento) => {
    const activoId = mantenimiento.activo_id;
    const activo = activosById[String(activoId)];
    const numeroReporte = getNumeroReporteMantenimiento(mantenimiento);

    if (activo) {
      const codigoActivo = activo.activo || `ACTIVO #${activo.id}`;
      const reporte = numeroReporte ? ` | REP ${numeroReporte}` : "";
      const nombre = activo.equipo || "";
      return `${codigoActivo}${reporte}${nombre ? ` - ${nombre}` : ""}`;
    }
    if (!activoId && isPuntoRedTipo(mantenimiento.tipo)) {
      return numeroReporte ? `Punto de Red / ${numeroReporte}` : "Punto de Red";
    }
    if (!activoId && isCronogramaTipo(mantenimiento.tipo) && numeroReporte) {
      return `Área: ${numeroReporte}`;
    }
    if (mantenimiento.activo) {
      return numeroReporte ? `${mantenimiento.activo} | REP ${numeroReporte}` : mantenimiento.activo;
    }
    if (activoId) {
      return numeroReporte ? `ACTIVO #${activoId} | REP ${numeroReporte}` : `ACTIVO #${activoId}`;
    }
    if (numeroReporte) {
      return `Sin activo / ${numeroReporte}`;
    }
    return "Sin activo";
  }, [activosById]);

  const periodicSuggestions = useMemo(() => {
    const source = Array.isArray(mantenimientos) ? mantenimientos : [];
    if (source.length === 0) return [];

    const now = new Date();
    const lookahead = addMonthsSafe(now, PERIODIC_LOOKAHEAD_MONTHS);
    lookahead.setHours(23, 59, 59, 999);
    const windowMs = PERIODIC_DUPLICATE_WINDOW_DAYS * MS_PER_DAY;
    const grouped = new Map();

    for (const item of source) {
      const activoId = Number(item.activo_id ?? item.activoId ?? item.activo ?? 0);
      if (!activoId) continue;
      if (!isPreventivoTipo(item.tipo)) continue;
      const date = parseDateValue(item.fecha);
      if (!date) continue;

      const list = grouped.get(activoId) ?? [];
      list.push({ ...item, __date: date });
      grouped.set(activoId, list);
    }

    const suggestions = [];
    for (const [activoId, list] of grouped.entries()) {
      if (!Array.isArray(list) || list.length === 0) continue;
      list.sort((a, b) => a.__date - b.__date);

      const activo = activosById[String(activoId)];
      if (!activo) {
        continue;
      }
      if (entidadActivaId && String(activo.entidad_id || "") !== entidadActivaId) {
        continue;
      }
      if (activo && isActivoFueraServicio(activo)) {
        continue;
      }

      const lastFinalizado = [...list].reverse().find((item) => normalizeEstado(item.estado) === "finalizado");
      const base = lastFinalizado || list[list.length - 1];
      const hasFuture = list.some(
        (item) => normalizeEstado(item.estado) !== "finalizado" && item.__date >= now
      );
      if (hasFuture) continue;

      const nextDate = addMonthsSafe(base.__date, PERIODIC_MONTHS);
      if (nextDate > lookahead) continue;
      const hasNear = list.some((item) => Math.abs(item.__date - nextDate) <= windowMs);
      if (hasNear) continue;

      const dateKey = toDateKey(nextDate);
      if (!dateKey) continue;
      const descripcionBase = formatDateLabel(base?.fecha || base.__date);

      suggestions.push({
        id: `periodic-${activoId}-${dateKey}`,
        fecha: dateKey,
        tipo: "Preventivo",
        estado: "Pendiente",
        activo_id: activoId,
        tecnico: base?.tecnico || "",
        tecnico_id: base?.tecnico_id ?? base?.tecnicoId ?? null,
        descripcion: `Mantenimiento periódico (cada 6 meses). Último: ${descripcionBase}`,
        isPeriodic: true
      });
    }

    return suggestions.sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
  }, [mantenimientos, activosById, entidadActivaId]);

  const periodicSummary = useMemo(() => {
    const now = new Date();
    let dueThisMonth = 0;
    let overdue = 0;
    for (const item of periodicSuggestions) {
      const date = parseDateValue(item.fecha);
      if (!date) continue;
      if (date < now) overdue += 1;
      if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
        dueThisMonth += 1;
      }
    }
    return {
      total: periodicSuggestions.length,
      dueThisMonth,
      overdue
    };
  }, [periodicSuggestions]);

  const displayMantenimientos = useMemo(() => {
    const base = Array.isArray(mantenimientos) ? mantenimientos : [];
    return showPeriodic ? [...base, ...periodicSuggestions] : base;
  }, [mantenimientos, periodicSuggestions, showPeriodic]);

  const filteredMantenimientos = useMemo(() => {
    const text = filters.texto.trim().toLowerCase();
    const type = filters.tipo.trim().toLowerCase();
    const state = filters.estado.trim().toLowerCase();

    return (Array.isArray(displayMantenimientos) ? displayMantenimientos : []).filter((mantenimiento) => {
      const label = getActivoLabel(mantenimiento).toLowerCase();
      const row = [
        label,
        mantenimiento.tipo || "",
        mantenimiento.tecnico || "",
        getEstadoLabelForItem(mantenimiento),
        mantenimiento.descripcion || ""
      ]
        .join(" ")
        .toLowerCase();

      if (text && !row.includes(text)) {
        return false;
      }
      if (type && String(mantenimiento.tipo || "").toLowerCase() !== type) {
        return false;
      }
      const estadoLabel = String(getEstadoLabelForItem(mantenimiento) || "").toLowerCase();
      if (state && estadoLabel !== state) {
        return false;
      }
      if (entidadActivaId) {
        const activo = activosById[String(mantenimiento.activo_id)];
        if (String(activo.entidad_id || "") !== entidadActivaId) {
          return false;
        }
      }
      return true;
    });
  }, [displayMantenimientos, filters, getActivoLabel, entidadActivaId, activosById]);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const mantenimiento of filteredMantenimientos) {
      const dateKey = toDateKey(mantenimiento.fecha);
      if (!dateKey) {
        continue;
      }
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(mantenimiento);
    }
    return map;
  }, [filteredMantenimientos]);

  const upcomingTasks = useMemo(() => {
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + 7);
    limit.setHours(23, 59, 59, 999);

    return (Array.isArray(filteredMantenimientos) ? filteredMantenimientos : [])
      .filter((item) => {
        const date = new Date(item.fecha || 0);
        if (Number.isNaN(date.getTime())) return false;
        if (date < now) return false;
        if (date > limit) return false;
        if (item.isPeriodic) return false;
        if (isCronogramaTipo(item.tipo)) return false;
        return String(item.estado || "").toLowerCase() !== "finalizado";
      })
      .sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
  }, [filteredMantenimientos]);

  const monthSummary = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    let total = 0;
    let pendiente = 0;
    let enProceso = 0;
    let finalizado = 0;

    for (const mantenimiento of filteredMantenimientos) {
      const date = new Date(mantenimiento.fecha);
      if (Number.isNaN(date.getTime())) {
        continue;
      }
      if (date.getFullYear() !== year || date.getMonth() !== month) {
        continue;
      }
      total += 1;

      if (isCronogramaTipo(mantenimiento.tipo)) {
        continue;
      }

      const estado = String(mantenimiento.estado || "").toLowerCase();
      if (estado === "pendiente") pendiente += 1;
      if (estado === "en proceso") enProceso += 1;
      if (estado === "finalizado") finalizado += 1;
    }

    return { total, pendiente, enProceso, finalizado };
  }, [filteredMantenimientos, currentMonth]);

  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const offset = firstDay.getDay();

    const cells = [];
    for (let index = 0; index < offset; index += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= totalDays; day += 1) {
      cells.push(new Date(year, month, day));
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [currentMonth]);

  const selectedEvents = eventsByDate[selectedDateKey] || [];

  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateKey(toDateKey(now));
  };

  const handleSendReminder = async (mantenimientoId) => {
    if (!mantenimientoId) return;
    try {
      setSendingReminderId(mantenimientoId);
      setReminderError("");
      await httpClient.post(`/api/mantenimientos/${mantenimientoId}/recordatorio`);
    } catch (err) {
      setReminderError(err?.response?.data?.message || "No se pudo enviar el recordatorio.");
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleCreatePeriodicPendings = async () => {
    if (!canCreate) {
      setPeriodicError("No tienes permiso para crear mantenimientos.");
      return;
    }
    if (isGeneratingPeriodic) return;
    if (periodicSuggestions.length === 0) {
      setPeriodicError("No hay mantenimientos periódicos pendientes para agregar.");
      return;
    }
    const confirmed = globalThis.confirm(
      `Se agregarán ${periodicSuggestions.length} mantenimientos periódicos pendientes. ¿Deseas continuar?`
    );
    if (!confirmed) return;

    setPeriodicInfo("");
    setPeriodicError("");
    setIsGeneratingPeriodic(true);

    let created = 0;
    let failed = 0;

    for (const suggestion of periodicSuggestions) {
      const dateKey = toDateKey(suggestion.fecha);
      const payload = {
        fecha: dateKey || suggestion.fecha,
        numeroReporte: buildPeriodicNumeroReporte(suggestion.activo_id, dateKey),
        activo_id: Number(suggestion.activo_id),
        tipo: suggestion.tipo || "Preventivo",
        estado: suggestion.estado || "Pendiente",
        tecnico: suggestion.tecnico || "",
        tecnico_id: suggestion.tecnico_id ?? null,
        descripcion: suggestion.descripcion || "Mantenimiento periódico (cada 6 meses)."
      };

      try {
        await httpClient.post("/api/mantenimientos", payload);
        created += 1;
      } catch {
        failed += 1;
      }
    }

    if (created > 0) {
      setPeriodicInfo(`Se agregaron ${created} mantenimientos pendientes correctamente.`);
      await loadData();
    }
    if (failed > 0) {
      setPeriodicError(`No se pudieron agregar ${failed} mantenimientos. Revisa activos fuera de servicio.`);
    }
    setIsGeneratingPeriodic(false);
  };

  const handleCronogramaFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!canCreate) {
      setImportError("No tienes permiso para importar cronogramas.");
      return;
    }

    setImportError("");
    setImportInfo("");
    setIsImporting(true);

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setImportError("El archivo no contiene hojas válidas.");
        setIsImporting(false);
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      const headerIndex = rows.findIndex((row) =>
        (Array.isArray(row) ? row : []).some((cell) => normalizeHeader(cell).includes("fechas"))
      );
      if (headerIndex === -1) {
        setImportError("No se encontró la fila de encabezados con la columna 'fechas'.");
        setIsImporting(false);
        return;
      }

      const headerRow = rows[headerIndex] || [];
      const headerCells = headerRow.map((cell) => normalizeHeader(cell));
      const findIndex = (keys = []) =>
        headerCells.findIndex((cell) => keys.some((key) => cell.includes(key)));

      const idxFecha = findIndex(["fechas", "fecha"]);
      const idxArea = findIndex(["areas", "area"]);
      const idxDispositivos = findIndex(["dispositivos", "dispositivo"]);
      const idxComputo = findIndex(["equipos de computo", "equipos de computo", "computo"]);
      const idxRack = findIndex(["rack"]);
      const idxSwitch = findIndex(["switch"]);
      const idxImpresoras = findIndex(["impresoras", "impresora"]);
      const idxEscaner = findIndex(["escaner", "scanner", "escaner"]);
      const idxErgotrones = findIndex(["ergotrones", "ergotron"]);

      if (idxFecha < 0 || idxArea < 0) {
        setImportError("El archivo no tiene columnas 'fechas' y 'areas' reconocibles.");
        setIsImporting(false);
        return;
      }

      const year = extractYearFromRows(rows.slice(0, headerIndex + 1));
      const existingKeys = new Set(
        (Array.isArray(mantenimientos) ? mantenimientos : [])
          .filter((item) => isCronogramaTipo(item.tipo))
          .map((item) => {
            const area = normalizeHeader(getNumeroReporteMantenimiento(item));
            const dateKey = toDateKey(item.fecha);
            return `${area}::${dateKey}`;
          })
      );

      const parsedRows = [];
      rows.slice(headerIndex + 1).forEach((row) => {
        if (!Array.isArray(row)) return;
        const fechaRaw = row[idxFecha];
        const areaRaw = row[idxArea];
        if (!fechaRaw || !areaRaw) return;

        const range = parseCronogramaRange(fechaRaw, year);
        if (!range) return;

        const dispositivos = idxDispositivos >= 0 ? row[idxDispositivos] : "";
        parsedRows.push({
          area: String(areaRaw || "").trim(),
          dispositivos: String(dispositivos || "").trim(),
          rango: range,
          counts: {
            computo: idxComputo >= 0 ? parseCount(row[idxComputo]) : 0,
            rack: idxRack >= 0 ? parseCount(row[idxRack]) : 0,
            switch: idxSwitch >= 0 ? parseCount(row[idxSwitch]) : 0,
            impresoras: idxImpresoras >= 0 ? parseCount(row[idxImpresoras]) : 0,
            escaner: idxEscaner >= 0 ? parseCount(row[idxEscaner]) : 0,
            ergotrones: idxErgotrones >= 0 ? parseCount(row[idxErgotrones]) : 0
          }
        });
      });

      if (parsedRows.length === 0) {
        setImportError("No se encontraron filas válidas en el archivo.");
        setIsImporting(false);
        return;
      }

      const events = [];
      let duplicates = 0;
      parsedRows.forEach((row) => {
        const { start, end } = row.rango;
        const startKey = toDateKey(start);
        const endKey = toDateKey(end);
        const fechas = buildDateRange(start, end);
        const countsLabel = [
          `Cómputo ${row.counts.computo}`,
          `Rack ${row.counts.rack}`,
          `Switch ${row.counts.switch}`,
          `Impresoras ${row.counts.impresoras}`,
          `Escáner ${row.counts.escaner}`,
          `Ergotrones ${row.counts.ergotrones}`
        ].join(", ");

        const descripcion = [
          `Área: ${row.area}`,
          row.dispositivos ? `Dispositivos: ${row.dispositivos}` : null,
          `Cantidades: ${countsLabel}`,
          startKey && endKey ? `Rango: ${formatDateLabel(startKey)} al ${formatDateLabel(endKey)}` : null
        ]
          .filter(Boolean)
          .join(" | ");

        fechas.forEach((fecha) => {
          const dateKey = toDateKey(fecha);
          const key = `${normalizeHeader(row.area)}::${dateKey}`;
          if (existingKeys.has(key)) {
            duplicates += 1;
            return;
          }
          events.push({
            fecha: dateKey,
            area: row.area,
            descripcion,
            numeroReporte: row.area
          });
        });
      });

      if (events.length === 0) {
        setImportError("Todos los registros ya existen en el cronograma.");
        setIsImporting(false);
        return;
      }

      const confirmed = globalThis.confirm(
        `Se encontraron ${parsedRows.length} filas y se crearán ${events.length} eventos. ` +
          (duplicates
            ? `(${duplicates} duplicados omitidos). Puedes eliminarlos seleccionando días en el cronograma. `
            : "") +
          "¿Deseas continuar?"
      );
      if (!confirmed) {
        setIsImporting(false);
        return;
      }

      let created = 0;
      let failed = 0;
      for (const item of events) {
        try {
          await httpClient.post("/api/mantenimientos", {
            fecha: item.fecha,
            numeroReporte: item.numeroReporte,
            tipo: "Cronograma",
            estado: "Pendiente",
            activo_id: null,
            tecnico: "",
            tecnico_id: null,
            descripcion: item.descripcion
          });
          created += 1;
        } catch {
          failed += 1;
        }
      }

      if (created > 0) {
        setImportInfo(`Se agregaron ${created} eventos del cronograma.`);
        await loadData();
      }
      if (failed > 0) {
        setImportError(`No se pudieron agregar ${failed} eventos.`);
      }
    } catch (err) {
      setImportError(err?.message || "No se pudo importar el cronograma.");
    } finally {
      setIsImporting(false);
    }
  };

  const openDetail = (mantenimiento) => {
    if (!mantenimiento) return;
    setSelectedMantenimiento(mantenimiento);
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setSelectedMantenimiento(null);
  };

  const toggleSelectedDay = (dateKey) => {
    if (!dateKey) return;
    setSelectedDayKeys((prev) => {
      if (prev.includes(dateKey)) {
        return prev.filter((item) => item !== dateKey);
      }
      return [...prev, dateKey];
    });
    setSelectedDateKey(dateKey);
  };

  const clearSelectedDays = () => {
    setSelectedDayKeys([]);
  };

  const handleToggleSelecting = () => {
    setIsSelectingDays((prev) => {
      const next = !prev;
      if (!next) {
        clearSelectedDays();
      }
      return next;
    });
  };

  const handleEditSelected = () => {
    if (!selectedMantenimiento?.id || selectedMantenimiento?.isPeriodic) return;
    navigate(`/mantenimientos?openId=${encodeURIComponent(selectedMantenimiento.id)}`);
  };

  const detailRows = selectedMantenimiento
    ? [
        {
          label: "Fecha",
          value: formatDateLabel(selectedMantenimiento.fecha || "") || "-"
        },
        ...(isCronogramaTipo(selectedMantenimiento.tipo)
          ? [
              {
                label: "Rango",
                value: getCronogramaRangeLabel(selectedMantenimiento.descripcion) || "-"
              }
            ]
          : []),
        {
          label: "Estado",
          value: (
            <span className={`detail-status detail-status-${getEstadoClassForItem(selectedMantenimiento)}`}>
              {getEstadoLabelForItem(selectedMantenimiento)}
            </span>
          )
        },
        {
          label: "Tipo",
          value: selectedMantenimiento.tipo || "-"
        },
        {
          label: "Técnico",
          value: selectedMantenimiento.tecnico || "No asignado"
        },
        {
          label: "Planificación",
          value: getPlanificacionByEstado(selectedMantenimiento.estado)
        },
        {
          label: "Nro. reporte",
          value: getNumeroReporteMantenimiento(selectedMantenimiento) || "-"
        },
        {
          label: "Activo",
          value: getActivoLabel(selectedMantenimiento)
        },
        ...(selectedMantenimiento.isPeriodic
          ? [
              {
                label: "Periodicidad",
                value: `Cada ${PERIODIC_MONTHS} meses`
              }
            ]
          : [])
      ]
    : [];

  const canEditSelected = Boolean(
    canEdit && selectedMantenimiento?.id && !selectedMantenimiento?.isPeriodic
  );
  const editDisabledReason = !canEdit
    ? "No tienes permiso para editar mantenimientos."
    : selectedMantenimiento?.isPeriodic
      ? "Los sugeridos periódicos no se pueden editar."
        : !selectedMantenimiento?.id
          ? "Este registro no se puede editar."
          : "";

  const selectedDaySet = useMemo(() => new Set(selectedDayKeys), [selectedDayKeys]);
  const selectedCronogramaItems = useMemo(() => {
    if (selectedDayKeys.length === 0) return [];
    const daySet = new Set(selectedDayKeys);
    return (Array.isArray(filteredMantenimientos) ? filteredMantenimientos : [])
      .filter((item) => {
        if (!item?.id) return false;
        if (!isCronogramaTipo(item.tipo)) return false;
        if (item.isPeriodic) return false;
        const dateKey = toDateKey(item.fecha);
        return dateKey && daySet.has(dateKey);
      });
  }, [selectedDayKeys, filteredMantenimientos]);

  const handleBulkDelete = async () => {
    if (!canDelete) {
      setBulkError("No tienes permiso para eliminar mantenimientos.");
      return;
    }
    if (isBulkDeleting) return;
    if (selectedCronogramaItems.length === 0) {
      setBulkError("No hay eventos del cronograma para eliminar en los días seleccionados.");
      return;
    }

    const confirmed = globalThis.confirm(
      `¿Eliminar ${selectedCronogramaItems.length} eventos del cronograma en ${selectedDayKeys.length} día(s)?`
    );
    if (!confirmed) return;

    setBulkError("");
    setBulkInfo("");
    setIsBulkDeleting(true);

    let deleted = 0;
    let failed = 0;
    for (const item of selectedCronogramaItems) {
      try {
        await httpClient.delete(`/api/mantenimientos/${item.id}`);
        deleted += 1;
      } catch {
        failed += 1;
      }
    }

    if (deleted > 0) {
      setBulkInfo(`Se eliminaron ${deleted} eventos del cronograma.`);
      await loadData();
    }
    if (failed > 0) {
      setBulkError(`No se pudieron eliminar ${failed} eventos.`);
    }
    setIsBulkDeleting(false);
    setIsSelectingDays(false);
    clearSelectedDays();
  };

  if (isLoading) {
    return (
      <div className="cronograma-page">
        <div className="loading">Cargando cronograma...</div>
      </div>
    );
  }

  return (
    <div className="cronograma-page">
      <div className="cronograma-header">
        <div>
          <h1>Cronograma de Mantenimientos</h1>
          <p>Visualiza las actividades programadas por día y por mes.</p>
        </div>
        <div className="cronograma-header-actions">
          <button
            type="button"
            className="btn-action"
            onClick={() => cronogramaFileRef.current?.click()}
            disabled={!canCreate || isImporting}
          >
            {isImporting ? "Importando..." : "Importar cronograma"}
          </button>
          <button type="button" className="btn-submit cronograma-primary" onClick={() => navigate("/mantenimientos")}>
            Ir a Mantenimientos
          </button>
          <input
            ref={cronogramaFileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleCronogramaFile}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}


      <div className="cronograma-summary">
        <article className="summary-total">
          <h3>{monthSummary.total}</h3>
          <p>Actividades del mes</p>
        </article>
        <article className="summary-pendiente">
          <h3>{monthSummary.pendiente}</h3>
          <p>Pendientes</p>
        </article>
        <article className="summary-proceso">
          <h3>{monthSummary.enProceso}</h3>
          <p>En proceso</p>
        </article>
        <article className="summary-finalizado">
          <h3>{monthSummary.finalizado}</h3>
          <p>Finalizados</p>
        </article>
      </div>

      <div className="cronograma-filters">
        <input
          className="search-input"
          type="text"
          placeholder="Buscar por activo, técnico o descripción..."
          value={filters.texto}
          onChange={(event) => setFilters((prev) => ({ ...prev, texto: event.target.value }))}
        />
        <select
          value={filters.tipo}
          onChange={(event) => setFilters((prev) => ({ ...prev, tipo: event.target.value }))}
        >
          <option value="">Todos los tipos</option>
          <option value="Preventivo">Preventivo</option>
          <option value="Correctivo">Correctivo</option>
          <option value="Predictivo">Predictivo</option>
          <option value="Calibracion">Calibración</option>
          <option value="Cronograma">Cronograma</option>
        </select>
        <select
          value={filters.estado}
          onChange={(event) => setFilters((prev) => ({ ...prev, estado: event.target.value }))}
        >
          <option value="">Todos los estados</option>
          <option value="En proceso">En proceso</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Programado">Programado</option>
          <option value="Finalizado">Finalizado</option>
        </select>
      </div>

      {(periodicError || periodicInfo || importError || importInfo || bulkError || bulkInfo) && (
        <div className="cronograma-alerts">
          {periodicError && <div className="alert alert-error">{periodicError}</div>}
          {periodicInfo && <div className="alert alert-success">{periodicInfo}</div>}
          {importError && <div className="alert alert-error">{importError}</div>}
          {importInfo && <div className="alert alert-success">{importInfo}</div>}
          {bulkError && <div className="alert alert-error">{bulkError}</div>}
          {bulkInfo && <div className="alert alert-success">{bulkInfo}</div>}
        </div>
      )}

      <section className="cronograma-bulk">
        <div className="bulk-left">
          <button type="button" className="btn-action" onClick={handleToggleSelecting}>
            {isSelectingDays ? "Finalizar selección" : "Seleccionar días"}
          </button>
          {isSelectingDays && (
            <button
              type="button"
              className="btn-action"
              onClick={clearSelectedDays}
              disabled={selectedDayKeys.length === 0}
            >
              Limpiar selección
            </button>
          )}
        </div>
        <div className="bulk-right">
          <span className="bulk-count">Días seleccionados: {selectedDayKeys.length}</span>
          <span className="bulk-count">Eventos: {selectedCronogramaItems.length}</span>
          <button
            type="button"
            className="btn-action cronograma-bulk-delete"
            onClick={handleBulkDelete}
            disabled={!canDelete || isBulkDeleting || selectedCronogramaItems.length === 0}
            title={canDelete ? "Eliminar eventos del cronograma" : "No tienes permiso para eliminar"}
          >
            {isBulkDeleting ? "Eliminando..." : "Eliminar días"}
          </button>
          <small className="bulk-hint">Solo eventos tipo Cronograma.</small>
        </div>
      </section>

      <section className="cronograma-periodic">
        <div className="periodic-copy">
          <h3>Programación periódica (cada 6 meses)</h3>
          <p>Se calcula con el último mantenimiento preventivo de cada activo.</p>
          <div className="periodic-metrics">
            <span className="periodic-pill">Sugeridos: {periodicSummary.total}</span>
            <span className="periodic-pill">Mes actual: {periodicSummary.dueThisMonth}</span>
            <span className="periodic-pill">Vencidos: {periodicSummary.overdue}</span>
          </div>
        </div>
        <div className="periodic-actions">
          <label className="periodic-toggle">
            <input
              type="checkbox"
              checked={showPeriodic}
              onChange={(event) => setShowPeriodic(event.target.checked)}
            />
            Mostrar sugeridos
          </label>
          <button
            type="button"
            className="btn-action"
            onClick={handleCreatePeriodicPendings}
            disabled={!canCreate || isGeneratingPeriodic || periodicSummary.total === 0}
          >
            {isGeneratingPeriodic ? "Agregando..." : "Agregar pendientes"}
          </button>
        </div>
      </section>

      <section className="calendar-panel">
        <div className="calendar-toolbar">
          <div className="toolbar-left">
            <button type="button" className="btn-action" onClick={goToPreviousMonth}>Anterior</button>
            <button type="button" className="btn-action" onClick={goToCurrentMonth}>Hoy</button>
            <button type="button" className="btn-action" onClick={goToNextMonth}>Siguiente</button>
          </div>
          <h2>{MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h2>
        </div>

        <div className="calendar-grid calendar-weekdays">
          {WEEK_DAYS.map((day) => (
            <div key={day} className="weekday-cell">{day}</div>
          ))}
        </div>

        <div className="calendar-grid calendar-days">
          {calendarCells.map((cellDate, index) => {
            if (!cellDate) {
              return <div key={`empty-${index}`} className="day-cell empty"></div>;
            }

            const dateKey = toDateKey(cellDate);
            const events = eventsByDate[dateKey] || [];
            const isToday = isSameDate(cellDate, new Date());
            const isSelected = dateKey === selectedDateKey;
            const isMultiSelected = selectedDaySet.has(dateKey);

            return (
              <button
                key={dateKey}
                type="button"
                className={`day-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${isMultiSelected ? "multi-selected" : ""}`}
                onClick={() => {
                  if (isSelectingDays) {
                    toggleSelectedDay(dateKey);
                    return;
                  }
                  setSelectedDateKey(dateKey);
                }}
              >
                <span className="day-number">{cellDate.getDate()}</span>
                <div className="day-events">
                  {events.slice(0, 2).map((eventItem) => (
                    <span
                      key={eventItem.id}
                      className={`event-chip event-chip-${getEstadoClassForItem(eventItem)}`}
                    >
                      {getActivoLabel(eventItem)} - {getEstadoLabelForItem(eventItem)}
                    </span>
                  ))}
                  {events.length > 2 && <span className="event-chip more">+{events.length - 2} más</span>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="cronograma-reminders">
        <h2>Recordatorios próximos (7 días)</h2>
        {reminderError && <div className="alert alert-error">{reminderError}</div>}
        {upcomingTasks.length === 0 ? (
          <p className="no-data">No hay mantenimientos próximos para recordar.</p>
        ) : (
          <div className="reminder-list">
            {upcomingTasks.map((item) => (
              <article key={`rem-${item.id}`} className="reminder-card">
                <div>
                  <strong>{getActivoLabel(item)}</strong>
                  <small>{item.tipo || "Mantenimiento"} - {item.fecha || "-"}</small>
                </div>
                <button
                  type="button"
                  className="btn-action"
                  onClick={() => handleSendReminder(item.id)}
                  disabled={sendingReminderId === item.id}
                >
                  {sendingReminderId === item.id ? "Enviando..." : "Enviar recordatorio"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="selected-day-panel">
        <h2>Detalle del {selectedDateKey ? formatDateLabel(selectedDateKey) : "día seleccionado"}</h2>
        {selectedEvents.length === 0 ? (
          <p className="no-data">No hay mantenimientos para la fecha seleccionada.</p>
        ) : (
          <div className="selected-list">
            {selectedEvents.map((eventItem) => (
              <article
                key={eventItem.id}
                className={`selected-item selected-item-${getEstadoClassForItem(eventItem)}`}
                role="button"
                tabIndex={0}
                onClick={() => openDetail(eventItem)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDetail(eventItem);
                  }
                }}
                aria-label={`Ver detalle del mantenimiento ${eventItem.id || ""}`}
              >
                <header>
                  <strong>{getActivoLabel(eventItem)}</strong>
                  <span className="event-badges">
                    {eventItem.isPeriodic && <span className="event-periodic-badge">Periódico</span>}
                    <span className={`event-status-badge event-status-${getEstadoClassForItem(eventItem)}`}>
                      {getEstadoLabelForItem(eventItem)}
                    </span>
                  </span>
                </header>
                {isCronogramaTipo(eventItem.tipo) ? (
                  <div className="cronograma-item-summary">
                    {getCronogramaRangeLabel(eventItem.descripcion) && (
                      <span className="cronograma-range-pill">
                        {getCronogramaRangeLabel(eventItem.descripcion)}
                      </span>
                    )}
                    <p>{getCronogramaShortDescription(eventItem.descripcion) || "Sin descripción"}</p>
                  </div>
                ) : (
                  <p>{eventItem.descripcion || "Sin descripción"}</p>
                )}
                <footer>
                  <span>Técnico: {eventItem.tecnico || "No asignado"}</span>
                  <span>Tipo: {eventItem.tipo || "-"}</span>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      {isDetailOpen && selectedMantenimiento && (
        <div
          className="cronograma-detail-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cronograma-detail-title"
          onClick={closeDetail}
        >
          <div className="cronograma-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cronograma-detail-header">
              <div>
                <h2 id="cronograma-detail-title">
                  Detalle de mantenimiento #{selectedMantenimiento.id ?? "-"}
                </h2>
                <p>{getActivoLabel(selectedMantenimiento)}</p>
              </div>
              <div className="cronograma-detail-actions">
                <button
                  type="button"
                  className="btn-action cronograma-detail-edit"
                  onClick={handleEditSelected}
                  disabled={!canEditSelected}
                  title={editDisabledReason || "Modificar mantenimiento"}
                >
                  Modificar
                </button>
                <button type="button" className="btn-action cronograma-detail-close" onClick={closeDetail}>
                  Cerrar
                </button>
              </div>
            </div>

            <div className="cronograma-detail-body">
              <div className="cronograma-detail-table-wrap">
                <table className="cronograma-detail-table">
                  <tbody>
                    {detailRows.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="cronograma-detail-section-title">Descripción</h3>
              <div className="cronograma-detail-notes">
                <p>{selectedMantenimiento.descripcion || "Sin descripción"}</p>
              </div>
              <h3 className="cronograma-detail-section-title">Cambio de partes</h3>
              <div className="cronograma-detail-notes">
                <p>{selectedMantenimiento.cambio_partes || selectedMantenimiento.cambioPartes || "Sin registro"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


