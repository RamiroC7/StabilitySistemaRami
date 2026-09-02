/**
 * Carga el `.env` del paquete si existe. Zero-dep (`process.loadEnvFile`, Node ≥ 20.12).
 *
 * En local (`npm run dev:stdio` / `npm run inspect`) hace falta para poblar
 * `DATABASE_URL`, y el cwd puede ser la raíz del monorepo, no el del paquete —
 * por eso se resuelve la ruta relativa a este archivo (`../.env`), no al cwd.
 * Claude Desktop (T15) y CI pasan el env directamente y no hay `.env` — por eso
 * el try/catch silencioso.
 *
 * Importar este módulo ANTES que cualquiera que lea `process.env` (p. ej. `db.ts`).
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const packageEnv = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env");

try {
  if (existsSync(packageEnv)) {
    process.loadEnvFile(packageEnv);
  } else {
    // Fallback: .env en el cwd (p. ej. si se corre desde el dir del paquete).
    process.loadEnvFile();
  }
} catch {
  // No hay .env en ningún lado; se asume que el env ya viene seteado (Claude Desktop / CI).
}
