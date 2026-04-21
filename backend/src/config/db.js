import pkg from "pg";
import env from "./env.js";

const { Pool } = pkg;

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  ssl: false
});

export default {
  query: (text, params) => pool.query(text, params),
  pool
};
