import { describe, expect, it, vi } from "vitest";
import type { HandleAuthorizeCallbackDeps } from "./authorize-callback.js";

// `authorize-callback.ts` también exporta `insertAccessGrant`/`authorizeCallback`
// (el wiring real), que importan `../db.js` a nivel de módulo — `db.ts` tira al
// importar si faltan las env vars de connection string (ver `requireEnv`). Este
// test solo ejercita `handleAuthorizeCallback`, la función pura con deps
// inyectadas (nunca toca `db.js`), pero el mock igual hace falta para que el
// import estático del archivo no reviente en el entorno de test.
vi.mock("../db.js", () => ({
  queryReadonly: vi.fn(),
  queryService: vi.fn(),
}));

const { handleAuthorizeCallback } = await import("./authorize-callback.js");

const CLIENT = {
  client_id: "client-1",
  redirect_uris: ["https://claude.ai/api/mcp/callback"],
  client_name: "Claude",
};

function makeDeps(overrides: Partial<HandleAuthorizeCallbackDeps> = {}): HandleAuthorizeCallbackDeps {
  return {
    verifySupabaseSession: vi.fn().mockResolvedValue({ id: "coach-uuid-1" }),
    findClient: vi.fn().mockResolvedValue(CLIENT),
    queryReadonly: vi.fn().mockResolvedValue([{ role: "coach", is_archived: false }]),
    insertAccessGrant: vi.fn().mockResolvedValue({ code: "plaintext-code-abc" }),
    ...overrides,
  };
}

const BASE_INPUT = {
  supabaseAccessToken: "fake-supabase-token",
  clientId: "client-1",
  redirectUri: "https://claude.ai/api/mcp/callback",
  codeChallenge: "challenge-xyz",
  state: "state-123",
};

describe("handleAuthorizeCallback", () => {
  it("client_id/redirect_uri inválido -> invalid_client, ANTES de llamar a verifySupabaseSession", async () => {
    const deps = makeDeps({ findClient: vi.fn().mockResolvedValue(null) });

    const result = await handleAuthorizeCallback(BASE_INPUT, deps);

    expect(result).toEqual({ error: "invalid_client", status: 400 });
    expect(deps.verifySupabaseSession).not.toHaveBeenCalled();
    expect(deps.insertAccessGrant).not.toHaveBeenCalled();
  });

  it("redirect_uri no registrada para ese client_id -> invalid_client, sin llamar a verifySupabaseSession", async () => {
    const deps = makeDeps();

    const result = await handleAuthorizeCallback(
      { ...BASE_INPUT, redirectUri: "https://otra-cosa.example.com/callback" },
      deps,
    );

    expect(result).toEqual({ error: "invalid_client", status: 400 });
    expect(deps.verifySupabaseSession).not.toHaveBeenCalled();
    expect(deps.insertAccessGrant).not.toHaveBeenCalled();
  });

  it("verifySupabaseSession devuelve null -> access_denied, sin insertar grant", async () => {
    const deps = makeDeps({ verifySupabaseSession: vi.fn().mockResolvedValue(null) });

    const result = await handleAuthorizeCallback(BASE_INPUT, deps);

    expect(result).toEqual({ error: "access_denied", status: 401 });
    expect(deps.insertAccessGrant).not.toHaveBeenCalled();
  });

  it("perfil role='student' -> access_denied, sin insertar grant (US-2)", async () => {
    const deps = makeDeps({
      queryReadonly: vi.fn().mockResolvedValue([{ role: "student", is_archived: false }]),
    });

    const result = await handleAuthorizeCallback(BASE_INPUT, deps);

    expect(result).toEqual({ error: "access_denied", status: 403 });
    expect(deps.insertAccessGrant).not.toHaveBeenCalled();
  });

  it("perfil coach archivado (is_archived=true) -> access_denied, sin insertar grant (US-2)", async () => {
    const deps = makeDeps({
      queryReadonly: vi.fn().mockResolvedValue([{ role: "coach", is_archived: true }]),
    });

    const result = await handleAuthorizeCallback(BASE_INPUT, deps);

    expect(result).toEqual({ error: "access_denied", status: 403 });
    expect(deps.insertAccessGrant).not.toHaveBeenCalled();
  });

  it("perfil inexistente (sin fila en profiles) -> access_denied, sin insertar grant", async () => {
    const deps = makeDeps({ queryReadonly: vi.fn().mockResolvedValue([]) });

    const result = await handleAuthorizeCallback(BASE_INPUT, deps);

    expect(result).toEqual({ error: "access_denied", status: 403 });
    expect(deps.insertAccessGrant).not.toHaveBeenCalled();
  });

  it("perfil coach activo -> inserta el grant y devuelve redirectTo con code y state", async () => {
    const deps = makeDeps();

    const result = await handleAuthorizeCallback(BASE_INPUT, deps);

    expect(deps.insertAccessGrant).toHaveBeenCalledWith({
      clientId: "client-1",
      coachProfileId: "coach-uuid-1",
      redirectUri: "https://claude.ai/api/mcp/callback",
      codeChallenge: "challenge-xyz",
    });
    expect(result).toEqual({
      redirectTo: "https://claude.ai/api/mcp/callback?code=plaintext-code-abc&state=state-123",
    });
  });
});
