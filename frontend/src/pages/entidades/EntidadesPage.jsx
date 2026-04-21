import React, { useEffect, useState } from "react";
import httpClient from "../../services/httpClient";
import { fetchCurrentUser, getCurrentUser, isAuthenticated } from "../../services/authService";
import { getRoleLabel, hasPermission } from "../../utils/permissions";
import { toProperCase } from "../../utils/formatters";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;
const NARROW_MOBILE_BREAKPOINT = 520;
const getBrowserWindow = () => globalThis.window;

const getViewportWidth = () => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) return null;
  return Number(browserWindow.innerWidth || 0);
};

const isMobileViewport = () => {
  const viewportWidth = getViewportWidth();
  return viewportWidth !== null && viewportWidth <= MOBILE_BREAKPOINT;
};
const isTabletViewport = () => {
  const viewportWidth = getViewportWidth();
  return viewportWidth !== null && viewportWidth > MOBILE_BREAKPOINT && viewportWidth <= TABLET_BREAKPOINT;
};
const isNarrowMobileViewport = () => {
  const viewportWidth = getViewportWidth();
  return viewportWidth !== null && viewportWidth <= NARROW_MOBILE_BREAKPOINT;
};

const styles = {
  container: {
    padding: "20px",
    maxWidth: "980px",
    margin: "0 auto"
  },
  header: {
    marginBottom: "20px",
    borderBottom: "2px solid #ddd",
    paddingBottom: "10px"
  },
  title: {
    fontSize: "24px",
    color: "#333",
    margin: 0
  },
  form: {
    backgroundColor: "#f9f9f9",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "20px"
  },
  formRow: {
    display: "flex",
    gap: "15px",
    marginBottom: "15px",
    flexWrap: "wrap"
  },
  formGroup: {
    flex: "1 1 220px",
    display: "flex",
    flexDirection: "column"
  },
  label: {
    fontWeight: "600",
    marginBottom: "5px",
    color: "#555",
    fontSize: "14px"
  },
  input: {
    padding: "10px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "14px"
  },
  textarea: {
    padding: "10px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "14px",
    minHeight: "90px",
    resize: "vertical",
    fontFamily: "inherit"
  },
  select: {
    padding: "10px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "14px",
    backgroundColor: "white"
  },
  button: {
    padding: "10px 20px",
    backgroundColor: "#021F59",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px"
  },
  buttonSecondary: {
    backgroundColor: "#6b7280"
  },
  buttonDanger: {
    backgroundColor: "#b91c1c"
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
    cursor: "not-allowed"
  },
  alert: {
    padding: "12px",
    borderRadius: "4px",
    marginBottom: "15px",
    fontWeight: "500"
  },
  alertError: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    border: "1px solid #fca5a5"
  },
  alertSuccess: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
    border: "1px solid #6ee7b7"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)"
  },
  tableWrapper: {
    width: "100%",
    overflowX: "auto",
    overflowY: "auto",
    maxHeight: "440px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb"
  },
  th: {
    backgroundColor: "#f5f5f5",
    padding: "12px",
    textAlign: "left",
    borderBottom: "2px solid #ddd",
    fontWeight: "bold",
    position: "sticky",
    top: 0,
    zIndex: 2
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #eee"
  },
  actionsCell: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap"
  },
  actionButton: {
    padding: "6px 10px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    color: "white",
    fontWeight: "600",
    fontSize: "12px"
  },
  loading: {
    textAlign: "center",
    padding: "40px",
    color: "#666"
  },
  empty: {
    textAlign: "center",
    padding: "40px",
    color: "#999"
  },
  mobileList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  mobileListWrapper: {
    maxHeight: "440px",
    overflowY: "auto",
    paddingRight: "4px"
  },
  mobileCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "12px",
    backgroundColor: "#ffffff",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)"
  },
  mobileCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px"
  },
  mobileLabel: {
    fontSize: "12px",
    color: "#475569",
    fontWeight: "700",
    minWidth: "86px"
  },
  mobileField: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "6px",
    fontSize: "14px",
    color: "#0f172a"
  },
  mobileActions: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginTop: "8px"
  },
  areaEditor: {
    border: "1px solid #dbe3f1",
    borderRadius: "8px",
    padding: "10px",
    backgroundColor: "#f8fbff"
  },
  areaInputRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center"
  },
  areaInput: {
    flex: 1
  },
  addAreaButton: {
    padding: "10px 12px",
    border: "none",
    borderRadius: "6px",
    backgroundColor: "var(--brand-900)",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap"
  },
  areaTagList: {
    marginTop: "10px",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px"
  },
  areaTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#e2e8f0",
    border: "1px solid #cbd5e1",
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#0f172a"
  },
  removeAreaButton: {
    border: "none",
    borderRadius: "999px",
    backgroundColor: "#b91c1c",
    color: "white",
    padding: "2px 8px",
    fontSize: "11px",
    cursor: "pointer"
  },
  emptyAreas: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 600
  },
  dashboardSection: {
    border: "1px solid #cbd5e1",
    borderRadius: "14px",
    background:
      "radial-gradient(circle at 88% 14%, rgba(2, 48, 89, 0.15), transparent 42%), linear-gradient(150deg, var(--brand-tint) 0%, #ffffff 62%)",
    padding: "16px",
    marginBottom: "20px",
    boxShadow: "0 10px 30px rgba(2, 31, 89, 0.08)"
  },
  dashboardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px"
  },
  dashboardTitle: {
    margin: 0,
    fontSize: "19px",
    color: "var(--brand-900)"
  },
  dashboardSubtitle: {
    margin: "6px 0 0",
    color: "#334155",
    fontSize: "13px",
    lineHeight: 1.4
  },
  dashboardFilters: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap"
  },
  dashboardInput: {
    minWidth: "220px",
    padding: "9px 10px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "13px"
  },
  dashboardSelect: {
    minWidth: "150px",
    padding: "9px 10px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    backgroundColor: "#ffffff"
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
    marginBottom: "14px"
  },
  kpiCard: {
    background: "rgba(255,255,255,0.9)",
    border: "1px solid var(--brand-tint-strong)",
    borderRadius: "10px",
    padding: "10px 11px",
    minHeight: "88px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between"
  },
  kpiLabel: {
    margin: 0,
    color: "#475569",
    fontSize: "12px",
    fontWeight: 700
  },
  kpiValue: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: "24px",
    fontWeight: 800,
    lineHeight: 1
  },
  kpiHint: {
    margin: "6px 0 0",
    fontSize: "11px",
    color: "var(--brand-700)",
    fontWeight: 700
  },
  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: "12px",
    alignItems: "stretch"
  },
  dashboardEntityList: {
    border: "1px solid var(--brand-tint-strong)",
    borderRadius: "12px",
    backgroundColor: "#ffffff",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxHeight: "360px",
    overflowY: "auto"
  },
  entityListHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px"
  },
  entityListTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "14px",
    fontWeight: 800
  },
  entityListCount: {
    color: "#334155",
    fontSize: "12px",
    fontWeight: 700
  },
  entityItem: {
    border: "1px solid var(--brand-tint-strong)",
    borderRadius: "10px",
    backgroundColor: "var(--brand-bg)",
    padding: "10px",
    cursor: "pointer",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  entityItemSelected: {
    borderColor: "var(--brand-700)",
    background: "linear-gradient(160deg, var(--brand-tint-strong) 0%, var(--brand-tint) 100%)",
    boxShadow: "0 8px 18px rgba(2, 48, 89, 0.2)"
  },
  entityItemTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px"
  },
  entityName: {
    fontSize: "13px",
    color: "#0f172a",
    fontWeight: 800
  },
  entityMeta: {
    margin: 0,
    color: "#475569",
    fontSize: "12px"
  },
  entityBarTrack: {
    width: "100%",
    height: "7px",
    borderRadius: "999px",
    backgroundColor: "var(--brand-tint-strong)",
    overflow: "hidden"
  },
  entityBar: {
    display: "block",
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, var(--brand-700), var(--brand-900))"
  },
  dashboardDetail: {
    border: "1px solid var(--brand-tint-strong)",
    borderRadius: "12px",
    backgroundColor: "#ffffff",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minHeight: "360px"
  },
  detailTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: 800
  },
  detailEntityBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "999px",
    border: "1px solid var(--brand-tint-stronger)",
    background: "var(--brand-tint)",
    color: "var(--brand-900)",
    fontSize: "12px",
    padding: "5px 10px",
    fontWeight: 700,
    width: "fit-content"
  },
  detailMeta: {
    margin: 0,
    color: "#475569",
    fontSize: "12px"
  },
  roleSummary: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px"
  },
  roleChip: {
    borderRadius: "999px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    fontSize: "11px",
    fontWeight: 700,
    padding: "4px 8px",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px"
  },
  roleChipValue: {
    color: "var(--brand-700)",
    fontWeight: 800
  },
  authorizedUsersList: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    backgroundColor: "#f8fafc",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxHeight: "214px",
    overflowY: "auto"
  },
  authorizedUserCard: {
    border: "1px solid var(--brand-tint-strong)",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    padding: "8px"
  },
  authorizedUserHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px"
  },
  authorizedUserName: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 800,
    color: "#0f172a"
  },
  authorizedUserRole: {
    fontSize: "11px",
    borderRadius: "999px",
    padding: "3px 8px",
    backgroundColor: "var(--brand-tint-strong)",
    color: "var(--brand-900)",
    fontWeight: 700
  },
  authorizedUserEmail: {
    margin: "4px 0 0",
    fontSize: "12px",
    color: "#475569"
  },
  dashboardEmpty: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 600,
    textAlign: "center",
    padding: "14px 6px"
  },
  tableRow: {
    cursor: "pointer"
  },
  tableRowSelected: {
    cursor: "pointer",
    backgroundColor: "var(--brand-tint)"
  },
  mobileCardSelected: {
    borderColor: "var(--brand-700)",
    boxShadow: "0 0 0 1px var(--brand-tint-stronger), 0 8px 20px rgba(2, 48, 89, 0.15)"
  }
};

