import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PASSWORD_POLICY,
  buildPasswordPolicyMessage,
  generateStrongPassword,
  validatePassword
} from "../src/utils/passwordPolicy.js";

const originalPolicy = { ...PASSWORD_POLICY };

afterEach(() => {
  Object.assign(PASSWORD_POLICY, originalPolicy);
  vi.restoreAllMocks();
});

describe("validatePassword", () => {
  it("valida contrasena fuerte", () => {
    const result = validatePassword("Abcdef12!@#xyz");
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("detecta errores de politica", () => {
    expect(validatePassword("abc").errors).toContain("minLength");
    expect(validatePassword("abcdefgHIJKL").errors).toContain("number");
    expect(validatePassword("ABCDEFGH1234").errors).toContain("lower");
    expect(validatePassword("abcdefgh1234").errors).toContain("upper");
    expect(validatePassword("Abcdefgh1234").errors).toContain("symbol");
  });

  it("trata valores falsy como cadena vacia", () => {
    const result = validatePassword();
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining(["minLength", "upper", "lower", "number", "symbol"])
    );
  });
});

describe("buildPasswordPolicyMessage", () => {
  it("genera mensaje de politica", () => {
    const msg = buildPasswordPolicyMessage();
    expect(msg).toMatch(/al menos/i);
    expect(msg).toMatch(/may/i);
  });
});

describe("generateStrongPassword", () => {
  it("genera una contrasena fuerte respetando la politica", () => {
    vi.spyOn(crypto, "randomInt").mockReturnValue(0);

    const password = generateStrongPassword(8);

    expect(password.length).toBeGreaterThanOrEqual(PASSWORD_POLICY.minLength);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });

  it("funciona cuando la politica no exige clases especificas", () => {
    PASSWORD_POLICY.requireUpper = false;
    PASSWORD_POLICY.requireLower = false;
    PASSWORD_POLICY.requireNumber = false;
    PASSWORD_POLICY.requireSymbol = false;
    vi.spyOn(crypto, "randomInt").mockReturnValue(0);

    const password = generateStrongPassword(4);

    expect(password.length).toBe(PASSWORD_POLICY.minLength);
    expect(password).toMatch(/^[A-Za-z0-9!@#$%*?_-]+$/);
  });
});
