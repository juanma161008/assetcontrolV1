import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import app from "./server.js";
import env from "./config/env.js";
import { startSchedulers } from "./application/scheduler/index.js";

const PORT = env.PORT;

const resolveFilePath = (filePath) =>
  path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

const startHttpServer = () => {
  app.listen(PORT, () => {
    console.log(`AssetControl API escuchando en http://localhost:${PORT}`);
  });
};

const startHttpsServer = () => {
  if (!env.HTTPS_KEY_PATH || !env.HTTPS_CERT_PATH) {
    console.error(
      "HTTPS_ENABLED=true pero faltan HTTPS_KEY_PATH y/o HTTPS_CERT_PATH en variables de entorno."
    );
    process.exit(1);
  }

  try {
    const keyPath = resolveFilePath(env.HTTPS_KEY_PATH);
    const certPath = resolveFilePath(env.HTTPS_CERT_PATH);

    const credentials = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };

    https.createServer(credentials, app).listen(PORT, () => {
      console.log(`AssetControl API escuchando en https://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar HTTPS en backend:", error?.message || error);
    process.exit(1);
  }
};

if (env.HTTPS_ENABLED) {
  startHttpsServer();
} else {
  startHttpServer();
}

startSchedulers();
