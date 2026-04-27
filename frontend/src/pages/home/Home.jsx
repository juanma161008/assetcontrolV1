import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import "../../styles/Home.css";
import httpClient from "../../services/httpClient";
import { getCurrentUser, isAuthenticated } from "../../services/authService";
import logoAsset from "../../assets/logos/logo-assetcontrol.png";
import { calculateAssetKpis, calculateLifecycle } from "../../utils/assetLifecycle";
import { hasPermission } from "../../utils/permissions";
import useAnimatedPresence from "../../hooks/useAnimatedPresence";

const DEFAULT_STATS = {
  total: 0,
  disponibles: 0,
  mantenimiento: 0,
  fueraServicio: 0,
  mantenimientosTotal: 0,
  mantenimientosPendientes: 0,
  mantenimientosEnProceso: 0,
  mantenimientosFinalizados: 0
};

const normalizeState = (estado = "") => String(estado || "").toLowerCase().trim();
const normalizeSearchValue = (value = "") =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const PUNTO_RED_ALIASES = new Set([
  "punto de red",
  "punto red",
  "preventivo punto de red",
  "instalacion punto de red",
  "instalación punto de red"
].map((item) => normalizeSearchValue(item)));
const isPuntoRedTipo = (value = "") => PUNTO_RED_ALIASES.has(normalizeSearchValue(value));
const isCronogramaTipo = (value = "") => normalizeSearchValue(value) === "cronograma";
const isOperationalMaintenance = (mantenimiento = {}) => !isCronogramaTipo(mantenimiento?.tipo);
const getMantenimientoEstadoLabel = (mantenimiento = {}) => (
  isCronogramaTipo(mantenimiento?.tipo)
    ? "Programado"
    : String(mantenimiento?.estado || "Pendiente")
);
const getMantenimientoEstadoNormalized = (mantenimiento = {}) =>
  normalizeState(getMantenimientoEstadoLabel(mantenimiento));
const formatTipoMantenimiento = (value = "") => {
  const source = String(value || "").trim();
  if (!source) return "";
  if (isPuntoRedTipo(source)) return "Punto de Red";
  const normalized = normalizeSearchValue(source);
  if (normalized === "calibracion") return "Calibración";
  if (normalized === "preventivo") return "Preventivo";
  if (normalized === "correctivo") return "Correctivo";
  if (normalized === "predictivo") return "Predictivo";
  return source;
};
const WEEK_DAYS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const DEFAULT_CHECKLIST = [
  { key: "diagnostico", label: "Diagnostico", done: false },
  { key: "repuestos", label: "Repuestos", done: false },
  { key: "pruebas", label: "Pruebas", done: false },
  { key: "cierre", label: "Cierre", done: false }
];

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateKey = (value) => {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeChecklist = (value) => {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          key: String(item.key || "").trim(),
          label: item.label || "",
          done: Boolean(item.done)
        }));
      }
    } catch {
      // ignore
    }
  }
  if (Array.isArray(value) && value.length) {
    return value.map((item) => ({
      key: String(item.key || "").trim(),
      label: item.label || "",
      done: Boolean(item.done)
    }));
  }
  return DEFAULT_CHECKLIST.map((item) => ({ ...item }));
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

const getAssetMeta = (item = {}) => (
  [item.activo || "Sin codigo", item.areaPrincipal || "Sin area", item.serial || item.marca || ""]
    .filter(Boolean)
    .join(" | ")
);

const formatWeeklyDate = (date) => {
  const safeDate = parseDate(date);
  if (!safeDate) return "-";
  const day = WEEK_DAYS[safeDate.getDay()] || "";
  const number = String(safeDate.getDate()).padStart(2, "0");
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  return `${day} ${number}/${month}/${safeDate.getFullYear()}`;
};

