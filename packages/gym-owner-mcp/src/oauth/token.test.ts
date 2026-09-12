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

const { exchangeAuthorizationCode, refreshAccessToken } = await import("./token.js");

const CODE_VERIFIER = "test-code-verifier-0123456789";
const CODE_CHALLENGE = createHash("sha256").update(CODE_VERIFIER, "utf8").digest("base64url");

const CLIENT_ID = "client-1";
const REDIRECT_URI = "https://claude.ai/api/mcp/callback";
const COACH_PROFILE_ID = "coach-uuid-1";

function futureIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function pastIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function validGrantRow(overrides: Record<string, unknown> = {}) {
  return {
    client_id: CLIENT_ID,
    coach_profile_id: COACH_PROFILE_ID,
    redirect_uri: REDIRECT_URI,
    code_challenge: CODE_CHALLENGE,
    expires_at: futureIso(5),
    used_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  queryServiceMock.mockReset();
  queryReadonlyMock.mockReset();
});

describe("exchangeAuthorizationCode", () => {
  it("code válido con PKCE correcto -> emite tokens y marca el grant como usado", async () => {
    queryServiceMock
      .mockResolvedValueOnce([validGrantRow()]) // select grant
      .mockResolvedValueOnce([]) // update used_at
      .mockResolvedValueOnce([]) // insert access_tokens
      .mockResolvedValueOnce([]); // insert refresh_tokens
    queryReadonlyMock.mockResolvedValueOnce([{ first_name: "Ada", last_name: "Coach" }]);

    const result = await exchangeAuthorizationCode({
      code: "plain-code",
      codeVerifier: CODE_VERIFIER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
    });

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("expected success");
    expect(result.token_type).toBe("Bearer");
    expect(result.expires_in).toBe(3600);
    expect(result.access_token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.refresh_token).toMatch(/^[0-9a-f]{64}$/);

    // Segunda llamada a queryService: UPDATE ... set used_at = now() ...
    expect(queryServiceMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("set used_at = now()"),
      [createHash("sha256").update("plain-code", "utf8").digest("hex")],
    );
  });

  it("reusar el mismo code ya usado -> invalid_grant", async () => {
    queryServiceMock.mockResolvedValueOnce([validGrantRow({ used_at: new Date().toISOString() })]);

    const result = await exchangeAuthorizationCode({
      code: "plain-code",
      codeVerifier: CODE_VERIFIER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
    });

    expect(result).toEqual({ error: "invalid_grant" });
    // Solo el select: no debe llegar a marcar used_at ni emitir tokens.
    expect(queryServiceMock).toHaveBeenCalledTimes(1);
  });

  it("code_verifier que no matchea el challenge -> invalid_grant", async () => {
    queryServiceMock.mockResolvedValueOnce([validGrantRow()]);

    const result = await exchangeAuthorizationCode({
      code: "plain-code",
      codeVerifier: "verifier-incorrecto",
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
    });

    expect(result).toEqual({ error: "invalid_grant" });
    expect(queryServiceMock).toHaveBeenCalledTimes(1);
  });

  it("code expirado -> invalid_grant", async () => {
    queryServiceMock.mockResolvedValueOnce([validGrantRow({ expires_at: pastIso(1) })]);

    const result = await exchangeAuthorizationCode({
      code: "plain-code",
      codeVerifier: CODE_VERIFIER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
    });

    expect(result).toEqual({ error: "invalid_grant" });
  });

  it("code inexistente -> invalid_grant", async () => {
    queryServiceMock.mockResolvedValueOnce([]);

    const result = await exchangeAuthorizationCode({
      code: "no-existe",
      codeVerifier: CODE_VERIFIER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
    });

    expect(result).toEqual({ error: "invalid_grant" });
  });

  it("client_id no matchea el del grant -> invalid_grant", async () => {
    queryServiceMock.mockResolvedValueOnce([validGrantRow({ client_id: "otro-client" })]);

    const result = await exchangeAuthorizationCode({
      code: "plain-code",
      codeVerifier: CODE_VERIFIER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
    });

    expect(result).toEqual({ error: "invalid_grant" });
  });
});

describe("refreshAccessToken", () => {
  it("refresh válido -> nuevo access_token, mismo refresh_token", async () => {
    queryServiceMock
      .mockResolvedValueOnce([
        { client_id: CLIENT_ID, coach_profile_id: COACH_PROFILE_ID, expires_at: futureIso(60 * 24 * 30), revoked_at: null },
      ])
      .mockResolvedValueOnce([]); // insert access_tokens
    queryReadonlyMock.mockResolvedValueOnce([{ first_name: "Ada", last_name: "Coach" }]);

    const result = await refreshAccessToken({ refreshToken: "plain-refresh", clientId: CLIENT_ID });

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("expected success");
    expect(result.access_token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.refresh_token).toBe("plain-refresh");
  });

  it("refresh revocado -> invalid_grant", async () => {
    queryServiceMock.mockResolvedValueOnce([
      {
        client_id: CLIENT_ID,
        coach_profile_id: COACH_PROFILE_ID,
        expires_at: futureIso(60 * 24 * 30),
        revoked_at: new Date().toISOString(),
      },
    ]);

    const result = await refreshAccessToken({ refreshToken: "plain-refresh", clientId: CLIENT_ID });

    expect(result).toEqual({ error: "invalid_grant" });
  });

  it("refresh expirado -> invalid_grant", async () => {
    queryServiceMock.mockResolvedValueOnce([
      { client_id: CLIENT_ID, coach_profile_id: COACH_PROFILE_ID, expires_at: pastIso(1), revoked_at: null },
    ]);

    const result = await refreshAccessToken({ refreshToken: "plain-refresh", clientId: CLIENT_ID });

    expect(result).toEqual({ error: "invalid_grant" });
  });

  it("refresh inexistente -> invalid_grant", async () => {
    queryServiceMock.mockResolvedValueOnce([]);

    const result = await refreshAccessToken({ refreshToken: "no-existe", clientId: CLIENT_ID });

    expect(result).toEqual({ error: "invalid_grant" });
  });

  it("client_id no matchea -> invalid_grant", async () => {
    queryServiceMock.mockResolvedValueOnce([
      { client_id: "otro-client", coach_profile_id: COACH_PROFILE_ID, expires_at: futureIso(60), revoked_at: null },
    ]);

    const result = await refreshAccessToken({ refreshToken: "plain-refresh", clientId: CLIENT_ID });

    expect(result).toEqual({ error: "invalid_grant" });
  });
});
