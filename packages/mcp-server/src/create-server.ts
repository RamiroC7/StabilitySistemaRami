/**
 * Factory del server MCP. Una sola definición de tools, reutilizable en los dos
 * transports (stdio ahora; HTTP en T16). Ver design.md §"Una definición, dos transports".
 *
 * El `pg.Pool` NO vive acá: está a nivel de módulo en `db.ts`. En HTTP esta
 * factory corre por request, y no queremos un pool nuevo por request.
 */
import { McpServer } from "@modelcontextprotocol/server";
import { registerAllTools } from "./tools/index.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "stability-db",
    version: "0.1.0",
  });

  // TODO(Fase 4 / T10): validar el token de acceso antes de ejecutar cualquier
  // tool y auditar la llamada después. El punto de intercepción (acá vs. dentro
  // de registerAllTools) se decide en T10 — ver el comentario en tools/index.ts.
  registerAllTools(server);

  return server;
}
