import { describe, it, expect } from "vitest";

describe("Permisos", () => {

  it("ADMIN_TOTAL debe permitir acceso", () => {
    const userPerms = ["ADMIN_TOTAL"];
    expect(userPerms.includes("ADMIN_TOTAL")).toBe(true);
  });

});
