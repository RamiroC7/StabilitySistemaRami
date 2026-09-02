/**
 * Carga `.env` del cwd si existe. Zero-dep (`process.loadEnvFile`, Node ≥ 20.12).
 *
 * En local (`npm run dev:stdio` / `npm run inspect`) hace falta para poblar
 * `DATABASE_URL`. Claude Desktop (T15) y CI pasan el env directamente y no hay
 * `.env` — por eso el try/catch silencioso.
 *
 * Importar este módulo ANTES que cualquiera que lea `process.env` (p. ej. `db.ts`).
 */
try {
  process.loadEnvFile();
} catch {
  // No hay .env en el cwd; se asume que el env ya viene seteado.
}
