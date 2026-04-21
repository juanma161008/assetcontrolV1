import { beforeEach, describe, expect, it, vi } from "vitest";
import httpClient from "./httpClient";
import { sendEmailNotification } from "./notificacionService";

vi.mock("./httpClient", () => ({
  default: {
    post: vi.fn()
  }
}));

describe("notificacionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna exito cuando el backend responde correctamente", async () => {
    httpClient.post.mockResolvedValue({
      data: {
        data: { accepted: ["destino@empresa.com"] },
        message: "Correo enviado"
      }
    });

    const result = await sendEmailNotification({
      to: "destino@empresa.com",
      subject: "Prueba",
      text: "Contenido"
    });

    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.message).toBe("Correo enviado");
  });

  it("retorna error normalizado cuando falla el backend", async () => {
    httpClient.post.mockRejectedValue({
      response: {
        data: { message: "SMTP no configurado" }
      }
    });

    const result = await sendEmailNotification({
      to: "destino@empresa.com",
      subject: "Prueba",
      text: "Contenido"
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("SMTP no configurado");
  });

  it("usa valores por defecto cuando faltan message/data o error detallado", async () => {
    httpClient.post.mockResolvedValue({ data: {} });

    const ok = await sendEmailNotification({
      to: "destino@empresa.com",
      subject: "Prueba",
      text: "Contenido"
    });

    expect(ok.success).toBe(true);
    expect(ok.data).toEqual({});
    expect(ok.message).toBe("Correo enviado");

    httpClient.post.mockRejectedValue(new Error("fallo generico"));
    const fail = await sendEmailNotification({
      to: "destino@empresa.com",
      subject: "Prueba",
      text: "Contenido"
    });

    expect(fail.success).toBe(false);
    expect(fail.error).toBe("No se pudo enviar el correo");
  });
});
