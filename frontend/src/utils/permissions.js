export const ADMIN_PERMISSION = "ADMIN_TOTAL";

const PERMISSION_LABELS = {
  ADMIN_TOTAL: "Administrador total",
  CREAR_USUARIO: "Crear usuarios",
  VER_ACTIVOS: "Ver activos",
  CREAR_ACTIVO: "Crear activos",
  EDITAR_ACTIVO: "Editar activos",
  ELIMINAR_ACTIVO: "Eliminar activos",
  CREAR_MANTENIMIENTO: "Crear mantenimientos",
  EDITAR_MANTENIMIENTO: "Editar mantenimientos",
  ELIMINAR_MANTENIMIENTO: "Eliminar mantenimientos",
  GENERAR_ORDEN: "Generar órdenes",
  FIRMAR_ORDEN: "Firmar órdenes"
};

export function getPermissions(user) {
  return Array.isArray(user?.permisos) ? user.permisos : [];
}

export function hasPermission(user, permission) {
  if (!permission) {
    return true;
  }

  const permisos = getPermissions(user);
  return permisos.includes(ADMIN_PERMISSION) || permisos.includes(permission);
}

export function hasAnyPermission(user, permissions = []) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return true;
  }

  return permissions.some((permission) => hasPermission(user, permission));
}

const humanizePermission = (permission = "") =>
  String(permission || "")
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export function getPermissionLabel(permission = "") {
  const normalizedPermission = String(permission || "").trim().toUpperCase();
  return PERMISSION_LABELS[normalizedPermission] || humanizePermission(normalizedPermission);
}

export function getRoleLabel(role) {
  const roleId = Number(role);

  if (roleId === 1) {
    return "Administrador";
  }

  if (roleId === 2) {
    return "Técnico";
  }

  if (roleId === 3) {
    return "Usuario";
  }

  return String(role || "Sin rol");
}
