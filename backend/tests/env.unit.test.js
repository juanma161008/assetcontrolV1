import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const restoreEnv = () => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
};

afterEach(() => {
  restoreEnv();
  vi.resetModules();
  vi.unmock("dotenv");
});

async function loadEnv(overrides = {}) {
  restoreEnv();
  vi.resetModules();
  vi.doMock("dotenv", () => ({
    default: {
      config: vi.fn()
    }
  }));
  Object.assign(process.env, overrides);
  return import("../src/config/env.js");
}

describe("config/env", () => {
  it("aplica valores por defecto cuando las variables estan vacias", async () => {
    const env = await loadEnv({
      PORT: "",
      DB_PORT: "",
      DB_HOST: "",
      DB_NAME: "",
      DB_USER: "",
      SMTP_HOST: "",
      SMTP_PORT: "",
      SMTP_SECURE: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      SMTP_FROM: "",
      LUMIX_AI_PROVIDER: "",
      DEEPSEEK_API_KEY: "",
      DEEPSEEK_BASE_URL: "",
      DEEPSEEK_MODEL: "",
      OPENAI_API_KEY: "",
      GEMINI_API_KEY: "",
      CORS_ORIGINS: "",
      HTTPS_ENABLED: "",
      HTTPS_KEY_PATH: "",
      HTTPS_CERT_PATH: "",
      TRUST_PROXY: "",
      AUTH_RATE_LIMIT_WINDOW_MS: "",
      AUTH_RATE_LIMIT_MAX: "",
      SCHEDULER_ENABLED: "",
      REPORTES_EMAILS: "",
      REPORTES_AUTOMATICOS: "",
      RECORDATORIOS_AUTOMATICOS: "",
      RECORDATORIOS_DIAS: ""
    });

    expect(env.default.PORT).toBe(5000);
    expect(env.default.DB_PORT).toBe(5432);
    expect(env.default.DB_NAME).toBe("assetcontrol");
    expect(env.default.SMTP_SECURE).toBe(false);
    expect(env.default.SMTP_FROM).toBe("");
    expect(env.default.LUMIX_AI_PROVIDER).toBe("auto");
    expect(env.default.SCHEDULER_ENABLED).toBe("true");
    expect(env.default.REPORTES_AUTOMATICOS).toBe("true");
    expect(env.default.RECORDATORIOS_AUTOMATICOS).toBe("true");
  });

  it("deriva provider deepseek y respeta valores personalizados", async () => {
    const env = await loadEnv({
      PORT: "8080",
      DB_PORT: "6543",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "2525",
      SMTP_SECURE: "true",
      SMTP_USER: "user@example.com",
      SMTP_FROM: "",
      LUMIX_AI_PROVIDER: "",
      LUMIX_AI_MODEL: "gpt-4.1-mini",
      LUMIX_AI_MAX_OUTPUT_TOKENS: "1000",
      LUMIX_AI_TEMPERATURE: "0.2",
      LUMIX_AI_TIMEOUT_MS: "30000",
      DEEPSEEK_API_KEY: "key",
      DEEPSEEK_BASE_URL: "https://api.example.com/v1",
      DEEPSEEK_MODEL: "deepseek-chat",
      OPENAI_API_KEY: "openai",
      GEMINI_API_KEY: "gemini",
      CORS_ORIGINS: "http://a.com",
      HTTPS_ENABLED: "true",
      HTTPS_KEY_PATH: "/key",
      HTTPS_CERT_PATH: "/cert",
      TRUST_PROXY: "true",
      AUTH_RATE_LIMIT_WINDOW_MS: "60000",
      AUTH_RATE_LIMIT_MAX: "5",
      SCHEDULER_ENABLED: "false",
      REPORTES_EMAILS: "reportes@example.com",
      REPORTES_AUTOMATICOS: "false",
      RECORDATORIOS_AUTOMATICOS: "false",
      RECORDATORIOS_DIAS: "7"
    });

    expect(env.default.PORT).toBe("8080");
    expect(env.default.DB_PORT).toBe(6543);
    expect(env.default.SMTP_SECURE).toBe(true);
    expect(env.default.SMTP_FROM).toBe("user@example.com");
    expect(env.default.LUMIX_AI_PROVIDER).toBe("deepseek");
    expect(env.default.LUMIX_AI_MODEL).toBe("gpt-4.1-mini");
    expect(env.default.LUMIX_AI_MAX_OUTPUT_TOKENS).toBe(1000);
    expect(env.default.LUMIX_AI_TEMPERATURE).toBe("0.2");
    expect(env.default.LUMIX_AI_TIMEOUT_MS).toBe(30000);
    expect(env.default.DEEPSEEK_BASE_URL).toBe("https://api.example.com/v1");
    expect(env.default.HTTPS_ENABLED).toBe(true);
    expect(env.default.TRUST_PROXY).toBe(true);
    expect(env.default.AUTH_RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(env.default.AUTH_RATE_LIMIT_MAX).toBe(5);
    expect(env.default.SCHEDULER_ENABLED).toBe("false");
    expect(env.default.REPORTES_EMAILS).toBe("reportes@example.com");
    expect(env.default.REPORTES_AUTOMATICOS).toBe("false");
    expect(env.default.RECORDATORIOS_AUTOMATICOS).toBe("false");
    expect(env.default.RECORDATORIOS_DIAS).toBe("7");
  });
});