const INITIAL_FORM = {
  nombre: "",
  tipo: "ENTIDAD",
  direccion: "",
  areas_primarias: [],
  areas_secundarias: [],
  areas_primarias_input: "",
  areas_secundarias_input: ""
};

export default function EntidadesPage() {
  const [entidades, setEntidades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [isMobile, setIsMobile] = useState(isMobileViewport());
  const [isTablet, setIsTablet] = useState(isTabletViewport());
  const [isNarrowMobile, setIsNarrowMobile] = useState(isNarrowMobileViewport());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [selectedEntidadId, setSelectedEntidadId] = useState("");
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [dashboardTipo, setDashboardTipo] = useState("TODOS");
  const [form, setForm] = useState(INITIAL_FORM);

  const isAdmin = hasPermission(currentUser, "ADMIN_TOTAL");

  const normalizeAreaValue = (value) =>
    toProperCase(
      String(value || "")
        .replace(/\s+/g, " ")
        .trim()
    );

  const sanitizeAreaList = (value) => {
    const source = Array.isArray(value) ? value : String(value || "").split(/[\n,;]+/);
    return [...new Set(source.map((item) => normalizeAreaValue(item)).filter(Boolean))];
  };

  const formatAreaList = (list) =>
    sanitizeAreaList(list).join(", ");

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
  };

  const syncSelectedEntidad = React.useCallback((catalogo) => {
    const lista = Array.isArray(catalogo) ? catalogo : [];
    const idsValidos = new Set(
      lista
        .map((item) => String(item.id || "").trim())
        .filter(Boolean)
    );

    setSelectedEntidadId((previous) => {
      const prev = String(previous || "").trim();
      if (prev && idsValidos.has(prev)) return prev;
      const primerId = String(lista[0].id || "").trim();
      return primerId || "";
    });
  }, []);

  const refreshData = React.useCallback(async ({ withLoading = false } = {}) => {
    if (!isAuthenticated()) {
      if (withLoading) setLoading(false);
      return;
    }

    if (withLoading) setLoading(true);
    setError("");

    const requests = [httpClient.get("/api/entidades")];
    if (isAdmin) {
      requests.push(httpClient.get("/api/usuarios"));
    }

    try {
      const results = await Promise.allSettled(requests);
      const entidadesResult = results[0];
      const usuariosResult = isAdmin ? results[1] : null;

      if (entidadesResult.status === "fulfilled") {
        const dataEntidades = entidadesResult.value.data.data || entidadesResult.value.data || [];
        const normalizedEntidades = Array.isArray(dataEntidades) ? dataEntidades : [];
        setEntidades(normalizedEntidades);
        syncSelectedEntidad(normalizedEntidades);
      } else {
        const backendMessage =
          entidadesResult.reason?.response?.data?.error ||
          entidadesResult.reason?.response?.data?.message ||
          "No se pudieron cargar entidades";
        setError((prev) => prev || String(backendMessage));
        setEntidades([]);
        syncSelectedEntidad([]);
      }

      if (isAdmin && usuariosResult.status === "fulfilled") {
        const dataUsuarios = usuariosResult.value.data.data || usuariosResult.value.data || [];
        setUsuarios(Array.isArray(dataUsuarios) ? dataUsuarios : []);
      } else if (isAdmin) {
        const usuariosMessage =
          usuariosResult?.reason?.response?.data?.error ||
          usuariosResult?.reason?.response?.data?.message ||
          "No se pudieron cargar usuarios autorizados";
        setUsuarios([]);
        setError((prev) => prev || String(usuariosMessage));
      } else {
        setUsuarios([]);
      }
    } finally {
      if (withLoading) setLoading(false);
    }
  }, [isAdmin, syncSelectedEntidad]);

  useEffect(() => {
    const init = async () => {
      const refreshed = await fetchCurrentUser();
      if (refreshed.success) {
        setCurrentUser(refreshed.user);
        await refreshData({ withLoading: true });
      }
    };

    init();
  }, [refreshData]);

  useEffect(() => {
    const browserWindow = getBrowserWindow();
    if (!browserWindow) return undefined;
    const onResize = () => {
      setIsMobile(isMobileViewport());
      setIsTablet(isTabletViewport());
      setIsNarrowMobile(isNarrowMobileViewport());
    };
    browserWindow.addEventListener("resize", onResize);
    return () => browserWindow.removeEventListener("resize", onResize);
  }, []);

  const tiposDashboard = React.useMemo(() => {
    const tipos = new Set();
    entidades.forEach((entidad) => {
      const tipo = String(entidad.tipo || "").trim();
      if (tipo) tipos.add(tipo);
    });
    return ["TODOS", ...Array.from(tipos).sort((a, b) => a.localeCompare(b, "es"))];
  }, [entidades]);

  const usuariosPorEntidad = React.useMemo(() => {
    const map = {};

    usuarios.forEach((usuario) => {
      const asignadas = Array.isArray(usuario.entidades_asignadas) ? usuario.entidades_asignadas : [];
      const vistos = new Set();

      asignadas.forEach((entidad) => {
        const entidadId = String(entidad.id || entidad || "").trim();
        if (!entidadId || vistos.has(entidadId)) return;

        vistos.add(entidadId);
        if (!Array.isArray(map[entidadId])) {
          map[entidadId] = [];
        }
        map[entidadId].push(usuario);
      });
    });

    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) =>
        String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")
      );
    });

    return map;
  }, [usuarios]);

  const entidadesFiltradasDashboard = React.useMemo(() => {
    const term = String(dashboardSearch || "").trim().toLowerCase();

    return entidades.filter((entidad) => {
      const nombre = String(entidad.nombre || "").toLowerCase();
      const tipo = String(entidad.tipo || "").toLowerCase();
      const direccion = String(entidad.direccion || "").toLowerCase();

      if (dashboardTipo !== "TODOS" && String(entidad.tipo || "") !== dashboardTipo) {
        return false;
      }

      if (!term) return true;
      return nombre.includes(term) || tipo.includes(term) || direccion.includes(term);
    });
  }, [entidades, dashboardSearch, dashboardTipo]);

  const entidadSeleccionada = React.useMemo(
    () => entidades.find((entidad) => String(entidad.id || "") === String(selectedEntidadId || "")) || null,
    [entidades, selectedEntidadId]
  );

  const usuariosAutorizadosEntidad = React.useMemo(
    () => usuariosPorEntidad[String(selectedEntidadId || "")] || [],
    [usuariosPorEntidad, selectedEntidadId]
  );

  const maxUsuariosPorEntidad = React.useMemo(
    () =>
      entidades.reduce((max, entidad) => {
        const total = (usuariosPorEntidad[String(entidad.id || "")] || []).length;
        return Math.max(max, total);
      }, 0),
    [entidades, usuariosPorEntidad]
  );

  const resumenRolesEntidad = React.useMemo(() => {
    const map = {};
    usuariosAutorizadosEntidad.forEach((usuario) => {
      const roleName = toProperCase(String(usuario.rol_nombre || getRoleLabel(usuario.rol_id)));
      map[roleName] = (map[roleName] || 0) + 1;
    });

    return Object.entries(map)
      .map(([rol, total]) => ({ rol, total }))
      .sort((a, b) => b.total - a.total);
  }, [usuariosAutorizadosEntidad]);

  const kpiData = React.useMemo(() => {
    const totalEntidades = entidades.length;
    const totalAsignaciones = Object.values(usuariosPorEntidad)
      .reduce((acc, list) => acc + list.length, 0);

    const usuariosConEntidad = usuarios.filter((usuario) => {
      const asignadas = Array.isArray(usuario.entidades_asignadas) ? usuario.entidades_asignadas : [];
      return asignadas.length > 0;
    }).length;

    const entidadesConCobertura = entidades.filter((entidad) => {
      const entidadId = String(entidad.id || "");
      return (usuariosPorEntidad[entidadId] || []).length > 0;
    }).length;

    const coverage = totalEntidades > 0 ? Math.round((entidadesConCobertura / totalEntidades) * 100) : 0;

    let entidadTop = null;
    entidades.forEach((entidad) => {
      const total = (usuariosPorEntidad[String(entidad.id || "")] || []).length;
      if (!entidadTop || total > entidadTop.total) {
        entidadTop = { nombre: entidad.nombre || `Entidad #${entidad.id || "-"}`, total };
      }
    });

    return {
      totalEntidades,
      totalAsignaciones,
      usuariosConEntidad,
      coverage,
      entidadTop
    };
  }, [entidades, usuarios, usuariosPorEntidad]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === "nombre") {
      setForm((prev) => ({ ...prev, [name]: value }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: toProperCase(value) }));
  };

  const handleAreaInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: toProperCase(value) }));
  };

  const handleAddArea = (areasKey, inputKey) => {
    const nextArea = normalizeAreaValue(form[inputKey]);
    if (!nextArea) return;

    setForm((prev) => {
      const actuales = sanitizeAreaList(prev[areasKey]);
      if (actuales.includes(nextArea)) {
        return { ...prev, [inputKey]: "" };
      }
      return {
        ...prev,
        [areasKey]: [...actuales, nextArea],
        [inputKey]: ""
      };
    });
  };

  const handleRemoveArea = (areasKey, valueToRemove) => {
    setForm((prev) => ({
      ...prev,
      [areasKey]: sanitizeAreaList(prev[areasKey]).filter((item) => item !== valueToRemove)
    }));
  };

  const handleAreaKeyDown = (event, areasKey, inputKey) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleAddArea(areasKey, inputKey);
  };

  const validateForm = () => {
    if (!form.nombre.trim()) {
      setError("El nombre es requerido");
      return false;
    }
    if (!form.tipo.trim()) {
      setError("El tipo es requerido");
      return false;
    }
    return true;
  };

  const buildPayload = () => ({
    nombre: form.nombre.trim(),
    tipo: form.tipo.trim(),
    direccion: form.direccion.trim() || null,
    areas_primarias: sanitizeAreaList(form.areas_primarias),
    areas_secundarias: sanitizeAreaList(form.areas_secundarias)
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) return;
    if (!isAdmin) {
      setError("Solo un administrador puede gestionar entidades");
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await httpClient.put(`/api/entidades/${editingId}`, payload);
        setSuccess("Entidad actualizada exitosamente");
      } else {
        await httpClient.post("/api/entidades", payload);
        setSuccess("Entidad creada exitosamente");
      }

      resetForm();
      await refreshData();
    } catch (err) {
      const backendMessage =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Error al guardar entidad";
      setError(String(backendMessage));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entidad) => {
    setError("");
    setSuccess("");
    setSelectedEntidadId(String(entidad.id || ""));
    setEditingId(entidad.id);
    setForm({
      nombre: String(entidad.nombre || ""),
      tipo: toProperCase(String(entidad.tipo || "")),
      direccion: toProperCase(String(entidad.direccion || "")),
      areas_primarias: sanitizeAreaList(entidad.areas_primarias),
      areas_secundarias: sanitizeAreaList(entidad.areas_secundarias),
      areas_primarias_input: "",
      areas_secundarias_input: ""
    });
  };

  const handleDelete = async (entidad) => {
    if (!isAdmin) return;
    const confirmed = globalThis.confirm(
      `¿Confirmas eliminar la entidad ${String(entidad.nombre || "")}`
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await httpClient.delete(`/api/entidades/${entidad.id}`);
      setSuccess("Entidad eliminada exitosamente");
      if (editingId === entidad.id) {
        resetForm();
      }
      await refreshData();
    } catch (err) {
      const backendMessage =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Error al eliminar entidad";
      setError(String(backendMessage));
    } finally {
      setSaving(false);
    }
  };

  const isCompactViewport = isMobile || isTablet;
  const getResponsiveValue = (mobileValue, tabletValue, defaultValue) => {
    if (isMobile) return mobileValue;
    if (isTablet) return tabletValue;
    return defaultValue;
  };
  const getCompactResponsiveValue = (narrowValue, compactValue, defaultValue) => {
    if (isNarrowMobile) return narrowValue;
    if (isCompactViewport) return compactValue;
    return defaultValue;
  };
  const containerPadding = getResponsiveValue("12px", "16px", "20px");
  const titleSize = getResponsiveValue("20px", "22px", "24px");
  const dashboardColumns = isCompactViewport ? "1fr" : styles.dashboardGrid.gridTemplateColumns;
  const kpiColumns = getCompactResponsiveValue("1fr", "repeat(2, minmax(0, 1fr))", styles.kpiGrid.gridTemplateColumns);
  const dashboardListHeight = getCompactResponsiveValue("280px", "320px", "360px");
  const dashboardDetailMinHeight = isCompactViewport ? "auto" : "360px";
  let submitEntidadLabel = "Crear Entidad";
  if (saving) {
    submitEntidadLabel = "Guardando...";
  } else if (editingId) {
    submitEntidadLabel = "Actualizar Entidad";
  }

  if (loading) {
    return (
      <div style={{ ...styles.container, padding: containerPadding }}>
        <div style={styles.loading}>Cargando entidades...</div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, padding: containerPadding }}>
      <div style={styles.header}>
        <h1 style={{ ...styles.title, fontSize: titleSize }}>Gestión De Entidades</h1>
      </div>

      {error && <div style={{ ...styles.alert, ...styles.alertError }}>{error}</div>}
      {success && <div style={{ ...styles.alert, ...styles.alertSuccess }}>{success}</div>}

      <section style={styles.dashboardSection}>
        <div
          style={{
            ...styles.dashboardHeader,
            flexDirection: isCompactViewport ? "column" : "row",
            alignItems: isCompactViewport ? "stretch" : "flex-start"
          }}
        >
          <div>
            <h3 style={styles.dashboardTitle}>Dashboard De Entidades Y Accesos</h3>
            <p style={styles.dashboardSubtitle}>
              Visualiza cobertura por entidad, selecciona una sede y revisa sus usuarios autorizados en tiempo real.
            </p>
          </div>

          <div style={{ ...styles.dashboardFilters, width: isCompactViewport ? "100%" : "auto" }}>
            <input
              type="text"
              value={dashboardSearch}
              onChange={(event) => setDashboardSearch(event.target.value)}
              placeholder="Buscar por nombre, tipo o dirección..."
              style={{
                ...styles.dashboardInput,
                minWidth: isCompactViewport ? "100%" : "220px",
                width: isCompactViewport ? "100%" : "auto"
              }}
            />
            <select
              value={dashboardTipo}
              onChange={(event) => setDashboardTipo(event.target.value)}
              style={{
                ...styles.dashboardSelect,
                minWidth: isCompactViewport ? "100%" : "150px",
                width: isCompactViewport ? "100%" : "auto"
              }}
            >
              {tiposDashboard.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo === "TODOS" ? "Todos los tipos" : toProperCase(tipo)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            ...styles.kpiGrid,
            gridTemplateColumns: kpiColumns
          }}
        >
          <article style={styles.kpiCard}>
            <p style={styles.kpiLabel}>Entidades registradas</p>
            <p style={styles.kpiValue}>{kpiData.totalEntidades}</p>
            <p style={styles.kpiHint}>Catálogo total</p>
          </article>
          <article style={styles.kpiCard}>
            <p style={styles.kpiLabel}>Usuarios con entidad</p>
            <p style={styles.kpiValue}>{kpiData.usuariosConEntidad}</p>
            <p style={styles.kpiHint}>Usuarios autorizados</p>
          </article>
          <article style={styles.kpiCard}>
            <p style={styles.kpiLabel}>Asignaciones activas</p>
            <p style={styles.kpiValue}>{kpiData.totalAsignaciones}</p>
            <p style={styles.kpiHint}>Usuario x entidad</p>
          </article>
          <article style={styles.kpiCard}>
            <p style={styles.kpiLabel}>Cobertura de acceso</p>
            <p style={styles.kpiValue}>{kpiData.coverage}%</p>
            <p style={styles.kpiHint}>
              Top: {kpiData.entidadTop ? `${toProperCase(kpiData.entidadTop.nombre)} (${kpiData.entidadTop.total})` : "Sin datos"}
            </p>
          </article>
        </div>

        <div
          style={{
            ...styles.dashboardGrid,
            gridTemplateColumns: dashboardColumns
          }}
        >
          <div
            style={{
              ...styles.dashboardEntityList,
              maxHeight: dashboardListHeight
            }}
          >
            <div style={styles.entityListHeader}>
              <h4 style={styles.entityListTitle}>Entidades filtradas</h4>
              <span style={styles.entityListCount}>{entidadesFiltradasDashboard.length} visibles</span>
            </div>

            {entidadesFiltradasDashboard.length === 0 ? (
              <p style={styles.dashboardEmpty}>No hay entidades con esos filtros.</p>
            ) : (
              entidadesFiltradasDashboard.map((entidad) => {
                const entidadId = String(entidad.id || "").trim();
                const totalUsuarios = (usuariosPorEntidad[entidadId] || []).length;
                const isSelected = entidadId === String(selectedEntidadId || "");
                const progress = maxUsuariosPorEntidad > 0 ? Math.max(10, Math.round((totalUsuarios / maxUsuariosPorEntidad) * 100)) : 0;

                return (
                  <button
                    key={entidadId || entidad.nombre}
                    type="button"
                    onClick={() => setSelectedEntidadId(entidadId)}
                    style={{
                      ...styles.entityItem,
                      ...(isSelected ? styles.entityItemSelected : {})
                    }}
                  >
                    <div style={styles.entityItemTop}>
                      <span style={styles.entityName}>
                        {toProperCase(String(entidad.nombre || `Entidad #${entidad.id || "-"}`))}
                      </span>
                      <span style={styles.detailEntityBadge}>{totalUsuarios}</span>
                    </div>
                    <p style={styles.entityMeta}>
                      {toProperCase(String(entidad.tipo || "Sin tipo"))} {entidad.direccion ? ` | ${entidad.direccion}` : " | Sin dirección"}
                    </p>
                    <div style={styles.entityBarTrack}>
                      <span
                        style={{
                          ...styles.entityBar,
                          width: `${progress}%`
                        }}
                      ></span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <aside
            style={{
              ...styles.dashboardDetail,
              minHeight: dashboardDetailMinHeight
            }}
          >
            {!entidadSeleccionada ? (
              <p style={styles.dashboardEmpty}>Selecciona una entidad para ver usuarios autorizados.</p>
            ) : (
              <>
                <h4 style={styles.detailTitle}>Usuarios autorizados por entidad</h4>
                <div style={styles.detailEntityBadge}>
                  {toProperCase(String(entidadSeleccionada.nombre || `Entidad #${entidadSeleccionada.id || "-"}`))}
                </div>
                <p style={styles.detailMeta}>
                  Tipo: {toProperCase(String(entidadSeleccionada.tipo || "Sin tipo"))}
                </p>
                <p style={styles.detailMeta}>
                  Dirección: {String(entidadSeleccionada.direccion || "Sin dirección registrada")}
                </p>
                <p style={styles.detailMeta}>
                  Áreas: {sanitizeAreaList(entidadSeleccionada.areas_primarias).length} primarias /
                  {" "}
                  {sanitizeAreaList(entidadSeleccionada.areas_secundarias).length} secundarias
                </p>

                <div style={styles.roleSummary}>
                  {resumenRolesEntidad.length === 0 ? (
                    <span style={styles.roleChip}>Sin usuarios asignados</span>
                  ) : (
                    resumenRolesEntidad.map((item) => (
                      <span key={item.rol} style={styles.roleChip}>
                        {item.rol}
                        <span style={styles.roleChipValue}>{item.total}</span>
                      </span>
                    ))
                  )}
                </div>

                <div style={styles.authorizedUsersList}>
                  {usuariosAutorizadosEntidad.length === 0 ? (
                    <p style={styles.dashboardEmpty}>Esta entidad aún no tiene usuarios autorizados.</p>
                  ) : (
                    usuariosAutorizadosEntidad.map((usuario, index) => (
                      <article
                        key={`${usuario.id || "sin-id"}-${usuario.email || "sin-email"}-${index}`}
                        style={styles.authorizedUserCard}
                      >
                        <div style={styles.authorizedUserHeader}>
                          <p style={styles.authorizedUserName}>
                            {toProperCase(String(usuario.nombre || `Usuario #${usuario.id || "-"}`))}
                          </p>
                          <span style={styles.authorizedUserRole}>
                            {toProperCase(String(usuario.rol_nombre || getRoleLabel(usuario.rol_id)))}
                          </span>
                        </div>
                        <p style={styles.authorizedUserEmail}>{String(usuario.email || "Sin email")}</p>
                      </article>
                    ))
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </section>

      <div style={{ ...styles.form, padding: isCompactViewport ? "14px" : "20px" }}>
        <h3 style={{ marginTop: 0, marginBottom: "15px", color: "#333" }}>
          {editingId ? "Editar Entidad" : "Agregar Nueva Entidad"}
        </h3>

        {!isAdmin && (
          <div style={{ ...styles.alert, ...styles.alertError }}>
            Solo administradores pueden crear, editar o eliminar entidades
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ ...styles.formRow, flexDirection: isCompactViewport ? "column" : "row", gap: isCompactViewport ? "10px" : "15px" }}>
            <div style={styles.formGroup}>
              <label htmlFor="entidad-nombre" style={styles.label}>Nombre *</label>
              <input
                id="entidad-nombre"
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Ej: Niquía, Autopista, Centro"
                style={styles.input}
                disabled={saving || !isAdmin}
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="entidad-tipo" style={styles.label}>Tipo *</label>
              <select
                id="entidad-tipo"
                name="tipo"
                value={form.tipo}
                onChange={handleChange}
                style={styles.select}
                disabled={saving || !isAdmin}
              >
                <option value="ENTIDAD">Entidad</option>
                <option value="OFICINA">Oficina</option>
                <option value="BODEGA">Bodega</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </div>

          <div style={{ ...styles.formRow, flexDirection: isCompactViewport ? "column" : "row", gap: isCompactViewport ? "10px" : "15px" }}>
            <div style={styles.formGroup}>
              <label htmlFor="entidad-direccion" style={styles.label}>Dirección</label>
              <input
                id="entidad-direccion"
                type="text"
                name="direccion"
                value={form.direccion}
                onChange={handleChange}
                placeholder="Dirección De La Entidad"
                style={styles.input}
                disabled={saving || !isAdmin}
              />
            </div>
          </div>

          <div style={{ ...styles.formRow, flexDirection: isCompactViewport ? "column" : "row", gap: isCompactViewport ? "10px" : "15px" }}>
            <div style={styles.formGroup}>
              <label htmlFor="entidad-areas-primarias" style={styles.label}>Áreas primarias</label>
              <div style={styles.areaEditor}>
                <div style={{ ...styles.areaInputRow, flexDirection: isCompactViewport ? "column" : "row" }}>
                  <input
                    id="entidad-areas-primarias"
                    type="text"
                    name="areas_primarias_input"
                    value={form.areas_primarias_input}
                    onChange={handleAreaInputChange}
                    onKeyDown={(event) => handleAreaKeyDown(event, "areas_primarias", "areas_primarias_input")}
                    placeholder="Ej: UCI"
                    style={{ ...styles.input, ...styles.areaInput }}
                    disabled={saving || !isAdmin}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddArea("areas_primarias", "areas_primarias_input")}
                    style={{
                      ...styles.addAreaButton,
                      width: isCompactViewport ? "100%" : "auto",
                      ...(saving || !isAdmin ? styles.buttonDisabled : {})
                    }}
                    disabled={saving || !isAdmin}
                  >
                    Agregar
                  </button>
                </div>
                <div style={styles.areaTagList}>
                  {form.areas_primarias.length === 0 ? (
                    <span style={styles.emptyAreas}>Sin áreas primarias agregadas</span>
                  ) : (
                    form.areas_primarias.map((area) => (
                      <span key={`primaria-${area}`} style={styles.areaTag}>
                        <span>{area}</span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleRemoveArea("areas_primarias", area)}
                            style={styles.removeAreaButton}
                            disabled={saving}
                          >
                            Quitar
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div style={styles.formGroup}>
              <label htmlFor="entidad-areas-secundarias" style={styles.label}>Áreas secundarias</label>
              <div style={styles.areaEditor}>
                <div style={{ ...styles.areaInputRow, flexDirection: isCompactViewport ? "column" : "row" }}>
                  <input
                    id="entidad-areas-secundarias"
                    type="text"
                    name="areas_secundarias_input"
                    value={form.areas_secundarias_input}
                    onChange={handleAreaInputChange}
                    onKeyDown={(event) => handleAreaKeyDown(event, "areas_secundarias", "areas_secundarias_input")}
                    placeholder="Ej: Farmacia"
                    style={{ ...styles.input, ...styles.areaInput }}
                    disabled={saving || !isAdmin}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddArea("areas_secundarias", "areas_secundarias_input")}
                    style={{
                      ...styles.addAreaButton,
                      width: isCompactViewport ? "100%" : "auto",
                      ...(saving || !isAdmin ? styles.buttonDisabled : {})
                    }}
                    disabled={saving || !isAdmin}
                  >
                    Agregar
                  </button>
                </div>
                <div style={styles.areaTagList}>
                  {form.areas_secundarias.length === 0 ? (
                    <span style={styles.emptyAreas}>Sin áreas secundarias agregadas</span>
                  ) : (
                    form.areas_secundarias.map((area) => (
                      <span key={`secundaria-${area}`} style={styles.areaTag}>
                        <span>{area}</span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleRemoveArea("areas_secundarias", area)}
                            style={styles.removeAreaButton}
                            disabled={saving}
                          >
                            Quitar
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...styles.formRow, marginBottom: 0 }}>
            <div
              style={{
                ...styles.formGroup,
                flexDirection: isCompactViewport ? "column" : "row",
                gap: "10px"
              }}
            >
              <button
                type="submit"
                style={{
                  ...styles.button,
                  width: isCompactViewport ? "100%" : "auto",
                  ...(saving || !isAdmin ? styles.buttonDisabled : {})
                }}
                disabled={saving || !isAdmin}
              >
                {submitEntidadLabel}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    ...styles.button,
                    width: isCompactViewport ? "100%" : "auto",
                    ...styles.buttonSecondary
                  }}
                  disabled={saving}
                >
                  Cancelar Edición
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <h3 style={{ marginBottom: "15px", color: "#333" }}>
        Entidades Registradas ({entidades.length})
      </h3>

      {entidades.length === 0 ? (
        <div style={styles.empty}>
          <p>No hay entidades registradas.</p>
        </div>
      ) : isCompactViewport ? (
        <div style={{ ...styles.mobileListWrapper, maxHeight: "62vh" }}>
          <div
            style={{
              ...styles.mobileList,
              display: "grid",
              gridTemplateColumns: isTablet ? "repeat(2, minmax(0, 1fr))" : "1fr",
              gap: "10px"
            }}
          >
            {entidades.map((entidad) => {
              const entidadId = String(entidad.id || "").trim();
              const isSelected = entidadId === String(selectedEntidadId || "");

              return (
                <article
                  key={entidad.id}
                  style={{
                    ...styles.mobileCard,
                    ...(isSelected ? styles.mobileCardSelected : {})
                  }}
                  onClick={() => setSelectedEntidadId(entidadId)}
                >
                <div style={styles.mobileCardHeader}>
                  <strong>{String(entidad.nombre || "-")}</strong>
                  <span>ID: {entidad.id}</span>
                </div>
                <div style={styles.mobileField}>
                  <span style={styles.mobileLabel}>Tipo</span>
                  <span>{String(entidad.tipo || "-")}</span>
                </div>
                <div style={styles.mobileField}>
                  <span style={styles.mobileLabel}>Dirección</span>
                  <span>{entidad.direccion || "-"}</span>
                </div>
                <div style={styles.mobileField}>
                  <span style={styles.mobileLabel}>Áreas P.</span>
                  <span>{formatAreaList(entidad.areas_primarias) || "-"}</span>
                </div>
                <div style={styles.mobileField}>
                  <span style={styles.mobileLabel}>Áreas S.</span>
                  <span>{formatAreaList(entidad.areas_secundarias) || "-"}</span>
                </div>

                {isAdmin && (
                  <div style={styles.mobileActions}>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEdit(entidad);
                      }}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: "var(--brand-700)",
                        width: "100%"
                      }}
                      disabled={saving}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(entidad);
                      }}
                      style={{
                        ...styles.actionButton,
                        ...styles.buttonDanger,
                        width: "100%"
                      }}
                      disabled={saving}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ ...styles.tableWrapper, maxHeight: "62vh" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Nombre</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Dirección</th>
                <th style={styles.th}>Áreas Primarias</th>
                <th style={styles.th}>Áreas Secundarias</th>
                {isAdmin && <th style={styles.th}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {entidades.map((entidad) => {
                const entidadId = String(entidad.id || "").trim();
                const isSelected = entidadId === String(selectedEntidadId || "");

                return (
                <tr
                  key={entidad.id}
                  style={isSelected ? styles.tableRowSelected : styles.tableRow}
                  onClick={() => setSelectedEntidadId(entidadId)}
                >
                  <td style={styles.td}>{entidad.id}</td>
                  <td style={styles.td}><strong>{entidad.nombre}</strong></td>
                  <td style={styles.td}>{entidad.tipo}</td>
                  <td style={styles.td}>{entidad.direccion || "-"}</td>
                  <td style={styles.td}>{formatAreaList(entidad.areas_primarias) || "-"}</td>
                  <td style={styles.td}>{formatAreaList(entidad.areas_secundarias) || "-"}</td>
                  {isAdmin && (
                    <td style={styles.td}>
                      <div style={styles.actionsCell}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleEdit(entidad);
                          }}
                          style={{
                            ...styles.actionButton,
                            backgroundColor: "var(--brand-700)"
                          }}
                          disabled={saving}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(entidad);
                          }}
                          style={{
                            ...styles.actionButton,
                            ...styles.buttonDanger
                          }}
                          disabled={saving}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


