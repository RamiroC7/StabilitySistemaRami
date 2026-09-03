/**
 * Factory del server MCP. Una sola definicion de tools, reutilizable en los dos
 * transports (stdio ahora; HTTP en T16). Ver design.md > "Una definicion, dos transports".
 *
 * El `pg.Pool` NO vive aca: esta a nivel de modulo en `db.ts`. En HTTP esta
 * factory corre por request, y no queremos un pool nuevo por request.
 */
import { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { registerAllTools } from "./tools/index.js";
import { resolveToken, UNAUTHORIZED_MESSAGE, type ResolvedAuth } from "./auth.js";
import { logToolCall } from "./audit.js";

/**
 * @param authOverride Identidad ya resuelta para ESTA instancia del server.
 *   - `undefined` (stdio, default): cada tool call resuelve `MCP_ACCESS_TOKEN`
 *     desde el entorno por su cuenta (comportamiento original de T10).
 *   - `ResolvedAuth` (HTTP, Fase 6 / T16): `http.ts` ya resolvio y valido el
 *     token del header `Authorization` UNA vez por request (antes de construir
 *     el server), asi que `guardToolDispatch` lo reusa en vez de volver a
 *     pegarle a la base por cada tool call. Ver `http.ts` para como se pasa
 *     (via `ctx.authInfo.extra` de `McpServerFactory`).
 */
export function createServer(authOverride?: ResolvedAuth): McpServer {
  const server = new McpServer({
    name: "stability-db",
    version: "0.1.0",
  });

  // Fase 4 / T10: se envuelve `registerTool` ANTES de registrar ningun tool,
  // asi que los 7 tools de `registerAllTools` quedan protegidos sin que
  // `tools/index.ts` ni cada archivo de `tools/*.ts` sepan que existe auth.
  registerAllTools(guardToolDispatch(server, authOverride));

  return server;
}

/** Handler de una tool tal como lo recibe `registerTool` (args, ctx, ...). */
type ToolHandler = (...handlerArgs: unknown[]) => CallToolResult | Promise<CallToolResult>;

/** Forma minima de `registerTool` que necesitamos para envolverlo. */
type RegisterToolLike = (
  name: string,
  config: Record<string, unknown>,
  handler: ToolHandler,
) => unknown;

/**
 * ── Seam de auth (Fase 4 / T10) ─────────────────────────────────────────────
 * Envuelve `server.registerTool`: cada handler que se registre DESPUES de
 * llamar a esta funcion queda automaticamente detras de un chequeo de auth
 * (US-7) y una linea de auditoria (D-3).
 *
 * El token sale de `process.env.MCP_ACCESS_TOKEN` — hoy el unico transport es
 * stdio, un token por proceso (design.md D-1). Cuando exista el transport
 * HTTP (T16), este es el punto que cambia para leer el token del header
 * `Authorization` (via `ctx.http?.authInfo`) en vez del env.
 *
 * El cast `as unknown as X` es necesario porque `registerTool` esta
 * sobrecargado (dos firmas, para Zod y para schemas "raw") y TypeScript no
 * permite reasignar un metodo de instancia contra su tipo sobrecargado
 * exacto. La forma real que usan los tools (`tools/list-plans.ts` y los que
 * sigan) no cambia: ellos siguen viendo el `registerTool` original de
 * `McpServer` al tipar su propia llamada.
 * ────────────────────────────────────────────────────────────────────────────
 */
function guardToolDispatch(server: McpServer, authOverride?: ResolvedAuth): McpServer {
  const originalRegisterTool = server.registerTool.bind(server) as unknown as RegisterToolLike;

  const guardedRegisterTool: RegisterToolLike = (name, config, handler) => {
    const guardedHandler: ToolHandler = async (...handlerArgs) => {
      const auth =
        authOverride ??
        (await resolveToken(process.env.MCP_ACCESS_TOKEN ?? "").catch((err: unknown) => {
          console.error(
            "[auth] error validando token en tool call:",
            err instanceof Error ? err.message : String(err),
          );
          return null;
        }));

      if (!auth) {
        return {
          isError: true,
          content: [{ type: "text", text: UNAUTHORIZED_MESSAGE }],
        } satisfies CallToolResult;
      }

      const startedAt = Date.now();
      const result = await handler(...handlerArgs);

      logToolCall({
        profileId: auth.profileId,
        coachName: auth.coachName,
        tool: name,
        args: handlerArgs[0],
        durationMs: Date.now() - startedAt,
        rowCount: countRows(result),
      });

      return result;
    };

    return originalRegisterTool(name, config, guardedHandler);
  };

  server.registerTool = guardedRegisterTool as unknown as typeof server.registerTool;

  return server;
}

/**
 * Best-effort: busca el primer array dentro de `structuredContent` y devuelve
 * su longitud, para el `row_count` de la auditoria (design.md). No todos los
 * tools tienen una unica lista "principal" (p. ej. `get_student_adherence`
 * trae `assignments` Y `completions`) — cuando no se puede inferir con
 * certeza, se audita sin `row_count` en vez de adivinar.
 */
function countRows(result: CallToolResult): number | undefined {
  const structured = (result as { structuredContent?: Record<string, unknown> })
    .structuredContent;
  if (!structured) return undefined;

  const firstArray = Object.values(structured).find((value) => Array.isArray(value));
  return Array.isArray(firstArray) ? firstArray.length : undefined;
}
