import { describe, it, expect, vi, afterEach } from "vitest";

import permisosAuth from "../src/interfaces/middleware/permisosAuth.js";
import hashUtil, { compareHash, hash, needsRehash } from "../src/utils/hash.js";
import { success, error } from "../src/utils/response.js";
import { generateToken, verifyToken } from "../src/config/jwt.js";

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

async function loadJwtAuth() {
  vi.resetModules();
  const stubs = { verifyToken: vi.fn() };

  vi.doMock("../src/config/jwt.js", () => ({
    verifyToken: (...args) => stubs.verifyToken(...args),
    generateToken: vi.fn()
  }));

  const mod = await import("../src/interfaces/middleware/jwtAuth.js");
  return { jwtAuth: mod.default, stubs };
}

async function loadAuditLogger() {
  vi.resetModules();
  const stubs = { repoCreate: vi.fn() };

  vi.doMock("../src/infrastructure/repositories/LogPgRepository.js", () => ({
    default: class {
      create(...args) {
        return stubs.repoCreate(...args);
      }
    }
  }));

  const mod = await import("../src/interfaces/middleware/auditlogger.js");
  return { auditLogger: mod.default, stubs };
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.restoreAllMocks();
});

describe("jwtAuth middleware", () => {
  it("en entorno test hace bypass y setea usuario", async () => {
    process.env.NODE_ENV = "test";
    const { jwtAuth } = await loadJwtAuth();
    const req = {};
    const res = createRes();
    const next = vi.fn();

    jwtAuth(req, res, next);

    expect(req.user).toEqual({ id: 1, permisos: ["ADMIN_TOTAL"] });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("retorna 401 si no hay header", async () => {
    process.env.NODE_ENV = "development";
    const { jwtAuth } = await loadJwtAuth();
    const req = { headers: {} };
    const res = createRes();
    const next = vi.fn();

    jwtAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.payload.error).toBe("Token requerido");
    expect(next).not.toHaveBeenCalled();
  });

  it("valida token y continua", async () => {
    process.env.NODE_ENV = "development";
    const { jwtAuth, stubs } = await loadJwtAuth();
    const req = { headers: { authorization: "Bearer token123" } };
    const res = createRes();
    const next = vi.fn();

    stubs.verifyToken.mockReturnValue({ id: 99, permisos: ["VER_ACTIVOS"] });
    jwtAuth(req, res, next);

    expect(stubs.verifyToken).toHaveBeenCalledWith("token123");
    expect(req.user).toEqual({ id: 99, permisos: ["VER_ACTIVOS"] });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("retorna 401 cuando token es invalido", async () => {
    process.env.NODE_ENV = "development";
    const { jwtAuth, stubs } = await loadJwtAuth();
    const req = { headers: { authorization: "Bearer bad" } };
    const res = createRes();
    const next = vi.fn();

    stubs.verifyToken.mockImplementation(() => {
      throw new Error("bad");
    });
    jwtAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.payload.error).toBeTruthy();
    expect(next).not.toHaveBeenCalled();
  });
});

describe("permisosAuth middleware", () => {
  it("niega cuando req.user no existe", () => {
    const middleware = permisosAuth(["VER_ACTIVOS"]);
    const req = {};
    const res = createRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.payload.message).toBe("Sin permisos");
    expect(next).not.toHaveBeenCalled();
  });

  it("permite ADMIN_TOTAL", () => {
    const middleware = permisosAuth(["VER_ACTIVOS"]);
    const req = { user: { permisos: ["ADMIN_TOTAL"] } };
    const res = createRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("permite permiso especifico", () => {
    const middleware = permisosAuth(["CREAR_ACTIVO"]);
    const req = { user: { permisos: ["CREAR_ACTIVO"] } };
    const res = createRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("deniega cuando no coincide permiso", () => {
    const middleware = permisosAuth(["ELIMINAR_ACTIVO"]);
    const req = { user: { permisos: ["VER_ACTIVOS"] } };
    const res = createRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.payload.message).toBe("Acceso denegado");
    expect(next).not.toHaveBeenCalled();
  });
});

describe("auditLogger middleware", () => {
  it("registra log y llama next", async () => {
    const { auditLogger, stubs } = await loadAuditLogger();
    const req = { user: { id: 1 }, ip: "127.0.0.1" };
    const res = {
      locals: {
        entidadId: 10,
        antes: { a: 1 },
        despues: { a: 2 }
      }
    };
    const next = vi.fn();

    stubs.repoCreate.mockResolvedValue(undefined);
    await auditLogger("EDITAR", "ACTIVO")(req, res, next);

    expect(stubs.repoCreate).toHaveBeenCalledWith({
      usuario_id: 1,
      accion: "EDITAR",
      entidad: "ACTIVO",
      entidad_id: 10,
      antes: { a: 1 },
      despues: { a: 2 },
      ip: "127.0.0.1"
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("maneja error en auditoria y sigue", async () => {
    const { auditLogger, stubs } = await loadAuditLogger();
    const req = { user: { id: 2 }, ip: "127.0.0.1" };
    const res = { locals: {} };
    const next = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    stubs.repoCreate.mockRejectedValue(new Error("db"));
    await auditLogger("CREAR", "USUARIO")(req, res, next);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("utils/hash", () => {
  it("hash y compareHash funcionan", async () => {
    const hashed = await hash("abc123");
    expect(hashed).toBeDefined();
    expect(await compareHash("abc123", hashed)).toBe(true);
    expect(await compareHash("zzz", hashed)).toBe(false);
  });

  it("hashUtil.compare usa compareHash", async () => {
    const hashed = await hash("demo");
    expect(await hashUtil.compare("demo", hashed)).toBe(true);
  });

  it("needsRehash detecta hashes con costo inferior", async () => {
    const weakHash = await hash("abc123", 10);
    expect(needsRehash(weakHash, 12)).toBe(true);
    expect(needsRehash(weakHash, 10)).toBe(false);
  });
});

describe("utils/response", () => {
  it("success retorna estructura estandar", () => {
    const res = createRes();
    success(res, { ok: true }, "Creado", 201);

    expect(res.statusCode).toBe(201);
    expect(res.payload).toEqual({
      success: true,
      message: "Creado",
      data: { ok: true }
    });
  });

  it("error retorna estructura estandar", () => {
    const res = createRes();
    error(res, "Fallo", 422);

    expect(res.statusCode).toBe(422);
    expect(res.payload).toEqual({
      success: false,
      message: "Fallo"
    });
  });
});

describe("config/jwt", () => {
  it("genera y verifica token", () => {
    const payload = { id: 1, email: "a@x.com" };
    const token = generateToken(payload);
    const decoded = verifyToken(token);

    expect(decoded.id).toBe(1);
    expect(decoded.email).toBe("a@x.com");
  });
});
