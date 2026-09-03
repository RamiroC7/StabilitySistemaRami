/**
 * ⚠️  stdout es el canal JSON-RPC del protocolo MCP — SOLO se puede escribir con
 *     `console.error` (va a stderr). Un `console.log` aca rompe el protocolo y
 *     Claude Desktop marca el server como "failed". La regla de lint de este
 *     paquete prohibe `console.log` justamente por esto.
 *
 * Entrypoint del transport stdio. Lo levanta Claude Desktop (T15) pasando
 * `DATABASE_URL` y `MCP_ACCESS_TOKEN` por env.
 *
 * En local, `npm run dev:stdio` / `npm run inspect` cargan `packages/mcp-server/.env`
 * (`./load-env.js`, que resuelve la ruta relativa a este paquete y usa
 * `process.loadEnvFile`). No hay dependencia de dotenv. Este import va PRIMERO:
 * puebla `process.env` antes de que `db.ts` (y `auth.ts`, que depende de `db.ts`) lo lean.
 */
import "./load-env.js";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./create-server.js";
import { closePool } from "./db.js";
import { assertAuthFromEnv } from "./auth.js";

// Fase 4 / T10: valida MCP_ACCESS_TOKEN ANTES de abrir el transport. Si falta,
// esta revocado/expirado, o no pertenece a un coach, `assertAuthFromEnv`
// loguea el motivo a stderr y sale con `exit(1)` — Claude Desktop marca el
// server como "failed" en vez de dejarlo andar sin auth (design.md
// "Arranque en modo stdio").
await assertAuthFromEnv();

const handle = serveStdio(() => createServer());

console.error("[stability-db] servidor MCP stdio listo (Fase 4: auth + auditoria)");

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`[stability-db] ${signal} recibido, cerrando…`);
  try {
    await handle.close();
    await closePool();
  } catch (err) {
    console.error("[stability-db] error durante el shutdown:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
