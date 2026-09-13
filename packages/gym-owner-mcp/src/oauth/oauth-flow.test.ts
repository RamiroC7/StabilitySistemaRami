/**
 * Verificación M2 (T16) — flujo OAuth completo, TODO mockeado a nivel de
 * `db.js` y con `verifySupabaseSession` inyectado (nunca red real): DCR →
 * login simulado (perfil `role='coach'` fijo) → code → token → resolución de
 * identidad. Más el caso negativo: revocación.
 *
 * ── Límite explícito de esta verificación ───────────────────────────────────
 * NO hay ningún login real de Supabase Auth acá: `verifySupabaseSession` es
 * una función fake (`vi.fn()`) inyectada directamente en
 * `handleAuthorizeCallback`, nunca la implementación real de
 * `verify-supabase-session.ts`. No se crea ninguna cuenta real, no se usa
 * ninguna password real. La validación con un coach humano real y un
 * cliente MCP real (Claude) es explícitamente T19 (Fase D) — no se adelanta
 * nada de eso acá.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryServiceMock, queryReadonlyMock } = vi.hoisted(() => ({
  queryServiceMock: vi.fn(),
  queryReadonlyMock: vi.fn(),
}));

vi.mock("../db.js", () => ({
  queryService: queryServiceMock,
  queryReadonly: queryReadonlyMock,
}));

const { registerClient, findClient } = await import("./clients.js");
const { handleAuthorizeCallback, insertAccessGrant } = await import("./authorize-callback.js");
const { exchangeAuthorizationCode } = await import("./token.js");
const { resolveBearerToken } = await import("./resolve-bearer.js");

const REDIRECT_URI = "http://localhost:5173/callback";
const COACH_PROFILE_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  queryServiceMock.mockReset();
  queryReadonlyMock.mockReset();
});

describe("flujo OAuth completo (T16, mocks — sin login real, ver el límite arriba)", () => {
  it("DCR -> login simulado -> code -> token -> resolución de identidad", async () => {
    // ── 1. DCR: POST /register ────────────────────────────────────────────
    queryServiceMock.mockResolvedValueOnce([]); // insert oauth_clients
    const client = await registerClient({
      redirect_uris: [REDIRECT_URI],
      client_name: "Cliente de prueba T16",
    });
    expect(client.token_endpoint_auth_method).toBe("none");

    // ── 2. Login simulado -> POST /authorize/callback ─────────────────────
    const codeVerifier = "t16-code-verifier-0123456789";
    const codeChallenge = createHash("sha256").update(codeVerifier, "utf8").digest("base64url");

    // findClient real (mockeado a nivel de db.js): select del cliente recién registrado.
    queryServiceMock.mockResolvedValueOnce([
      { client_id: client.client_id, redirect_uris: client.redirect_uris, client_name: client.client_name },
    ]);
    // El perfil "logueado" resuelve a un coach (US-2).
    queryReadonlyMock.mockResolvedValueOnce([{ role: "coach" }]);
    // insertAccessGrant (real, no mockeado): insert en access_grants.
    queryServiceMock.mockResolvedValueOnce([]);

    const fakeVerifySupabaseSession = vi.fn().mockResolvedValue({ id: COACH_PROFILE_ID });

    const callbackResult = await handleAuthorizeCallback(
      {
        supabaseAccessToken: "fake-supabase-session-token",
        clientId: client.client_id,
        redirectUri: REDIRECT_URI,
        codeChallenge,
        state: "state-t16",
      },
      {
        verifySupabaseSession: fakeVerifySupabaseSession,
        findClient,
        queryReadonly: queryReadonlyMock,
        insertAccessGrant,
      },
    );

    expect(fakeVerifySupabaseSession).toHaveBeenCalledWith("fake-supabase-session-token");
    if ("error" in callbackResult) {
      throw new Error(`esperaba éxito, recibí error: ${callbackResult.error}`);
    }

    const redirectUrl = new URL(callbackResult.redirectTo);
    expect(redirectUrl.searchParams.get("state")).toBe("state-t16");
    const code = redirectUrl.searchParams.get("code");
    expect(code).toBeTruthy();

    // ── 3. POST /token (authorization_code) ───────────────────────────────
    const codeHash = createHash("sha256").update(code!, "utf8").digest("hex");
    queryServiceMock.mockResolvedValueOnce([
      {
        client_id: client.client_id,
        coach_profile_id: COACH_PROFILE_ID,
        redirect_uri: REDIRECT_URI,
        code_challenge: codeChallenge,
        expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        used_at: null,
      },
    ]); // select access_grants por code_hash
    queryServiceMock.mockResolvedValueOnce([]); // update used_at
    queryReadonlyMock.mockResolvedValueOnce([{ first_name: "Ada", last_name: "Coach" }]); // coach_label
    queryServiceMock.mockResolvedValueOnce([]); // insert access_tokens
    queryServiceMock.mockResolvedValueOnce([]); // insert refresh_tokens

    const tokenResult = await exchangeAuthorizationCode({
      code: code!,
      codeVerifier,
      clientId: client.client_id,
      redirectUri: REDIRECT_URI,
    });

    if ("error" in tokenResult) {
      throw new Error(`esperaba éxito, recibí error: ${tokenResult.error}`);
    }
    expect(tokenResult.token_type).toBe("Bearer");

    // Confirma que el UPDATE de used_at usó el hash del code correcto.
    expect(queryServiceMock).toHaveBeenCalledWith(expect.stringContaining("set used_at = now()"), [codeHash]);

    // ── 4. resolveBearerToken con el access_token recién emitido ──────────
    queryServiceMock.mockResolvedValueOnce([
      { coach_profile_id: COACH_PROFILE_ID, coach_label: "Ada Coach" },
    ]);

    const identity = await resolveBearerToken(tokenResult.access_token);

    expect(identity).toEqual({ profileId: COACH_PROFILE_ID, label: "Ada Coach" });
  });

  it("caso negativo: revocar el token a mano en el mock -> resolveBearerToken devuelve null", async () => {
    // `resolveBearerToken` filtra `revoked_at IS NULL` en el propio SQL, así
    // que "revocar a mano" en un mock de `queryService` significa simular
    // que esa fila ya no vuelve del SELECT (como pasaría de verdad después
    // de un `UPDATE gym_mcp.access_tokens SET revoked_at = now() ...`).
    queryServiceMock.mockResolvedValueOnce([]);

    const identity = await resolveBearerToken("un-access-token-que-fue-revocado");

    expect(identity).toBeNull();
  });
});
