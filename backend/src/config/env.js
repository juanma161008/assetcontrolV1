import dotenv from "dotenv";

dotenv.config();

export default {
  PORT: process.env.PORT || 5000,

  DB_HOST: process.env.DB_HOST || "localhost",
  DB_PORT: Number(process.env.DB_PORT) || 5432,
  DB_NAME: process.env.DB_NAME || "assetcontrol",
  DB_USER: process.env.DB_USER || "postgres",
  DB_PASSWORD: process.env.DB_PASSWORD,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",
  JWT_ISSUER: process.env.JWT_ISSUER || "assetcontrol-api",
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || "assetcontrol-web",

  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER || "",

  LUMIX_AI_PROVIDER: process.env.LUMIX_AI_PROVIDER || (process.env.DEEPSEEK_API_KEY ? "deepseek" : "auto"),
  LUMIX_AI_MODEL: process.env.LUMIX_AI_MODEL || "",
  LUMIX_AI_MAX_OUTPUT_TOKENS: Number(process.env.LUMIX_AI_MAX_OUTPUT_TOKENS) || 500,
  LUMIX_AI_TEMPERATURE: process.env.LUMIX_AI_TEMPERATURE || "",
  LUMIX_AI_TIMEOUT_MS: Number(process.env.LUMIX_AI_TIMEOUT_MS) || 25000,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
  DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",

  CORS_ORIGINS: process.env.CORS_ORIGINS || "",

  HTTPS_ENABLED: process.env.HTTPS_ENABLED === "true",
  HTTPS_KEY_PATH: process.env.HTTPS_KEY_PATH || "",
  HTTPS_CERT_PATH: process.env.HTTPS_CERT_PATH || "",

  TRUST_PROXY: process.env.TRUST_PROXY === "true",

  AUTH_RATE_LIMIT_WINDOW_MS: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX) || 12,
  PASSWORD_HASH_ROUNDS: Number(process.env.PASSWORD_HASH_ROUNDS) || 12,
  PASSWORD_HISTORY_LIMIT: Number(process.env.PASSWORD_HISTORY_LIMIT) || 5,

  SCHEDULER_ENABLED: process.env.SCHEDULER_ENABLED || "true",
  REPORTES_EMAILS: process.env.REPORTES_EMAILS || "",
  REPORTES_AUTOMATICOS: process.env.REPORTES_AUTOMATICOS || "true",
  RECORDATORIOS_AUTOMATICOS: process.env.RECORDATORIOS_AUTOMATICOS || "true",
  RECORDATORIOS_DIAS: process.env.RECORDATORIOS_DIAS || "3"
};
