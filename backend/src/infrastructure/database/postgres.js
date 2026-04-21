import pkg from "pg";
import env from "../../config/env.js";

const { Pool } = pkg;

const pool = new Pool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: env.DB_PORT
});

export default pool;
