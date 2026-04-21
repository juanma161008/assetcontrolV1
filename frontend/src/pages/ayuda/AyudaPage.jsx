import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "../../styles/InfoPages.css";
import httpClient from "../../services/httpClient";
import { getCurrentUser } from "../../services/authService";
import { hasPermission } from "../../utils/permissions";

export default function AyudaPage() {
  const [threads, setThreads] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [openThreadId, setOpenThreadId] = useState(null);
  const [threadMessages, setThreadMessages] = useState({});
  const [loadingThreadId, setLoadingThreadId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [adminStatusDrafts, setAdminStatusDrafts] = useState({});
  const [isUpdatingThread, setIsUpdatingThread] = useState(false);
  const [formAdjuntos, setFormAdjuntos] = useState([]);
  const [replyAdjuntos, setReplyAdjuntos] = useState({});
  const [formData, setFormData] = useState({
    titulo: "",
    categoria: "",
    prioridad: "MEDIA",
    admin_asignado_id: "",
    mensaje: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const formRef = useRef(null);
  const location = useLocation();
  const MAX_ADJUNTOS = 4;
  const MAX_ADJUNTO_BYTES = 2 * 1024 * 1024;
  const ALLOWED_ADJUNTO_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp"
  ];

  const loadHelpdesk = async () => {
    try {
      setIsLoading(true);
      setError("");
      const [threadsResponse, adminsResponse] = await Promise.all([
        httpClient.get("/api/helpdesk/threads"),
        httpClient.get("/api/helpdesk/admins")
      ]);

      setThreads(threadsResponse.data?.data || []);
      setAdmins(adminsResponse.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "No fue posible cargar la mesa de ayuda.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHelpdesk();
  }, []);

  useEffect(() => {
    if (!admins.length) return;
    setFormData((prev) => {
      const current = Number(prev.admin_asignado_id);
      const exists = admins.some((admin) => Number(admin.id) === current);
      if (exists) return prev;
      return { ...prev, admin_asignado_id: admins[0].id };
    });
  }, [admins]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("nuevo") === "1" || params.get("nuevo") === "true") {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [location.search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, statusFilter, priorityFilter]);

  const currentUser = getCurrentUser();
  const isAdmin = hasPermission(currentUser, "ADMIN_TOTAL");

  const normalizeEstado = (value = "") => String(value || "").toUpperCase().replace(/\s+/g, "_");

  const stats = useMemo(() => {
    const abiertos = threads.filter((item) => normalizeEstado(item.estado) === "ABIERTO").length;
    const enRevision = threads.filter((item) => normalizeEstado(item.estado) === "EN_REVISION").length;
    const resueltos = threads.filter((item) => normalizeEstado(item.estado) === "RESUELTO").length;
    return [
      { label: "Abiertos", value: abiertos },
      { label: "En revision", value: enRevision },
      { label: "Resueltos", value: resueltos },
      { label: "SLA respuesta", value: "24h" }
    ];
  }, [threads]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      const haystack = [
        thread.titulo,
        thread.categoria,
        thread.creado_por_nombre,
        thread.prioridad,
        thread.estado,
        thread.id
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
      const matchesStatus =
        statusFilter === "ALL" || normalizeEstado(thread.estado) === statusFilter;
      const normalizedPriority = String(thread.prioridad || "MEDIA").toUpperCase();
      const matchesPriority = priorityFilter === "ALL" || normalizedPriority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [threads, normalizedSearch, statusFilter, priorityFilter]);

  const totalThreads = filteredThreads.length;
  const totalPages = Math.max(1, Math.ceil(totalThreads / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * itemsPerPage;
  const pageEnd = Math.min(pageStart + itemsPerPage, totalThreads);
  const paginatedThreads = filteredThreads.slice(pageStart, pageEnd);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!openThreadId) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenThreadId(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [openThreadId]);

  const formatDate = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("es-CO");
  };

  const formatMessageDate = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString("es-CO");
  };

  const normalizeAdjuntos = (value) => {
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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.titulo.trim() || !formData.mensaje.trim()) {
      setError("Titulo y mensaje son obligatorios.");
      return;
    }

    if (!formData.admin_asignado_id) {
      setError("Debes asignar un administrador para este caso.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await httpClient.post("/api/helpdesk/threads", {
        titulo: formData.titulo,
        categoria: formData.categoria || "General",
        prioridad: formData.prioridad || "MEDIA",
        admin_asignado_id: formData.admin_asignado_id,
        mensaje: formData.mensaje,
        adjuntos: formAdjuntos
      });
      setFormData({
        titulo: "",
        categoria: "",
        prioridad: "MEDIA",
        admin_asignado_id: formData.admin_asignado_id,
        mensaje: ""
      });
      setFormAdjuntos([]);
      await loadHelpdesk();
    } catch (err) {
      setError(err?.response?.data?.message || "No fue posible crear el hilo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadThreadMessages = async (threadId) => {
    try {
      setLoadingThreadId(threadId);
      const response = await httpClient.get(`/api/helpdesk/threads/${threadId}`);
      const mensajes = response.data?.data?.mensajes || [];
      setThreadMessages((prev) => ({ ...prev, [threadId]: mensajes }));
    } catch (err) {
      setError(err?.response?.data?.message || "No fue posible cargar la conversacion.");
      setOpenThreadId(null);
    } finally {
      setLoadingThreadId(null);
    }
  };

  const handleToggleThread = async (threadId) => {
    if (openThreadId === threadId) {
      setOpenThreadId(null);
      return;
    }
    setOpenThreadId(threadId);
    if (!threadMessages[threadId]) {
      await loadThreadMessages(threadId);
    }
  };

  const handleReplyChange = (threadId, value) => {
    setReplyDrafts((prev) => ({ ...prev, [threadId]: value }));
  };

  const handleSendReply = async (threadId) => {
    const mensaje = String(replyDrafts[threadId] || "").trim();
    const adjuntos = replyAdjuntos[threadId] || [];
    if (!mensaje && adjuntos.length === 0) {
      setError("Escribe un mensaje antes de enviar.");
      return;
    }

    try {
      setIsSendingReply(true);
      setError("");
      await httpClient.post(`/api/helpdesk/threads/${threadId}/messages`, {
        mensaje,
        adjuntos
      });
      setReplyDrafts((prev) => ({ ...prev, [threadId]: "" }));
      setReplyAdjuntos((prev) => ({ ...prev, [threadId]: [] }));
      await loadThreadMessages(threadId);
      await loadHelpdesk();
    } catch (err) {
      setError(err?.response?.data?.message || "No fue posible enviar la respuesta.");
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleAdminStatusChange = (threadId, value) => {
    setAdminStatusDrafts((prev) => ({ ...prev, [threadId]: value }));
  };

  const handleAdminUpdateThread = async (threadId) => {
    if (!isAdmin) return;
    const nextStatus = adminStatusDrafts[threadId];
    if (!nextStatus) return;

    try {
      setIsUpdatingThread(true);
      setError("");
      await httpClient.patch(`/api/helpdesk/threads/${threadId}`, {
        estado: nextStatus
      });
      await loadHelpdesk();
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo actualizar el caso.");
    } finally {
      setIsUpdatingThread(false);
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleItemsPerPageChange = (event) => {
    const value = Number(event.target.value);
    setItemsPerPage(Number.isFinite(value) && value > 0 ? value : 10);
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });

  const buildAdjuntoPayload = async (file) => {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl
    };
  };

  const filterValidAdjuntos = (files = []) => {
    const accepted = [];
    const rejects = [];

    Array.from(files).forEach((file) => {
      if (!ALLOWED_ADJUNTO_TYPES.includes(file.type)) {
        rejects.push(`Tipo no permitido: ${file.name}`);
        return;
      }
      if (file.size > MAX_ADJUNTO_BYTES) {
        rejects.push(`Archivo muy grande: ${file.name}`);
        return;
      }
      accepted.push(file);
    });

    return { accepted, rejects };
  };

  const handleFormAdjuntosChange = async (event) => {
    const files = event.target.files || [];
    if (!files.length) return;

    const { accepted, rejects } = filterValidAdjuntos(files);
    if (rejects.length) {
      setError(rejects.join(". "));
    }

    const currentCount = formAdjuntos.length;
    const availableSlots = Math.max(0, MAX_ADJUNTOS - currentCount);
    const toProcess = accepted.slice(0, availableSlots);
    if (!toProcess.length) return;

    const payloads = await Promise.all(toProcess.map(buildAdjuntoPayload));
    setFormAdjuntos((prev) => [...prev, ...payloads]);
    event.target.value = "";
  };

  const handleReplyAdjuntosChange = async (threadId, event) => {
    const files = event.target.files || [];
    if (!files.length) return;

    const { accepted, rejects } = filterValidAdjuntos(files);
    if (rejects.length) {
      setError(rejects.join(". "));
    }

    const current = replyAdjuntos[threadId] || [];
    const availableSlots = Math.max(0, MAX_ADJUNTOS - current.length);
    const toProcess = accepted.slice(0, availableSlots);
    if (!toProcess.length) return;

    const payloads = await Promise.all(toProcess.map(buildAdjuntoPayload));
    setReplyAdjuntos((prev) => ({ ...prev, [threadId]: [...current, ...payloads] }));
    event.target.value = "";
  };

  const removeFormAdjunto = (index) => {
    setFormAdjuntos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const removeReplyAdjunto = (threadId, index) => {
    setReplyAdjuntos((prev) => ({
      ...prev,
      [threadId]: (prev[threadId] || []).filter((_, idx) => idx !== index)
    }));
  };

  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
  };

  const handlePriorityFilterChange = (event) => {
    setPriorityFilter(event.target.value);
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleCloseThread = () => {
    setOpenThreadId(null);
  };

  const handleFocusForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const statusLabel = (value = "") => {
    const normalized = normalizeEstado(value);
    if (normalized === "EN_REVISION") return "En revision";
    if (normalized === "RESUELTO") return "Resuelto";
    return "Abierto";
  };

  const statusClass = (value = "") => {
    const normalized = normalizeEstado(value);
    if (normalized === "EN_REVISION") return "review";
    if (normalized === "RESUELTO") return "resolved";
    return "open";
  };

  const adminRoleLabel = (rolId) => {
    if (Number(rolId) === 1) return "Administrador";
    return "Soporte interno";
  };

  const activeThread = useMemo(() => {
    if (!openThreadId) return null;
    return threads.find((thread) => Number(thread.id) === Number(openThreadId)) || null;
  }, [openThreadId, threads]);

  return (
    <div className="info-page helpdesk-page">
      <div className="tickets-header">
        <div>
          <span className="tickets-eyebrow">Comunicaciones internas</span>
          <h1>MIS TICKETS</h1>
          <p className="tickets-subtitle">
            Comunicaciones internas privadas: solo el administrador asignado puede ver y resolver tu caso.
          </p>
        </div>
        <button type="button" className="btn-action" onClick={handleFocusForm}>
          Crear caso
        </button>
      </div>

      <div className="tickets-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="tickets-stat">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="helpdesk-board">
        <section className="tickets-card">
          <div className="tickets-toolbar">
            <div className="tickets-toolbar-left">
              <span>Mostrar</span>
              <select value={itemsPerPage} onChange={handleItemsPerPageChange}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
              <span>Datos</span>
            </div>
            <div className="tickets-toolbar-right">
              <div className="tickets-filters">
                <label>
                  Estado
                  <select value={statusFilter} onChange={handleStatusFilterChange}>
                    <option value="ALL">Todos</option>
                    <option value="ABIERTO">Abiertos</option>
                    <option value="EN_REVISION">En revision</option>
                    <option value="RESUELTO">Resueltos</option>
                  </select>
                </label>
                <label>
                  Prioridad
                  <select value={priorityFilter} onChange={handlePriorityFilterChange}>
                    <option value="ALL">Todas</option>
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Media</option>
                    <option value="BAJA">Baja</option>
                  </select>
                </label>
              </div>
              <div className="tickets-search">
                <span>Buscar:</span>
                <input
                  type="text"
                  placeholder="ID, categoria, solicitante..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </div>
            </div>
          </div>

          <div className="tickets-table-wrapper">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>AREA</th>
                  <th>DESCRIPCION</th>
                  <th>SOLICITANTE</th>
                  <th>FECHA</th>
                  <th>PRIORIDAD</th>
                  <th>ACCION</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan="7" className="tickets-empty">Cargando casos...</td>
                  </tr>
                )}
                {!isLoading && paginatedThreads.length === 0 && (
                  <tr>
                    <td colSpan="7" className="tickets-empty">No hay datos para mostrar</td>
                  </tr>
                )}
                {!isLoading && paginatedThreads.map((thread) => (
                  <tr key={thread.id} className={openThreadId === thread.id ? "ticket-row-active" : ""}>
                    <td>{thread.id}</td>
                    <td>{thread.categoria || "General"}</td>
                    <td>
                      <div className="ticket-title">{thread.titulo}</div>
                      <div className="ticket-meta">
                        <span className={`ticket-status status-${statusClass(thread.estado)}`}>
                          {statusLabel(thread.estado)}
                        </span>
                        <span className="ticket-status status-private">Privado</span>
                        {thread.tiene_respuesta_admin && (
                          <span className="ticket-status status-admin">Admin</span>
                        )}
                      </div>
                      <div className="ticket-meta-secondary">
                        Admin: {thread.admin_asignado_nombre || "Sin asignar"} -
                        Ultima respuesta: {thread.ultimo_mensaje_por_nombre || thread.creado_por_nombre || "Usuario"} -
                        {formatDate(thread.ultimo_mensaje_en || thread.creado_en || thread.actualizado_en)}
                      </div>
                    </td>
                    <td>{thread.creado_por_nombre || "Usuario"}</td>
                    <td>{formatDate(thread.ultimo_mensaje_en || thread.creado_en || thread.actualizado_en)}</td>
                    <td>
                      <span className={`ticket-priority priority-${String(thread.prioridad || "MEDIA").toLowerCase()}`}>
                        {String(thread.prioridad || "MEDIA").toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ticket-action-btn"
                        onClick={() => handleToggleThread(thread.id)}
                      >
                        {openThreadId === thread.id ? "Cerrar" : "Ver"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="tickets-footer">
            <span>
              Mostrando {totalThreads === 0 ? 0 : pageStart + 1} a {pageEnd} de {totalThreads} Datos
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
        </section>

        <aside className="tickets-aside">
          <div className="helpdesk-card" ref={formRef}>
            <h2>Crear caso</h2>
            <form className="helpdesk-form" onSubmit={handleSubmit}>
              <input
                name="titulo"
                type="text"
                placeholder="Asunto corto"
                value={formData.titulo}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              <select
                name="categoria"
                value={formData.categoria}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="">Selecciona categoria</option>
                <option>Activos</option>
                <option>Mantenimientos</option>
                <option>Ordenes de trabajo</option>
                <option>ISO 55000</option>
                <option>General</option>
              </select>
              <select
                name="admin_asignado_id"
                value={formData.admin_asignado_id}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="">Asignar administrador</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.nombre}
                  </option>
                ))}
              </select>
              <select
                name="prioridad"
                value={formData.prioridad}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="BAJA">Prioridad baja</option>
                <option value="MEDIA">Prioridad media</option>
                <option value="ALTA">Prioridad alta</option>
              </select>
              <textarea
                name="mensaje"
                placeholder="Describe tu solicitud o duda"
                value={formData.mensaje}
                onChange={handleChange}
                disabled={isSubmitting}
              ></textarea>
              <div className="helpdesk-attachments">
                <label>
                  Adjuntar archivos (max {MAX_ADJUNTOS})
                  <input
                    type="file"
                    multiple
                    accept={ALLOWED_ADJUNTO_TYPES.join(",")}
                    onChange={handleFormAdjuntosChange}
                    disabled={isSubmitting || formAdjuntos.length >= MAX_ADJUNTOS}
                  />
                </label>
                {formAdjuntos.length > 0 && (
                  <div className="attachment-list">
                    {formAdjuntos.map((adjunto, index) => (
                      <div key={`${adjunto.name}-${index}`} className="attachment-item">
                        <span>{adjunto.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFormAdjunto(index)}
                          disabled={isSubmitting}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="btn-action" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : "Enviar consulta"}
              </button>
            </form>
          </div>

          <div className="helpdesk-card">
            <h2>Administradores disponibles</h2>
            <div className="admin-list">
              {admins.map((admin) => (
                <div key={admin.id} className="admin-item">
                  <div className="admin-avatar">{String(admin.nombre || "AD").slice(0, 2).toUpperCase()}</div>
                  <div>
                    <span>{admin.nombre}</span>
                    <small>{adminRoleLabel(admin.rol_id)} - Disponible</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {activeThread && (
        <div className="helpdesk-modal-overlay" onClick={handleCloseThread} role="presentation">
          <div
            className="helpdesk-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="helpdesk-modal-header">
              <div>
                <span className="tickets-eyebrow">Caso #{activeThread.id}</span>
                <h2>{activeThread.titulo}</h2>
                <p className="tickets-subtitle">
                  Admin asignado: {activeThread.admin_asignado_nombre || "Sin asignar"} - Comunicacion privada.
                </p>
              </div>
              <button type="button" className="helpdesk-modal-close" onClick={handleCloseThread}>
                Cerrar
              </button>
            </div>

            <div className="tickets-conversation-meta">
              <span className={`ticket-status status-${statusClass(activeThread.estado)}`}>
                {statusLabel(activeThread.estado)}
              </span>
              <span className={`ticket-priority priority-${String(activeThread.prioridad || "MEDIA").toLowerCase()}`}>
                {String(activeThread.prioridad || "MEDIA").toUpperCase()}
              </span>
              <span className="ticket-category">{activeThread.categoria || "General"}</span>
            </div>

            {isAdmin && (
              <div className="tickets-admin-actions">
                <select
                  value={adminStatusDrafts[activeThread.id] || String(activeThread.estado || "ABIERTO").toUpperCase().replace(/\s+/g, "_")}
                  onChange={(event) => handleAdminStatusChange(activeThread.id, event.target.value)}
                  disabled={isUpdatingThread}
                >
                  <option value="ABIERTO">Abierto</option>
                  <option value="EN_REVISION">En revision</option>
                  <option value="RESUELTO">Resuelto</option>
                </select>
                <button
                  type="button"
                  className="btn-action"
                  onClick={() => handleAdminUpdateThread(activeThread.id)}
                  disabled={isUpdatingThread}
                >
                  {isUpdatingThread ? "Actualizando..." : "Actualizar caso"}
                </button>
              </div>
            )}

            <div className="tickets-conversation-body">
              {loadingThreadId === activeThread.id && (
                <p className="info-intro">Cargando mensajes...</p>
              )}
              {loadingThreadId !== activeThread.id && (
                <>
                  <div className="thread-messages">
                    {(threadMessages[activeThread.id] || []).length === 0 && (
                      <p className="info-intro">No hay mensajes aun.</p>
                    )}
                    {(threadMessages[activeThread.id] || []).map((message) => {
                      const adjuntos = normalizeAdjuntos(message.adjuntos);
                      return (
                        <div
                          key={message.id}
                          className={`message-item ${Number(message.creado_por_rol) === 1 ? "admin" : ""}`}
                        >
                          <div className="message-meta">
                            <strong>{message.creado_por_nombre || "Usuario"}</strong>
                            <span>{formatMessageDate(message.creado_en)}</span>
                          </div>
                          <p className="message-text">{message.mensaje}</p>
                          {adjuntos.length > 0 && (
                            <div className="attachment-list">
                              {adjuntos.map((adjunto, index) => (
                                <a
                                  key={`${message.id}-adj-${index}`}
                                  className="attachment-link"
                                  href={adjunto.dataUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {adjunto.name || `Adjunto ${index + 1}`}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="thread-reply-form">
                    <textarea
                      placeholder="Escribe una respuesta"
                      value={replyDrafts[activeThread.id] || ""}
                      onChange={(event) => handleReplyChange(activeThread.id, event.target.value)}
                      disabled={isSendingReply}
                    ></textarea>
                    <div className="helpdesk-attachments">
                      <label>
                        Adjuntar archivos
                        <input
                          type="file"
                          multiple
                          accept={ALLOWED_ADJUNTO_TYPES.join(",")}
                          onChange={(event) => handleReplyAdjuntosChange(activeThread.id, event)}
                          disabled={isSendingReply || (replyAdjuntos[activeThread.id] || []).length >= MAX_ADJUNTOS}
                        />
                      </label>
                      {(replyAdjuntos[activeThread.id] || []).length > 0 && (
                        <div className="attachment-list">
                          {(replyAdjuntos[activeThread.id] || []).map((adjunto, index) => (
                            <div key={`${adjunto.name}-${index}`} className="attachment-item">
                              <span>{adjunto.name}</span>
                              <button
                                type="button"
                                onClick={() => removeReplyAdjunto(activeThread.id, index)}
                                disabled={isSendingReply}
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="thread-reply-actions">
                      <button
                        type="button"
                        className="btn-action"
                        onClick={() => handleSendReply(activeThread.id)}
                        disabled={isSendingReply}
                      >
                        {isSendingReply ? "Enviando..." : "Responder"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

