import express from "express";
import cors from "cors";
import helmet from "helmet";
import env from "./config/env.js";
import requestContext from "./interfaces/middleware/requestContext.js";
import requestLogger from "./interfaces/middleware/requestLogger.js";
import jwtAuth from "./interfaces/middleware/jwtAuth.js";
import permisosAuth from "./interfaces/middleware/permisosAuth.js";
import { getMetricsSnapshot } from "./utils/metrics.js";

import authRoutes from "./interfaces/routes/auth.routes.js";
import activosRoutes from "./interfaces/routes/activos.routes.js";
import mantenimientosRoutes from "./interfaces/routes/mantenimientos.routes.js";
import ordenesRoutes from "./interfaces/routes/ordenes.routes.js";
import usuariosRoutes from "./interfaces/routes/usuarios.routes.js";
import entidadesRoutes from "./interfaces/routes/entidades.routes.js";
import auditoriaRoutes from "./interfaces/routes/auditoria.routes.js";
import notificacionesRoutes from "./interfaces/routes/notificaciones.routes.js";
import helpdeskRoutes from "./interfaces/routes/helpdesk.routes.js";
import reportesRoutes from "./interfaces/routes/reportes.routes.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);
app.use(helmet());
app.use(requestContext);
app.use(requestLogger);

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176"
];

const envAllowedOrigins = String(env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([...defaultAllowedOrigins, ...envAllowedOrigins]);

const isPrivateNetworkOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true;
    }

    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin) || isPrivateNetworkOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origen no permitido por CORS: ${origin}`), false);
  },
  credentials: true,
  exposedHeaders: ["x-request-id"]
}));

app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    requestId: req.requestId
  });
});

app.get("/api/metrics", jwtAuth, permisosAuth(["ADMIN_TOTAL"]), (req, res) => {
  res.json({
    ...getMetricsSnapshot(),
    requestId: req.requestId
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/activos", activosRoutes);
app.use("/api/mantenimientos", mantenimientosRoutes);
app.use("/api/ordenes", ordenesRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/entidades", entidadesRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/notificaciones", notificacionesRoutes);
app.use("/api/helpdesk", helpdeskRoutes);
app.use("/api/reportes", reportesRoutes);

app.get("/", (req, res) => {
  res.json({ status: "AssetControl API", version: "1.0" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err?.message || err, {
    requestId: req.requestId,
    path: req.originalUrl
  });
  res.status(500).json({
    error: "Error interno del servidor",
    requestId: req.requestId
  });
});

export default app;
