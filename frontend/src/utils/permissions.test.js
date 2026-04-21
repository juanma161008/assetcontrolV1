import { describe, expect, it } from "vitest";
import {
  ADMIN_PERMISSION,
  getPermissions,
  getRoleLabel,
  hasAnyPermission,
  hasPermission
} from "./permissions";

describe("permissions utils", () => {
  it("retorna arreglo vacio cuando el usuario no tiene permisos", () => {
    expect(getPermissions(null)).toEqual([]);
    expect(getPermissions({ permisos: "NO_ARRAY" })).toEqual([]);
  });

  it("permite cuando el usuario tiene ADMIN_TOTAL", () => {
    const user = { permisos: [ADMIN_PERMISSION] };
    expect(hasPermission(user, "CREAR_ACTIVO")).toBe(true);
  });

  it("valida permisos individuales y por lista", () => {
    const user = { permisos: ["VER_ACTIVOS", "CREAR_MANTENIMIENTO"] };

    expect(hasPermission(user, "VER_ACTIVOS")).toBe(true);
    expect(hasPermission(user, "ELIMINAR_ACTIVO")).toBe(false);
    expect(hasPermission(user, "")).toBe(true);
    expect(hasAnyPermission(user, ["ELIMINAR_ACTIVO", "VER_ACTIVOS"])).toBe(true);
    expect(hasAnyPermission(user, ["ELIMINAR_ACTIVO"])).toBe(false);
    expect(hasAnyPermission(user, [])).toBe(true);
    expect(hasAnyPermission(user, null)).toBe(true);
  });

  it("asigna etiqueta de rol conocida", () => {
    expect(getRoleLabel(1)).toBe("Administrador");
    expect(getRoleLabel(2)).toBe("Técnico");
    expect(getRoleLabel(3)).toBe("Usuario");
    expect(getRoleLabel(99)).toBe("99");
    expect(getRoleLabel(null)).toBe("Sin rol");
  });
});

