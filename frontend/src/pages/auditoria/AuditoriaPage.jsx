import React, { useCallback, useEffect, useState } from "react";
import httpClient from "../../services/httpClient";
import { isAuthenticated } from "../../services/authService";

const MOBILE_BREAKPOINT = 768;
const isMobileViewport = () =>
  typeof globalThis.innerWidth === "number" && globalThis.innerWidth <= MOBILE_BREAKPOINT;

const escapeCsvValue = (value) => {
  const raw = String(value ?? "");
  const mustQuote = raw.includes(",") || raw.includes("\"") || raw.includes("\n");
  if (!mustQuote) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
};

const styles = {
  container: {
    padding: "20px",
    maxWidth: "1200px",
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
  toolbar: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: "15px"
  },
  searchInput: {
    flex: "1 1 280px",
    minWidth: "200px",
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #d1d5db"
  },
  button: {
    padding: "10px 16px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    color: "white",
    fontWeight: "600"
  },
  buttonPrimary: {
    backgroundColor: "var(--brand-700)"
  },
  buttonSecondary: {
    backgroundColor: "#6b7280"
  },
  buttonOutline: {
    backgroundColor: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5f5"
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 0,
    backgroundColor: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)"
  },
  tableWrapper: {
    marginTop: "20px",
    maxHeight: "68vh",
    overflowX: "auto",
    overflowY: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "8px"
  },
  th: {
    backgroundColor: "#f5f5f5",
    padding: "12px",
    textAlign: "left",
    borderBottom: "2px solid #ddd",
    fontWeight: "bold",
    position: "sticky",
    top: 0,
    zIndex: 1
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #eee",
    verticalAlign: "top"
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
  detailCell: {
    maxWidth: "360px",
    minWidth: "260px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: "12px",
    color: "#222"
  },
  detailContent: {
    maxHeight: "120px",
    overflowY: "auto",
    overflowX: "hidden"
  },
  filterLabel: {
    fontSize: "12px",
    color: "#444",
    marginBottom: "6px"
  },
  mobileList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "12px"
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
  mobileField: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "6px",
    gap: "2px"
  },
  mobileFieldLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b"
  },
  mobileFieldValue: {
    fontSize: "13px",
    color: "#0f172a",
    wordBreak: "break-word"
  },
  mobileDetail: {
    margin: 0,
    padding: "8px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    whiteSpace: "pre-wrap",
    overflowX: "auto",
    fontSize: "12px"
  }
};

