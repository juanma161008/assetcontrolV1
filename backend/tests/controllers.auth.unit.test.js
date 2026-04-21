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

async function loadAuthController() {
  vi.resetModules();

  const stubs = {
    loginExecute: vi.fn(),
    registroExecute: vi.fn(),
    generateToken: vi.fn()
  };

  vi.doMock("../src/application/auth/LoginUseCase.js", () => ({
    default: class {
      execute(...args) {
        return stubs.loginExecute(...args);
      }
    }
  }));

  vi.doMock("../src/application/auth/RegistroUseCase.js", () => ({
    default: class {
      execute(...args) {
        return stubs.registroExecute(...args);
      }
    }
  }));

  vi.doMock("../src/infrastructure/repositories/UsuarioPgRepository.js", () => ({
    default: class {}
  }));

  vi.doMock("../src/infrastructure/repositories/PermisoPgRepository.js", () => ({
    default: class {}
  }));

  vi.doMock("../src/config/jwt.js", () => ({
    generateToken: (...args) => stubs.generateToken(...args),
    verifyToken: vi.fn()
  }));

  const controller = await import("../src/interfaces/controllers/auth.controller.js");
  return { ...controller, stubs };
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.restoreAllMocks();
});

describe("auth.controller", () => {
  it("login responde rama test", async () => {
    process.env.NODE_ENV = "test";
    const { login } = await loadAuthController();
    const res = createRes();

    await login({ body: { email: "test@local" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
    expect(res.payload.data.token).toBe("test-token");
  });

  it("login en rama test usa email por defecto cuando falta body.email", async () => {
    process.env.NODE_ENV = "test";
    const { login } = await loadAuthController();
    const res = createRes();

    await login({ body: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.data.user.email).toBe("test@local");
  });

  it("login responde rama no-test exitosa", async () => {
    process.env.NODE_ENV = "development";
    const { login, stubs } = await loadAuthController();
    const res = createRes();

    stubs.loginExecute.mockResolvedValue({
      id: 1,
      nombre: "Admin",
      email: "admin@x.com",
      rol: 1,
      permisos: ["ADMIN_TOTAL"]
    });
    stubs.generateToken.mockReturnValue("jwt-123");

    await login(
      { body: { email: "admin@x.com", password: "secret" } },
      res
    );

    expect(stubs.loginExecute).toHaveBeenCalledWith("admin@x.com", "secret");
    expect(stubs.generateToken).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.payload.data.token).toBe("jwt-123");
  });

  it("login captura errores en rama no-test", async () => {
    process.env.NODE_ENV = "development";
    const { login, stubs } = await loadAuthController();
    const res = createRes();

    stubs.loginExecute.mockRejectedValue(new Error("Credenciales invalidas"));

    await login({ body: { email: "x", password: "y" } }, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload.success).toBe(false);
    expect(res.payload.message).toBe("Credenciales invalidas");
  });

  it("registro responde rama test", async () => {
    process.env.NODE_ENV = "test";
    const { registro } = await loadAuthController();
    const res = createRes();

    await registro(
      { body: { nombre: "A", email: "a@x.com" } },
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.payload.success).toBe(true);
    expect(res.payload.data.email).toBe("a@x.com");
  });

  it("registro en rama test usa valores por defecto cuando faltan datos", async () => {
    process.env.NODE_ENV = "test";
    const { registro } = await loadAuthController();
    const res = createRes();

    await registro({ body: {} }, res);

    expect(res.statusCode).toBe(201);
    expect(res.payload.data.nombre).toBe("Test User");
    expect(res.payload.data.email).toBe("test@local");
  });

  it("registro responde rama no-test exitosa", async () => {
    process.env.NODE_ENV = "development";
    const { registro, stubs } = await loadAuthController();
    const res = createRes();

    stubs.registroExecute.mockResolvedValue({ id: 9, email: "new@x.com" });

    await registro(
      { body: { nombre: "Nuevo", email: "new@x.com", password: "123" } },
      res
    );

    expect(stubs.registroExecute).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(201);
    expect(res.payload.data.email).toBe("new@x.com");
  });

  it("registro captura errores en rama no-test", async () => {
    process.env.NODE_ENV = "development";
    const { registro, stubs } = await loadAuthController();
    const res = createRes();

    stubs.registroExecute.mockRejectedValue(new Error("Error de registro"));

    await registro({ body: { email: "x" } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.success).toBe(false);
    expect(res.payload.message).toBe("Error de registro");
  });

  it("me responde usuario autenticado", async () => {
    const { me } = await loadAuthController();
    const res = createRes();

    await me({ user: { id: 1, email: "me@x.com" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
    expect(res.payload.data.email).toBe("me@x.com");
  });

  it("me responde no autenticado en error", async () => {
    const { me } = await loadAuthController();
    const res = createRes();

    await me(null, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload.success).toBe(false);
    expect(res.payload.message).toBe("No autenticado");
  });
});
