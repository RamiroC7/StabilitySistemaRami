import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryServiceMock } = vi.hoisted(() => ({ queryServiceMock: vi.fn() }));

vi.mock("../db.js", () => ({
  queryService: queryServiceMock,
}));

const { registerClient, findClient, InvalidRedirectUriError } = await import("./clients.js");

describe("registerClient", () => {
  beforeEach(() => {
    queryServiceMock.mockReset();
  });

  it("rechaza redirect_uri que no es https:// ni http://localhost, sin insertar nada", async () => {
    await expect(
      registerClient({ redirect_uris: ["http://evil.example.com/callback"] }),
    ).rejects.toThrow(InvalidRedirectUriError);

    expect(queryServiceMock).not.toHaveBeenCalled();
  });

  it("rechaza si CUALQUIERA de varias redirect_uris es inválida", async () => {
    await expect(
      registerClient({
        redirect_uris: ["https://claude.ai/callback", "http://not-localhost/callback"],
      }),
    ).rejects.toThrow(InvalidRedirectUriError);

    expect(queryServiceMock).not.toHaveBeenCalled();
  });

  it("rechaza sin ninguna redirect_uri", async () => {
    await expect(registerClient({ redirect_uris: [] })).rejects.toThrow(InvalidRedirectUriError);
    expect(queryServiceMock).not.toHaveBeenCalled();
  });

  it("caso feliz: acepta https:// y http://localhost con cualquier puerto", async () => {
    queryServiceMock.mockResolvedValueOnce([]);

    const result = await registerClient({
      redirect_uris: ["https://claude.ai/callback", "http://localhost:54321/callback"],
      client_name: "Claude Desktop",
    });

    expect(result.token_endpoint_auth_method).toBe("none");
    expect(result.client_id).toMatch(/^[0-9a-f]{32}$/);
    expect(result.redirect_uris).toEqual([
      "https://claude.ai/callback",
      "http://localhost:54321/callback",
    ]);
    expect(result.client_name).toBe("Claude Desktop");

    expect(queryServiceMock).toHaveBeenCalledWith(
      expect.stringContaining("insert into gym_mcp.oauth_clients"),
      [result.client_id, result.redirect_uris, "Claude Desktop"],
    );
  });

  it("client_name es opcional (queda null)", async () => {
    queryServiceMock.mockResolvedValueOnce([]);

    const result = await registerClient({ redirect_uris: ["https://claude.ai/callback"] });

    expect(result.client_name).toBeNull();
  });
});

describe("findClient", () => {
  beforeEach(() => {
    queryServiceMock.mockReset();
  });

  it("devuelve el cliente si existe", async () => {
    queryServiceMock.mockResolvedValueOnce([
      { client_id: "abc123", redirect_uris: ["https://claude.ai/callback"], client_name: "Claude" },
    ]);

    const client = await findClient("abc123");

    expect(client).toEqual({
      client_id: "abc123",
      redirect_uris: ["https://claude.ai/callback"],
      client_name: "Claude",
    });
  });

  it("devuelve null si no existe", async () => {
    queryServiceMock.mockResolvedValueOnce([]);

    const client = await findClient("no-existe");

    expect(client).toBeNull();
  });
});
