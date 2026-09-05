/**
 * Tests de `resolveToken` (T11). Mockean `./db.js` — sin esto, importar el
 * `db.ts` real explota si no hay `DATABASE_URL` (ver db.ts), y estos tests
 * no necesitan una base de verdad: solo prueban las reglas de auth sobre
 * filas simuladas de `mcp.access_tokens` + `profiles`.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("./db.js", () => ({
  query: queryMock,
}));

const { hashToken, resolveToken } = await import("./auth.js");

interface RowOverrides {
  profile_id?: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  role?: "student" | "coach";
  first_name?: string;
  last_name?: string;
}

/** Fila "feliz" de `mcp.access_tokens` join `profiles`, con overrides puntuales. */
function tokenRow(overrides: RowOverrides = {}) {
  return {
    profile_id: "profile-coach-1",
    expires_at: null,
    revoked_at: null,
    role: "coach" as const,
    first_name: "Maximo",
    last_name: "Perez",
    ...overrides,
  };
}

describe("resolveToken", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("devuelve null si el token no existe (ninguna fila matchea el hash)", async () => {
    queryMock.mockResolvedValueOnce([]);

    await expect(resolveToken("token-inexistente")).resolves.toBeNull();
  });

  it("devuelve null si el token esta revocado", async () => {
    queryMock.mockResolvedValueOnce([tokenRow({ revoked_at: "2026-01-01T00:00:00Z" })]);

    await expect(resolveToken("token-revocado")).resolves.toBeNull();
  });

  it("devuelve null si el token esta expirado", async () => {
    queryMock.mockResolvedValueOnce([tokenRow({ expires_at: "2020-01-01T00:00:00Z" })]);

    await expect(resolveToken("token-expirado")).resolves.toBeNull();
  });

  it("devuelve null si el token es valido pero el profile no es coach", async () => {
    queryMock.mockResolvedValueOnce([tokenRow({ role: "student" })]);

    await expect(resolveToken("token-de-alumno")).resolves.toBeNull();
  });

  it("resuelve la identidad para un token valido de coach", async () => {
    queryMock.mockResolvedValueOnce([
      tokenRow({ profile_id: "profile-coach-42", first_name: "Ana", last_name: "Gomez" }),
    ]);

    await expect(resolveToken("token-valido")).resolves.toEqual({
      profileId: "profile-coach-42",
      coachName: "Ana Gomez",
    });
  });

  it("acepta un token sin expiracion (expires_at null = sin vencimiento)", async () => {
    queryMock.mockResolvedValueOnce([tokenRow({ expires_at: null })]);

    await expect(resolveToken("token-sin-vencimiento")).resolves.not.toBeNull();
  });

  it("nunca consulta con el token en claro: usa sha256(token) como parametro", async () => {
    queryMock.mockResolvedValueOnce([]);

    await resolveToken("mi-token-secreto");

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([hashToken("mi-token-secreto")]);
    expect(params).not.toContain("mi-token-secreto");
  });

  it("devuelve null sin consultar la base si el token viene vacio", async () => {
    await expect(resolveToken("")).resolves.toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });
});
