import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import httpClient from "../../services/httpClient";
import { getCurrentUser, isAuthenticated } from "../../services/authService";
import { hasPermission } from "../../utils/permissions";
import { buildMaintenanceOrderHtml } from "../../utils/emailDocuments";
import logoM5 from "../../assets/logos/logom5.png";
import logoAssetControl from "../../assets/logos/logo-assetcontrol.png";
import "../../styles/OrdenesPage.css";

const DIGIT_GROUP_REGEX = /\d+/g;
const createHtmlPreviewUrl = (html = "") => {
  const content = String(html || "").trim();
  if (!content) return "";
  return globalThis.URL.createObjectURL(new Blob([content], { type: "text/html;charset=utf-8" }));
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

const buildSearchIndex = (orden = {}) => Object.values(orden || {}).join(" ").toLowerCase();

const escapeCsvValue = (value) => {
  const raw = String(value ?? "");
  const mustQuote = raw.includes(",") || raw.includes("\"") || raw.includes("\n");
  if (!mustQuote) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
};

const extraerConsecutivoOrden = (value) => {
  const source = String(value || "").trim();
  if (!source) return null;
  if (/^\d+$/.test(source)) return Number(source);

  const lastGroup = getLastDigitGroup(source);
  if (!lastGroup) return null;

  const num = Number(lastGroup);
  return Number.isInteger(num) && num > 0 ? num : null;
};

export default function OrdenesPage({ selectedEntidadId, selectedEntidadNombre }) {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchGlobal, setSearchGlobal] = useState("");
  const [searchEntidad, setSearchEntidad] = useState("");
  const [searchActivo, setSearchActivo] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedOrden, setSelectedOrden] = useState(null);
  const deferredSearchGlobal = useDeferredValue(searchGlobal);
  const deferredSearchEntidad = useDeferredValue(searchEntidad);
  const deferredSearchActivo = useDeferredValue(searchActivo);

  const currentUser = getCurrentUser();
  const isAdmin = hasPermission(currentUser, "ADMIN_TOTAL");

  const fetchOrdenes = async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      const response = await httpClient.get("/api/ordenes");
      const data = response.data.data || response.data || [];
      setOrdenes(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.response?.status !== 401) {
        setError(err?.response?.data?.message || "Error al cargar órdenes");
      }
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdenes();
  }, []);

  const formatFecha = (fecha) => {
    if (!fecha) return "-";
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return fecha;
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  };

  const ordenesVisibles = useMemo(() => {
    if (isAdmin) {
      return ordenes;
    }
    if (!currentUser.id) {
      return ordenes;
    }
    return ordenes.filter((orden) => Number(orden.creado_por) === Number(currentUser.id));
  }, [ordenes, currentUser.id, isAdmin]);

  const entidadActivaNombre = String(selectedEntidadNombre ?? "").trim().toLowerCase();
  const entidadActivaIdNum = Number(selectedEntidadId);

  const ordenesPorEntidadActiva = useMemo(() => {
    const source = Array.isArray(ordenesVisibles) ? ordenesVisibles : [];
    const tieneEntidadActiva =
      Boolean(entidadActivaNombre) ||
      (Number.isInteger(entidadActivaIdNum) && entidadActivaIdNum > 0);

    if (!tieneEntidadActiva) {
      return source;
    }

    return source.filter((orden) => {
      const entidadesIds = (Array.isArray(orden.entidades_ids) ? orden.entidades_ids : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0);

      if (Number.isInteger(entidadActivaIdNum) && entidadActivaIdNum > 0 && entidadesIds.length > 0) {
        return entidadesIds.includes(entidadActivaIdNum);
      }

      if (entidadActivaNombre) {
        return String(orden.entidades || "").toLowerCase().includes(entidadActivaNombre);
      }

      return false;
    });
  }, [ordenesVisibles, entidadActivaNombre, entidadActivaIdNum]);

  const searchTerms = useMemo(
    () => ({
      globalTerm: deferredSearchGlobal.trim().toLowerCase(),
      entidadTerm: deferredSearchEntidad.trim().toLowerCase(),
      activoTerm: deferredSearchActivo.trim().toLowerCase()
    }),
    [deferredSearchGlobal, deferredSearchEntidad, deferredSearchActivo]
  );

  const ordenesIndex = useMemo(() => {
    return ordenesPorEntidadActiva.map((orden) => ({
      orden,
      searchIndex: buildSearchIndex(orden),
      entidades: String(orden.entidades || "").toLowerCase(),
      activos: String(orden.activos || "").toLowerCase()
    }));
  }, [ordenesPorEntidadActiva]);

  const filteredOrdenes = useMemo(() => {
    const { globalTerm, entidadTerm, activoTerm } = searchTerms;

    return ordenesIndex
      .filter((item) => {
        if (globalTerm && !item.searchIndex.includes(globalTerm)) {
          return false;
        }
        if (entidadTerm && !item.entidades.includes(entidadTerm)) {
          return false;
        }
        if (activoTerm && !item.activos.includes(activoTerm)) {
          return false;
        }

        return true;
      })
      .map((item) => item.orden);
  }, [ordenesIndex, searchTerms]);

  const consecutivoPorOrdenId = useMemo(() => {
    const source = Array.isArray(ordenesPorEntidadActiva) ? [...ordenesPorEntidadActiva] : [];
    source.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

    const map = {};
    const usados = new Set();

    source.forEach((orden) => {
      const idKey = String(orden.id || "");
      if (!idKey) return;
      const extraido = extraerConsecutivoOrden(orden.numero);
      if (Number.isInteger(extraido) && extraido > 0 && !usados.has(extraido)) {
        map[idKey] = extraido;
        usados.add(extraido);
      }
    });

    let siguiente = 1;
    source.forEach((orden) => {
      const idKey = String(orden.id || "");
      if (!idKey || map[idKey]) return;
      while (usados.has(siguiente)) {
        siguiente += 1;
      }
      map[idKey] = siguiente;
      usados.add(siguiente);
    });

    return map;
  }, [ordenesPorEntidadActiva]);

  const obtenerConsecutivoOrden = (ordenId) => {
    const consecutivo = consecutivoPorOrdenId[String(ordenId || "")];
    return Number.isInteger(consecutivo) ? consecutivo : "-";
  };

  const abrirDocumentoOrden = (documentHtml, numeroOrden, modo = "pdf") => {
    const html = String(documentHtml || "").trim();
    if (!html) return false;

    const previewUrl = createHtmlPreviewUrl(html);
    const viewer = previewUrl ? globalThis.open(previewUrl, "_blank", "width=1200,height=900") : null;
    if (!viewer) {
      if (previewUrl) {
        globalThis.URL.revokeObjectURL(previewUrl);
      }
      setError("No se pudo abrir la vista de impresion. Habilita ventanas emergentes.");
      return true;
    }

    globalThis.setTimeout(() => {
      try {
        viewer.focus();
        viewer.print();
      } catch {
        // Ignorar errores del visor del navegador al imprimir.
      }
    }, 450);

    globalThis.setTimeout(() => {
      globalThis.URL.revokeObjectURL(previewUrl);
    }, 60000);

    if (modo === "print") {
      setSuccess(`Vista lista para imprimir la orden ${numeroOrden}.`);
    } else {
      setSuccess(`Vista lista para guardar PDF de la orden ${numeroOrden}.`);
    }
    return true;
  };

  const abrirDocumentoOrdenDesdeRespaldo = (orden, modo = "pdf") => {
    const ordenId = orden.id;
    if (!ordenId) return false;

    const respaldo = localStorage.getItem(`orden_pdf_${ordenId}`);
    if (!respaldo) return false;

    try {
      const parsed = JSON.parse(respaldo);
      const numeroOrden = String(parsed.numero || orden.numero || `OT-${ordenId}`).trim();
      const mantenimientoConsecutivo =
        parsed.mantenimientoConsecutivo || parsed.mantenimiento.id || null;
      const html =
        parsed.documentoHtml ||
        buildMaintenanceOrderHtml({
          activo: parsed.activo || {},
          mantenimiento: parsed.mantenimiento || {},
          factura: parsed.factura || {},
          numeroOrden,
          mantenimientoConsecutivo,
          logos: {
            logoM5,
            logoAssetControl
          }
        });

      return abrirDocumentoOrden(html, numeroOrden, modo);
    } catch {
      return false;
    }
  };

  const descargarOrden = async (orden) => {
    const ordenId = orden.id;
    const numeroOrden = orden.numero;
    if (!ordenId) {
      return;
    }

    setError("");
    setSuccess("");
    setDownloadingId(ordenId);

    try {
      if (abrirDocumentoOrdenDesdeRespaldo(orden, "pdf")) {
        return;
      }

      const response = await httpClient.get(`/api/ordenes/${ordenId}/pdf`, {
        responseType: "blob"
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = globalThis.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Orden-${numeroOrden || ordenId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      globalThis.URL.revokeObjectURL(url);
      setSuccess(`PDF descargado para la orden ${numeroOrden || ordenId}`);
    } catch {
      const respaldo = localStorage.getItem(`orden_pdf_${ordenId}`);
      if (!respaldo) {
        setError(`No se pudo descargar PDF de la orden ${numeroOrden || ordenId}.`);
        return;
      }

      try {
        const parsed = JSON.parse(respaldo);
        const lines = [
          "RESUMEN DE ORDEN",
          "",
          `Numero: ${parsed.numero || numeroOrden || ordenId}`,
          `Activo: ${parsed.activo.activo || parsed.activo.nombre || "-"}`,
          `Técnico: ${parsed.mantenimiento.tecnico || "-"}`,
          `Tipo: ${parsed.mantenimiento.tipo || "-"}`,
          `Descripcion: ${parsed.mantenimiento.descripcion || "-"}`,
          `Factura: ${parsed.factura.numeroFactura || "-"}`
        ].join("\n");

        const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
        const url = globalThis.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Orden-${numeroOrden || ordenId}-respaldo.txt`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        globalThis.URL.revokeObjectURL(url);
      setSuccess(`No hubo PDF en el servidor. Se descargó un respaldo de la orden ${numeroOrden || ordenId}.`);
      } catch {
        setError(`No se pudo generar respaldo para la orden ${numeroOrden || ordenId}.`);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const imprimirOrden = async (orden) => {
    const ordenId = orden.id;
    const numeroOrden = orden.numero || ordenId;
    if (!ordenId) return;

    setError("");
    setSuccess("");
    setDownloadingId(ordenId);

    try {
      if (abrirDocumentoOrdenDesdeRespaldo(orden, "print")) {
        return;
      }

      const response = await httpClient.get(`/api/ordenes/${ordenId}/pdf`, {
        responseType: "blob"
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = globalThis.URL.createObjectURL(blob);
      const viewer = globalThis.open(url, "_blank");
      if (!viewer) {
        setError("No se pudo abrir la vista de impresion. Habilita ventanas emergentes.");
        globalThis.URL.revokeObjectURL(url);
        return;
      }
      setSuccess(`PDF abierto para imprimir la orden ${numeroOrden}.`);
      globalThis.setTimeout(() => {
        try {
          viewer.focus();
          viewer.print();
        } catch {
          // Ignorar errores de impresion del visor integrado.
        } finally {
          globalThis.URL.revokeObjectURL(url);
        }
      }, 700);
    } catch {
      setError(`No se pudo imprimir la orden ${numeroOrden}.`);
    } finally {
      setDownloadingId(null);
    }
  };

  const eliminarOrden = async (ordenId) => {
    if (!ordenId || !isAdmin) {
      return;
    }

    const confirmed = globalThis.confirm("Esta accion eliminara la orden. Deseas continuar");
    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setDeletingId(ordenId);

    try {
      await httpClient.delete(`/api/ordenes/${ordenId}`);
      setSuccess(`Orden ${ordenId} eliminada correctamente`);
      await fetchOrdenes();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || "Error al eliminar la orden");
    } finally {
      setDeletingId(null);
    }
  };

  const stats = useMemo(() => {
    const source = Array.isArray(filteredOrdenes) ? filteredOrdenes : [];
    return {
      total: source.length,
      firmadas: source.filter((item) => item.firmada).length,
      pendientes: source.filter((item) => !item.firmada).length
    };
  }, [filteredOrdenes]);

  const exportOrdenesCsv = () => {
    const rows = Array.isArray(filteredOrdenes) ? filteredOrdenes : [];
    if (rows.length === 0) {
      setError("No hay órdenes para exportar.");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");

    const headers = [
      "Consecutivo",
      "ID",
      "Número",
      "Estado",
      "Firmada",
      "Fecha",
      "Activos",
      "Entidades",
      "Creador",
      "Mantenimientos"
    ];

    const csvRows = [headers.map(escapeCsvValue).join(",")];
    rows.forEach((orden) => {
      const line = [
        obtenerConsecutivoOrden(orden.id),
        orden.id ?? "",
        orden.numero || "",
        orden.estado || "",
        orden.firmada ? "SI" : "NO",
        formatFecha(orden.fecha),
        orden.activos || "",
        orden.entidades || "",
        orden.creador_nombre || orden.creado_por || "",
        orden.total_mantenimientos ?? 0
      ];
      csvRows.push(line.map(escapeCsvValue).join(","));
    });

    const csvContent = `\uFEFF${csvRows.join("\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = globalThis.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute("download", `ordenes_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    globalThis.URL.revokeObjectURL(url);
    setSuccess(`Exportadas ${rows.length} órdenes a CSV.`);
  };

  const selectedOrdenBackup = useMemo(() => {
    if (!selectedOrden?.id) return null;
    try {
      const raw = localStorage.getItem(`orden_pdf_${selectedOrden.id}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [selectedOrden]);

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading">Cargando ordenes...</div>
      </div>
    );
  }

  return (
    <div className="ordenes-page">
      <h1>Órdenes de trabajo</h1>
      <p className="ordenes-subtitle">
        {isAdmin
          ? "Vista de administración: puedes ver y eliminar cualquier orden."
          : "Se muestran las órdenes generadas por tu usuario."}
      </p>

      <div className="ordenes-stats">
        <div className="ordenes-stat">Total: {stats.total}</div>
        <div className="ordenes-stat ordenes-stat-ok">Firmadas: {stats.firmadas}</div>
        <div className="ordenes-stat ordenes-stat-pending">Pendientes: {stats.pendientes}</div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}


      <div className="ordenes-filters">
        <input
          type="text"
          placeholder="Buscar general..."
          value={searchGlobal}
          onChange={(event) => setSearchGlobal(event.target.value)}
          className="search-input"
        />
        <input
          type="text"
          placeholder="Buscar por entidad..."
          value={searchEntidad}
          onChange={(event) => setSearchEntidad(event.target.value)}
          className="search-input"
        />
        <input
          type="text"
          placeholder="Buscar por activo / reporte..."
          value={searchActivo}
          onChange={(event) => setSearchActivo(event.target.value)}
          className="search-input"
        />
        <button
          type="button"
          className="btn-action ordenes-export-button"
          onClick={exportOrdenesCsv}
          disabled={filteredOrdenes.length === 0}
          title="Exportar órdenes filtradas a CSV"
        >
          Exportar CSV ({filteredOrdenes.length})
        </button>
      </div>

      {filteredOrdenes.length === 0 ? (
        <div className="no-data">
          {ordenesPorEntidadActiva.length === 0 ? "No hay órdenes disponibles." : "No se encontraron resultados para los filtros aplicados."}
        </div>
      ) : (
        <div className="ordenes-table-wrap">
          <table className="ordenes-table">
          <thead>
            <tr>
              <th>Consecutivo</th>
              <th>ID</th>
              <th>Numero</th>
              <th>Estado</th>
              <th>Firmada</th>
              <th>Fecha</th>
              <th>Activos</th>
              <th>Entidades</th>
              <th>Creador</th>
              <th>Mants.</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrdenes.map((orden) => (
              <tr key={orden.id}>
                <td>{obtenerConsecutivoOrden(orden.id)}</td>
                <td>{orden.id}</td>
                <td>{orden.numero || "-"}</td>
                <td>{orden.estado || "-"}</td>
                <td>{orden.firmada ? "SI" : "NO"}</td>
                <td>{formatFecha(orden.fecha)}</td>
                <td>{orden.activos || "-"}</td>
                <td>{orden.entidades || "-"}</td>
                <td>{orden.creador_nombre || orden.creado_por || "-"}</td>
                <td>{orden.total_mantenimientos ?? 0}</td>
                <td className="ordenes-actions-cell">
                  <button
                    className="btn-action"
                    onClick={() => setSelectedOrden(orden)}
                    title="Ver detalle"
                  >
                    Ver
                  </button>
                  <button
                    className="btn-action"
                    onClick={() => descargarOrden(orden)}
                    disabled={downloadingId === orden.id}
                    title="Descargar PDF"
                  >
                    {downloadingId === orden.id ? "..." : "PDF"}
                  </button>
                  <button
                    className="btn-action"
                    onClick={() => imprimirOrden(orden)}
                    disabled={downloadingId === orden.id}
                    title="Imprimir"
                  >
                    Imprimir
                  </button>
                  {isAdmin && (
                    <button
                      className="btn-action"
                      onClick={() => eliminarOrden(orden.id)}
                      disabled={deletingId === orden.id}
                      title="Eliminar orden"
                    >
                      {deletingId === orden.id ? "..." : "Eliminar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}

      {selectedOrden && (
        <dialog
          open
          className="ordenes-detail-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedOrden(null);
            }
          }}
          onCancel={(event) => {
            event.preventDefault();
            setSelectedOrden(null);
          }}
          aria-labelledby="orden-detail-title"
        >
          <div className="ordenes-detail-card" onClick={(event) => event.stopPropagation()}>
            <h3 id="orden-detail-title">Detalle de orden {selectedOrden.numero || `#${selectedOrden.id}`}</h3>
            <div className="ordenes-detail-grid">
              <p><strong>Consecutivo:</strong> {obtenerConsecutivoOrden(selectedOrden.id)}</p>
              <p><strong>Estado:</strong> {selectedOrden.estado || "-"}</p>
              <p><strong>Firmada:</strong> {selectedOrden.firmada ? "SI" : "NO"}</p>
              <p><strong>Fecha:</strong> {formatFecha(selectedOrden.fecha)}</p>
              <p><strong>Activos:</strong> {selectedOrden.activos || "-"}</p>
              <p><strong>Entidades:</strong> {selectedOrden.entidades || "-"}</p>
              <p><strong>Creador:</strong> {selectedOrden.creador_nombre || selectedOrden.creado_por || "-"}</p>
              <p><strong>Mantenimientos:</strong> {selectedOrden.total_mantenimientos ?? 0}</p>
            </div>
            <div className="ordenes-detail-block">
              <h4>Cambio de partes</h4>
              <p>{selectedOrdenBackup?.mantenimiento?.cambio_partes || selectedOrdenBackup?.mantenimiento?.cambioPartes || "Sin dato registrado en la orden."}</p>
            </div>
            <div className="ordenes-detail-block">
              <h4>Trabajo realizado</h4>
              <p>{selectedOrdenBackup?.mantenimiento?.descripcion || "Sin descripción registrada."}</p>
            </div>
            <div className="ordenes-detail-actions">
              <button className="btn-action" onClick={() => descargarOrden(selectedOrden)}>
                Descargar PDF
              </button>
              <button className="btn-action" onClick={() => imprimirOrden(selectedOrden)}>
                Imprimir
              </button>
              <button className="btn-action" onClick={() => setSelectedOrden(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}




OrdenesPage.propTypes = {
  selectedEntidadId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selectedEntidadNombre: PropTypes.string
};