export default function AuditoriaPage() {
  const [logs, setLogs] = useState([]);
  const [isMobile, setIsMobile] = useState(isMobileViewport());
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchApplied, setSearchApplied] = useState("");

  const fetchLogs = useCallback(async (usuario = "") => {
    setLoading(true);

    if (!isAuthenticated()) {
      setLoading(false);
      setHasData(false);
      return;
    }

    try {
      const response = await httpClient.get("/api/auditoria", {
        params: usuario ? { usuario } : undefined
      });
      const data = response.data.data || response.data || [];
      setLogs(Array.isArray(data) ? data : []);
      setHasData(Array.isArray(data) && data.length > 0);
    } catch {
      setLogs([]);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs("");
  }, [fetchLogs]);

  useEffect(() => {
    const browserWindow = globalThis.window;
    if (browserWindow === undefined) return undefined;
    const onResize = () => setIsMobile(isMobileViewport());
    browserWindow.addEventListener("resize", onResize);
    return () => browserWindow.removeEventListener("resize", onResize);
  }, []);

  const handleSearch = async (event) => {
    event.preventDefault();
    const normalized = searchText.trim();
    setSearchApplied(normalized);
    await fetchLogs(normalized);
  };

  const clearSearch = async () => {
    setSearchText("");
    setSearchApplied("");
    await fetchLogs("");
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const getActionColor = (action) => {
    const actionLower = (action || "").toLowerCase();
    if (actionLower.includes("error") || actionLower.includes("bug") || actionLower.includes("fallo")) return "#b91c1c";
    if (actionLower.includes("crear")) return "#28a745";
    if (actionLower.includes("editar") || actionLower.includes("update")) return "#f59e0b";
    if (actionLower.includes("eliminar") || actionLower.includes("delete")) return "#dc2626";
    if (actionLower.includes("login")) return "#0891b2";
    if (actionLower.includes("permis")) return "var(--brand-700)";
    return "#6c757d";
  };

  const parseJsonValue = (value) => {
    if (!value) return null;
    if (typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const joinPermisos = (permisos) => {
    if (!Array.isArray(permisos) || permisos.length === 0) {
      return "(Sin permisos)";
    }
    return permisos.join(", ");
  };

  const formatDetalleValue = (value) => (
    typeof value === "string" ? value : JSON.stringify(value, null, 2)
  );

  const formatDetalleCambioPermisos = (log, detalles) => {
    const actorNombre = detalles.actor.nombre || log.usuario_nombre || `Usuario #${log.usuario_id || "-"}`;
    const actorEmail = detalles.actor.email || log.usuario_email || "-";
    const objetivoNombre = detalles.objetivo.nombre || `Usuario #${detalles.objetivo.id || log.entidad_id || "-"}`;
    const objetivoEmail = detalles.objetivo.email || "-";
    const objetivoRol = detalles.objetivo.rol_id ?? "-";
    const permisosAntes = joinPermisos(detalles.permisos_antes);
    const permisosDespues = joinPermisos(detalles.permisos_despues);

    return [
      `Actor: ${actorNombre} (${actorEmail})`,
      `Objetivo: ${objetivoNombre} (${objetivoEmail})`,
      `Rol Objetivo: ${objetivoRol}`,
      `Permisos Antes: ${permisosAntes}`,
      `Permisos Después: ${permisosDespues}`
    ].join("\n");
  };

  const formatDetalle = (log) => {
    const despues = parseJsonValue(log.despues);
    const antes = parseJsonValue(log.antes);
    const accion = String(log.accion || "").toLowerCase();

    const esCambioPermisos = accion.includes("permis") && despues && typeof despues === "object";
    if (esCambioPermisos) {
      return formatDetalleCambioPermisos(log, despues);
    }

    if (despues) {
      return formatDetalleValue(despues);
    }

    if (antes) {
      return formatDetalleValue(antes);
    }

    return "-";
  };

  const formatUsuario = (log) => {
    if (log.usuario_nombre && log.usuario_email) {
      return `${log.usuario_nombre} (${log.usuario_email})`;
    }
    if (log.usuario_nombre) return log.usuario_nombre;
    if (log.usuario_email) return log.usuario_email;
    if (log.usuario_id) return `Usuario #${log.usuario_id}`;
    return "-";
  };

  const exportAuditoriaCsv = () => {
    const rows = Array.isArray(logs) ? logs : [];
    if (rows.length === 0) return;

    const headers = [
      "Fecha",
      "Usuario",
      "Acción",
      "Entidad",
      "Entidad Id",
      "Detalle",
      "IP"
    ];

    const csvRows = [headers.map(escapeCsvValue).join(",")];
    rows.forEach((log) => {
      const line = [
        formatDate(log.creado_en || log.fecha),
        formatUsuario(log),
        String(log.accion || "-"),
        String(log.entidad || "-"),
        log.entidad_id || "-",
        formatDetalle(log),
        log.ip || "-"
      ];
      csvRows.push(line.map(escapeCsvValue).join(","));
    });

    const csvContent = `\uFEFF${csvRows.join("\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = globalThis.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute("download", `auditoria_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    globalThis.URL.revokeObjectURL(url);
  };

  const renderMobileLogs = () => (
    <div style={styles.mobileList}>
      {logs.map((log, index) => (
        <article key={log.id || index} style={styles.mobileCard}>
          <div style={styles.mobileCardHeader}>
            <strong>{String(log.accion || "-")}</strong>
            <span style={{ color: getActionColor(log.accion), fontWeight: "700" }}>
              {formatDate(log.creado_en || log.fecha)}
            </span>
          </div>

          <div style={styles.mobileField}>
            <span style={styles.mobileFieldLabel}>Usuario</span>
            <span style={styles.mobileFieldValue}>{formatUsuario(log)}</span>
          </div>
          <div style={styles.mobileField}>
            <span style={styles.mobileFieldLabel}>Entidad</span>
            <span style={styles.mobileFieldValue}>
              {String(log.entidad || "-")} #{log.entidad_id || "-"}
            </span>
          </div>
          <div style={styles.mobileField}>
            <span style={styles.mobileFieldLabel}>IP</span>
            <span style={styles.mobileFieldValue}>{log.ip || "-"}</span>
          </div>
          <div style={styles.mobileField}>
            <span style={styles.mobileFieldLabel}>Detalle</span>
            <pre style={styles.mobileDetail}>{formatDetalle(log)}</pre>
          </div>
        </article>
      ))}
    </div>
  );

  const renderDesktopLogs = () => (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Fecha</th>
            <th style={styles.th}>Usuario</th>
            <th style={styles.th}>Acción</th>
            <th style={styles.th}>Entidad</th>
            <th style={styles.th}>Entidad Id</th>
            <th style={styles.th}>Detalle</th>
            <th style={styles.th}>IP</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => (
            <tr key={log.id || index}>
              <td style={styles.td}>{formatDate(log.creado_en || log.fecha)}</td>
              <td style={styles.td}>{formatUsuario(log)}</td>
              <td style={styles.td}>
                <span style={{ color: getActionColor(log.accion), fontWeight: "bold" }}>
                  {String(log.accion || "-")}
                </span>
              </td>
              <td style={styles.td}>{String(log.entidad || "-")}</td>
              <td style={styles.td}>{log.entidad_id || "-"}</td>
              <td style={{ ...styles.td, ...styles.detailCell }}>
                <div style={styles.detailContent}>{formatDetalle(log)}</div>
              </td>
              <td style={styles.td}>{log.ip || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderEmptyState = () => (
    <div style={styles.empty}>
      <p>
        {searchApplied ? "No hay registros para ese usuario." : "No hay registros de auditoría disponibles."}
      </p>
    </div>
  );

  const renderLogsContent = () => {
    if (!hasData) return renderEmptyState();
    return isMobile ? renderMobileLogs() : renderDesktopLogs();
  };

  if (loading) {
    return (
      <div style={{ ...styles.container, padding: isMobile ? "12px" : "20px" }}>
        <div style={styles.loading}>Cargando registros de auditoría...</div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, padding: isMobile ? "12px" : "20px" }}>
      <div style={styles.header}>
        <h1 style={{ ...styles.title, fontSize: isMobile ? "20px" : "24px" }}>Registros De Auditoría</h1>
      </div>

      <div style={styles.filterLabel}>
        Buscador De Usuario (Nombre, Correo O Id)
      </div>
      <form
        style={{
          ...styles.toolbar,
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center"
        }}
        onSubmit={handleSearch}
      >
        <input
          type="text"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Ej: Admin, Tecnico@Empresa.Com, 12"
          style={{
            ...styles.searchInput,
            minWidth: isMobile ? "100%" : "200px",
            width: isMobile ? "100%" : "auto"
          }}
        />
        <button
          type="submit"
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            width: isMobile ? "100%" : "auto"
          }}
        >
          Buscar
        </button>
        <button
          type="button"
          onClick={clearSearch}
          style={{
            ...styles.button,
            ...styles.buttonSecondary,
            width: isMobile ? "100%" : "auto"
          }}
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={() => fetchLogs(searchApplied)}
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            width: isMobile ? "100%" : "auto"
          }}
        >
          Actualizar
        </button>
        <button
          type="button"
          onClick={exportAuditoriaCsv}
          disabled={!logs.length}
          style={{
            ...styles.button,
            ...styles.buttonOutline,
            ...(logs.length === 0 ? styles.buttonDisabled : null),
            width: isMobile ? "100%" : "auto"
          }}
        >
          Exportar CSV ({logs.length})
        </button>
      </form>

      {searchApplied && (
        <div style={styles.filterLabel}>
          Filtro Activo: {searchApplied}
        </div>
      )}

      {renderLogsContent()}
    </div>
  );
}

