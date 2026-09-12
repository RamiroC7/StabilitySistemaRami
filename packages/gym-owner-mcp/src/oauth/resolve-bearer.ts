/**
 * Middleware de auth para tool calls (T15, US-2/US-3, design.md > Key flows).
 *
 * Reemplaza `DEV_IDENTITY` de `http.ts`: cada request a `/mcp` trae
 * `Authorization: Bearer <token>`, y esta función lo resuelve contra
 * `gym_mcp.access_tokens` (hasheado, no revocado, no expirado) ANTES de
 * construir el server o ejecutar cualquier tool call — mismo criterio
 * fail-closed que el resto de la Fase C.
 */
import { createHash } from "node:crypto";
import { queryService } from "../db.js";
import type { CoachIdentity } from "../types.js";

interface AccessTokenRow {
  coach_profile_id: string;
  coach_label: string;
}

/**
 * Devuelve la identidad del coach si `token` es un access_token válido
 * (existe, no revocado, no expirado), o `null` ante cualquier otro caso —
 * el filtro de revocación/expiración vive en el propio SQL (`revoked_at is
 * null and expires_at > now()`), así que "no hay fila" cubre los tres
 * motivos de rechazo (inexistente, revocado, expirado) sin distinguirlos.
 */
export async function resolveBearerToken(token: string): Promise<CoachIdentity | null> {
  if (!token) return null;

  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");

  const rows = await queryService<AccessTokenRow>(
    `select coach_profile_id, coach_label
     from gym_mcp.access_tokens
     where token_hash = $1 and revoked_at is null and expires_at > now()`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;

  return { profileId: row.coach_profile_id, label: row.coach_label };
}
