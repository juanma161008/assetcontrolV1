import React, { useCallback, useEffect, useMemo, useState } from "react";
import httpClient from "../../services/httpClient";
import { getCurrentUser } from "../../services/authService";
import { hasPermission, getRoleLabel } from "../../utils/permissions";
import { toProperCase } from "../../utils/formatters";
import {
  buildPasswordPolicyMessage,
  generateStrongPassword,
  validatePassword
} from "../../utils/passwordPolicy";
import "../../styles/UsuariosPage.css";

const INITIAL_FORM = {
  nombre: "",
  email: "",
  rol_id: 3,
  password: "",
  temporal: true
};

export default function UsuariosPage() {
  const currentUser = getCurrentUser();
  const isAdmin = hasPermission(currentUser, "ADMIN_TOTAL");

  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [entidadesCatalogo, setEntidadesCatalogo] = useState([]);
  const [catalogoPermisos, setCatalogoPermisos] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedPermisos, setSelectedPermisos] = useState([]);
  const [selectedRolId, setSelectedRolId] = useState("");
  const [selectedEntidadesIds, setSelectedEntidadesIds] = useState([]);
  const [entidadSearchTerm, setEntidadSearchTerm] = useState("");
  const [showOnlySelectedEntities, setShowOnlySelectedEntities] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [claveReseteada, setClaveReseteada] = useState(null);

  const formatPermisoLabel = (permiso = "") =>
    toProperCase(String(permiso || "").split("_").join(" ").toLowerCase());

  const normalizeRoleName = useCallback((role = {}) => {
    const roleId = Number(role.id ?? role.rol_id ?? 0);
    if (roleId) {
      return getRoleLabel(roleId);
    }

    const roleName = toProperCase(
      String(role.nombre ?? role.rol_nombre ?? "")
        .trim()
        .toLowerCase()
    );
    const roleNameWithoutDiacritics = roleName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (roleNameWithoutDiacritics === "tecnico") {
      return getRoleLabel(2);
    }
    if (roleNameWithoutDiacritics === "administrador") {
      return getRoleLabel(1);
    }
    if (roleNameWithoutDiacritics === "usuario") {
      return getRoleLabel(3);
    }
    return roleName || "Sin rol";
  }, []);

  const roleOptions = useMemo(() => {
    const availableRoles = roles.length
      ? roles
      : [
          { id: 1, nombre: getRoleLabel(1) },
          { id: 2, nombre: getRoleLabel(2) },
          { id: 3, nombre: getRoleLabel(3) }
        ];

    return availableRoles
      .map((rol) => ({
        id: Number(rol.id ?? rol.rol_id),
        nombre: normalizeRoleName(rol)
      }))
      .filter((rol) => Number.isFinite(rol.id));
  }, [roles, normalizeRoleName]);

  const selectedUser = useMemo(
    () => usuarios.find((usuario) => Number(usuario.id) === Number(selectedUserId)) || null,
    [usuarios, selectedUserId]
  );

  const selectedEntidadesSet = useMemo(
    () => new Set(selectedEntidadesIds.map((id) => String(id))),
    [selectedEntidadesIds]
  );

  const entidadesPorId = useMemo(
    () =>
      (Array.isArray(entidadesCatalogo) ? entidadesCatalogo : []).reduce((acc, entidad) => {
        const key = String(entidad.id || "");
        if (key) {
          acc[key] = entidad;
        }
        return acc;
      }, {}),
    [entidadesCatalogo]
  );

  const entidadesFiltradas = useMemo(() => {
    const term = String(entidadSearchTerm || "").trim().toLowerCase();
    const source = Array.isArray(entidadesCatalogo) ? entidadesCatalogo : [];
    const filtered = term
      ? source.filter((entidad) =>
          String(entidad.nombre || "").toLowerCase().includes(term))
      : source;

    return [...filtered].sort((a, b) => {
      const isASelected = selectedEntidadesSet.has(String(a.id || ""));
      const isBSelected = selectedEntidadesSet.has(String(b.id || ""));
      if (isASelected !== isBSelected) {
        return isASelected ? -1 : 1;
      }
      return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
        sensitivity: "base"
      });
    });
  }, [entidadesCatalogo, entidadSearchTerm, selectedEntidadesSet]);

  const entidadesVisibles = useMemo(() => {
    if (!showOnlySelectedEntities) return entidadesFiltradas;
    return entidadesFiltradas.filter((entidad) =>
      selectedEntidadesSet.has(String(entidad.id || ""))
    );
  }, [entidadesFiltradas, selectedEntidadesSet, showOnlySelectedEntities]);

  const entidadesSeleccionadasDetalle = useMemo(
    () =>
      selectedEntidadesIds
        .map((id) => entidadesPorId[String(id)])
        .filter(Boolean)
        .map((entidad) => ({
          id: String(entidad.id || ""),
          nombre: toProperCase(String(entidad.nombre || ""))
        })),
    [entidadesPorId, selectedEntidadesIds]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [usuariosRes, rolesRes, permisosRes, entidadesRes] = await Promise.all([
        httpClient.get("/api/usuarios"),
        httpClient.get("/api/usuarios/roles"),
        httpClient.get("/api/usuarios/catalogo/permisos"),
        httpClient.get("/api/entidades")
      ]);

      const usuariosData = usuariosRes.data.data || [];
      const rolesData = rolesRes.data.data || [];
      const permisosData = permisosRes.data.data || [];
      const entidadesData = entidadesRes.data.data || [];

      setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setCatalogoPermisos(Array.isArray(permisosData) ? permisosData : []);
      setEntidadesCatalogo(Array.isArray(entidadesData) ? entidadesData : []);

      if (Array.isArray(usuariosData) && usuariosData.length > 0) {
        setSelectedUserId((previous) => previous ?? usuariosData[0].id);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo cargar usuarios y permisos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadData();
  }, [isAdmin, loadData]);

  useEffect(() => {
    if (!selectedUser) {
      setSelectedPermisos([]);
      setSelectedEntidadesIds([]);
      return;
    }
    const permisos = Array.isArray(selectedUser.permisos_personalizados)
      ? selectedUser.permisos_personalizados
      : [];
    setSelectedPermisos(permisos);
    setSelectedRolId(String(selectedUser.rol_id ?? ""));
    const entidades = Array.isArray(selectedUser.entidades_asignadas) ? selectedUser.entidades_asignadas.map((item) => String(item.id || item)).filter(Boolean) : [];
    setSelectedEntidadesIds(entidades);
    setEntidadSearchTerm("");
    setShowOnlySelectedEntities(false);
  }, [selectedUser]);

  const handleCreateChange = (event) => {
    const { name, value, type, checked } = event.target;
    let normalizedValue = value;

    if (type !== "checkbox") {
      if (name === "email") {
        normalizedValue = value.trim().toLowerCase();
      } else if (name === "nombre") {
        normalizedValue = toProperCase(value);
      } else {
        normalizedValue = value;
      }
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : normalizedValue
    }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    setClaveReseteada(null);

    try {
      const payload = {
        nombre: form.nombre,
        email: form.email,
        rol_id: Number(form.rol_id),
        temporal: Boolean(form.temporal)
      };

      if (form.password.trim()) {
        const trimmedPassword = form.password.trim();
        const passwordValidation = validatePassword(trimmedPassword);
        if (!passwordValidation.valid) {
          setError(buildPasswordPolicyMessage());
          setSaving(false);
          return;
        }
        payload.password = trimmedPassword;
      }

      const response = await httpClient.post("/api/usuarios", payload);
      const createdUser = response.data.data;

      setSuccess("Usuario creado correctamente");
      setForm(INITIAL_FORM);

      if (createdUser.clave_temporal) {
        setClaveReseteada({ password: createdUser.clave_temporal, temporal: true });
      }

      await loadData();
      if (createdUser.id) {
        setSelectedUserId(createdUser.id);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo crear el usuario");
    } finally {
      setSaving(false);
    }
  };

  const togglePermiso = (permiso) => {
    setSelectedPermisos((prev) => {
      if (prev.includes(permiso)) {
        return prev.filter((item) => item !== permiso);
      }
      return [...prev, permiso];
    });
  };

  const guardarPermisos = async () => {
    if (!selectedUserId) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await httpClient.put(`/api/usuarios/${selectedUserId}/permisos`, {
        permisos: selectedPermisos
      });

      const usuarioActualizado = response.data.data;
      setUsuarios((prev) =>
        prev.map((usuario) =>
          Number(usuario.id) === Number(selectedUserId)
            ? {
                ...usuario,
                permisos_personalizados:
                  usuarioActualizado.permisos_personalizados || selectedPermisos
              }
            : usuario
        )
      );

      setSuccess("Permisos actualizados");
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudieron actualizar permisos");
    } finally {
      setSaving(false);
    }
  };

  const toggleEntidadSelection = useCallback((entidadId) => {
    const normalizedId = String(entidadId || "");
    if (!normalizedId) return;

    setSelectedEntidadesIds((prev) => {
      if (prev.includes(normalizedId)) {
        return prev.filter((item) => item !== normalizedId);
      }
      return [...prev, normalizedId];
    });
  }, []);

  const removeEntidadSelection = useCallback((entidadId) => {
    const normalizedId = String(entidadId || "");
    setSelectedEntidadesIds((prev) => prev.filter((item) => item !== normalizedId));
  }, []);

  const selectVisibleEntities = useCallback(() => {
    const visibleIds = entidadesVisibles
      .map((entidad) => String(entidad.id || ""))
      .filter(Boolean);

    if (visibleIds.length === 0) return;

    setSelectedEntidadesIds((prev) => {
      const merged = new Set(prev.map((item) => String(item)));
      visibleIds.forEach((id) => merged.add(id));
      return Array.from(merged);
    });
  }, [entidadesVisibles]);

  const clearSelectedEntities = useCallback(() => {
    setSelectedEntidadesIds([]);
  }, []);

  const guardarEntidadesUsuario = async () => {
    if (!selectedUserId) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const entidadesPayload = selectedEntidadesIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));

      await httpClient.put(`/api/usuarios/${selectedUserId}`, {
        entidades_asignadas: entidadesPayload
      });

      const entidadesAsignadas = entidadesCatalogo
        .filter((item) => selectedEntidadesIds.includes(String(item.id)))
        .map((item) => ({ id: item.id, nombre: item.nombre }));

      setUsuarios((prev) =>
        prev.map((usuario) =>
          Number(usuario.id) === Number(selectedUserId)
            ? { ...usuario, entidades_asignadas: entidadesAsignadas }
            : usuario
        )
      );

      setSuccess("Entidades asignadas actualizadas");
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudieron actualizar las entidades");
    } finally {
      setSaving(false);
    }
  };

  const guardarRol = async () => {
    if (!selectedUserId || !selectedRolId) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await httpClient.put(`/api/usuarios/${selectedUserId}`, {
        rol_id: Number(selectedRolId)
      });

      setUsuarios((prev) =>
        prev.map((usuario) =>
          Number(usuario.id) === Number(selectedUserId)
            ? { ...usuario, rol_id: Number(selectedRolId) }
            : usuario
        )
      );

      setSuccess("Rol actualizado");
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo actualizar el rol");
    } finally {
      setSaving(false);
    }
  };

  const resetearPassword = async (temporal = true) => {
    if (!selectedUserId) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const newPassword = generateStrongPassword(16);
      await httpClient.post("/api/auth/reset-password", {
        userId: selectedUserId,
        newPassword,
        temporal
      });

      setClaveReseteada({ password: newPassword, temporal });
      setSuccess(
        temporal ? "Contrasena temporal restablecida" : "Contrasena definitiva restablecida"
      );
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "No se pudo resetear la contrasena");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="usuarios-page">
        <div className="loading">Cargando usuarios...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="usuarios-page">
        <div className="alert alert-error">No tienes permisos de administrador.</div>
      </div>
    );
  }

  return (
    <div className="usuarios-page">
      <h1>Administración de usuarios</h1>
      <p className="usuarios-subtitle">
        Crea usuarios con clave temporal y parametriza las pantallas/permisos que puede ver cada uno.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {claveReseteada && (
        <div className="alert alert-success">
          Clave {claveReseteada.temporal ? "temporal" : "definitiva"} generada:{" "}
          <strong>{claveReseteada.password}</strong>
        </div>
      )}

      <div className="usuarios-grid">
        <section className="usuarios-card">
          <h2>Crear usuario</h2>
          <form onSubmit={handleCreateUser} className="usuarios-form">
            <input
              name="nombre"
              value={form.nombre}
              onChange={handleCreateChange}
              placeholder="Nombre"
              required
            />
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleCreateChange}
              placeholder="Email"
              required
            />
            <select name="rol_id" value={form.rol_id} onChange={handleCreateChange}>
              {roleOptions.map((rol) => (
                <option key={rol.id} value={rol.id}>
                  {rol.nombre}
                </option>
              ))}
            </select>
            <input
              name="password"
              type="text"
              value={form.password}
              onChange={handleCreateChange}
              placeholder="Contraseña temporal (opcional)"
            />

            <label className="checkbox-line" htmlFor="temporal-check">
              <input
                id="temporal-check"
                name="temporal"
                type="checkbox"
                checked={form.temporal}
                onChange={handleCreateChange}
              />
              Forzar cambio de contraseña al primer ingreso
            </label>

            <button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Crear usuario"}
            </button>
          </form>
        </section>

        <section className="usuarios-card">
          <h2>Usuarios</h2>
          <div className="usuarios-list">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => {
                  const isSelected = Number(usuario.id) === Number(selectedUserId);
                  return (
                    <tr
                      key={usuario.id}
                      className={isSelected ? "selected" : ""}
                      onClick={() => setSelectedUserId(usuario.id)}
                    >
                      <td data-label="Nombre">{toProperCase(String(usuario.nombre || "-"))}</td>
                      <td data-label="Email">{usuario.email || "-"}</td>
                      <td data-label="Rol">
                        {normalizeRoleName({
                          rol_id: usuario.rol_id,
                          rol_nombre: usuario.rol_nombre
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedUser && (
            <div className="user-actions-row">
              <select
                value={selectedRolId}
                onChange={(event) => setSelectedRolId(event.target.value)}
                disabled={saving}
              >
                {roleOptions.map((rol) => (
                  <option key={rol.id} value={rol.id}>
                    {rol.nombre}
                  </option>
                ))}
              </select>
              <button type="button" onClick={guardarRol} disabled={saving}>
                Cambiar Rol
              </button>
              <button type="button" onClick={() => resetearPassword(true)} disabled={saving}>
                Resetear Clave Temporal
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => resetearPassword(false)}
                disabled={saving}
              >
                Resetear Clave Definitiva
              </button>
            </div>
          )}

          {selectedUser && (
            <div className="usuarios-card" style={{ marginTop: "12px" }}>
              <h3 style={{ marginTop: 0, marginBottom: "10px" }}>
                Entidades asignadas - {toProperCase(String(selectedUser.nombre || "-"))}
              </h3>
              {entidadesCatalogo.length === 0 ? (
                <p>No hay entidades registradas.</p>
              ) : (
                <>
                  <input
                    type="text"
                    className="entidades-search"
                    placeholder="Buscar entidad por nombre..."
                    value={entidadSearchTerm}
                    onChange={(event) => setEntidadSearchTerm(event.target.value)}
                  />

                  <div className="entidades-toolbar">
                    <button
                      type="button"
                      className="entidades-tool-btn"
                      onClick={selectVisibleEntities}
                      disabled={saving || entidadesVisibles.length === 0}
                    >
                      Seleccionar visibles
                    </button>
                    <button
                      type="button"
                      className="entidades-tool-btn secondary"
                      onClick={clearSelectedEntities}
                      disabled={saving || selectedEntidadesIds.length === 0}
                    >
                      Limpiar selección
                    </button>
                    <label className="checkbox-line entidades-only-selected" htmlFor="show-only-entities">
                      <input
                        id="show-only-entities"
                        type="checkbox"
                        checked={showOnlySelectedEntities}
                        onChange={(event) => setShowOnlySelectedEntities(event.target.checked)}
                      />
                      Mostrar solo seleccionadas
                    </label>
                  </div>

                  <p className="entidades-view-hint">
                    Mostrando {entidadesVisibles.length} {showOnlySelectedEntities ? "seleccionadas" : "resultados"}
                  </p>

                  <div className="entidades-select-wrap">
                    {entidadesVisibles.length === 0 ? (
                      <p className="entidades-empty">
                        {showOnlySelectedEntities ? "No hay entidades seleccionadas para mostrar." : "No hay entidades que coincidan con el filtro."}
                      </p>
                    ) : (
                      <div
                        className="entidades-checklist"
                        role="listbox"
                        aria-label="Listado de entidades para asignar"
                        aria-multiselectable="true"
                      >
                        {entidadesVisibles.map((entidad) => {
                          const entidadId = String(entidad.id || "");
                          const isSelected = selectedEntidadesSet.has(entidadId);
                          const inputId = `entidad-assign-${entidadId}`;

                          return (
                            <label
                              key={entidadId}
                              htmlFor={inputId}
                              className={`entidad-option ${isSelected ? "selected" : ""}`}
                            >
                              <input
                                id={inputId}
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleEntidadSelection(entidadId)}
                                disabled={saving}
                              />
                              <span className="entidad-option-text">
                                {toProperCase(String(entidad.nombre || `Entidad #${entidadId}`))}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <p className="entidades-selected-counter">
                    {selectedEntidadesIds.length} de {entidadesCatalogo.length} entidades seleccionadas
                  </p>

                  {entidadesSeleccionadasDetalle.length > 0 && (
                    <div className="entidades-tags" aria-label="Entidades seleccionadas">
                      {entidadesSeleccionadasDetalle.map((entidad) => (
                        <span key={entidad.id} className="entidad-tag">
                          <span>{entidad.nombre}</span>
                          <button
                            type="button"
                            className="entidad-tag-remove"
                            onClick={() => removeEntidadSelection(entidad.id)}
                            disabled={saving}
                            aria-label={`Quitar entidad ${entidad.nombre}`}
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <button type="button" onClick={guardarEntidadesUsuario} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar entidades asignadas"}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="usuarios-card permisos-card">
        <h2>Permisos de pantallas - {toProperCase(String(selectedUser?.nombre || "Selecciona un usuario"))}</h2>

        {!selectedUser ? (
          <p>Selecciona un usuario para parametrizar permisos.</p>
        ) : (
          <>
            <div className="permisos-grid">
              {catalogoPermisos.map((permiso) => (
                <label key={permiso} className="checkbox-line" htmlFor={`permiso-${permiso}`}>
                  <input
                    id={`permiso-${permiso}`}
                    type="checkbox"
                    checked={selectedPermisos.includes(permiso)}
                    onChange={() => togglePermiso(permiso)}
                  />
                  {formatPermisoLabel(permiso)}
                </label>
              ))}
            </div>

            <button type="button" onClick={guardarPermisos} disabled={saving}>
              {saving ? "Guardando..." : "Guardar permisos"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

