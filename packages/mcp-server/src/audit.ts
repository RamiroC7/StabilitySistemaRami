/**
 * Auditoria de tool calls (D-3, US-7).
 *
 * Cada tool call exitosa emite una linea JSON a stderr. En stdio, Claude
 * Desktop la escribe a `%APPDATA%\Claude\logs\mcp-server-stability-db.log`
 * junto con el resto de los logs del proceso. No hay tabla de auditoria en
 * la base: escribir ahi exigiria una segunda conexion con permiso de
 * INSERT, lo que perfora "el server no puede escribir" (US-8). Ver
 * design.md > Trade-offs > "Auditoria (D-3)".
 */

export interface ToolCallAudit {
  profileId: string;
  coachName: string;
  tool: string;
  args: unknown;
  durationMs: number;
  /** Best-effort: cantidad de filas de la respuesta, cuando se puede inferir. */
  rowCount: number | undefined;
}

/** Emite una linea JSON a stderr con los datos de un tool call (design.md). */
export function logToolCall(entry: ToolCallAudit): void {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      profile_id: entry.profileId,
      coach_name: entry.coachName,
      tool: entry.tool,
      args: entry.args,
      duration_ms: entry.durationMs,
      row_count: entry.rowCount ?? null,
    }),
  );
}
