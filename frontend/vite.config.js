import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const resolveFilePath = (filePath) =>
  path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const httpsEnabled = env.VITE_DEV_HTTPS === "true";
  const certPath = env.VITE_DEV_HTTPS_CERT_PATH;
  const keyPath = env.VITE_DEV_HTTPS_KEY_PATH;

  let httpsConfig;

  if (httpsEnabled && certPath && keyPath) {
    const resolvedCert = resolveFilePath(certPath);
    const resolvedKey = resolveFilePath(keyPath);

    if (fs.existsSync(resolvedCert) && fs.existsSync(resolvedKey)) {
      httpsConfig = {
        cert: fs.readFileSync(resolvedCert),
        key: fs.readFileSync(resolvedKey)
      };
    } else {
      console.warn("[vite] HTTPS habilitado pero no se encontraron cert/key. Se usara HTTP.");
    }
  }

  return {
    plugins: [
      react({
        babel: {
          plugins: [["babel-plugin-react-compiler"]]
        }
      })
    ],
    server: {
      host: true,
      https: httpsConfig
    }
  };
});
