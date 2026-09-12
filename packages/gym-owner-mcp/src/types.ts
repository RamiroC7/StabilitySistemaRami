/**
 * Tipos compartidos del server MCP remoto para coaches (design.md).
 */

/**
 * Identidad del coach que esta llamando a una tool.
 *
 * Resuelta por request en `http.ts` (T15, Fase C): `resolveBearerToken`
 * (`oauth/resolve-bearer.ts`) hashea el `Bearer <token>` de
 * `Authorization`, lo busca en `gym_mcp.access_tokens` (no revocado, no
 * expirado), y arma `{ profileId, label }` a partir de `coach_profile_id`/
 * `coach_label`. `createServer` sigue recibiendo `identity` como parametro
 * obligatorio — ya no hay ningun valor hardcodeado de desarrollo: si el
 * token no resuelve, `http.ts` responde 401 antes de construir el server.
 */
export interface CoachIdentity {
  /** = public.profiles.id del coach autenticado. */
  profileId: string;
  /** Nombre para mostrar en logs/auditoria. */
  label: string;
}
