import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifySupabaseSession } from "./verify-supabase-session.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.SUPABASE_URL = "https://project-ref.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key-fake";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("verifySupabaseSession", () => {
  it("devuelve { id } cuando /auth/v1/user responde 200 con un id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "coach-uuid-1", email: "coach@example.com" }),
    });

    const result = await verifySupabaseSession("fake-token", fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ id: "coach-uuid-1" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://project-ref.supabase.co/auth/v1/user",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fake-token",
          apikey: "anon-key-fake",
        }),
      }),
    );
  });

  it("devuelve null si la respuesta no es ok (token inválido/expirado)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    const result = await verifySupabaseSession("fake-token", fetchImpl as unknown as typeof fetch);

    expect(result).toBeNull();
  });

  it("devuelve null si la red falla", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await verifySupabaseSession("fake-token", fetchImpl as unknown as typeof fetch);

    expect(result).toBeNull();
  });

  it("devuelve null si la respuesta no trae id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const result = await verifySupabaseSession("fake-token", fetchImpl as unknown as typeof fetch);

    expect(result).toBeNull();
  });

  it("devuelve null sin llamar a fetch si falta SUPABASE_URL/SUPABASE_ANON_KEY", async () => {
    delete process.env.SUPABASE_URL;
    const fetchImpl = vi.fn();

    const result = await verifySupabaseSession("fake-token", fetchImpl as unknown as typeof fetch);

    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
