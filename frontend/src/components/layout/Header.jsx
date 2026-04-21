import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import "../../styles/Global.css";
import logoM5 from "../../assets/logos/logom5.png";
import { getRoleLabel, hasAnyPermission } from "../../utils/permissions";
import { toProperCase } from "../../utils/formatters";
import httpClient from "../../services/httpClient";

const NAV_STRUCTURE = [
  { key: "inicio", label: "Inicio", path: "/", permissions: [] },
  {
    key: "inventario",
    label: "Inventario de activos",
    items: [
      { path: "/activos", label: "Activos", permissions: ["VER_ACTIVOS"] },
      { path: "/entidades", label: "Entidades", permissions: ["ADMIN_TOTAL"] }
    ]
  },
  {
    key: "mantenimientos",
    label: "Mantenimientos",
    items: [
      {
        path: "/mantenimientos",
        label: "Gestión",
        permissions: ["CREAR_MANTENIMIENTO", "EDITAR_MANTENIMIENTO", "ELIMINAR_MANTENIMIENTO"]
      },
      {
        path: "/cronograma",
        label: "Cronograma",
        permissions: ["CREAR_MANTENIMIENTO", "EDITAR_MANTENIMIENTO", "ELIMINAR_MANTENIMIENTO"]
      },
      {
        path: "/ordenes",
        label: "Órdenes de trabajo",
        permissions: ["GENERAR_ORDEN", "FIRMAR_ORDEN", "CREAR_MANTENIMIENTO"]
      }
    ]
  },
  {
    key: "administracion",
    label: "Administración",
    items: [
      { path: "/usuarios", label: "Usuarios", permissions: ["ADMIN_TOTAL"] },
      { path: "/auditoria", label: "Auditoría", permissions: ["ADMIN_TOTAL"] },
      { path: "/iso-55000", label: "ISO 55000", permissions: ["VER_ACTIVOS"] }
    ]
  },
  {
    key: "ayuda",
    label: "Ayuda",
    items: [
      { path: "/ayuda", label: "Comunicaciones internas", permissions: [] }
    ]
  }
];

const USER_MENU_ITEMS = [
  { path: "/mi-cuenta?tab=perfil", label: "Mi cuenta", permissions: [] },
  { path: "/mi-cuenta?tab=seguridad", label: "Cambiar contraseña", permissions: [] },
  { path: "/notificaciones", label: "Centro de notificaciones", permissions: [] },
  { path: "/ayuda", label: "Comunicaciones internas", permissions: [] },
  { path: "/acerca-de", label: "Acerca de", permissions: [] }
];

function getRoleClass(role) {
  const roleId = Number(role);

  if (roleId === 1) return "rol-admin";
  if (roleId === 2) return "rol-tecnico";
  if (roleId === 3) return "rol-usuario";
  return "";
}

