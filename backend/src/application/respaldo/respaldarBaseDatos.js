import fs from "node:fs";
import { spawnSync } from "node:child_process";
import env from "../../config/env.js";

// Vuelca la base de datos completa con pg_dump al archivo indicado.
// Usado tanto por el respaldo automatico (a la carpeta configurada) como por
// la descarga individual que cada usuario puede pedir desde su navegador.
export default function respaldarBaseDatos(archivoDestino) {
  const pgDumpCommand = env.PG_DUMP_PATH || "pg_dump";
  const args = [
    "-h", env.DB_HOST,
    "-p", String(env.DB_PORT),
    "-U", env.DB_USER,
    "-d", env.DB_NAME,
    "--format=plain",
    "--no-owner",
    "--no-privileges",
    "--encoding=UTF8"
  ];
  const extraEnv = env.DB_PASSWORD ? { PGPASSWORD: env.DB_PASSWORD } : {};

  const fd = fs.openSync(archivoDestino, "w");
  try {
    const result = spawnSync(pgDumpCommand, args, {
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", fd, "pipe"]
    });

    if (result.error) {
      throw new Error(
        result.error.code === "ENOENT"
          ? "No se encontro pg_dump. Configura PG_DUMP_PATH en el servidor."
          : result.error.message
      );
    }

    if (result.status !== 0) {
      throw new Error(`pg_dump termino con codigo ${result.status ?? "desconocido"}.`);
    }
  } finally {
    fs.closeSync(fd);
  }
}
