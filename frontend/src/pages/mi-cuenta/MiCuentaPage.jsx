import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useSearchParams } from "react-router-dom";
import {
  changePassword,
  fetchCurrentUser,
  getCurrentUser,
  updateCurrentUser,
  updateProfile
} from "../../services/authService";
import { toProperCase } from "../../utils/formatters";
import { getRoleLabel } from "../../utils/permissions";
import { buildPasswordPolicyMessage, validatePassword } from "../../utils/passwordPolicy";
import "../../styles/MiCuentaPage.css";

const DEFAULT_PASSWORD_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

const buildProfileForm = (user) => ({
  nombre: toProperCase(String(user.nombre || "")),
  email: String(user.email || "")
});

export default function MiCuentaPage({ onUserUpdate }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "seguridad" ? "seguridad" : "perfil";

  const [user, setUser] = useState(() => getCurrentUser() || {});
  const [profileForm, setProfileForm] = useState(() => buildProfileForm(getCurrentUser() || {}));
  const [passwordForm, setPasswordForm] = useState(DEFAULT_PASSWORD_FORM);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const syncUser = useCallback(
    (nextUser) => {
      const safeUser = nextUser && typeof nextUser === "object" ? nextUser : {};
      setUser(safeUser);
      setProfileForm(buildProfileForm(safeUser));
      updateCurrentUser(safeUser);
      if (typeof onUserUpdate === "function") {
        onUserUpdate(safeUser);
      }
    },
    [onUserUpdate]
  );

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError("");

      const result = await fetchCurrentUser();
      if (result.success) {
        syncUser(result.user);
      } else {
        setError(result.error || "No se pudo cargar tu cuenta");
      }

      setLoading(false);
    };

    loadProfile();
  }, [syncUser]);

  useEffect(() => {
    if (user?.debe_cambiar_password && activeTab !== "seguridad") {
      setSearchParams({ tab: "seguridad" }, { replace: true });
    }
  }, [activeTab, setSearchParams, user?.debe_cambiar_password]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  const handleChangeTab = (tab) => {
    setError("");
    setSuccess("");
    setSearchParams({ tab });
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    const normalizedValue = name === "nombre" ? toProperCase(value) : value;
    setProfileForm((prev) => ({ ...prev, [name]: normalizedValue }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();

    const nombre = toProperCase(String(profileForm.nombre || "").trim());
    const email = String(profileForm.email || "").trim().toLowerCase();

    setSavingProfile(true);
    setError("");
    setSuccess("");

    if (!nombre || !email) {
      setError("Debes completar nombre y correo");
      setSavingProfile(false);
      return;
    }

    const currentNombre = String(user?.nombre || "").trim();
    const currentEmail = String(user?.email || "").trim().toLowerCase();

    if (nombre.toUpperCase() === currentNombre.toUpperCase() && email === currentEmail) {
      setSuccess("No hay cambios para guardar");
      setSavingProfile(false);
      return;
    }

    const result = await updateProfile(nombre, email);

    if (!result.success) {
      setError(result.error || "No se pudo actualizar el perfil");
      setSavingProfile(false);
      return;
    }

    if (result.user) {
      syncUser(result.user);
    } else {
      const refreshed = await fetchCurrentUser();
      if (refreshed.success) {
        syncUser(refreshed.user);
      }
    }

    setSuccess("Perfil actualizado correctamente");
    setSavingProfile(false);
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setError("");
    setSuccess("");

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setError("Debes completar todos los campos");
      setSavingPassword(false);
      return;
    }

    const passwordValidation = validatePassword(passwordForm.newPassword);
    if (!passwordValidation.valid) {
      setError(buildPasswordPolicyMessage());
      setSavingPassword(false);
      return;
    }

    if (
      passwordForm.confirmPassword &&
      passwordForm.confirmPassword !== passwordForm.newPassword
    ) {
      setError("Las contraseñas no coinciden");
      setSavingPassword(false);
      return;
    }

    const result = await changePassword(
      passwordForm.currentPassword,
      passwordForm.newPassword,
      passwordForm.confirmPassword
    );

    if (!result.success) {
      setError(result.error || "No se pudo cambiar la contraseña");
      setSavingPassword(false);
      return;
    }

    const refreshed = await fetchCurrentUser();
    if (refreshed.success) {
      syncUser({ ...refreshed.user, debe_cambiar_password: false });
    } else if (user) {
      syncUser({ ...user, debe_cambiar_password: false });
    }

    setSuccess("Contraseña actualizada correctamente");
    setPasswordForm(DEFAULT_PASSWORD_FORM);
    setSavingPassword(false);
  };

  if (loading) {
    return (
      <div className="mi-cuenta-page">
        <div className="loading">Cargando perfil...</div>
      </div>
    );
  }

  return (
    <div className="mi-cuenta-page">
      <h1>Mi cuenta</h1>
      <p className="mi-cuenta-subtitle">
        Gestiona tu perfil, revisa permisos y administra la seguridad de tu acceso.
      </p>

      <div className="mi-cuenta-tabs">
        <button
          type="button"
          className={`mi-cuenta-tab ${activeTab === "perfil" ? "active" : ""}`}
          onClick={() => handleChangeTab("perfil")}
        >
          Mi cuenta
        </button>
        <button
          type="button"
          className={`mi-cuenta-tab ${activeTab === "seguridad" ? "active" : ""}`}
          onClick={() => handleChangeTab("seguridad")}
        >
          Cambiar contraseña
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {user?.debe_cambiar_password && (
        <div className="alert alert-error">
          Debes cambiar tu contraseña temporal antes de continuar usando el sistema.
        </div>
      )}

      <div className="mi-cuenta-grid">
        {activeTab === "perfil" && (
          <section className="mi-cuenta-card">
            <h2>Información personal</h2>

            <form className="profile-form" onSubmit={handleProfileSubmit}>
              <label className="profile-label" htmlFor="perfil-nombre">Nombre</label>
              <input
                id="perfil-nombre"
                className="profile-input"
                name="nombre"
                type="text"
                value={profileForm.nombre}
                onChange={handleProfileChange}
                minLength={2}
                required
                disabled={savingProfile}
              />

              <label className="profile-label" htmlFor="perfil-email">Email</label>
              <input
                id="perfil-email"
                className="profile-input"
                name="email"
                type="email"
                value={profileForm.email}
                onChange={handleProfileChange}
                required
                disabled={savingProfile}
              />

              <button type="submit" className="profile-save-btn" disabled={savingProfile}>
                {savingProfile ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>

            <div className="profile-row">
              <span>Rol</span>
              <strong>{getRoleLabel(user?.rol)}</strong>
            </div>
            <div className="profile-row profile-permissions">
              <span>Permisos</span>
              <div>
                {Array.isArray(user?.permisos) && user.permisos.length > 0 ? (
                  user.permisos.map((permiso) => (
                    <code key={permiso} className="perm-tag">
                      {permiso}
                    </code>
                  ))
                ) : (
                  <strong>Sin permisos asignados</strong>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "seguridad" && (
          <section className="mi-cuenta-card">
            <h2>Actualizar contraseña</h2>
            <form onSubmit={handlePasswordSubmit} className="password-form">
              <input
                type="password"
                name="currentPassword"
                placeholder="Contraseña actual"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                required
              />
              <input
                type="password"
                name="newPassword"
                placeholder="Nueva contraseña (mínimo 12 caracteres)"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                required
              />
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirmar nueva contraseña"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
              />
              <button type="submit" disabled={savingPassword}>
                {savingPassword ? "Guardando..." : "Actualizar contraseña"}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

MiCuentaPage.propTypes = {
  onUserUpdate: PropTypes.func
};

MiCuentaPage.defaultProps = {
  onUserUpdate: null
};
