import { describe, expect, it, vi } from "vitest";
import EnviarCorreo from "../src/application/notificaciones/EnviarCorreo.js";
import ListarNotificaciones from "../src/application/notificaciones/ListarNotificaciones.js";
import MarcarNotificacionLeida from "../src/application/notificaciones/MarcarNotificacionLeida.js";
import MarcarTodasNotificacionesLeidas from "../src/application/notificaciones/MarcarTodasNotificacionesLeidas.js";

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

  it("acepta listas y usa defaults del provider", async () => {
    const provider = { send: vi.fn().mockResolvedValue(undefined) };
    const usecase = new EnviarCorreo(provider);

    const result = await usecase.execute(
      {
        to: ["uno@empresa.com", "dos@empresa.com"],
        subject: "Aviso",
        html: "<p>Hola</p>"
      },
      { replyTo: "reply@empresa.com" }
    );

    expect(provider.send).toHaveBeenCalledWith({
      to: "uno@empresa.com, dos@empresa.com",
      subject: "Aviso",
      text: "",
      html: "<p>Hola</p>",
      replyTo: "reply@empresa.com",
      attachments: []
    });
    expect(result).toEqual({
      accepted: ["uno@empresa.com", "dos@empresa.com"],
      rejected: [],
      messageId: null
    });
  });

  it("normaliza attachments no array como lista vacia", async () => {
    const provider = { send: vi.fn().mockResolvedValue(undefined) };
    const usecase = new EnviarCorreo(provider);

    await usecase.execute({
      to: "uno@empresa.com",
      subject: "Aviso",
      text: "Hola",
      attachments: "archivo"
    });

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: []
      })
    );
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

describe("notificaciones wrappers", () => {
  it("delegan a sus repositorios", async () => {
    const repo = {
      findByUsuario: vi.fn().mockResolvedValue([{ id: 1 }]),
      markAsRead: vi.fn().mockResolvedValue(true),
      markAllAsRead: vi.fn().mockResolvedValue(3)
    };

    const listar = new ListarNotificaciones(repo);
    const marcar = new MarcarNotificacionLeida(repo);
    const marcarTodas = new MarcarTodasNotificacionesLeidas(repo);

    await expect(listar.execute(7, { unread: true })).resolves.toEqual([{ id: 1 }]);
    await expect(marcar.execute(7, 9)).resolves.toBe(true);
    await expect(marcarTodas.execute(7)).resolves.toBe(3);

    expect(repo.findByUsuario).toHaveBeenCalledWith(7, { unread: true });
    expect(repo.markAsRead).toHaveBeenCalledWith(9, 7);
    expect(repo.markAllAsRead).toHaveBeenCalledWith(7);
  });
});
