import { describe, expect, it, vi } from "vitest";
import EnviarCorreo from "../src/application/notificaciones/EnviarCorreo.js";

describe("application/notificaciones/EnviarCorreo", () => {
  it("valida destinatarios y envia correo", async () => {
    const provider = {
      send: vi.fn().mockResolvedValue({
        accepted: ["destino@empresa.com"],
        rejected: [],
        messageId: "abc-123"
      })
    };

    const usecase = new EnviarCorreo(provider);
    const result = await usecase.execute({
      to: "destino@empresa.com",
      subject: "Prueba",
      text: "Contenido"
    });

    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(result.accepted).toEqual(["destino@empresa.com"]);
    expect(result.messageId).toBe("abc-123");
  });

  it("rechaza correos invalidos", async () => {
    const provider = { send: vi.fn() };
    const usecase = new EnviarCorreo(provider);

    await expect(
      usecase.execute({
        to: "correo-invalido",
        subject: "Prueba",
        text: "Contenido"
      })
    ).rejects.toThrow("Correo invalido");
  });
});
