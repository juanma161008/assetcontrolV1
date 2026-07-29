import fs from "node:fs";
import env from "../../config/env.js";

const CANDIDATE_PATHS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];

// En produccion (Docker/Debian) se usa CHROMIUM_PATH=/usr/bin/chromium (definido en el
// Dockerfile). En desarrollo local se autodetecta un Chrome/Edge ya instalado para no
// exigirle a cada dev que configure la variable a mano.
export default function resolveChromiumPath() {
  if (env.CHROMIUM_PATH && fs.existsSync(env.CHROMIUM_PATH)) {
    return env.CHROMIUM_PATH;
  }

  const found = CANDIDATE_PATHS.find((candidate) => fs.existsSync(candidate));
  if (found) {
    return found;
  }

  throw new Error(
    "No se encontro un navegador Chromium/Chrome instalado para generar el PDF. Define CHROMIUM_PATH."
  );
}
