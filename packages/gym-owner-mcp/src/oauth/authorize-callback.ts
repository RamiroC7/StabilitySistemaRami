/**
 * `POST /authorize/callback` — verifica identidad y emite el `code` (T13,
 * US-2, design.md > Interfaces / contracts > `POST /authorize/callback`).
 *
 * Esta es LA verificación más importante de la Fase C (US-2): NUNCA se emite
 * un `code` si el usuario autenticado en Supabase no resuelve a un coach
 * (`role = 'coach'` en `public.profiles`). Cualquier otro caso (cliente
 * inválido, sesión de Supabase inválida, no es coach) devuelve un error SIN
 * insertar ningún grant.
 *
 * Nota: `profiles.is_archived` (revocar acceso a un coach puntual) existió
 * en este chequeo pero se eliminó junto con la columna — nunca se usó en
 * producción. Si se necesita revocar acceso a un coach en el futuro, hay que
 * reintroducir un mecanismo para eso.
 *
 * `handleAuthorizeCallback` es la función pura y testeable: recibe sus
 * dependencias inyectadas (`deps`) en vez de importar módulos enteros, así
 * los tests le pasan funciones fake (`vi.fn()`) sin mockear `../db.js` ni
 * pegarle a la red. `authorizeCallback` (al final del archivo) es el wiring
 * real que usa `http.ts`.
 */
import { createHash, randomBytes } from "node:crypto";
import { queryReadonly, queryService } from "../db.js";
import { findClient } from "./clients.js";
import { verifySupabaseSession } from "./verify-supabase-session.js";
import type { OAuthClient } from "./clients.js";
import type { SupabaseSessionUser } from "./verify-supabase-session.js";

export interface HandleAuthorizeCallbackInput {
  supabaseAccessToken: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}

export interface InsertedAccessGrant {
  code: string;
}

export interface InsertAccessGrantInput {
  clientId: string;
  coachProfileId: string;
  redirectUri: string;
  codeChallenge: string;
}

export interface HandleAuthorizeCallbackDeps {
  verifySupabaseSession: (token: string) => Promise<SupabaseSessionUser | null>;
  findClient: (clientId: string) => Promise<OAuthClient | null>;
  queryReadonly: <T>(text: string, params?: unknown[]) => Promise<T[]>;
  insertAccessGrant: (input: InsertAccessGrantInput) => Promise<InsertedAccessGrant>;
}

export type HandleAuthorizeCallbackResult = { redirectTo: string } | { error: string; status: number };

interface CoachProfileRow {
  role: string;
}

/**
 * Handler puro y testeable (sin `vi.mock` de módulos): la lógica completa
 * del flujo descripta en design.md > Key flows, con las cuatro dependencias
 * externas (Supabase Auth, `oauth_clients`, `profiles`, `access_grants`)
 * pasadas como funciones inyectadas.
 */
export async function handleAuthorizeCallback(
  input: HandleAuthorizeCallbackInput,
  deps: HandleAuthorizeCallbackDeps,
): Promise<HandleAuthorizeCallbackResult> {
  const client = await deps.findClient(input.clientId);
  if (!client || !client.redirect_uris.includes(input.redirectUri)) {
    return { error: "invalid_client", status: 400 };
  }

  const user = await deps.verifySupabaseSession(input.supabaseAccessToken);
  if (!user) {
    return { error: "access_denied", status: 401 };
  }

  // Solo hace falta role acá: coach_label se resuelve aparte, en /token
  // (T14), en el momento de emitir el access_token — evita pedir
  // first_name/last_name en un paso que ni siquiera va a usarlos si el login
  // falla más adelante en /token.
  const profiles = await deps.queryReadonly<CoachProfileRow>(
    `select role from public.profiles where id = $1`,
    [user.id],
  );
  const profile = profiles[0];

  // US-2, lo más importante de todo el flujo: sin coach, NUNCA se inserta un
  // grant ni se emite un code, sin importar el motivo puntual (no existe el
  // profile o no es coach) — se le da al exterior el mismo `access_denied`
  // en ambos casos.
  if (!profile || profile.role !== "coach") {
    return { error: "access_denied", status: 403 };
  }

  const { code } = await deps.insertAccessGrant({
    clientId: input.clientId,
    coachProfileId: user.id,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
  });

  const redirectTo = `${input.redirectUri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(input.state)}`;
  return { redirectTo };
}

/**
 * Implementación real de `insertAccessGrant`: genera el `code` (32 bytes hex),
 * lo guarda hasheado (sha256 hex, NUNCA en claro) en `gym_mcp.access_grants`
 * con TTL de 5 minutos, y devuelve el `code` EN CLARO (única vez que se ve —
 * va en la URL de redirect hacia el cliente MCP).
 */
export async function insertAccessGrant(input: InsertAccessGrantInput): Promise<InsertedAccessGrant> {
  const code = randomBytes(32).toString("hex");
  const codeHash = createHash("sha256").update(code, "utf8").digest("hex");

  await queryService(
    `insert into gym_mcp.access_grants
       (code_hash, client_id, coach_profile_id, redirect_uri, code_challenge, expires_at)
     values ($1, $2, $3, $4, $5, now() + interval '5 minutes')`,
    [codeHash, input.clientId, input.coachProfileId, input.redirectUri, input.codeChallenge],
  );

  return { code };
}

/**
 * Wiring real para `http.ts`: mismas dependencias que usa producción
 * (Supabase Auth real, `queryReadonly`/`queryService` reales). `http.ts`
 * llama a esta función, no a `handleAuthorizeCallback` directamente.
 */
export async function authorizeCallback(
  input: HandleAuthorizeCallbackInput,
): Promise<HandleAuthorizeCallbackResult> {
  return handleAuthorizeCallback(input, {
    verifySupabaseSession: (token) => verifySupabaseSession(token),
    findClient,
    queryReadonly,
    insertAccessGrant,
  });
}
