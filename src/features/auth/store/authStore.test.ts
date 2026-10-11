import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// supabase.ts explota al importarse sin estas variables (ver ci.yml).
vi.stubEnv("VITE_SUPABASE_URL", "https://ci-placeholder.supabase.co");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "ci-placeholder-anon-key");

// Regla R15 (rendimiento-stability): los handlers de eventos de alta
// frecuencia (scroll/touchstart/mousedown) no pueden hacer set() en cada
// evento, porque cada set() escribe auth-storage en localStorage.
describe("authStore.updateActivity (throttle)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("solo actualiza lastActivity una vez por minuto", async () => {
    const { useAuthStore } = await import("./authStore");
    useAuthStore.setState({ lastActivity: null });

    const updates: Array<number | null> = [];
    const unsubscribe = useAuthStore.subscribe((s, prev) => {
      if (s.lastActivity !== prev.lastActivity) updates.push(s.lastActivity);
    });

    // 500 eventos en el mismo instante -> una sola actualizacion.
    for (let i = 0; i < 500; i++) useAuthStore.getState().updateActivity();
    expect(updates).toHaveLength(1);

    // 59 s despues sigue dentro de la ventana.
    vi.advanceTimersByTime(59_000);
    useAuthStore.getState().updateActivity();
    expect(updates).toHaveLength(1);

    // Pasado el minuto vuelve a actualizar.
    vi.advanceTimersByTime(2_000);
    useAuthStore.getState().updateActivity();
    expect(updates).toHaveLength(2);

    unsubscribe();
    // El primer import() carga supabase-js y Sentry: en frio (o con CI cargado)
    // puede pasar el timeout default de 5 s.
  }, 30_000);
});
