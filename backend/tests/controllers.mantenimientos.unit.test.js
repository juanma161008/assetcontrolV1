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

async function loadMantenimientosController() {
  vi.resetModules();

  const stubs = {
    listarExecute: vi.fn(),
    crearExecute: vi.fn(),
    editarExecute: vi.fn(),
    eliminarExecute: vi.fn()
  };

  vi.doMock("../src/application/mantenimientos/ListarMantenimientos.js", () => ({
    default: class {
      execute(...args) {
        return stubs.listarExecute(...args);
      }
    }
  }));

  vi.doMock("../src/application/mantenimientos/CrearMantenimiento.js", () => ({
    default: class {
      execute(...args) {
        return stubs.crearExecute(...args);
      }
    }
  }));

  vi.doMock("../src/application/mantenimientos/EditarMantenimiento.js", () => ({
    default: class {
      execute(...args) {
        return stubs.editarExecute(...args);
      }
    }
  }));

  vi.doMock("../src/application/mantenimientos/EliminarMantenimiento.js", () => ({
    default: class {
      execute(...args) {
        return stubs.eliminarExecute(...args);
      }
    }
  }));

  vi.doMock("../src/infrastructure/repositories/MantenimientoPgRepository.js", () => ({
    default: class {}
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

  const controller = await import("../src/interfaces/controllers/mantenimientos.controller.js");
  return { ...controller, stubs };
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  delete globalThis.__assetControlTestStore;
  vi.restoreAllMocks();
});

describe("mantenimientos.controller", () => {
  it("lista mantenimientos en rama test", async () => {
    process.env.NODE_ENV = "test";
    const { listarMantenimientos } = await loadMantenimientosController();
    const res = createRes();

    await listarMantenimientos({}, res);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.payload.data)).toBe(true);
  });

  it("retorna error si activo no existe al crear en rama test", async () => {
    process.env.NODE_ENV = "test";
    const { crearMantenimiento } = await loadMantenimientosController();
    const res = createRes();

    await crearMantenimiento(
      { body: { activo: 99, tipo: "Preventivo" } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload.success).toBe(false);
  });

  it("permite crear punto de red sin activo en rama test", async () => {
    process.env.NODE_ENV = "test";
    const { crearMantenimiento } = await loadMantenimientosController();
    const res = createRes();

    globalThis.__assetControlTestStore = {
      activos: [],
      mantenimientos: [],
      nextActivoId: 1,
      nextMantenimientoId: 1
    };

    await crearMantenimiento(
      {
        body: {
          fecha: "2026-01-03",
          numeroReporte: "PR-001",
          tipo: "Preventivo Punto De Red"
        }
      },
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.payload.data.activo_id).toBeNull();
    expect(res.payload.data.tipo).toBe("Preventivo Punto De Red");
  });

  it("crea, edita y elimina en rama test", async () => {
    process.env.NODE_ENV = "test";
    const { crearMantenimiento, editarMantenimiento, eliminarMantenimiento } =
      await loadMantenimientosController();

    globalThis.__assetControlTestStore = {
      activos: [{ id: 10, nombre: "Activo X" }],
      mantenimientos: [],
      nextActivoId: 11,
      nextMantenimientoId: 1
    };

    const resCreate = createRes();
    await crearMantenimiento(
      {
        body: {
          fecha: "2026-01-01",
          activo: 10,
          tipo: "Preventivo",
          descripcion: "Revision"
        }
      },
      resCreate
    );

    expect(resCreate.statusCode).toBe(201);
    const id = resCreate.payload.data.id;

    const resEdit = createRes();
    await editarMantenimiento(
      { params: { id }, body: { descripcion: "Actualizado" } },
      resEdit
    );
    expect(resEdit.statusCode).toBe(200);
    expect(resEdit.payload.data.descripcion).toBe("Actualizado");

    const resDelete = createRes();
    await eliminarMantenimiento({ params: { id } }, resDelete);
    expect(resDelete.statusCode).toBe(200);
    expect(resDelete.payload.success).toBe(true);
  });

  it("retorna 404 al editar inexistente en rama test", async () => {
    process.env.NODE_ENV = "test";
    const { editarMantenimiento } = await loadMantenimientosController();
    const res = createRes();

    await editarMantenimiento(
      { params: { id: 999 }, body: { descripcion: "x" } },
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.payload.success).toBe(false);
  });

  it("ejecuta rama no-test exitosa para listar, crear, editar y eliminar", async () => {
    process.env.NODE_ENV = "development";
    const {
      listarMantenimientos,
      crearMantenimiento,
      editarMantenimiento,
      eliminarMantenimiento,
      stubs
    } = await loadMantenimientosController();

    stubs.listarExecute.mockResolvedValue([{ id: 1 }]);
    stubs.crearExecute.mockResolvedValue({ id: 2 });
    stubs.editarExecute.mockResolvedValue({ id: 2, descripcion: "OK" });
    stubs.eliminarExecute.mockResolvedValue(true);

    const resList = createRes();
    await listarMantenimientos({}, resList);
    expect(resList.statusCode).toBe(200);

    const resCreate = createRes();
    await crearMantenimiento(
      { body: { activo_id: 1 }, user: { id: 20 } },
      resCreate
    );
    expect(stubs.crearExecute).toHaveBeenCalledWith({ activo_id: 1 }, 20);
    expect(resCreate.statusCode).toBe(201);

    const resEdit = createRes();
    await editarMantenimiento(
      { params: { id: 2 }, body: { descripcion: "OK" } },
      resEdit
    );
    expect(stubs.editarExecute).toHaveBeenCalledWith(2, { descripcion: "OK" });
    expect(resEdit.statusCode).toBe(200);

    const resDelete = createRes();
    await eliminarMantenimiento({ params: { id: 2 } }, resDelete);
    expect(stubs.eliminarExecute).toHaveBeenCalledWith(2);
    expect(resDelete.statusCode).toBe(200);
  });

  it("maneja error al listar en rama no-test", async () => {
    process.env.NODE_ENV = "development";
    const { listarMantenimientos, stubs } = await loadMantenimientosController();
    const res = createRes();

    stubs.listarExecute.mockRejectedValue(new Error("fallo listar"));
    await listarMantenimientos({}, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo listar");
  });

  it("maneja error al crear en rama no-test", async () => {
    process.env.NODE_ENV = "development";
    const { crearMantenimiento, stubs } = await loadMantenimientosController();
    const res = createRes();

    stubs.crearExecute.mockRejectedValue(new Error("fallo crear"));
    await crearMantenimiento({ body: {}, user: { id: 1 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo crear");
  });

  it("maneja error al editar en rama no-test", async () => {
    process.env.NODE_ENV = "development";
    const { editarMantenimiento, stubs } = await loadMantenimientosController();
    const res = createRes();

    stubs.editarExecute.mockRejectedValue(new Error("fallo editar"));
    await editarMantenimiento({ params: { id: 1 }, body: {} }, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo editar");
  });

  it("maneja error al eliminar en rama no-test", async () => {
    process.env.NODE_ENV = "development";
    const { eliminarMantenimiento, stubs } = await loadMantenimientosController();
    const res = createRes();

    stubs.eliminarExecute.mockRejectedValue(new Error("fallo eliminar"));
    await eliminarMantenimiento({ params: { id: 1 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo eliminar");
  });
});
