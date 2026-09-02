/**
 * ⚠️  stdout es el canal JSON-RPC del protocolo MCP — SOLO se puede escribir con
 *     `console.error` (va a stderr). Un `console.log` acá rompe el protocolo y
 *     Claude Desktop marca el server como "failed". La regla de lint de este
 *     paquete prohíbe `console.log` justamente por esto.
 *
 * Entrypoint del transport stdio. Lo levanta Claude Desktop (T15) pasando
 * `DATABASE_URL` y `MCP_ACCESS_TOKEN` por env.
 *
 * En local, `npm run dev:stdio` / `npm run inspect` cargan `.env` del cwd
 * (`./load-env.js`, que usa `process.loadEnvFile`). No hay dependencia de dotenv.
 * Este import va PRIMERO: puebla `process.env` antes de que `db.ts` lo lea.
 */
import "./load-env.js";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./create-server.js";
import { closePool } from "./db.js";

// TODO(Fase 4 / T10): await assertAuthFromEnv() acá — si MCP_ACCESS_TOKEN falta o
// es inválido, loguear a stderr y process.exit(1) ANTES de abrir el transport.

const handle = serveStdio(createServer);

console.error("[stability-db] servidor MCP stdio listo (Fase 3: esqueleto + list_plans)");

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
