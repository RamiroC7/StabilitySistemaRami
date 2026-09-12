/**
 * Bootstrap del server HTTP LOCAL (T8, Fase B; T15, Fase C) — corre
 * `node:http` standalone con `tsx` (`npm run dev:http`, dev/tests, T8-T9).
 * Toda la lógica de ruteo (conversión Node↔web-standard, OAuth + `/mcp`)
 * vive en `./request-handler.js` (`handleRequest`), reusada sin duplicación
 * por el entrypoint de Vercel (`../api/handler.ts`, T17) — este archivo sólo
 * hace de bootstrap: `http.createServer`, `.listen(PORT)` y shutdown por
 * `SIGINT`/`SIGTERM` (cierre del `mcpHandler` y de los pools de `pg`).
 */
import http from "node:http";
import { handleRequest, mcpHandler, PORT } from "./request-handler.js";
import { closePools } from "./db.js";

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err: unknown) => {
    console.error("[http] error no manejado:", err instanceof Error ? err.message : String(err));
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Error interno." }));
    } else {
      res.end();
    }
  });
});

server.listen(PORT, () => {
  console.error(
    `[gym-owner-mcp] servidor MCP HTTP escuchando en http://localhost:${PORT}/mcp (auth OAuth activa — Fase C)`,
  );
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`[gym-owner-mcp] ${signal} recibido, cerrando…`);
  try {
    await mcpHandler.close();
    await closePools();
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  } catch (err) {
    console.error("[gym-owner-mcp] error durante el shutdown:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
