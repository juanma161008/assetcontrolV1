import { beforeEach, describe, expect, it, vi } from "vitest";
import httpClient from "./httpClient";
import {
  changePassword,
  fetchCurrentUser,
  getCurrentUser,
  getSession,
  getToken,
  INACTIVITY_TIMEOUT_MS,
  isAuthenticated,
  isSessionExpired,
  login,
  setSession,
  updateCurrentUser
} from "./authService";

vi.mock("./httpClient", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

function createLocalStorageMock() {
  let store = {};
  return {
    getItem: vi.fn((key) => (Object.hasOwn(store, key) ? store[key] : null)),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
}

describe("authService", () => {
  beforeEach(() => {
    const localStorageMock = createLocalStorageMock();
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true
    });
    vi.clearAllMocks();
  });

  it("guarda y recupera la sesion", () => {
    setSession({ user: { id: 1, nombre: "Ana" }, token: "abc" });

    expect(getSession()).toEqual({ user: { id: 1, nombre: "Ana" }, token: "abc" });
    expect(getToken()).toBe("abc");
    expect(isAuthenticated()).toBe(true);
  });

  it("login persiste usuario y token", async () => {
    httpClient.post.mockResolvedValue({
      data: {
        data: {
          user: { id: 2, email: "demo@empresa.com" },
          token: "token-demo"
        }
      }
    });

    const result = await login("demo@empresa.com", "123456");

    expect(result.success).toBe(true);
    expect(getCurrentUser()).toEqual({ id: 2, email: "demo@empresa.com" });
    expect(getToken()).toBe("token-demo");
  });

  it("fetchCurrentUser actualiza datos del usuario en sesion", async () => {
    setSession({ user: { id: 5, nombre: "Inicial" }, token: "tok-5" });
    httpClient.get.mockResolvedValue({
      data: {
        data: { id: 5, nombre: "Actualizado" }
      }
    });

    const result = await fetchCurrentUser();

    expect(result.success).toBe(true);
    expect(getCurrentUser()).toEqual({ id: 5, nombre: "Actualizado" });
  });

  it("updateCurrentUser mergea informacion parcial", () => {
    setSession({ user: { id: 9, nombre: "Juan", email: "a@b.com" }, token: "tok-9" });

    updateCurrentUser({ nombre: "Juan Pablo" });

    expect(getCurrentUser()).toEqual({ id: 9, nombre: "Juan Pablo", email: "a@b.com" });
  });

  it("bloquea sesion cuando supera el tiempo de inactividad", () => {
    setSession({ user: { id: 10, nombre: "Idle" }, token: "tok-idle" });
    localStorage.setItem("lastActivity", String(Date.now() - INACTIVITY_TIMEOUT_MS - 2000));

    expect(isSessionExpired()).toBe(true);
    expect(isAuthenticated()).toBe(false);
    expect(getSession()).toBeNull();
  });

  it("changePassword retorna error cuando backend falla", async () => {
    httpClient.post.mockRejectedValue({
      response: { data: { message: "No autorizado" } }
    });

    const result = await changePassword("old", "new123", "new123");

    expect(result.success).toBe(false);
    expect(result.error).toBe("No autorizado");
  });
});