export default function Home({ selectedEntidadId, selectedEntidadNombre }) {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isAdmin = hasPermission(currentUser, "ADMIN_TOTAL");
  const entidadActivaId = String(selectedEntidadId ?? "").trim();
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [dashboardActivos, setDashboardActivos] = useState([]);
  const [dashboardMantenimientos, setDashboardMantenimientos] = useState([]);
  const [weeklyPending, setWeeklyPending] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboardMode, setDashboardMode] = useState("compact");
  const [focusMetric, setFocusMetric] = useState("activos-total");
  const [weeklyFilter, setWeeklyFilter] = useState("pendiente");
  const assetModalPresence = useAnimatedPresence(showAssetModal, 220, () => {
    setSelectedAssetId(null);
  });

  useEffect(() => {
    const body = globalThis?.document?.body;
    if (!body) return undefined;

    if (assetModalPresence.isMounted) {
      body.classList.add("modal-open");
    } else {
      body.classList.remove("modal-open");
    }

    return () => {
      body.classList.remove("modal-open");
    };
  }, [assetModalPresence.isMounted]);

  const formatActivoIdLabel = useCallback((activoId, fallback = "Activo") => {
    const parsed = Number(activoId);
    if (Number.isFinite(parsed) && parsed > 0) {
      return isAdmin ? `Activo #${parsed}` : fallback;
    }
    return fallback;
  }, [isAdmin]);

  const getAssetDisplayName = useCallback((item = {}) => (
    item.nombre || item.equipo || item.activo || formatActivoIdLabel(item.id, "Activo")
  ), [formatActivoIdLabel]);

  const getWeeklyPending = useCallback((activos, mantenimientos) => {
    const sourceActivos = Array.isArray(activos) ? activos : [];
    const sourceMantenimientos = (Array.isArray(mantenimientos) ? mantenimientos : []).filter(
      (item) => isOperationalMaintenance(item)
    );
    const activosById = new Map(sourceActivos.map((activo) => [Number(activo.id), activo]));
    const { start, end } = getCurrentWeekRange();

    return sourceMantenimientos
      .map((item) => {
        const fecha = parseDate(item.fecha);
        return { item, fecha };
      })
      .filter(({ fecha }) => {
        if (!fecha) return false;
        return fecha >= start && fecha <= end;
      })
      .sort((a, b) => {
        const statusOrder = {
          pendiente: 0,
          programado: 1,
          "en proceso": 2,
          finalizado: 3
        };

        const byDate = a.fecha - b.fecha;
        if (byDate !== 0) return byDate;

        return (
          (statusOrder[getMantenimientoEstadoNormalized(a.item)] ?? 9) -
          (statusOrder[getMantenimientoEstadoNormalized(b.item)] ?? 9)
        );
      })
      .slice(0, 12)
      .map(({ item, fecha }) => {
        const activoId = Number(item.activo_id);
        const activoMatch = activosById.get(activoId);
        const activoNombre =
          item.activo_nombre ||
          item.activo_equipo ||
          item.activo ||
          activoMatch?.nombre ||
          activoMatch?.equipo ||
          formatActivoIdLabel(activoId, "Sin activo");

        const estado = getMantenimientoEstadoLabel(item);

        return {
          id: item.id ?? `wk-${item.fecha || "sin-fecha"}-${item.activo_id || "sin-activo"}-${item.tipo || "sin-tipo"}`,
          tipo: formatTipoMantenimiento(item.tipo) || "Mantenimiento",
          estado,
          estadoClass: `estado-${normalizeState(estado).replace(/\s+/g, "-")}`,
          fechaLabel: formatWeeklyDate(fecha),
          activo: String(activoNombre),
          tecnico: String(item.tecnico || "Sin tecnico asignado")
        };
      });
  }, [formatActivoIdLabel]);

  const getEstadoGeneral = () => {
    if (stats.mantenimiento === 0) {
      return { text: "Excelente", class: "excelente" };
    }
    if (stats.mantenimiento < 3) {
      return { text: "Bueno", class: "bueno" };
    }
    return { text: "Critico", class: "critico" };
  };

  const cargarDatos = useCallback(async () => {
    if (!isAuthenticated()) {
      throw new Error("Sesion no autenticada");
    }

    try {
      const activosResponse = await httpClient.get("/api/activos");
      const activos = activosResponse.data.data || activosResponse.data || [];

      let mantenimientos = [];
      try {
        const mantenimientosResponse = await httpClient.get("/api/mantenimientos");
        mantenimientos = mantenimientosResponse.data.data || mantenimientosResponse.data || [];
      } catch (mantenimientosError) {
        if (mantenimientosError.response.status === 401) {
          throw new Error("Sesion expirada. Por favor, inicia sesion nuevamente.");
        }
        if (mantenimientosError.response.status !== 403) {
          throw mantenimientosError;
        }
      }

      return { activos, mantenimientos };
    } catch (loadError) {
      if (loadError.response.status === 401) {
        throw new Error("Sesion expirada. Por favor, inicia sesion nuevamente.");
      }
      throw new Error("Error al cargar datos del servidor");
    }
  }, []);

  const filtrarDatosPorEntidad = useCallback((activos, mantenimientos) => {
    const sourceActivos = Array.isArray(activos) ? activos : [];
    const sourceMantenimientos = Array.isArray(mantenimientos) ? mantenimientos : [];

    if (!entidadActivaId) {
      return { activos: sourceActivos, mantenimientos: sourceMantenimientos };
    }

    const activosFiltrados = sourceActivos.filter(
      (activo) => String(activo.entidad_id || "") === entidadActivaId
    );
    const activosIds = new Set(
      activosFiltrados
        .map((activo) => Number(activo.id))
        .filter((id) => Number.isInteger(id) && id > 0)
    );

    const mantenimientosFiltrados = sourceMantenimientos.filter((mantenimiento) => {
      const entidadMantenimiento = String(mantenimiento.entidad_id || "").trim();
      if (entidadMantenimiento) {
        return entidadMantenimiento === entidadActivaId;
      }
      const activoId = Number(mantenimiento.activo_id);
      if (Number.isInteger(activoId) && activosIds.has(activoId)) {
        return true;
      }
      return isPuntoRedTipo(mantenimiento.tipo);
    });

    return { activos: activosFiltrados, mantenimientos: mantenimientosFiltrados };
  }, [entidadActivaId]);

  const calcularEstadisticas = useCallback((activos, mantenimientos) => {
    const sourceActivos = Array.isArray(activos) ? activos : [];
    const sourceMantenimientos = Array.isArray(mantenimientos) ? mantenimientos : [];

    const disponibles = sourceActivos.filter(
      (activo) => String(activo.estado || "").toLowerCase() === "disponible"
    ).length;

    const enMantenimiento = sourceActivos.filter(
      (activo) => String(activo.estado || "").toLowerCase() === "mantenimiento"
    ).length;

    const fueraServicio = sourceActivos.filter(
      (activo) => String(activo.estado || "").toLowerCase() === "fuera de servicio"
    ).length;

    const mantenimientosPendientes = sourceMantenimientos.filter(
      (mantenimiento) => getMantenimientoEstadoNormalized(mantenimiento) === "pendiente"
    ).length;

    const mantenimientosEnProceso = sourceMantenimientos.filter(
      (mantenimiento) => getMantenimientoEstadoNormalized(mantenimiento) === "en proceso"
    ).length;

    const mantenimientosFinalizados = sourceMantenimientos.filter(
      (mantenimiento) => getMantenimientoEstadoNormalized(mantenimiento) === "finalizado"
    ).length;

    return {
      total: sourceActivos.length,
      disponibles,
      mantenimiento: enMantenimiento,
      fueraServicio,
      mantenimientosTotal: sourceMantenimientos.length,
      mantenimientosPendientes,
      mantenimientosEnProceso,
      mantenimientosFinalizados
    };
  }, []);

  const cargarEstadisticas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const { activos, mantenimientos } = await cargarDatos();
      const filtrados = filtrarDatosPorEntidad(activos, mantenimientos);
      const mantenimientosOperativos = (Array.isArray(filtrados.mantenimientos) ? filtrados.mantenimientos : []).filter(
        (item) => isOperationalMaintenance(item)
      );
      const estadisticas = calcularEstadisticas(filtrados.activos, mantenimientosOperativos);
      const pendientesSemana = getWeeklyPending(filtrados.activos, mantenimientosOperativos);

      setStats(estadisticas);
      setDashboardActivos(filtrados.activos);
      setDashboardMantenimientos(mantenimientosOperativos);
      setWeeklyPending(pendientesSemana);
    } catch (err) {
      setError(err.message || "Error al cargar estadisticas");
      setStats(DEFAULT_STATS);
      setDashboardActivos([]);
      setDashboardMantenimientos([]);
      setWeeklyPending([]);
    } finally {
      setIsLoading(false);
    }
  }, [cargarDatos, calcularEstadisticas, filtrarDatosPorEntidad, getWeeklyPending]);

  useEffect(() => {
    cargarEstadisticas();
  }, [cargarEstadisticas]);

  const weeklyHeader = useMemo(() => {
    const { start, end } = getCurrentWeekRange();
    return `${formatWeeklyDate(start)} - ${formatWeeklyDate(end)}`;
  }, []);

  const kpiCards = useMemo(() => {
    return [
      {
        key: "activos-total",
        title: "Total Activos",
        value: stats.total,
        description: "Equipos registrados",
        tone: "info"
      },
      {
        key: "activos-disponibles",
        title: "Disponibles",
        value: stats.disponibles,
        description: "Listos para operacion",
        tone: "success"
      },
      {
        key: "activos-mantenimiento",
        title: "En Mantenimiento",
        value: stats.mantenimiento,
        description: "En intervencion tecnica",
        tone: "warning"
      },
      {
        key: "activos-fuera-servicio",
        title: "Fuera de Servicio",
        value: stats.fueraServicio,
        description: "Equipos no operativos",
        tone: "danger"
      },
      {
        key: "mnt-total",
        title: "Total Mantenimientos",
        value: stats.mantenimientosTotal,
        description: "Registros del periodo",
        tone: "info"
      },
      {
        key: "mnt-pendientes",
        title: "Pendientes",
        value: stats.mantenimientosPendientes,
        description: "Por iniciar",
        tone: "pending-light"
      },
      {
        key: "mnt-proceso",
        title: "En Proceso",
        value: stats.mantenimientosEnProceso,
        description: "Trabajos activos",
        tone: "inprogress"
      },
      {
        key: "mnt-finalizados",
        title: "Finalizados",
        value: stats.mantenimientosFinalizados,
        description: "Cerrados correctamente",
        tone: "success"
      }
    ];
  }, [stats]);

  const focusCard = useMemo(() => {
    return kpiCards.find((card) => card.key === focusMetric) || kpiCards[0];
  }, [kpiCards, focusMetric]);

  const weeklyCounters = useMemo(() => {
    return {
      all: weeklyPending.length,
      pendiente: weeklyPending.filter((item) => normalizeState(item.estado) === "pendiente").length,
      programado: weeklyPending.filter((item) => normalizeState(item.estado) === "programado").length,
      "en proceso": weeklyPending.filter((item) => normalizeState(item.estado) === "en proceso").length,
      finalizado: weeklyPending.filter((item) => normalizeState(item.estado) === "finalizado").length
    };
  }, [weeklyPending]);

  const weeklyFiltered = useMemo(() => {
    if (weeklyFilter === "all") return weeklyPending;
    return weeklyPending.filter((item) => normalizeState(item.estado) === weeklyFilter);
  }, [weeklyPending, weeklyFilter]);

  const backlogCount = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return (Array.isArray(dashboardMantenimientos) ? dashboardMantenimientos : []).filter((item) => {
      const estado = getMantenimientoEstadoNormalized(item);
      if (estado === "finalizado") return false;
      const fechaKey = toDateKey(item.fecha);
      return Boolean(fechaKey && fechaKey < todayKey);
    }).length;
  }, [dashboardMantenimientos]);

  const slaCumplimiento = useMemo(() => {
    const pending = (Array.isArray(dashboardMantenimientos) ? dashboardMantenimientos : []).filter(
      (item) => getMantenimientoEstadoNormalized(item) !== "finalizado"
    );
    if (!pending.length) return 100;
    const overdue = pending.filter((item) => {
      const fechaKey = toDateKey(item.fecha);
      return fechaKey && fechaKey < toDateKey(new Date());
    }).length;
    return Math.max(0, Math.round(((pending.length - overdue) / pending.length) * 100));
  }, [dashboardMantenimientos]);

  const disponibilidadPct = useMemo(() => {
    if (stats.total === 0) return 0;
    return (stats.disponibles / stats.total) * 100;
  }, [stats.disponibles, stats.total]);

  const problemasTotal = useMemo(() => {
    return stats.mantenimiento;
  }, [stats.mantenimiento]);

  const cierreMantenimientoPct = useMemo(() => {
    if (stats.mantenimientosTotal === 0) return 0;
    return (stats.mantenimientosFinalizados / stats.mantenimientosTotal) * 100;
  }, [stats.mantenimientosFinalizados, stats.mantenimientosTotal]);

  const estadoGeneral = getEstadoGeneral();

  const activosPorEstado = useMemo(() => {
    const source = Array.isArray(dashboardActivos) ? dashboardActivos : [];
    return {
      disponibles: source.filter((item) => normalizeState(item.estado) === "disponible"),
      mantenimiento: source.filter((item) => normalizeState(item.estado) === "mantenimiento"),
      fueraServicio: source.filter((item) => normalizeState(item.estado) === "fuera de servicio")
    };
  }, [dashboardActivos]);

  const maintenanceByAsset = useMemo(() => {
    const map = new Map();
    (Array.isArray(dashboardMantenimientos) ? dashboardMantenimientos : []).forEach((item) => {
      const assetId = Number(item.activo_id);
      if (!Number.isFinite(assetId)) {
        return;
      }
      if (!map.has(assetId)) {
        map.set(assetId, []);
      }
      map.get(assetId).push(item);
    });
    return map;
  }, [dashboardMantenimientos]);

  const globalKpis = useMemo(() => {
    return calculateAssetKpis(dashboardMantenimientos);
  }, [dashboardMantenimientos]);

  const isoCompliance = useMemo(() => {
    const assets = Array.isArray(dashboardActivos) ? dashboardActivos : [];
    if (!assets.length) return null;
    const values = assets
      .map((asset) => {
        const historial = maintenanceByAsset.get(Number(asset.id)) || [];
        return calculateLifecycle(asset, historial).cumplimiento;
      })
      .filter((value) => Number.isFinite(value));

    if (!values.length) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [dashboardActivos, maintenanceByAsset]);

  const reliabilityCards = useMemo(() => {
    const formatValue = (value, suffix = "") => {
      if (value === null || value === undefined || Number.isNaN(value)) {
        return "-";
      }
      return `${value}${suffix}`;
    };

    return [
      {
        key: "mtbf",
        label: "MTBF",
        value: formatValue(globalKpis.mtbf, " d"),
        description: "Tiempo medio entre fallas"
      },
      {
        key: "mttr",
        label: "MTTR",
        value: formatValue(globalKpis.mttr, " h"),
        description: "Tiempo medio de reparación"
      },
      {
        key: "oee",
        label: "OEE",
        value: formatValue(globalKpis.oee, "%"),
        description: "Eficiencia global del equipo"
      },
      {
        key: "sla",
        label: "SLA",
        value: formatValue(slaCumplimiento, "%"),
        description: "Cumplimiento de plazo"
      },
      {
        key: "backlog",
        label: "Backlog",
        value: formatValue(backlogCount, ""),
        description: "Pendientes vencidos"
      },
      {
        key: "iso",
        label: "ISO 55000",
        value: formatValue(isoCompliance, "%"),
        description: "Cumplimiento automático"
      }
    ];
  }, [globalKpis, isoCompliance, slaCumplimiento, backlogCount]);

  const todayTasks = useMemo(() => {
    const userId = Number(currentUser?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return [];
    }
    const todayKey = toDateKey(new Date());
    return (Array.isArray(dashboardMantenimientos) ? dashboardMantenimientos : [])
      .filter((item) => Number(item.tecnico_id) === userId)
      .filter((item) => toDateKey(item.fecha) === todayKey)
      .map((item) => ({
        ...item,
        checklist: normalizeChecklist(item.checklist)
      }));
  }, [dashboardMantenimientos, currentUser]);

  const handleToggleChecklist = async (mantenimientoId, itemKey) => {
    if (!mantenimientoId || !itemKey) return;

    let updatedChecklist = [];
    setDashboardMantenimientos((prev) =>
      prev.map((item) => {
        if (Number(item.id) !== Number(mantenimientoId)) return item;
        const currentChecklist = normalizeChecklist(item.checklist);
        updatedChecklist = currentChecklist.map((entry) =>
          entry.key === itemKey ? { ...entry, done: !entry.done } : entry
        );
        return { ...item, checklist: updatedChecklist };
      })
    );

    try {
      await httpClient.put(`/api/mantenimientos/${mantenimientoId}`, {
        checklist: updatedChecklist
      });
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo actualizar la lista de tareas.");
    }
  };

  const focusItems = useMemo(() => {
    const buildActivoItem = (item) => ({
      id: `activo-${item.id}`,
      assetId: Number(item.id) || null,
      title: getAssetDisplayName(item),
      subtitle: getAssetMeta(item),
      detail: item.estado || "Sin estado",
      tone: normalizeState(item.estado).replace(/\s+/g, "-") || "info"
    });
    const buildMantenimientoItem = (item) => ({
      id: `mnt-${item.id}`,
      assetId: Number(item.activo_id) || null,
      title:
        item.activo_nombre ||
        item.activo_equipo ||
        item.activo ||
        formatActivoIdLabel(item.activo_id, "Activo"),
      subtitle: [formatTipoMantenimiento(item.tipo) || "Mantenimiento", item.tecnico || "Sin tecnico", formatWeeklyDate(item.fecha)]
        .filter(Boolean)
        .join(" | "),
      detail: item.cambio_partes || item.descripcion || "Sin cambio de partes registrado",
      tone: getMantenimientoEstadoNormalized(item).replace(/\s+/g, "-") || "info"
    });

    switch (focusMetric) {
      case "activos-disponibles":
        return activosPorEstado.disponibles.slice(0, 8).map(buildActivoItem);
      case "activos-mantenimiento":
        return activosPorEstado.mantenimiento.slice(0, 8).map(buildActivoItem);
      case "activos-fuera-servicio":
        return activosPorEstado.fueraServicio.slice(0, 8).map(buildActivoItem);
      case "mnt-pendientes":
        return dashboardMantenimientos
          .filter((item) => getMantenimientoEstadoNormalized(item) === "pendiente")
          .slice(0, 8)
          .map(buildMantenimientoItem);
      case "mnt-proceso":
        return dashboardMantenimientos
          .filter((item) => getMantenimientoEstadoNormalized(item) === "en proceso")
          .slice(0, 8)
          .map(buildMantenimientoItem);
      case "mnt-finalizados":
        return dashboardMantenimientos
          .filter((item) => getMantenimientoEstadoNormalized(item) === "finalizado")
          .slice(0, 8)
          .map(buildMantenimientoItem);
      default:
        return dashboardActivos.slice(0, 8).map(buildActivoItem);
    }
  }, [
    activosPorEstado,
    dashboardActivos,
    dashboardMantenimientos,
    focusMetric,
    formatActivoIdLabel,
    getAssetDisplayName
  ]);

  const equiposCriticos = useMemo(() => {
    return [...activosPorEstado.mantenimiento]
      .slice(0, 6)
      .map((item) => ({
        id: item.id,
        assetId: Number(item.id) || null,
        nombre: getAssetDisplayName(item),
        meta: getAssetMeta(item),
        estado: item.estado || "-"
      }));
  }, [activosPorEstado, getAssetDisplayName]);

  const selectedDashboardAsset = useMemo(() => {
    if (!selectedAssetId) return null;
    return dashboardActivos.find((item) => Number(item.id) === Number(selectedAssetId)) || null;
  }, [dashboardActivos, selectedAssetId]);

  const selectedAssetHistory = useMemo(() => {
    if (!selectedDashboardAsset?.id) return [];
    return dashboardMantenimientos
      .filter((item) => Number(item.activo_id) === Number(selectedDashboardAsset.id))
      .sort((a, b) => {
        const timestampA = parseDate(a.fecha)?.getTime() || 0;
        const timestampB = parseDate(b.fecha)?.getTime() || 0;
        return timestampB - timestampA;
      })
      .slice(0, 3);
  }, [dashboardMantenimientos, selectedDashboardAsset]);

  const selectedAssetLastMaintenance = selectedAssetHistory[0] || null;

  useEffect(() => {
    const fallbackAsset =
      activosPorEstado.fueraServicio[0] ||
      activosPorEstado.mantenimiento[0] ||
      dashboardActivos[0] ||
      null;

    setSelectedAssetId((prev) => {
      if (prev && dashboardActivos.some((item) => Number(item.id) === Number(prev))) {
        return prev;
      }
      return fallbackAsset ? Number(fallbackAsset.id) : null;
    });
  }, [activosPorEstado, dashboardActivos]);

  const selectedAssetStatusTone = useMemo(() => {
    if (!selectedDashboardAsset?.estado) return "info";
    const normalized = normalizeState(selectedDashboardAsset.estado).replace(/\s+/g, "-");
    return normalized || "info";
  }, [selectedDashboardAsset]);

  const openAssetModal = useCallback((assetId) => {
    if (!assetId) return;
    setSelectedAssetId(assetId);
    setShowAssetModal(true);
  }, []);

  const closeAssetModal = useCallback(() => {
    setShowAssetModal(false);
  }, []);


  return (
    <div className="home-container">
      <div className="home-welcome">
        <div className="welcome-logo">
          <img src={logoAsset} alt="AssetControl" className="home-logo" />
        </div>
        <p>
          Plataforma para la <strong>gestion de activos tecnologicos</strong> y el
          <strong> control de mantenimientos</strong>. Aqui puedes visualizar el estado de los equipos,
          seguir mantenimientos y tener la informacion centralizada.
        </p>
      </div>

      <div className="dashboard-section">
        <h2 className="home-title">Dashboard de Activos</h2>
        {entidadActivaId && (
          <p className="home-entity-scope">
            Vista filtrada por entidad: <strong>{selectedEntidadNombre || `Entidad #${entidadActivaId}`}</strong>
          </p>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {isLoading ? (
          <div className="loading-message">
            <div className="spinner"></div>
            <p>Cargando estadisticas...</p>
          </div>
        ) : (
          <div className={`dashboard-grid dashboard-layout mode-${dashboardMode}`}>
            <section className="dashboard-main">
              <div className="dashboard-toolbar">
                <div className="dashboard-toolbar-copy">
                  <h3>Vista Operativa</h3>
                  <p>Semana actual: {weeklyHeader}</p>
                </div>
                <div className="dashboard-mode-toggle" role="tablist" aria-label="Modo del dashboard">
                  <button
                    type="button"
                    className={`mode-btn ${dashboardMode === "compact" ? "active" : ""}`}
                    onClick={() => setDashboardMode("compact")}
                  >
                    Compacto
                  </button>
                  <button
                    type="button"
                    className={`mode-btn ${dashboardMode === "detail" ? "active" : ""}`}
                    onClick={() => setDashboardMode("detail")}
                  >
                    Detallado
                  </button>
                </div>
              </div>

              <div className={`kpi-compact-grid mode-${dashboardMode}`}>
                {kpiCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    className={`kpi-card ${card.tone} ${focusCard.key === card.key ? "is-active" : ""}`}
                    onClick={() => setFocusMetric(card.key)}
                  >
                    <h3>{card.title}</h3>
                    <span className="kpi-number">{card.value}</span>
                    <div className="kpi-description">{card.description}</div>
                  </button>
                ))}
              </div>

              <div className="summary-container summary-compact">
                <h3>Resumen estadistico</h3>
                <div className="summary-grid compact-grid">
                  <div className="summary-card">
                    <div className="summary-content">
                      <div className="summary-label">Disponibilidad</div>
                      <div className="summary-value">{disponibilidadPct.toFixed(1)}%</div>
                    </div>
                  </div>

                  <div className="summary-card">
                    <div className="summary-content">
                      <div className="summary-label">Equipos con problemas</div>
                      <div className="summary-value">{problemasTotal}</div>
                    </div>
                  </div>

                  <div className="summary-card">
                    <div className="summary-content">
                      <div className="summary-label">Estado general</div>
                      <div className={`summary-value estado-general ${estadoGeneral.class}`}>
                        {estadoGeneral.text}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="summary-bars">
                  <div className="summary-bar-row">
                    <div className="summary-bar-copy">
                      <span>Cierre de mantenimientos</span>
                      <strong>{cierreMantenimientoPct.toFixed(1)}%</strong>
                    </div>
                    <div className="summary-progress">
                      <span style={{ width: `${Math.min(100, cierreMantenimientoPct)}%` }}></span>
                    </div>
                  </div>
                  <div className="summary-bar-row">
                    <div className="summary-bar-copy">
                      <span>Carga operativa actual</span>
                      <strong>{problemasTotal}</strong>
                    </div>
                    <div className="summary-progress summary-progress-warning">
                      <span
                        style={{
                          width: `${Math.min(100, stats.total > 0 ? (problemasTotal / stats.total) * 100 : 0)}%`
                        }}
                      ></span>
                    </div>
                  </div>
                </div>

                <div className="summary-alert-strip">
                  <button
                    type="button"
                    className={`summary-alert-card summary-alert-neutral ${focusMetric === "activos-fuera-servicio" ? "is-active" : ""}`}
                    onClick={() => setFocusMetric("activos-fuera-servicio")}
                  >
                    <span>Dados de baja</span>
                    <strong>{stats.fueraServicio}</strong>
                    <small>Declarados sin intervención</small>
                  </button>
                  <button
                    type="button"
                    className={`summary-alert-card summary-alert-warning ${focusMetric === "activos-mantenimiento" ? "is-active" : ""}`}
                    onClick={() => setFocusMetric("activos-mantenimiento")}
                  >
                    <span>En mantenimiento</span>
                    <strong>{stats.mantenimiento}</strong>
                    <small>Seguimiento tecnico activo</small>
                  </button>
                </div>
              </div>

              <div className="reliability-panel">
                <div className="reliability-head">
                  <div>
                    <h3>Indicadores automáticos</h3>
                    <p>Confiabilidad, eficiencia e ISO 55000 (sin edición manual).</p>
                  </div>
                  <small>
                    Base: {globalKpis.baseMantenimientos ?? 0} mantenimientos registrados
                  </small>
                </div>
                <div className="reliability-grid">
                  {reliabilityCards.map((card) => (
                    <div key={card.key} className="reliability-card">
                      <span className="reliability-label">{card.label}</span>
                      <strong className="reliability-value">{card.value}</strong>
                      <small>{card.description}</small>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="dashboard-side">
              <article className="focus-card-panel">
                <p className="focus-label">KPI seleccionado</p>
                <h4>{focusCard.title || "Sin KPI"}</h4>
                <div className={`focus-value tone-${focusCard.tone || "info"}`}>{focusCard.value ?? 0}</div>
                <p className="focus-description">{focusCard.description || "-"}</p>
                <div className="focus-item-list">
                  {focusItems.length ? (
                    focusItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`focus-item focus-item-${item.tone} focus-item-button ${Number(item.assetId) === Number(selectedAssetId) ? "is-selected" : ""}`}
                        onClick={() => {
                          if (item.assetId) {
                            openAssetModal(item.assetId);
                          }
                        }}
                        disabled={!item.assetId}
                      >
                        <strong>{item.title}</strong>
                        <span>{item.subtitle}</span>
                        <small>{item.detail}</small>
                      </button>
                    ))
                  ) : (
                    <p className="weekly-empty">No hay registros para este indicador.</p>
                  )}
                </div>
              </article>

              <article className="focus-card-panel critical-assets-panel">
                <p className="focus-label">Equipos con atencion</p>
                <h4>Prioridad operativa</h4>
                {equiposCriticos.length ? (
                  equiposCriticos.map((item) => (
                    <button
                      key={`crit-${item.id}`}
                      type="button"
                      className={`focus-item focus-item-${normalizeState(item.estado).replace(/\s+/g, "-")} focus-item-button ${Number(item.assetId) === Number(selectedAssetId) ? "is-selected" : ""}`}
                      onClick={() => openAssetModal(item.assetId)}
                    >
                      <strong>{item.nombre}</strong>
                      <span>{item.meta}</span>
                    </button>
                  ))
                ) : (
                  <p className="weekly-empty">No hay equipos criticos en este momento.</p>
                )}
              </article>

              <div className="weekly-pending-panel weekly-compact-panel">
                <div className="weekly-panel-head">
                  <h3>Agenda semanal</h3>
                  <small>{weeklyHeader}</small>
                </div>

                <div className="weekly-filter-row">
                  {[
                    { key: "all", label: "Todos", count: weeklyCounters.all },
                    { key: "pendiente", label: "Pendientes", count: weeklyCounters.pendiente },
                    { key: "programado", label: "Programados", count: weeklyCounters.programado },
                    { key: "en proceso", label: "Proceso", count: weeklyCounters["en proceso"] },
                    { key: "finalizado", label: "Finalizados", count: weeklyCounters.finalizado }
                  ].map((filterOption) => (
                    <button
                      key={filterOption.key}
                      type="button"
                      className={`weekly-filter-btn ${weeklyFilter === filterOption.key ? "active" : ""}`}
                      onClick={() => setWeeklyFilter(filterOption.key)}
                    >
                      <span>{filterOption.label}</span>
                      <strong>{filterOption.count}</strong>
                    </button>
                  ))}
                </div>

                {weeklyFiltered.length ? (
                  <div className="weekly-pending-list weekly-scroll">
                    {weeklyFiltered.map((task) => (
                      <article key={task.id} className="weekly-pending-item">
                        <header>
                          <strong>{task.tipo}</strong>
                          <span className={`weekly-status-pill ${task.estadoClass}`}>{task.estado}</span>
                        </header>
                        <p className="weekly-item-asset">{task.activo}</p>
                        <footer>
                          <span className="weekly-item-date">{task.fechaLabel}</span>
                          <span>{task.tecnico}</span>
                        </footer>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="weekly-empty">No hay mantenimientos para este filtro esta semana.</p>
                )}
              </div>

              <div className="daily-tasks-panel">
                <div className="weekly-panel-head">
                  <h3>Tareas de hoy</h3>
                  <small>{toDateKey(new Date())}</small>
                </div>

                {todayTasks.length ? (
                  <div className="daily-task-list">
                    {todayTasks.map((task) => (
                      <article key={`today-${task.id}`} className="daily-task-card">
                        <header>
                          <strong>{formatTipoMantenimiento(task.tipo) || "Mantenimiento"}</strong>
                          <span className={`weekly-status-pill estado-${normalizeState(getMantenimientoEstadoLabel(task)).replace(/\s+/g, "-")}`}>
                            {getMantenimientoEstadoLabel(task)}
                          </span>
                        </header>
                        <p className="weekly-item-asset">
                          {task.activo || formatActivoIdLabel(task.activo_id, "Activo")}
                        </p>
                        <div className="daily-checklist">
                          {task.checklist.map((item) => (
                            <label key={`${task.id}-${item.key}`} className="daily-check-item">
                              <input
                                type="checkbox"
                                checked={item.done}
                                onChange={() => handleToggleChecklist(task.id, item.key)}
                              />
                              <span>{item.label}</span>
                            </label>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="weekly-empty">No tienes tareas asignadas para hoy.</p>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>

      {assetModalPresence.isMounted && selectedDashboardAsset && typeof document !== "undefined" && createPortal(
        <div
          className="asset-detail-modal-overlay"
          data-state={assetModalPresence.phase}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeAssetModal();
            }
          }}
        >
          <div
            className="asset-detail-modal"
            data-state={assetModalPresence.phase}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-asset-title"
          >
            <div className="asset-detail-head">
              <div>
                <p className="focus-label">Equipo seleccionado</p>
                <h4 id="dashboard-asset-title">{getAssetDisplayName(selectedDashboardAsset)}</h4>
              </div>
              <button type="button" className="asset-detail-close" onClick={closeAssetModal} aria-label="Cerrar detalle">
                Cerrar
              </button>
            </div>

            <div className="asset-detail-grid">
              <div className="asset-detail-item">
                <span>Estado</span>
                <strong className={`tone-${selectedAssetStatusTone}`}>{selectedDashboardAsset.estado || "-"}</strong>
              </div>
              <div className="asset-detail-item">
                <span>Codigo</span>
                <strong>{selectedDashboardAsset.activo || "Sin codigo"}</strong>
              </div>
              <div className="asset-detail-item">
                <span>Area</span>
                <strong>{selectedDashboardAsset.areaPrincipal || "Sin area"}</strong>
              </div>
              <div className="asset-detail-item">
                <span>Marca / Modelo</span>
                <strong>{[selectedDashboardAsset.marca || "Sin marca", selectedDashboardAsset.modelo || "Sin modelo"].join(" / ")}</strong>
              </div>
            </div>

            <div className="asset-detail-note">
              <strong>Resumen:</strong> {getAssetMeta(selectedDashboardAsset)}
            </div>

            {selectedAssetLastMaintenance ? (
              <div className="asset-detail-note asset-detail-note-highlight">
                <strong>Ultimo mantenimiento:</strong> {formatTipoMantenimiento(selectedAssetLastMaintenance.tipo) || "Mantenimiento"} | {formatWeeklyDate(selectedAssetLastMaintenance.fecha)} | {selectedAssetLastMaintenance.tecnico || "Sin tecnico"}
                {(selectedAssetLastMaintenance.cambio_partes || selectedAssetLastMaintenance.descripcion) && (
                  <span>{selectedAssetLastMaintenance.cambio_partes || selectedAssetLastMaintenance.descripcion}</span>
                )}
              </div>
            ) : (
              <p className="weekly-empty">Este equipo aun no tiene mantenimientos relacionados en el dashboard.</p>
            )}

            {selectedAssetHistory.length > 1 && (
              <div className="asset-detail-timeline">
                {selectedAssetHistory.slice(1).map((item) => (
                  <div key={`asset-history-${item.id}`} className="asset-detail-event">
                    <strong>{formatTipoMantenimiento(item.tipo) || "Mantenimiento"}</strong>
                    <span>{formatWeeklyDate(item.fecha)} | {getMantenimientoEstadoLabel(item) || "Sin estado"}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="asset-detail-actions">
              <button type="button" className="asset-detail-link" onClick={() => navigate("/activos")}>
                Abrir activos
              </button>
              <button type="button" className="asset-detail-close asset-detail-close-secondary" onClick={closeAssetModal}>
                Listo
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


Home.propTypes = {
  selectedEntidadId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selectedEntidadNombre: PropTypes.string
};
