import { describe, it, expect, vi, afterEach } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;

function createRes() {
  const res = {};
  res.statusCode = 200;
  res.payload = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.payload = body;
    return res;
  };
  return res;
}

async function loadActivosController() {
  vi.resetModules();

  const stubs = {
    listarExecute: vi.fn(),
    crearExecute: vi.fn(),
    editarExecute: vi.fn(),
    eliminarExecute: vi.fn()
  };

  vi.doMock("../src/application/activos/ListarActivos.js", () => ({
    default: class {
      execute(...args) {
        return stubs.listarExecute(...args);
      }
    }
  }));

  vi.doMock("../src/application/activos/CrearActivo.js", () => ({
    default: class {
      execute(...args) {
        return stubs.crearExecute(...args);
      }
    }
  }));

  vi.doMock("../src/application/activos/EditarActivo.js", () => ({
    default: class {
      execute(...args) {
        return stubs.editarExecute(...args);
      }
    }
  }));

  vi.doMock("../src/application/activos/EliminarActivo.js", () => ({
    default: class {
      execute(...args) {
        return stubs.eliminarExecute(...args);
      }
    }
  }));

  vi.doMock("../src/infrastructure/repositories/ActivoPgRepository.js", () => ({
    default: class {}
  }));

  vi.doMock("../src/infrastructure/repositories/LogPgRepository.js", () => ({
    default: class {}
  }));

  vi.doMock("../src/application/auditoria/RegistrarLog.js", () => ({
    default: class {
      execute() {
        return Promise.resolve();
      }
    }
  }));

  const controller = await import("../src/interfaces/controllers/activos.controller.js");
  return { ...controller, stubs };
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  delete globalThis.__assetControlTestStore;
  vi.restoreAllMocks();
});

describe("activos.controller", () => {
  it("lista activos en rama test", async () => {
    process.env.NODE_ENV = "test";
    const { listarActivos } = await loadActivosController();
    const res = createRes();

    await listarActivos({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
    expect(Array.isArray(res.payload.data)).toBe(true);
  });

  it("crea, edita y elimina en rama test", async () => {
    process.env.NODE_ENV = "test";
    const { crearActivo, editarActivo, eliminarActivo } = await loadActivosController();

    const resCreate = createRes();
    await crearActivo(
      {
        body: {
          activo: "ACT-1",
          equipo: "Laptop",
          nombre: "Equipo 1"
        }
      },
      resCreate
    );

    expect(resCreate.statusCode).toBe(201);
    const id = resCreate.payload.data.id;

    const resEdit = createRes();
    await editarActivo(
      { params: { id }, body: { estado: "Mantenimiento" } },
      resEdit
    );
    expect(resEdit.statusCode).toBe(200);
    expect(resEdit.payload.data.estado).toBe("Mantenimiento");

    const resDelete = createRes();
    await eliminarActivo({ params: { id } }, resDelete);
    expect(resDelete.statusCode).toBe(200);
    expect(resDelete.payload.success).toBe(true);
  });

  it("retorna 404 al editar inexistente en rama test", async () => {
    process.env.NODE_ENV = "test";
    const { editarActivo } = await loadActivosController();
    const res = createRes();

    await editarActivo(
      { params: { id: 999 }, body: { estado: "X" } },
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.payload.success).toBe(false);
  });

  it("ejecuta rama no-test exitosa para listar, crear, editar y eliminar", async () => {
    process.env.NODE_ENV = "development";
    const { listarActivos, crearActivo, editarActivo, eliminarActivo, stubs } =
      await loadActivosController();

    stubs.listarExecute.mockResolvedValue([{ id: 1 }]);
    stubs.crearExecute.mockResolvedValue({ id: 2 });
    stubs.editarExecute.mockResolvedValue({ id: 2, estado: "OK" });
    stubs.eliminarExecute.mockResolvedValue(true);

    const resList = createRes();
    await listarActivos({}, resList);
    expect(resList.statusCode).toBe(200);
    expect(resList.payload.data).toEqual([{ id: 1 }]);

    const resCreate = createRes();
    await crearActivo(
      { body: { nombre: "A", equipo: "Laptop" }, user: { id: 10 } },
      resCreate
    );
    expect(stubs.crearExecute).toHaveBeenCalledWith(
      { nombre: "A", equipo: "Laptop" },
      10
    );
    expect(resCreate.statusCode).toBe(201);

    const resEdit = createRes();
    await editarActivo(
      { params: { id: 2 }, body: { estado: "OK" }, user: { id: 10 } },
      resEdit
    );
    expect(stubs.editarExecute).toHaveBeenCalledWith(2, { estado: "OK" }, 10);
    expect(resEdit.statusCode).toBe(200);

    const resDelete = createRes();
    await eliminarActivo({ params: { id: 2 }, user: { id: 10 } }, resDelete);
    expect(stubs.eliminarExecute).toHaveBeenCalledWith(2, 10);
    expect(resDelete.statusCode).toBe(200);
  });

  it("maneja error al listar en rama no-test", async () => {
    process.env.NODE_ENV = "development";
    const { listarActivos, stubs } = await loadActivosController();
    const res = createRes();

    stubs.listarExecute.mockRejectedValue(new Error("fallo listar"));
    await listarActivos({}, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo listar");
  });

  it("maneja error al crear en rama no-test", async () => {
    process.env.NODE_ENV = "development";
    const { crearActivo, stubs } = await loadActivosController();
    const res = createRes();

    stubs.crearExecute.mockRejectedValue(new Error("fallo crear"));
    await crearActivo({ body: {}, user: { id: 1 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo crear");
  });

  it("maneja error al editar en rama no-test", async () => {
    process.env.NODE_ENV = "development";
    const { editarActivo, stubs } = await loadActivosController();
    const res = createRes();

    stubs.editarExecute.mockRejectedValue(new Error("fallo editar"));
    await editarActivo({ params: { id: 1 }, body: {}, user: { id: 1 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo editar");
  });

  it("maneja error al eliminar en rama no-test", async () => {
    process.env.NODE_ENV = "development";
    const { eliminarActivo, stubs } = await loadActivosController();
    const res = createRes();

    stubs.eliminarExecute.mockRejectedValue(new Error("fallo eliminar"));
    await eliminarActivo({ params: { id: 1 }, user: { id: 1 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo eliminar");
  });
});
