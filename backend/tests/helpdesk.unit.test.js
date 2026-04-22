import { describe, it, expect, vi, beforeEach } from "vitest";
import ActualizarHelpdeskThread from "../src/application/helpdesk/ActualizarHelpdeskThread.js";
import CrearHelpdeskMensaje from "../src/application/helpdesk/CrearHelpdeskMensaje.js";
import CrearHelpdeskThread from "../src/application/helpdesk/CrearHelpdeskThread.js";
import ListarHelpdeskThreads from "../src/application/helpdesk/ListarHelpdeskThreads.js";
import ObtenerHelpdeskThread from "../src/application/helpdesk/ObtenerHelpdeskThread.js";

const helpdeskRepository = {
  updateThread: vi.fn(async () => ({ ok: true })),
  createMessage: vi.fn(async () => ({ ok: true })),
  createThreadWithMessage: vi.fn(async () => ({ thread: { id: 1 } })),
  findThreads: vi.fn(async () => [{ id: 1 }]),
  findThreadById: vi.fn(async () => ({ id: 1 }))
};
const logUseCase = { execute: vi.fn(async () => {}) };

beforeEach(() => {
  Object.values(helpdeskRepository).forEach((fn) => fn.mockClear());
  logUseCase.execute.mockClear();
});

describe("ActualizarHelpdeskThread", () => {
  it("actualiza un thread y registra log", async () => {
    const useCase = new ActualizarHelpdeskThread(helpdeskRepository, logUseCase);
    const result = await useCase.execute(1, { titulo: "Nuevo" }, 2);
    expect(helpdeskRepository.updateThread).toHaveBeenCalled();
    expect(logUseCase.execute).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("mapea campos opcionales sin usar log use case", async () => {
    const useCase = new ActualizarHelpdeskThread(helpdeskRepository);
    const result = await useCase.execute(
      3,
      {
        categoria: "Incidente",
        estado: "Abierto",
        prioridad: "Alta",
        adminAsignadoId: 9
      },
      4
    );

    expect(helpdeskRepository.updateThread).toHaveBeenCalledWith(3, {
      categoria: "Incidente",
      estado: "Abierto",
      prioridad: "Alta",
      admin_asignado_id: 9
    });
    expect(result).toEqual({ ok: true });
  });

  it("registra usuario null cuando no se envía usuarioId", async () => {
    const useCase = new ActualizarHelpdeskThread(helpdeskRepository, logUseCase);
    await useCase.execute(5, { estado: "Cerrado" }, null);

    expect(logUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: null,
        entidad_id: 5
      })
    );
  });
});

describe("CrearHelpdeskMensaje", () => {
  it("crea mensaje con texto", async () => {
    const useCase = new CrearHelpdeskMensaje(helpdeskRepository, logUseCase);
    const result = await useCase.execute(1, { mensaje: "Hola" }, 2);
    expect(helpdeskRepository.createMessage).toHaveBeenCalled();
    expect(logUseCase.execute).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("usa mensaje por defecto cuando solo hay adjuntos", async () => {
    const useCase = new CrearHelpdeskMensaje(helpdeskRepository);
    const result = await useCase.execute(
      1,
      {
        adjuntos: [
          {
            dataUrl: "data:image/png;base64,QUJD",
            type: "image/png",
            size: 3,
            name: "evidencia.png"
          }
        ]
      },
      2
    );

    expect(helpdeskRepository.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mensaje: "Adjunto",
        creado_por: 2
      })
    );
    expect(result).toEqual({ ok: true });
  });

  it("lanza error si no hay mensaje ni adjuntos", async () => {
    const useCase = new CrearHelpdeskMensaje(helpdeskRepository, logUseCase);
    await expect(() => useCase.execute(1, {}, 2)).rejects.toThrow();
  });
});

describe("CrearHelpdeskThread", () => {
  it("crea thread y mensaje", async () => {
    const useCase = new CrearHelpdeskThread(helpdeskRepository, logUseCase);
    const result = await useCase.execute({ titulo: "T", mensaje: "M" }, 2);
    expect(helpdeskRepository.createThreadWithMessage).toHaveBeenCalled();
    expect(logUseCase.execute).toHaveBeenCalled();
    expect(result).toEqual({ thread: { id: 1 } });
  });

  it("mapa admin_asignado_id y omite log cuando no hay use case", async () => {
    const useCase = new CrearHelpdeskThread(helpdeskRepository);
    const result = await useCase.execute(
      {
        titulo: "T2",
        mensaje: "M2",
        admin_asignado_id: 15,
        categoria: "Soporte",
        prioridad: "ALTA"
      },
      3
    );

    expect(helpdeskRepository.createThreadWithMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        admin_asignado_id: 15,
        categoria: "Soporte",
        prioridad: "ALTA",
        creado_por: 3
      })
    );
    expect(result).toEqual({ thread: { id: 1 } });
  });

  it("usa entidad_id null cuando la respuesta no trae thread id", async () => {
    helpdeskRepository.createThreadWithMessage.mockResolvedValueOnce({ thread: {} });

    const useCase = new CrearHelpdeskThread(helpdeskRepository, logUseCase);
    await useCase.execute(
      {
        titulo: "T3",
        mensaje: "M3"
      },
      null
    );

    expect(logUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: null,
        entidad_id: null
      })
    );
  });

  it("lanza error si falta titulo", async () => {
    const useCase = new CrearHelpdeskThread(helpdeskRepository, logUseCase);
    await expect(() => useCase.execute({ mensaje: "M" }, 2)).rejects.toThrow();
  });

  it("lanza error si falta mensaje", async () => {
    const useCase = new CrearHelpdeskThread(helpdeskRepository, logUseCase);
    await expect(() => useCase.execute({ titulo: "T" }, 2)).rejects.toThrow();
  });
});

describe("ListarHelpdeskThreads", () => {
  it("lista threads", async () => {
    const useCase = new ListarHelpdeskThreads(helpdeskRepository);
    const result = await useCase.execute();
    expect(helpdeskRepository.findThreads).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });
});

describe("ObtenerHelpdeskThread", () => {
  it("obtiene thread por id", async () => {
    const useCase = new ObtenerHelpdeskThread(helpdeskRepository);
    const result = await useCase.execute(1);
    expect(helpdeskRepository.findThreadById).toHaveBeenCalled();
    expect(result).toEqual({ id: 1 });
  });
});
