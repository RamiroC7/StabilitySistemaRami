/**
 * Tool `query_gym_data` — US-1, US-5 (design.md > Interfaces / contracts).
 *
 * Único tool de datos del server: el modelo arma el SQL (contra el pool
 * `gym_owner_readonly`, solo SELECT) a partir de la pregunta en lenguaje
 * natural del coach. Antes de correr ese SQL se audita (US-5, fail-closed):
 * si la auditoría no se puede escribir, la tool entera falla y el SQL de
 * datos NUNCA se ejecuta.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { queryReadonly } from "../db.js";
import { insertAuditRow, updateAuditRow } from "../audit.js";
import type { CoachIdentity } from "../types.js";

// Tope duro de filas devueltas por llamada. Es un default razonable (no
// configurable por ahora): evita que un pedido de "todo sin resumir" del
// coach devuelva cientos/miles de filas y agote la cuota de tokens de salida
// de una cuenta Free (visto en una prueba de estrés real). El corte se hace
// en JS sobre el array ya devuelto por `queryReadonly`, nunca reescribiendo
// el SQL del coach.
const MAX_ROWS = 200;

const inputSchema = z.object({
  question: z
    .string()
    .min(1)
    .describe(
      "La pregunta del coach, parafraseada en español por vos (SIEMPRE completá este campo, " +
        "aunque el coach haya escrito en otras palabras) — queda en la auditoría junto al SQL.",
    ),
  sql: z
    .string()
    .min(1)
    .describe(
      "Sentencia SQL a ejecutar contra Postgres (schema `public`, 18 tablas: alumnos, planes " +
        "de entrenamiento, asignaciones, adherencia, RPE, progresión de cargas, etc.). Preferí " +
        "siempre `select` — el rol de base ya bloquea cualquier escritura (INSERT/UPDATE/DELETE/" +
        "DDL fallan a nivel de Postgres), así que un intento de escritura no tiene sentido " +
        "reintentar con otra sintaxis.",
    ),
});

interface QueryGymDataResult {
  rows: unknown[];
  row_count: number;
  truncated: boolean;
}

/**
 * Handler puro y testeable: no depende de `server.registerTool`, así se puede
 * instanciar en tests sin pasar por el registro real (mismo patrón que
 * `listStudentsHandler` en `packages/mcp-server`).
 */
export function createQueryGymDataHandler(
  identity: CoachIdentity,
): (args: { question: string; sql: string }) => Promise<CallToolResult> {
  return async ({ question, sql }) => {
    // US-5, fail-closed: si esto tira, se propaga sin capturar. El framework
    // de tools de @modelcontextprotocol/server convierte cualquier error no
    // atrapado en `{ isError: true, ... }` (ver `_createRegisteredTool` /
    // dispatch de `tools/call`) — no hace falta armar un try/catch acá, y el
    // SQL de datos de abajo nunca llega a ejecutarse.
    const auditId = await insertAuditRow({
      coachProfileId: identity.profileId,
      question,
      sql,
    });

    const startedAt = Date.now();
    let rows: unknown[];
    try {
      rows = await queryReadonly(sql);
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : String(err);
      // Best-effort: si esto falla, no debe afectar la respuesta que ya se le
      // va a dar a Claude (el error del SQL de datos).
      await updateAuditRow(auditId, { rowCount: null, durationMs, error: message });
      return {
        isError: true,
        content: [{ type: "text", text: `Error ejecutando el SQL: ${message}` }],
      } satisfies CallToolResult;
    }

    const durationMs = Date.now() - startedAt;
    const totalCount = rows.length;
    const truncated = totalCount > MAX_ROWS;
    if (truncated) {
      rows = rows.slice(0, MAX_ROWS);
    }

    // Auditoría: se graba el total real encontrado (antes del corte), no el
    // efectivamente devuelto — para trazabilidad, importa saber qué tan
    // pesada fue la query real contra la base, más allá de cuánto se le haya
    // mandado a Claude después.
    // Best-effort: no bloquea la respuesta exitosa si falla el update.
    await updateAuditRow(auditId, { rowCount: totalCount, durationMs, error: null });

    const structuredContent: QueryGymDataResult = {
      rows,
      row_count: rows.length,
      truncated,
    };

    const summary = truncated
      ? `Devolví ${rows.length} fila(s) (de ${totalCount} encontradas — el resultado se truncó; ` +
        "pedí un rango más chico, un LIMIT, o un resumen/agregación si necesitás más detalle)."
      : `Devolví ${rows.length} fila(s).`;

    return {
      content: [{ type: "text", text: summary }],
      structuredContent,
    };
  };
}

export function registerQueryGymData(server: McpServer, identity: CoachIdentity): void {
  server.registerTool(
    "query_gym_data",
    {
      title: "Consultar datos del gimnasio",
      description:
        "Ejecuta una consulta SQL de solo lectura contra la base de Stability para responder " +
        "la pregunta del coach en lenguaje natural (alumnos, planes de entrenamiento, " +
        "adherencia, RPE, progresión de cargas, etc.). Completá SIEMPRE `question` con la " +
        "pregunta del coach parafraseada — queda auditada junto al SQL antes de ejecutarse. " +
        "Preferí `select`: el rol de base bloquea cualquier escritura a nivel de Postgres.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    createQueryGymDataHandler(identity),
  );
}
