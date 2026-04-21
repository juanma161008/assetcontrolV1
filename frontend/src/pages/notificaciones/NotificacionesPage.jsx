import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import httpClient from "../../services/httpClient";
import "../../styles/InfoPages.css";
import "../../styles/Notificaciones.css";

const DEFAULT_TIPOS = [
  { value: "ALL", label: "Todos los modulos" },
  { value: "ACTIVO", label: "Activos" },
  { value: "MANTENIMIENTO", label: "Mantenimientos" },
  { value: "ORDEN", label: "Ordenes" },
  { value: "HELPDESK", label: "Mesa de ayuda" },
  { value: "SISTEMA", label: "Sistema" }
];

export default function NotificacionesPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("ALL");
  const [estado, setEstado] = useState("ALL");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
  const safePage = Math.min(page, totalPages);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("page", String(safePage));

    if (search.trim()) {
      params.set("q", search.trim());
    }
    if (tipo !== "ALL") {
      params.set("tipo", tipo);
    }
    if (estado === "LEIDAS") {
      params.set("leido", "true");
    }
    if (estado === "NO_LEIDAS") {
      params.set("leido", "false");
    }

    return params.toString();
  }, [limit, safePage, search, tipo, estado]);

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const query = buildParams();
      const response = await httpClient.get(`/api/notificaciones?${query}`);
      const payload = response.data?.data;
      const list = Array.isArray(payload) ? payload : payload?.items || [];
      setItems(list);
      setTotal(Number(payload?.total ?? list.length));
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudieron cargar las notificaciones.");
      setItems([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    setPage(1);
  }, [search, tipo, estado, limit]);

  const handleMarkAll = async () => {
    try {
      await httpClient.patch("/api/notificaciones/marcar-todas");
      setItems((prev) => prev.map((item) => ({ ...item, leido: true })));
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudieron actualizar las notificaciones.");
    }
  };

  const handleMarkRead = async (notification) => {
    if (!notification || notification.leido) {
      return;
    }
    try {
      await httpClient.patch(`/api/notificaciones/${notification.id}/leido`);
      setItems((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, leido: true } : item))
      );
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo actualizar la notificacion.");
    }
  };

  const handleDelete = async (notification) => {
    if (!notification) return;
    try {
      await httpClient.delete(`/api/notificaciones/${notification.id}`);
      setItems((prev) => prev.filter((item) => item.id !== notification.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo eliminar la notificacion.");
    }
  };

  const handlePrevPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

  const formatDate = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString("es-CO");
  };

  return (
    <div className="info-page notifications-page">
      <div className="tickets-header notifications-header">
        <div>
          <span className="tickets-eyebrow">Centro de notificaciones</span>
          <h1>NOTIFICACIONES</h1>
          <p className="tickets-subtitle">
            Filtra por modulo, estado de lectura y busca mensajes recientes.
          </p>
        </div>
        <button type="button" className="btn-action" onClick={handleMarkAll}>
          Marcar todas como leidas
        </button>
      </div>

      <div className="notification-filters">
        <label>
          Modulo
          <select value={tipo} onChange={(event) => setTipo(event.target.value)}>
            {DEFAULT_TIPOS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="ALL">Todas</option>
            <option value="NO_LEIDAS">No leidas</option>
            <option value="LEIDAS">Leidas</option>
          </select>
        </label>
        <label className="notification-search">
          Buscar
          <input
            type="text"
            placeholder="Titulo o mensaje"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="notification-center-card">
        {isLoading ? (
          <div className="notification-empty">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="notification-empty">No hay notificaciones para este filtro.</div>
        ) : (
          <div className="notification-center-list">
            {items.map((item) => (
              <article key={item.id} className={`notification-center-item ${item.leido ? "read" : "unread"}`}>
                <header>
                  <h3>{item.titulo}</h3>
                  <span>{formatDate(item.creado_en)}</span>
                </header>
                {item.mensaje && <p>{item.mensaje}</p>}
                <footer>
                  <span className="notification-tag">{item.tipo}</span>
                  <div className="notification-actions">
                    {!item.leido && (
                      <button type="button" onClick={() => handleMarkRead(item)}>
                        Marcar leida
                      </button>
                    )}
                    <button type="button" className="btn-danger" onClick={() => handleDelete(item)}>
                      Eliminar
                    </button>
                    {item.url && (
                      <Link to={item.url} className="btn-link">
                        Ver modulo
                      </Link>
                    )}
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}

        <div className="tickets-footer notifications-footer">
          <span>
            Mostrando {items.length === 0 ? 0 : (safePage - 1) * limit + 1} a{" "}
            {(safePage - 1) * limit + items.length} de {total} Datos
          </span>
          <div className="tickets-pagination">
            <button type="button" onClick={handlePrevPage} disabled={safePage <= 1}>
              Anterior
            </button>
            <button type="button" onClick={handleNextPage} disabled={safePage >= totalPages}>
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
