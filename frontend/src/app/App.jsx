import { Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";

// Pages
import Login from "../pages/auth/login";
import Home from "../pages/home/Home";
import ActivosPage from "../pages/activos/ActivosPage";
import MantenimientosPage from "../pages/mantenimientos/MantenimientosPage";
import CronogramaPage from "../pages/cronograma/CronogramaPage";
import OrdenesPage from "../pages/ordenes/OrdenesPage";
import AuditoriaPage from "../pages/auditoria/AuditoriaPage";
import EntidadesPage from "../pages/entidades/EntidadesPage";
import UsuariosPage from "../pages/usuarios/UsuariosPage";
import MiCuentaPage from "../pages/mi-cuenta/MiCuentaPage";
import AyudaPage from "../pages/ayuda/AyudaPage";
import AcercaDePage from "../pages/acerca-de/AcercaDePage";
import NotificacionesPage from "../pages/notificaciones/NotificacionesPage";
import Iso55000Page from "../pages/iso/Iso55000Page";

// Layout Components
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { hasAnyPermission, hasPermission } from "../utils/permissions";
import {
  clearSession,
  fetchCurrentUser,
  getSession,
  INACTIVITY_TIMEOUT_MS,
  isSessionExpired,
  updateLastActivity
} from "../services/authService";

// Styles
import "../styles/Global.css";

function ProtectedRoute({ user, requiredPermissions, mustChangePassword, children }) {
  if (mustChangePassword) {
    return <Navigate to="/mi-cuenta" replace />;
  }

  if (!hasAnyPermission(user, requiredPermissions)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

ProtectedRoute.propTypes = {
  user: PropTypes.shape({
    permisos: PropTypes.arrayOf(PropTypes.string)
  }),
  requiredPermissions: PropTypes.arrayOf(PropTypes.string),
  mustChangePassword: PropTypes.bool,
  children: PropTypes.node.isRequired
};

ProtectedRoute.defaultProps = {
  user: null,
  requiredPermissions: [],
  mustChangePassword: false
};

function App() {
  const ACTIVE_ENTITY_STORAGE_KEY = "active_entidad_id";
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [entitySearch, setEntitySearch] = useState("");
  const [isEntitySelectorOpen, setIsEntitySelectorOpen] = useState(false);
  const [selectedEntidadId, setSelectedEntidadId] = useState(
    () => localStorage.getItem(ACTIVE_ENTITY_STORAGE_KEY) || ""
  );
  const mustChangePassword = Boolean(user?.debe_cambiar_password);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const modalSelector = [
      ".modal-overlay",
      "dialog[open]",
      ".modal-dialog[open]",
      ".signature-modal-overlay",
      ".asset-detail-modal-overlay",
      ".helpdesk-modal-overlay",
      ".order-sign-modal-overlay",
      ".unlock-modal-content"
    ].join(", ");

    const { document } = window;
    const { body } = document;
    let rafId = 0;

    const syncModalState = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const hasModal = Boolean(document.querySelector(modalSelector));
        body.classList.toggle("modal-open", hasModal);
      });
    };

    syncModalState();

    const observer = new MutationObserver(syncModalState);
    observer.observe(body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "class", "style"]
    });

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      body.classList.remove("modal-open");
    };
  }, []);

  useEffect(() => {
    // Check authentication on mount and validate session with backend.
    const checkAuth = async () => {
      const session = getSession();
      if (!session?.token) {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      if (isSessionExpired()) {
        clearSession();
        setUser(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      const refreshed = await fetchCurrentUser();
      if (refreshed.success && refreshed.user) {
        setUser(refreshed.user);
        setIsAuthenticated(true);
        updateLastActivity();
      } else {
        clearSession();
        setUser(null);
        setIsAuthenticated(false);
      }

      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Function to update auth state after login
  // Login component passes { user, token } to onLoginSuccess
  const handleLoginSuccess = (sessionData) => {
    localStorage.removeItem(ACTIVE_ENTITY_STORAGE_KEY);
    setSelectedEntidadId("");
    setEntitySearch("");
    setIsEntitySelectorOpen(false);

    // sessionData can be { user, token } or just user object
    if (sessionData?.user && sessionData?.token) {
      // New format - store as { user, token }
      const session = { user: sessionData.user, token: sessionData.token };
      localStorage.setItem("user", JSON.stringify(session));
      setUser(sessionData.user);
    } else if (sessionData) {
      // Just user data - store directly
      localStorage.setItem("user", JSON.stringify(sessionData));
      setUser(sessionData);
    } else {
      setUser(null);
    }
    updateLastActivity();
    setIsAuthenticated(true);
  };

  // Function to handle logout
  const handleLogout = useCallback(() => {
    clearSession();
    localStorage.removeItem(ACTIVE_ENTITY_STORAGE_KEY);
    setUser(null);
    setIsAuthenticated(false);
    setEntitySearch("");
    setSelectedEntidadId("");
    setIsEntitySelectorOpen(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const activityEvents = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    let inactivityTimeoutId = null;
    let lastActivityUpdateAt = 0;

    const lockByInactivity = () => {
      handleLogout();
    };

    const resetInactivityTimer = () => {
      const now = Date.now();
      if (now - lastActivityUpdateAt >= 10000) {
        updateLastActivity();
        lastActivityUpdateAt = now;
      }

      if (inactivityTimeoutId) {
        globalThis.clearTimeout(inactivityTimeoutId);
      }
      inactivityTimeoutId = globalThis.setTimeout(lockByInactivity, INACTIVITY_TIMEOUT_MS);
    };

    if (isSessionExpired()) {
      lockByInactivity();
      return undefined;
    }

    resetInactivityTimer();

    activityEvents.forEach((eventName) => {
      globalThis.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (isSessionExpired()) {
        lockByInactivity();
        return;
      }
      resetInactivityTimer();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const expirationWatcher = globalThis.setInterval(() => {
      if (isSessionExpired()) {
        lockByInactivity();
      }
    }, 15000);

    return () => {
      if (inactivityTimeoutId) {
        globalThis.clearTimeout(inactivityTimeoutId);
      }
      globalThis.clearInterval(expirationWatcher);
      activityEvents.forEach((eventName) => {
        globalThis.removeEventListener(eventName, resetInactivityTimer);
      });
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAuthenticated, handleLogout]);

  const handleUserUpdate = useCallback((nextUser) => {
    if (nextUser) {
      setUser(nextUser);
    }
  }, []);

  const handleEntityChange = useCallback((nextEntityId) => {
    const normalized = String(nextEntityId || "").trim();
    setSelectedEntidadId(normalized);
    setIsEntitySelectorOpen(false);
    if (normalized) {
      localStorage.setItem(ACTIVE_ENTITY_STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(ACTIVE_ENTITY_STORAGE_KEY);
    }
  }, []);

  const handleOpenEntitySelector = useCallback(() => {
    setEntitySearch("");
    setIsEntitySelectorOpen(true);
  }, []);

  const isAdmin = hasPermission(user, "ADMIN_TOTAL");
  const entidadesAsignadas = useMemo(() => {
    const source = Array.isArray(user?.entidades_asignadas) ? user.entidades_asignadas : [];
    return source
      .map((item) => ({
        id: String(item.id || item || "").trim(),
        nombre: String(item.nombre || "").trim()
      }))
      .filter((item) => item.id);
  }, [user]);

  const entidadesAsignadasFiltradas = useMemo(() => {
    const term = String(entitySearch || "").trim().toLowerCase();
    if (!term) return entidadesAsignadas;
    return entidadesAsignadas.filter((item) =>
      String(item.nombre || "").toLowerCase().includes(term)
    );
  }, [entidadesAsignadas, entitySearch]);

  const selectedEntidadNombre = useMemo(() => {
    if (!selectedEntidadId) return "";
    return (
      entidadesAsignadas.find((item) => String(item.id) === String(selectedEntidadId))?.nombre || ""
    );
  }, [entidadesAsignadas, selectedEntidadId]);

  const hasEntityAccess = useMemo(() => {
    if (isAdmin) return true;
    return entidadesAsignadas.some((item) => String(item.id) === String(selectedEntidadId));
  }, [isAdmin, entidadesAsignadas, selectedEntidadId]);
  const shouldShowEntitySelector = !isAdmin && (isEntitySelectorOpen || !hasEntityAccess);
  const hasMultipleAssignedEntities = entidadesAsignadas.length > 1;

  const effectiveSelectedEntidadId = isAdmin ? "" : selectedEntidadId;
  const effectiveSelectedEntidadNombre = isAdmin ? "" : selectedEntidadNombre;

  if (isLoading) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh",
        background: "#f5f5f5"
      }}>
        <div className="spinner"></div>
        <p style={{ marginLeft: "10px" }}>Cargando...</p>
      </div>
    );
  }

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route 
          path="/*" 
          element={<Login onLoginSuccess={handleLoginSuccess} />} 
        />
      </Routes>
    );
  }

  if (!isAdmin && entidadesAsignadas.length === 0) {
    return (
      <div className="app-container">
        <a className="skip-link" href="#main-content">Saltar al contenido</a>
        <Header user={user} onLogout={handleLogout} />
        <main className="main-content" id="main-content">
          <div className="page-container" style={{ maxWidth: "760px", textAlign: "center" }}>
            <h2 style={{ marginBottom: "8px" }}>Sin entidad asignada</h2>
            <p style={{ color: "#334155", marginBottom: "16px" }}>
              Tu usuario no tiene entidades asignadas. Solicita al administrador que asigne al menos una entidad para continuar.
            </p>
            <button type="button" className="btn-logout" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (shouldShowEntitySelector) {
    return (
      <div className="entity-selector-shell">
        <div className="entity-selector-card">
          <header className="entity-selector-header">
            <h2>Selecciona Tu Entidad De Trabajo</h2>
            <p>
              Elige la entidad para cargar dashboard, activos, mantenimientos y cronograma solo para ese contexto.
            </p>
          </header>

          <div className="entity-selector-search">
            <input
              type="text"
              className="search-input"
              placeholder="Buscar entidad asignada..."
              value={entitySearch}
              onChange={(event) => setEntitySearch(event.target.value)}
            />
          </div>

          <div className="entity-selector-grid">
            {entidadesAsignadasFiltradas.map((entidad) => (
              <button
                key={entidad.id}
                type="button"
                className="entity-selector-option"
                onClick={() => handleEntityChange(entidad.id)}
              >
                <span>{entidad.nombre || `Entidad #${entidad.id}`}</span>
                <small>Ingresar a esta entidad</small>
              </button>
            ))}
            {entidadesAsignadasFiltradas.length === 0 && (
              <p className="no-data">No hay entidades que coincidan con la búsqueda.</p>
            )}
          </div>

          <div className="entity-selector-actions">
            {!isEntitySelectorOpen && (
              <button type="button" className="btn-logout" onClick={handleLogout}>
                Cerrar sesión
              </button>
            )}
            {isEntitySelectorOpen && hasEntityAccess && (
              <button
                type="button"
                className="btn-action"
                onClick={() => setIsEntitySelectorOpen(false)}
              >
                Regresar a la entidad actual
              </button>
            )}
            {isEntitySelectorOpen && !hasEntityAccess && (
              <button type="button" className="btn-logout" onClick={handleLogout}>
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If authenticated, show main layout with routes
  return (
    <div className="app-container">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <Header user={user} onLogout={handleLogout} />
      <main className="main-content" id="main-content">
        <div className="app-routes-shell">
          {!isAdmin && hasEntityAccess && (
            <section className="entity-context-bar">
              <div className="entity-context-pill">
                <span>Entidad:</span>
                <strong>
                  {effectiveSelectedEntidadNombre || `Entidad #${effectiveSelectedEntidadId}`}
                </strong>
              </div>
              {hasMultipleAssignedEntities && (
                <button
                  type="button"
                  className="btn-action entity-context-switch"
                  onClick={handleOpenEntitySelector}
                >
                  Cambiar entidad
                </button>
              )}
            </section>
          )}
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute user={user} mustChangePassword={mustChangePassword}>
                  <Home
                    selectedEntidadId={effectiveSelectedEntidadId}
                    selectedEntidadNombre={effectiveSelectedEntidadNombre}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/activos"
              element={
                <ProtectedRoute
                  user={user}
                  requiredPermissions={["VER_ACTIVOS"]}
                  mustChangePassword={mustChangePassword}
                >
                  <ActivosPage
                    selectedEntidadId={effectiveSelectedEntidadId}
                    selectedEntidadNombre={effectiveSelectedEntidadNombre}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mantenimientos"
              element={
                <ProtectedRoute
                  user={user}
                  requiredPermissions={[
                    "CREAR_MANTENIMIENTO",
                    "EDITAR_MANTENIMIENTO",
                    "ELIMINAR_MANTENIMIENTO"
                  ]}
                  mustChangePassword={mustChangePassword}
                >
                  <MantenimientosPage
                    selectedEntidadId={effectiveSelectedEntidadId}
                    selectedEntidadNombre={effectiveSelectedEntidadNombre}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cronograma"
              element={
                <ProtectedRoute
                  user={user}
                  requiredPermissions={[
                    "CREAR_MANTENIMIENTO",
                    "EDITAR_MANTENIMIENTO",
                    "ELIMINAR_MANTENIMIENTO"
                  ]}
                  mustChangePassword={mustChangePassword}
                >
                  <CronogramaPage
                    selectedEntidadId={effectiveSelectedEntidadId}
                    selectedEntidadNombre={effectiveSelectedEntidadNombre}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ordenes"
              element={
                <ProtectedRoute
                  user={user}
                  requiredPermissions={["GENERAR_ORDEN", "FIRMAR_ORDEN", "CREAR_MANTENIMIENTO"]}
                  mustChangePassword={mustChangePassword}
                >
                  <OrdenesPage
                    selectedEntidadId={effectiveSelectedEntidadId}
                    selectedEntidadNombre={effectiveSelectedEntidadNombre}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/auditoria"
              element={
                <ProtectedRoute
                  user={user}
                  requiredPermissions={["ADMIN_TOTAL"]}
                  mustChangePassword={mustChangePassword}
                >
                  <AuditoriaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/entidades"
              element={
                <ProtectedRoute
                  user={user}
                  requiredPermissions={["ADMIN_TOTAL"]}
                  mustChangePassword={mustChangePassword}
                >
                  <EntidadesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute
                  user={user}
                  requiredPermissions={["ADMIN_TOTAL"]}
                  mustChangePassword={mustChangePassword}
                >
                  <UsuariosPage />
                </ProtectedRoute>
              }
            />
            <Route path="/mi-cuenta" element={<MiCuentaPage onUserUpdate={handleUserUpdate} />} />
            <Route
              path="/notificaciones"
              element={
                <ProtectedRoute user={user} mustChangePassword={mustChangePassword}>
                  <NotificacionesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ayuda"
              element={
                <ProtectedRoute user={user} mustChangePassword={mustChangePassword}>
                  <AyudaPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/acerca-de"
              element={
                <ProtectedRoute user={user} mustChangePassword={mustChangePassword}>
                  <AcercaDePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/iso-55000"
              element={
                <ProtectedRoute
                  user={user}
                  requiredPermissions={["VER_ACTIVOS"]}
                  mustChangePassword={mustChangePassword}
                >
                  <Iso55000Page />
                </ProtectedRoute>
              }
            />
            {/* Redirect unknown routes to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;


