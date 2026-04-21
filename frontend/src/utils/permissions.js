export const ADMIN_PERMISSION = "ADMIN_TOTAL";

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

