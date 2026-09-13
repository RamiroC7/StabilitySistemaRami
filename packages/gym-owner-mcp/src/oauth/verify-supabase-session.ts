/**
 * Verificación de identidad delegada a Supabase Auth (T13, US-2,
 * design.md > Key flows): `GET {SUPABASE_URL}/auth/v1/user` con el
 * `supabase_access_token` de la sesión del coach que acaba de loguearse en
 * `/authorize`.
 *
 * Factorizada en un archivo propio, con el `fetch` inyectable, para poder
 * testear `handleAuthorizeCallback` (y este mismo módulo) sin pegarle a la
 * red real — `vi.fn()` en vez de un mock de módulo completo. NUNCA se llama
 * a esto contra una cuenta real de Supabase Auth desde un test: los tests de
 * esta Fase C mockean `fetchImpl` (o directamente esta función completa vía
 * inyección de dependencias en `handleAuthorizeCallback`).
 */

export interface SupabaseSessionUser {
  id: string;
}

/**
 * Devuelve `{ id }` si `token` es una sesión válida de Supabase Auth, o
 * `null` ante CUALQUIER motivo de rechazo (token inválido/expirado, red
 * caída, respuesta sin `id`, faltan `SUPABASE_URL`/`SUPABASE_ANON_KEY` en el
 * entorno) — el llamador (`handleAuthorizeCallback`) trata todo `null` como
 * `access_denied`, sin distinguir el motivo (fail-closed).
 */
export async function verifySupabaseSession(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SupabaseSessionUser | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[oauth] Falta SUPABASE_URL o SUPABASE_ANON_KEY en el entorno: no se puede verificar la sesión.",
    );
    return null;
  }
  if (!token) return null;

  try {
    const response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { id?: unknown };
    if (typeof body.id !== "string" || body.id.length === 0) return null;

    return { id: body.id };
  } catch (err) {
    console.error(
      "[oauth] error verificando sesión de Supabase Auth:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