function Header({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const navId = "main-navigation";
  const userMenuId = "user-menu-dropdown";

  const isPathActive = (targetPath = "") => {
    const [pathname, queryString] = String(targetPath).split("?");
    if (location.pathname !== pathname) return false;
    if (!queryString) return true;

    const currentQuery = location.search.replace(/^\?/, "");
    if (!currentQuery && pathname === "/mi-cuenta" && queryString === "tab=perfil") {
      return true;
    }

    return currentQuery === queryString;
  };

  const visibleNavItems = useMemo(() => {
    return NAV_STRUCTURE
      .map((entry) => {
        if (entry.path) {
          return hasAnyPermission(user, entry.permissions) ? entry : null;
        }

        const items = (entry.items || []).filter((item) => hasAnyPermission(user, item.permissions));
        if (!items.length) return null;

        if (items.length === 1) {
          return {
            key: entry.key,
            label: entry.label,
            path: items[0].path,
            permissions: []
          };
        }

        return { ...entry, items };
      })
      .filter(Boolean);
  }, [user]);

  const visibleUserMenuItems = useMemo(() => {
    return USER_MENU_ITEMS.filter((item) => hasAnyPermission(user, item.permissions));
  }, [user]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (!target.closest(".header-nav")) {
        setOpenGroup("");
      }
      if (!target.closest(".header-user-menu")) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenGroup("");
        setIsMobileMenuOpen(false);
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setOpenGroup("");
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname, location.search]);

  const closeMenus = () => {
    setOpenGroup("");
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  const handleLogout = () => {
    closeMenus();
    onLogout();
    navigate("/");
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
    setOpenGroup("");
    setIsUserMenuOpen(false);
  };

  const handleToggleGroup = (event, key) => {
    event.stopPropagation();
    setIsUserMenuOpen(false);
    setOpenGroup((previous) => (previous === key ? "" : key));
  };

  const handleToggleUserMenu = (event) => {
    event.stopPropagation();
    setOpenGroup("");
    setIsUserMenuOpen((previous) => {
      const nextValue = !previous;
      if (nextValue) {
        loadNotifications();
      }
      return nextValue;
    });
  };

  const loadNotifications = async () => {
    try {
      setIsLoadingNotifications(true);
      setNotificationError("");
      const response = await httpClient.get("/api/notificaciones");
      const payload = response.data?.data;
      const items = Array.isArray(payload) ? payload : payload?.items || [];
      setNotifications(items);
    } catch (err) {
      setNotificationError(err?.response?.data?.message || "No se pudieron cargar notificaciones.");
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !item.leido).length;
  }, [notifications]);

  const handleMarkAllNotifications = async () => {
    try {
      await httpClient.patch("/api/notificaciones/marcar-todas");
      setNotifications((prev) => prev.map((item) => ({ ...item, leido: true })));
    } catch (err) {
      setNotificationError(err?.response?.data?.message || "No se pudieron actualizar.");
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification) return;
    try {
      if (!notification.leido) {
        await httpClient.patch(`/api/notificaciones/${notification.id}/leido`);
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, leido: true } : item
          )
        );
      }
    } catch (err) {
      setNotificationError(err?.response?.data?.message || "No se pudo actualizar.");
    }

    if (notification.url) {
      closeMenus();
      navigate(notification.url);
    }
  };

  const handleDeleteNotification = async (event, notificationId) => {
    event.stopPropagation();
    try {
      await httpClient.delete(`/api/notificaciones/${notificationId}`);
      setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
    } catch (err) {
      setNotificationError(err?.response?.data?.message || "No se pudo eliminar la notificacion.");
    }
  };

  const userNameLabel = toProperCase(String(user?.nombre || "Usuario"));
  const userRoleLabel = toProperCase(String(getRoleLabel(user?.rol) || "Sin rol"));
  const userInitials = userNameLabel
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase() || "US";
  const formatNotificationDate = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
  };
  const previewNotifications = notifications.slice(0, 2);
  const userMenuLabel = `${isUserMenuOpen ? "Cerrar" : "Abrir"} menú de usuario${
    unreadCount > 0 ? `, ${unreadCount} notificaciones sin leer` : ""
  }`;

  return (
    <>
      <header className="app-header">
        <div className="header-container">
        <button
          className={`mobile-menu-toggle ${isMobileMenuOpen ? "open" : ""}`}
          onClick={toggleMobileMenu}
          type="button"
          aria-expanded={isMobileMenuOpen}
          aria-controls={navId}
          aria-label={isMobileMenuOpen ? "Cerrar menú principal" : "Abrir menú principal"}
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>

        <div className="header-logo">
          <Link to="/" onClick={closeMenus} className="logo-link">
            <span className="logo-mark" aria-hidden="true">
              <img src={logoM5} alt="M5" className="logo-m5" />
            </span>
            <span className="logo-text">
              <strong>MicroCinco</strong>
              <small>AssetControl</small>
            </span>
          </Link>
        </div>

        <nav
          className={`header-nav ${isMobileMenuOpen ? "mobile-open" : ""}`}
          id={navId}
          aria-label="Navegación principal"
        >
          {visibleNavItems.map((item) => {
            if (item.path) {
              const isActive = isPathActive(item.path);
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={`nav-link ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={closeMenus}
                >
                  <span className="nav-text">{item.label}</span>
                </Link>
              );
            }

            const isGroupOpen = openGroup === item.key;
            const isGroupActive = item.items.some((groupItem) => isPathActive(groupItem.path));

            return (
              <div
                key={item.key}
                className={`nav-group ${isGroupOpen ? "open" : ""} ${isGroupActive ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="nav-group-toggle"
                  onClick={(event) => handleToggleGroup(event, item.key)}
                  aria-expanded={isGroupOpen}
                  aria-controls={`nav-dropdown-${item.key}`}
                  aria-haspopup="true"
                >
                  <span>{item.label}</span>
                  <span className="nav-caret">{isGroupOpen ? "▲" : "▼"}</span>
                </button>

                <div
                  className="nav-dropdown"
                  id={`nav-dropdown-${item.key}`}
                  aria-hidden={!isGroupOpen}
                >
                  {item.items.map((groupItem) => {
                    const isGroupItemActive = isPathActive(groupItem.path);
                    return (
                      <Link
                        key={groupItem.path}
                        to={groupItem.path}
                        className={`nav-link nav-sublink ${isGroupItemActive ? "active" : ""}`}
                        aria-current={isGroupItemActive ? "page" : undefined}
                        onClick={closeMenus}
                      >
                        <span className="nav-text">{groupItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className={`header-user ${isMobileMenuOpen ? "mobile-open" : ""}`}>
          <div className="header-user-top">
            <div className={`header-user-menu ${isUserMenuOpen ? "open" : ""}`}>
              <button
                type="button"
                className={`user-info user-info-button ${getRoleClass(user?.rol)}`}
                onClick={handleToggleUserMenu}
                aria-expanded={isUserMenuOpen}
                aria-controls={userMenuId}
                aria-label={userMenuLabel}
                aria-haspopup="true"
              >
                <span className="user-avatar" aria-hidden="true">{userInitials}</span>
                <div className="user-details">
                  <span className="user-name">{userNameLabel}</span>
                  <span className="user-role">{userRoleLabel}</span>
                </div>
                <span className="user-actions">
                  <span className="user-bell" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                      <path
                        d="M6 9a6 6 0 0 1 12 0c0 4 2 5 2 5H4s2-1 2-5Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 18a2 2 0 0 0 4 0"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="notification-badge" aria-hidden="true">
                        {unreadCount}
                      </span>
                    )}
                  </span>
                  <span className="user-menu-caret">{isUserMenuOpen ? "^" : "v"}</span>
                </span>
              </button>

              <div
                className="user-dropdown"
                id={userMenuId}
                aria-hidden={!isUserMenuOpen}
              >
                <div className="user-dropdown-section">
                  <div className="notification-header">
                    <span>Notificaciones</span>
                    <button
                      type="button"
                      className="notification-clear"
                      onClick={handleMarkAllNotifications}
                      disabled={unreadCount === 0}
                    >
                      Marcar todas
                    </button>
                  </div>

                  {notificationError && (
                    <div className="notification-error">{notificationError}</div>
                  )}

                  {isLoadingNotifications ? (
                    <div className="notification-empty">Cargando...</div>
                  ) : notifications.length === 0 ? (
                    <div className="notification-empty">Sin notificaciones</div>
                  ) : (
                    <div className="notification-list">
                      {previewNotifications.map((item) => (
                        <div
                          key={item.id}
                          className={`notification-item ${item.leido ? "read" : "unread"}`}
                        >
                          <button
                            type="button"
                            className="notification-item-main"
                            onClick={() => handleNotificationClick(item)}
                          >
                            <div className="notification-title">{item.titulo}</div>
                            {item.mensaje && <div className="notification-text">{item.mensaje}</div>}
                            <div className="notification-time">{formatNotificationDate(item.creado_en)}</div>
                          </button>
                          <button
                            type="button"
                            className="notification-delete"
                            onClick={(event) => handleDeleteNotification(event, item.id)}
                            aria-label={`Eliminar notificación ${item.titulo || "seleccionada"}`}
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link
                    to="/notificaciones"
                    className="notification-view-all"
                    onClick={closeMenus}
                  >
                    Ver todas las notificaciones
                  </Link>
                </div>

                <div className="user-dropdown-section">
                  {visibleUserMenuItems.map((item) => {
                    const isUserMenuItemActive = isPathActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`user-dropdown-link ${isUserMenuItemActive ? "active" : ""}`}
                        aria-current={isUserMenuItemActive ? "page" : undefined}
                        onClick={closeMenus}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>

                <div className="user-dropdown-section">
                  <button type="button" className="user-dropdown-logout" onClick={handleLogout}>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
        </div>
      </header>
      <div
        className={`header-backdrop ${isMobileMenuOpen ? "open" : ""}`}
        onClick={closeMenus}
        aria-hidden="true"
      />
    </>
  );
}

Header.propTypes = {
  user: PropTypes.shape({
    nombre: PropTypes.string,
    rol: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    permisos: PropTypes.arrayOf(PropTypes.string)
  }),
  onLogout: PropTypes.func.isRequired
};

Header.defaultProps = {
  user: null
};

export default Header;
