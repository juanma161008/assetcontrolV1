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

async function loadEntidadesController() {
  vi.resetModules();

  const stubs = {
    listarExecute: vi.fn(),
    crearExecute: vi.fn()
  };

  vi.doMock("../src/application/entidades/ListarEntidades.js", () => ({
    default: class {
      execute(...args) {
        return stubs.listarExecute(...args);
      }
    }
  }));

  vi.doMock("../src/application/entidades/CrearEntidad.js", () => ({
    default: class {
      execute(...args) {
        return stubs.crearExecute(...args);
      }
    }
  }));

  vi.doMock("../src/infrastructure/repositories/EntidadPgRepository.js", () => ({
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

  const controller = await import("../src/interfaces/controllers/entidades.controller.js");
  return { ...controller, stubs };
}

async function loadOrdenesController() {
  vi.resetModules();

  const stubs = {
    crearExecute: vi.fn(),
    firmarExecute: vi.fn()
  };

  vi.doMock("../src/application/ordenes/CrearOrden.js", () => ({
    default: class {
      execute(...args) {
        return stubs.crearExecute(...args);
      }
    }
  }));

  vi.doMock("../src/application/ordenes/FirmarOrden.js", () => ({
    default: class {
      execute(...args) {
        return stubs.firmarExecute(...args);
      }
    }
  }));

  vi.doMock("../src/infrastructure/repositories/OrdenPgRepository.js", () => ({
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

  const controller = await import("../src/interfaces/controllers/ordenes.controller.js");
  return { ...controller, stubs };
}

async function loadUsuariosController() {
  vi.resetModules();

  const stubs = {
    hash: vi.fn(),
    repoCreate: vi.fn(),
    repoFindAll: vi.fn(),
    repoUpdate: vi.fn(),
    repoFindById: vi.fn(),
    repoDelete: vi.fn(),
    logExecute: vi.fn()
  };

  vi.doMock("../src/infrastructure/repositories/UsuarioPgRepository.js", () => ({
    default: class {
      create(...args) {
        return stubs.repoCreate(...args);
      }
      findAll(...args) {
        return stubs.repoFindAll(...args);
      }
      update(...args) {
        return stubs.repoUpdate(...args);
      }
      findById(...args) {
        return stubs.repoFindById(...args);
      }
      delete(...args) {
        return stubs.repoDelete(...args);
      }
    }
  }));

  vi.doMock("../src/infrastructure/repositories/LogPgRepository.js", () => ({
    default: class {}
  }));

  vi.doMock("../src/application/auditoria/RegistrarLog.js", () => ({
    default: class {
      execute(...args) {
        return stubs.logExecute(...args);
      }
    }
  }));

  vi.doMock("../src/utils/hash.js", () => ({
    default: {
      hash: (...args) => stubs.hash(...args)
    }
  }));

  const controller = await import("../src/interfaces/controllers/Usuarios.controller.js");
  return { ...controller, stubs };
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.restoreAllMocks();
});

describe("entidades.controller", () => {
  it("listarEntidades responde exito", async () => {
    const { listarEntidades, stubs } = await loadEntidadesController();
    const res = createRes();

    stubs.listarExecute.mockResolvedValue([{ id: 1 }]);
    await listarEntidades({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.data).toEqual([{ id: 1 }]);
  });

  it("listarEntidades responde error", async () => {
    const { listarEntidades, stubs } = await loadEntidadesController();
    const res = createRes();

    stubs.listarExecute.mockRejectedValue(new Error("fallo listar entidades"));
    await listarEntidades({}, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo listar entidades");
  });

  it("crearEntidad responde exito", async () => {
    const { crearEntidad, stubs } = await loadEntidadesController();
    const res = createRes();

    stubs.crearExecute.mockResolvedValue({ id: 2, nombre: "Entidad X" });
    await crearEntidad(
      { body: { nombre: "Entidad X", tipo: "Cliente" }, user: { id: 8 } },
      res
    );

    expect(stubs.crearExecute).toHaveBeenCalledWith(
      { nombre: "Entidad X", tipo: "Cliente" },
      8
    );
    expect(res.statusCode).toBe(201);
  });

  it("crearEntidad responde error", async () => {
    const { crearEntidad, stubs } = await loadEntidadesController();
    const res = createRes();

    stubs.crearExecute.mockRejectedValue(new Error("fallo crear entidad"));
    await crearEntidad({ body: {}, user: { id: 1 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo crear entidad");
  });
});

describe("ordenes.controller", () => {
  it("crearOrden responde exito", async () => {
    const { crearOrden, stubs } = await loadOrdenesController();
    const res = createRes();

    stubs.crearExecute.mockResolvedValue({ id: 1, numero: "OT-1" });
    await crearOrden(
      { body: { numero: "OT-1", mantenimientos: [1] }, user: { id: 9 } },
      res
    );

    expect(stubs.crearExecute).toHaveBeenCalledWith(
      { numero: "OT-1", mantenimientos: [1] },
      9
    );
    expect(res.statusCode).toBe(201);
  });

  it("crearOrden responde error", async () => {
    const { crearOrden, stubs } = await loadOrdenesController();
    const res = createRes();

    stubs.crearExecute.mockRejectedValue(new Error("fallo crear orden"));
    await crearOrden({ body: {}, user: { id: 1 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo crear orden");
  });

  it("firmarOrden responde exito", async () => {
    const { firmarOrden, stubs } = await loadOrdenesController();
    const res = createRes();

    stubs.firmarExecute.mockResolvedValue(undefined);
    await firmarOrden(
      {
        params: { id: 3 },
        body: { firmaBase64: "abc" },
        user: { id: 15 }
      },
      res
    );

    expect(stubs.firmarExecute).toHaveBeenCalledWith(3, "abc", 15);
    expect(res.statusCode).toBe(200);
  });

  it("firmarOrden responde error", async () => {
    const { firmarOrden, stubs } = await loadOrdenesController();
    const res = createRes();

    stubs.firmarExecute.mockRejectedValue(new Error("fallo firmar"));
    await firmarOrden(
      { params: { id: 1 }, body: { firmaBase64: "x" }, user: { id: 1 } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo firmar");
  });

  it("listar responde error controlado", async () => {
    const { listar } = await loadOrdenesController();
    const res = createRes();

    await listar({}, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.success).toBe(false);
  });

  it("obtenerPorId responde error controlado", async () => {
    const { obtenerPorId } = await loadOrdenesController();
    const res = createRes();

    await obtenerPorId({ params: { id: 1 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.success).toBe(false);
  });
});

describe("Usuarios.controller", () => {
  it("crearUsuario responde exito", async () => {
    const { crearUsuario, stubs } = await loadUsuariosController();
    const res = createRes();

    stubs.hash.mockReturnValue("hash123");
    stubs.repoCreate.mockResolvedValue({ id: 7, email: "u@x.com" });
    stubs.logExecute.mockResolvedValue(undefined);

    await crearUsuario(
      {
        body: { nombre: "U", email: "u@x.com", password: "Admin123!Strong" },
        user: { id: 99 }
      },
      res
    );

    expect(stubs.hash).toHaveBeenCalledWith("Admin123!Strong");
    expect(stubs.repoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ password: "hash123" })
    );
    expect(stubs.logExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 99,
        accion: "CREAR",
        entidad: "USUARIO",
        entidadId: 7
      })
    );
    expect(res.statusCode).toBe(201);
  });

  it("crearUsuario responde error", async () => {
    const { crearUsuario, stubs } = await loadUsuariosController();
    const res = createRes();

    stubs.hash.mockReturnValue("hash123");
    stubs.repoCreate.mockRejectedValue(new Error("fallo crear usuario"));

    await crearUsuario(
      { body: { password: "Admin123!Strong" }, user: { id: 1 } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toBe("fallo crear usuario");
  });

  it("listarUsuarios responde exito y error", async () => {
    const { listarUsuarios, stubs } = await loadUsuariosController();

    const resOk = createRes();
    stubs.repoFindAll.mockResolvedValue([{ id: 1 }]);
    await listarUsuarios({}, resOk);
    expect(resOk.statusCode).toBe(200);
    expect(resOk.payload.data).toHaveLength(1);
    expect(resOk.payload.data[0]).toMatchObject({ id: 1 });

    const resErr = createRes();
    stubs.repoFindAll.mockRejectedValue(new Error("fallo listar usuarios"));
    await listarUsuarios({}, resErr);
    expect(resErr.statusCode).toBe(400);
    expect(resErr.payload.message).toBe("fallo listar usuarios");
  });

  it("editarUsuario cubre con y sin password, y error", async () => {
    const { editarUsuario, stubs } = await loadUsuariosController();

    stubs.hash.mockReturnValue("hash-edit");
    stubs.repoFindById.mockResolvedValue({ id: 2, password: "old-hash" });
    stubs.repoUpdate.mockResolvedValue({ id: 2, email: "e@x.com" });
    stubs.logExecute.mockResolvedValue(undefined);

    const resWithPass = createRes();
    await editarUsuario(
      { params: { id: 2 }, body: { password: "Admin123!Strong" }, user: { id: 7 } },
      resWithPass
    );
    expect(stubs.hash).toHaveBeenCalledWith("Admin123!Strong");
    expect(resWithPass.statusCode).toBe(200);

    const resNoPass = createRes();
    await editarUsuario(
      { params: { id: 2 }, body: { nombre: "Sin pass" }, user: { id: 7 } },
      resNoPass
    );
    expect(resNoPass.statusCode).toBe(200);

    const resErr = createRes();
    stubs.repoUpdate.mockRejectedValue(new Error("fallo editar usuario"));
    await editarUsuario(
      { params: { id: 2 }, body: {}, user: { id: 7 } },
      resErr
    );
    expect(resErr.statusCode).toBe(400);
    expect(resErr.payload.message).toBe("fallo editar usuario");
  });

  it("eliminarUsuario responde exito y error", async () => {
    const { eliminarUsuario, stubs } = await loadUsuariosController();

    stubs.repoFindById.mockResolvedValue({ id: 3, email: "del@x.com" });
    stubs.repoDelete.mockResolvedValue(undefined);
    stubs.logExecute.mockResolvedValue(undefined);

    const resOk = createRes();
    await eliminarUsuario({ params: { id: 3 }, user: { id: 5 } }, resOk);
    expect(resOk.statusCode).toBe(200);

    const resErr = createRes();
    stubs.repoFindById.mockRejectedValue(new Error("fallo eliminar usuario"));
    await eliminarUsuario({ params: { id: 3 }, user: { id: 5 } }, resErr);
    expect(resErr.statusCode).toBe(400);
    expect(resErr.payload.message).toBe("fallo eliminar usuario");
  });

  it("obtenerUsuario responde exito y error", async () => {
    const { obtenerUsuario, stubs } = await loadUsuariosController();

    const resOk = createRes();
    stubs.repoFindById.mockResolvedValue({ id: 1, email: "u@x.com" });
    await obtenerUsuario({ params: { id: 1 } }, resOk);
    expect(resOk.statusCode).toBe(200);
    expect(resOk.payload.data.email).toBe("u@x.com");

    const resErr = createRes();
    stubs.repoFindById.mockRejectedValue(new Error("fallo obtener usuario"));
    await obtenerUsuario({ params: { id: 1 } }, resErr);
    expect(resErr.statusCode).toBe(400);
    expect(resErr.payload.message).toBe("fallo obtener usuario");
  });
});
