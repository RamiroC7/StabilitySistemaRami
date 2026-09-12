/**
 * Auditoria de tool calls — log-antes-de-ejecutar, fail-closed (US-5,
 * design.md > Data model > `gym_mcp.query_audit_log`).
 *
 * A diferencia de `packages/mcp-server/src/audit.ts` (loguea a stderr porque
 * ese rol no tiene permiso de escritura), acá SÍ hay un rol con permiso de
 * escritura (`gym_mcp_service`, vía `queryService` de `db.ts`) y una tabla
 * real: `gym_mcp.query_audit_log`.
 *
 * `insertAuditRow` corre ANTES del SQL de datos y es fail-closed: si el
 * insert falla, quien la llama debe dejar que el error se propague y NO
 * correr el SQL de datos (eso es lo que hace que la auditoría sea confiable —
 * US-5). `updateAuditRow` corre DESPUÉS y es best-effort: nunca debe tirar ni
 * afectar la respuesta que ya se le va a dar a Claude.
 */
import { queryService } from "./db.js";

export interface InsertAuditRowInput {
  coachProfileId: string;
  question: string;
  sql: string;
}

export interface UpdateAuditRowInput {
  rowCount: number | null;
  durationMs: number;
  error: string | null;
}

interface AuditRowId {
  id: string;
}

/**
 * Inserta la fila de auditoría ANTES de correr el SQL de datos y devuelve su
 * `id`. Si `queryService` tira, el error se propaga tal cual (fail-closed):
 * NO se atrapa acá.
 */
export async function insertAuditRow(input: InsertAuditRowInput): Promise<string> {
  const rows = await queryService<AuditRowId>(
    `insert into gym_mcp.query_audit_log (coach_profile_id, question, sql)
     values ($1, $2, $3)
     returning id`,
    [input.coachProfileId, input.question, input.sql],
  );
  return rows[0].id;
}

/**
 * Completa la fila de auditoría después de correr (o intentar correr) el SQL
 * de datos. Best-effort: si `queryService` falla acá, se atrapa el error y
 * solo se loguea (sanitizado, vía el propio mensaje ya sanitizado de
 * `queryService`) — nunca tira ni afecta la respuesta ya obtenida.
 */
export async function updateAuditRow(id: string, input: UpdateAuditRowInput): Promise<void> {
  try {
    await queryService(
      `update gym_mcp.query_audit_log
       set row_count = $2, duration_ms = $3, error = $4
       where id = $1`,
      [id, input.rowCount, input.durationMs, input.error],
    );
  } catch (err) {
    console.error(
      "[audit] no se pudo actualizar gym_mcp.query_audit_log (best-effort, no afecta la respuesta):",
      err instanceof Error ? err.message : String(err),
    );
  }
}
