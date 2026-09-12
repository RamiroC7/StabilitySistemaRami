/**
 * Tipos compartidos del server MCP remoto para coaches (design.md).
 */

/**
 * Identidad del coach que esta llamando a una tool.
 *
 * ── Placeholder temporal hasta T15 ──────────────────────────────────────────
 * Hoy (T5-T9, Fase B) no existe el flujo OAuth: eso es Fase C (T10-T15). Todavia
 * no hay forma real de resolver que coach esta llamando una tool call HTTP, asi
 * que `createServer` recibe `identity` como parametro OBLIGATORIO y quien
 * construya el server hoy (el smoke test manual / lo que arme T8-T9) le pasa un
 * identity de desarrollo hardcodeado, por ejemplo:
 *
 *   { profileId: "00000000-0000-0000-0000-000000000000", label: "dev (sin OAuth todavia, ver T15)" }
 *
 * En T15, el middleware de auth (mismo patron que `guardToolDispatch` de
 * packages/mcp-server) va a resolver el `Bearer <token>` de cada request contra
 * `gym_mcp.access_tokens`, construir la identidad REAL del coach autenticado
 * (`coach_profile_id` + su nombre) y pasarla aca — este parametro deja de ser un
 * placeholder. NO se implementa ningun mecanismo de auth en este archivo ni en
 * `create-server.ts`: esa responsabilidad es explicitamente de T15.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface CoachIdentity {
  /** = public.profiles.id del coach autenticado. */
  profileId: string;
  /** Nombre para mostrar en logs/auditoria. */
  label: string;
}
