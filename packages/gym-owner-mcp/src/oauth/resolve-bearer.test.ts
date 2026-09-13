import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryServiceMock } = vi.hoisted(() => ({ queryServiceMock: vi.fn() }));

vi.mock("../db.js", () => ({
  queryService: queryServiceMock,
}));

const { resolveBearerToken } = await import("./resolve-bearer.js");

beforeEach(() => {
  queryServiceMock.mockReset();
});

describe("resolveBearerToken", () => {
  it("token válido -> identity correcta", async () => {
    queryServiceMock.mockResolvedValueOnce([
      { coach_profile_id: "coach-uuid-1", coach_label: "Ada Coach" },
    ]);

    const identity = await resolveBearerToken("plain-access-token");

    expect(identity).toEqual({ profileId: "coach-uuid-1", label: "Ada Coach" });
    expect(queryServiceMock).toHaveBeenCalledWith(
      expect.stringContaining("revoked_at is null and expires_at > now()"),
      [createHash("sha256").update("plain-access-token", "utf8").digest("hex")],
    );
  });

  it("token inexistente -> null", async () => {
    queryServiceMock.mockResolvedValueOnce([]);

    const identity = await resolveBearerToken("no-existe");

    expect(identity).toBeNull();
  });

  it("token revocado -> null (el WHERE revoked_at is null lo excluye a nivel SQL: la fila no vuelve)", async () => {
    queryServiceMock.mockResolvedValueOnce([]);

    const identity = await resolveBearerToken("token-revocado");

    expect(identity).toBeNull();
  });

  it("token expirado -> null (el WHERE expires_at > now() lo excluye a nivel SQL: la fila no vuelve)", async () => {
    queryServiceMock.mockResolvedValueOnce([]);

    const identity = await resolveBearerToken("token-expirado");

    expect(identity).toBeNull();
  });

  it("token vacío -> null sin llegar a consultar la base", async () => {
    const identity = await resolveBearerToken("");

    expect(identity).toBeNull();
    expect(queryServiceMock).not.toHaveBeenCalled();
  });
});
