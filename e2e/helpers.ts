import type { Page, Request } from "@playwright/test";

// Debe coincidir con VITE_SUPABASE_URL con el que se hizo el build (en CI son
// valores de mentira: ver .github/workflows/ci.yml). La clave de storage de
// supabase-js es `sb-<primer label del host>-auth-token`.
const SUPABASE_STORAGE_KEY = "sb-ci-placeholder-auth-token";

export type Role = "coach" | "student";

const FAKE_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "e2e@example.test",
  firstName: "E2E",
  lastName: "Tester",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function base64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

// JWT con forma valida pero sin firma real: supabase-js no verifica la firma
// del lado del cliente. Solo sirve contra el Supabase mockeado de los tests.
function fakeJwt(exp: number): string {
  return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({
    sub: FAKE_USER.id,
    role: "authenticated",
    exp,
  })}.e2e-signature`;
}

/**
 * Deja la app "logueada" como `role` ANTES de que cargue cualquier script:
 * siembra la sesion de supabase-js y el store persistido de zustand
 * (`auth-storage`), asi no hay fetch de perfil y se salta el login.
 */
export async function seedSession(page: Page, role: Role): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const session = {
    access_token: fakeJwt(nowSec + 3600),
    refresh_token: "e2e-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: nowSec + 3600,
    user: {
      id: FAKE_USER.id,
      aud: "authenticated",
      role: "authenticated",
      email: FAKE_USER.email,
      app_metadata: {},
      user_metadata: {},
      created_at: FAKE_USER.createdAt,
    },
  };
  const authStorage = {
    state: {
      professor: { ...FAKE_USER, role, hasCompletedProfile: true },
      isAuthenticated: true,
      lastActivity: null,
      tokenExpiry: null,
    },
    version: 0,
  };

  await page.addInitScript(
    ([key, sessionJson, storeJson]) => {
      localStorage.setItem(key, sessionJson);
      localStorage.setItem("auth-storage", storeJson);
    },
    [
      SUPABASE_STORAGE_KEY,
      JSON.stringify(session),
      JSON.stringify(authStorage),
    ] as const,
  );
}

/** Responde vacio a todo lo de Supabase: ningun test toca un backend real. */
export async function mockSupabase(page: Page): Promise<void> {
  await page.route("**/*.supabase.co/**", (route) => {
    const url = route.request().url();
    if (url.includes("/auth/v1/")) {
      return route.fulfill({ status: 200, json: {} });
    }
    // PostgREST: lista vacia. (.single() puede dar 406; la UI lo tolera.)
    return route.fulfill({ status: 200, json: [] });
  });
  await page.route("**/api/**", (route) => route.fulfill({ status: 200, json: {} }));
}

/** Registra las URLs de JS pedidas a la red. */
export function trackJsRequests(page: Page): { urls: () => string[] } {
  const seen: string[] = [];
  page.on("request", (req: Request) => {
    const url = req.url();
    if (/\/assets\/.+\.js(\?|$)/.test(url)) seen.push(url);
  });
  return { urls: () => [...seen] };
}

/** Chunks que NUNCA deben bajarse sin que el usuario los necesite. */
export const HEAVY_CHUNKS = [
  /vendor-charts/,
  /jspdf/,
  /html2canvas/,
  /\/index\.es-/,
  /\/purify\.es-/,
  /\/BusinessMetrics-/,
];

export function heavyRequested(urls: string[]): string[] {
  return urls.filter((u) => HEAVY_CHUNKS.some((re) => re.test(u)));
}

/** Espera a que el navegador este ocioso (cuando corre el prefetch). */
export async function waitForIdle(page: Page, ms = 6000): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}
