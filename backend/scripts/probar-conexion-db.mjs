/**
 * Prueba la conexion a PostgreSQL usando backend/.env.
 * Uso, desde la raiz del repo: npm run db:check
 *
 * Sirve para validar credenciales y para diagnosticar por que el backend no
 * arranca, sin tener que leer los logs de la API.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pkg from "pg";

const { Pool } = pkg;

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(backendRoot, ".env") });

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "assetcontrol",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  ssl: false,
  connectionTimeoutMillis: 10000
};

console.log(`Conectando a ${config.user}@${config.host}:${config.port}/${config.database} ...`);

if (!config.password || config.password.startsWith("CAMBIAR_")) {
  console.error("ERROR: DB_PASSWORD no esta configurada en backend/.env");
  process.exit(1);
}

const pool = new Pool(config);

try {
  const { rows } = await pool.query(
    "select current_database() as db, current_user as usuario, version() as version"
  );
  console.log("OK - conexion establecida");
  console.log(`  base de datos   : ${rows[0].db}`);
  console.log(`  usuario         : ${rows[0].usuario}`);
  console.log(`  servidor        : ${rows[0].version.split(",")[0]}`);

  const tablas = await pool.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
  );
  console.log(`  tablas en public: ${tablas.rowCount}`);
  if (tablas.rowCount > 0) {
    console.log(`  ${tablas.rows.map((r) => r.table_name).join(", ")}`);
  } else {
    console.log(
      "  AVISO: el esquema 'public' esta vacio: la base existe pero no tiene las tablas de AssetControl."
    );
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  if (error.code) console.error(`  codigo pg: ${error.code}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
