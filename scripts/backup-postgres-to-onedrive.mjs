import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const pad = (value) => String(value).padStart(2, "0");

const timestamp = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("-") + `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
};

function parseEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.search(/\s+#/);
      if (commentIndex >= 0) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    env[key] = value;
  }

  return env;
}

function resolveEnvFile() {
  const explicit = process.env.BACKUP_ENV_FILE;
  if (explicit) {
    const resolved = path.isAbsolute(explicit) ? explicit : path.resolve(repoRoot, explicit);
    if (!fs.existsSync(resolved)) {
      throw new Error(`No existe el archivo de entorno indicado en BACKUP_ENV_FILE: ${resolved}`);
    }
    return resolved;
  }

  const candidates = [
    path.join(repoRoot, "backend", ".env"),
    path.join(repoRoot, "deploy", ".env.production"),
    path.join(repoRoot, ".env")
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function resolveBackupDir(env) {
  const explicit = env.BACKUP_DIR || env.GOOGLE_DRIVE_BACKUP_DIR;
  if (explicit) {
    return path.resolve(explicit);
  }

  return path.join(repoRoot, "tmp", "backups");
}

function isCommandAvailable(command, args) {
  const result = spawnSync(command, args, { stdio: "ignore" });
  return !result.error && result.status === 0;
}

function resolveDockerRunner() {
  if (isCommandAvailable("docker", ["compose", "version"])) {
    return { command: "docker", prefix: ["compose"] };
  }

  if (isCommandAvailable("docker-compose", ["version"])) {
    return { command: "docker-compose", prefix: [] };
  }

  return null;
}

function runDump(command, args, extraEnv, outputFile) {
  const fd = fs.openSync(outputFile, "w");

  try {
    const result = spawnSync(command, args, {
      cwd: repoRoot,
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", fd, "inherit"]
    });

    if (result.error) {
      if (result.error.code === "ENOENT") {
        const commandName = path.basename(command);
        throw new Error(
          `No se encontro ${commandName}. Define PG_DUMP_PATH si pg_dump no esta en el PATH.`
        );
      }

      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(`${command} termino con codigo ${result.status ?? "desconocido"}.`);
    }
  } finally {
    fs.closeSync(fd);
  }
}

function main() {
  const envFile = resolveEnvFile();
  const fileEnv = parseEnvFile(envFile);
  const env = { ...fileEnv, ...process.env };

  const database = env.DB_NAME || env.POSTGRES_DB || env.PGDATABASE || "assetcontrol";
  const user = env.DB_USER || env.POSTGRES_USER || env.PGUSER || "postgres";
  const password = env.DB_PASSWORD ?? env.POSTGRES_PASSWORD ?? env.PGPASSWORD ?? "";
  const host = env.DB_HOST || env.POSTGRES_HOST || env.PGHOST || "localhost";
  const port = Number(env.DB_PORT || env.POSTGRES_PORT || env.PGPORT || 5432);
  const requestedMode = String(env.BACKUP_MODE || "auto").toLowerCase();
  const inferredMode = ["db", "postgres", "postgresql"].includes(String(host).toLowerCase())
    ? "docker"
    : "direct";
  const mode = requestedMode === "auto" ? inferredMode : requestedMode;
  const backupPrefix = env.BACKUP_PREFIX || "assetcontrol";
  const backupDir = resolveBackupDir(env);
  const backupFile = path.join(backupDir, `${backupPrefix}-${timestamp()}.sql`);

  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`Archivo de entorno: ${envFile || "(sin archivo, solo process.env)"}`);
  console.log(`Modo de respaldo: ${mode}`);
  console.log(`Destino: ${backupFile}`);

  try {
    if (mode === "docker") {
      const dockerRunner = resolveDockerRunner();
      if (!dockerRunner) {
        throw new Error(
          "No se encontro Docker Compose. Instala Docker o usa BACKUP_MODE=direct con una base accesible desde el host."
        );
      }

      const composeFile = env.BACKUP_COMPOSE_FILE
        ? (path.isAbsolute(env.BACKUP_COMPOSE_FILE)
          ? env.BACKUP_COMPOSE_FILE
          : path.resolve(repoRoot, env.BACKUP_COMPOSE_FILE))
        : path.join(repoRoot, "deploy", "docker-compose.prod.yml");
      const composeEnvFile = env.BACKUP_ENV_FILE
        ? (path.isAbsolute(env.BACKUP_ENV_FILE)
          ? env.BACKUP_ENV_FILE
          : path.resolve(repoRoot, env.BACKUP_ENV_FILE))
        : path.join(repoRoot, "deploy", ".env.production");
      const service = env.BACKUP_DOCKER_SERVICE || "db";
      const dockerArgs = [
        ...dockerRunner.prefix,
        "-f",
        composeFile,
        "--env-file",
        composeEnvFile,
        "exec",
        "-e",
        password ? `PGPASSWORD=${password}` : "PGPASSWORD=",
        "-T",
        service,
        "pg_dump",
        "-h",
        "localhost",
        "-p",
        "5432",
        "-U",
        user,
        "-d",
        database,
        "--format=plain",
        "--no-owner",
        "--no-privileges",
        "--encoding=UTF8"
      ];

      runDump(dockerRunner.command, dockerArgs, {}, backupFile);
    } else if (mode === "direct") {
      if (String(host).toLowerCase() === "db") {
        throw new Error(
          "DB_HOST=db solo funciona dentro de Docker. Usa BACKUP_MODE=docker o apunta a una base accesible desde el host."
        );
      }

      const pgDumpCommand = env.PG_DUMP_PATH || "pg_dump";
      const directArgs = [
        "-h",
        host,
        "-p",
        String(port),
        "-U",
        user,
        "-d",
        database,
        "--format=plain",
        "--no-owner",
        "--no-privileges",
        "--encoding=UTF8"
      ];
      const extraEnv = password ? { PGPASSWORD: password } : {};

      runDump(pgDumpCommand, directArgs, extraEnv, backupFile);
    } else {
      throw new Error(`BACKUP_MODE invalido: ${mode}. Usa auto, direct o docker.`);
    }
  } catch (error) {
    if (fs.existsSync(backupFile)) {
      try {
        fs.unlinkSync(backupFile);
      } catch {
        // Ignore cleanup errors.
      }
    }

    throw error;
  }

  const stats = fs.statSync(backupFile);
  console.log(`Respaldo creado correctamente (${stats.size} bytes).`);
}

try {
  main();
} catch (error) {
  console.error(error?.message || error);
  process.exit(1);
}
