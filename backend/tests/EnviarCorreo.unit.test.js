import { describe, it, expect, vi } from "vitest";
import EnviarCorreo from "../src/application/notificaciones/EnviarCorreo.js";

describe("EnviarCorreo", () => {
  const emailProvider = {
    send: vi.fn(async (payload) => ({ accepted: [payload.to], rejected: [], messageId: "id" }))
  };

  it("lanza error si no hay destinatario", async () => {
    const useCase = new EnviarCorreo(emailProvider);
    await expect(() => useCase.execute({ to: "", subject: "s", text: "t" })).rejects.toThrow();
  });

  it("lanza error si destinatario es inválido", async () => {
    const useCase = new EnviarCorreo(emailProvider);
    await expect(() => useCase.execute({ to: "noemail", subject: "s", text: "t" })).rejects.toThrow();
  });

  it("lanza error si falta asunto", async () => {
    const useCase = new EnviarCorreo(emailProvider);
    await expect(() => useCase.execute({ to: "a@b.com", text: "t" })).rejects.toThrow();
  });

  it("lanza error si falta contenido", async () => {
    const useCase = new EnviarCorreo(emailProvider);
    await expect(() => useCase.execute({ to: "a@b.com", subject: "s" })).rejects.toThrow();
  });

  it("envía correo correctamente", async () => {
    const useCase = new EnviarCorreo(emailProvider);
    const result = await useCase.execute({ to: "a@b.com", subject: "s", text: "t" });
    expect(result.accepted).toContain("a@b.com");
    expect(result.messageId).toBe("id");
  });

  it("preserva attachments cuando ya vienen como arreglo", async () => {
    const provider = {
      send: vi.fn(async (payload) => ({ accepted: [payload.to], rejected: [], messageId: "id-2" }))
    };
    const useCase = new EnviarCorreo(provider);

    await useCase.execute({
      to: "a@b.com",
      subject: "s",
      text: "t",
      attachments: [{ filename: "evidencia.pdf" }]
    });

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ filename: "evidencia.pdf" }]
      })
    );
  });
});
