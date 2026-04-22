import { describe, it, expect, vi } from "vitest";
import CrearNotificacion from "../src/application/notificaciones/CrearNotificacion.js";

describe("CrearNotificacion", () => {
  const repo = { create: vi.fn(async (data) => ({ ...data, id: 1 })) };
  it("lanza error si falta usuario_id", async () => {
    const useCase = new CrearNotificacion(repo);
    await expect(() => useCase.execute({ titulo: "t" })).rejects.toThrow();
  });
  it("lanza error si falta titulo", async () => {
    const useCase = new CrearNotificacion(repo);
    await expect(() => useCase.execute({ usuario_id: 1 })).rejects.toThrow();
  });
  it("crea notificación correctamente", async () => {
    const useCase = new CrearNotificacion(repo);
    const result = await useCase.execute({ usuario_id: 1, titulo: "t" });
    expect(result).toHaveProperty("id");
    expect(repo.create).toHaveBeenCalled();
  });
});
