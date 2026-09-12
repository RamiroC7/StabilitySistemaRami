/**
 * Carga el `.env` del paquete si existe. Zero-dep (`process.loadEnvFile`, Node ≥ 20.12).
 *
 * En local (dev, Inspector, scripts manuales) hace falta para poblar
 * `GYM_OWNER_RO_DATABASE_URL` / `GYM_MCP_SERVICE_DATABASE_URL` (y las env vars
 * de OAuth que se agreguen en tasks siguientes), y el cwd puede ser la raíz
 * del monorepo, no el del paquete — por eso se resuelve la ruta relativa a
 * este archivo (`../.env`), no al cwd. En Vercel el env viene seteado por la
 * plataforma y no hay `.env` — por eso el try/catch silencioso.
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
  // No hay .env en ningún lado; se asume que el env ya viene seteado (Vercel / CI).
}
