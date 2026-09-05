/**
 * Autenticacion del MCP server (US-7, design.md > Interfaces > "Autenticacion").
 *
 * Cada request trae un token de acceso en texto plano (stdio: variable de
 * entorno `MCP_ACCESS_TOKEN`, un token por proceso; HTTP futuro: header
 * `Authorization`, un token por request). `resolveToken` lo hashea, busca la
 * fila en `mcp.access_tokens`, y la valida contra `profiles`.
 *
 * Cualquier motivo de rechazo (token inexistente, revocado, expirado, o de
 * un profile que no es `role = 'coach'`) devuelve exactamente lo mismo hacia
 * afuera: `null` de esta funcion, y el mensaje unico `UNAUTHORIZED_MESSAGE`
 * en la respuesta MCP (US-7: "sin revelar detalle del motivo").
 */
import { createHash } from "node:crypto";
import { query } from "./db.js";

/** Identidad resuelta de un token de acceso valido. */
export interface ResolvedAuth {
  profileId: string;
  coachName: string;
}

interface AccessTokenRow {
  profile_id: string;
  expires_at: string | null;
  revoked_at: string | null;
  role: "student" | "coach";
  first_name: string;
  last_name: string;
}

/** Unico mensaje de error para cualquier fallo de auth (US-7). */
export const UNAUTHORIZED_MESSAGE = "No autorizado";

// Query fija y parametrizada: el hash del token entra como unico parametro
// ($1). El modelo nunca compone SQL ni ve el token en claro mas alla de este
// modulo.
const RESOLVE_TOKEN_SQL = `
  select
    t.profile_id as profile_id,
    t.expires_at as expires_at,
    t.revoked_at as revoked_at,
    p.role       as role,
    p.first_name as first_name,
    p.last_name  as last_name
  from mcp.access_tokens t
  join public.profiles p on p.id = t.profile_id
  where t.token_hash = $1
`;

/** sha256(token) en hex. Los tokens se guardan (y se buscan) solo hasheados. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Resuelve un token de acceso a la identidad del coach que lo emitio.
 *
 * Devuelve `null` ante CUALQUIER motivo de rechazo (US-7):
 *   - el hash no matchea ninguna fila de `mcp.access_tokens`,
 *   - `revoked_at` esta seteado,
 *   - `expires_at` esta seteado y ya paso,
 *   - el `profile` asociado no tiene `role = 'coach'` (incluye alumnos).
 */
export async function resolveToken(token: string): Promise<ResolvedAuth | null> {
  if (!token) return null;

  const rows = await query<AccessTokenRow>(RESOLVE_TOKEN_SQL, [hashToken(token)]);
  const row = rows[0];
  if (!row) return null;
  if (row.revoked_at !== null) return null;
  if (row.expires_at !== null && new Date(row.expires_at).getTime() <= Date.now()) {
    return null;
  }
  if (row.role !== "coach") return null;

  return {
    profileId: row.profile_id,
    coachName: `${row.first_name} ${row.last_name}`.trim(),
  };
}

/**
 * Valida `MCP_ACCESS_TOKEN` al arrancar el proceso stdio (design.md >
 * "Arranque en modo stdio"). Si la variable falta, o no resuelve a un coach
 * (invalida, revocada, expirada, o de un alumno), loguea el motivo a stderr
 * y sale con `exit(1)` ANTES de abrir el transport — asi Claude Desktop
 * marca el server como "failed" en vez de dejarlo andar sin auth.
 */
export async function assertAuthFromEnv(): Promise<ResolvedAuth> {
  const token = process.env.MCP_ACCESS_TOKEN;
  if (!token) {
    console.error("[auth] Falta MCP_ACCESS_TOKEN en el entorno. No se puede arrancar.");
    process.exit(1);
  }

  const auth = await resolveToken(token).catch((err: unknown) => {
    console.error(
      "[auth] Error validando MCP_ACCESS_TOKEN:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  });

  if (!auth) {
    console.error(
      "[auth] MCP_ACCESS_TOKEN invalido, revocado, expirado, o no pertenece a un coach.",
    );
    process.exit(1);
  }

  return auth;
}
