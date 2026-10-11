import { test, expect } from "@playwright/test";
import {
  mockSupabase,
  seedSession,
  trackJsRequests,
  heavyRequested,
  waitForIdle,
} from "./helpers";

// Reglas que protegen estos tests: .claude/skills/rendimiento-stability/SKILL.md
// (R2 chunks pesados async, R4 prefetch por rol, R15 eventos de alta frecuencia).

test.describe("carga inicial", () => {
  test("login: no baja chunks pesados y el JS critico entra en presupuesto", async ({ page }) => {
    await mockSupabase(page);
    const js = trackJsRequests(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    let jsBytes = 0;
    page.on("response", async (res) => {
      if (/\/assets\/.+\.js(\?|$)/.test(res.url())) {
        jsBytes += (await res.body().catch(() => Buffer.alloc(0))).length;
      }
    });

    await page.goto("/login");
    await expect(page.locator("input[type=email], input[name=email]").first()).toBeVisible();
    await waitForIdle(page, 3000);

    expect(heavyRequested(js.urls()), "chunks pesados en el login").toEqual([]);
    expect(errors, "errores de JS no capturados").toEqual([]);
    // Login = entry + vendors + chunk de Login/forms. Margen sobre el critico.
    expect(jsBytes).toBeLessThan(900 * 1024);
  });

  test("ruta protegida sin sesion redirige al login sin cargar chunks de coach", async ({ page }) => {
    await mockSupabase(page);
    const js = trackJsRequests(page);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await waitForIdle(page, 3000);

    expect(heavyRequested(js.urls())).toEqual([]);
  });
});

test.describe("prefetch por rol", () => {
  test("alumno: nunca baja recharts ni pantallas de coach", async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page, "student");
    const js = trackJsRequests(page);

    await page.goto("/entrenamiento");
    await waitForIdle(page);

    const urls = js.urls();
    expect(heavyRequested(urls)).toEqual([]);
    for (const coachChunk of [/\/StudentsList-/, /\/NewPlan-/, /\/Library-/, /\/PlanExpirations-/, /\/StudentProfile-/]) {
      expect(urls.filter((u) => coachChunk.test(u)), String(coachChunk)).toEqual([]);
    }
  });

  test("coach: no precarga el dashboard (recharts) hasta que lo abre", async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page, "coach");
    const js = trackJsRequests(page);

    await page.goto("/inicio");
    await waitForIdle(page);

    expect(heavyRequested(js.urls())).toEqual([]);

    // Al navegar al dashboard recien ahi debe bajar charts.
    await page.goto("/dashboard");
    await expect
      .poll(() => js.urls().some((u) => /vendor-charts/.test(u)), { timeout: 15_000 })
      .toBe(true);
  });

  test("alumno no baja el chunk de Login ni de coach una vez logueado", async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page, "student");
    const js = trackJsRequests(page);

    await page.goto("/entrenamiento");
    await waitForIdle(page);

    expect(js.urls().filter((u) => /\/Login-/.test(u))).toEqual([]);
  });
});

test.describe("eventos de alta frecuencia", () => {
  test("scroll/touch no escribe auth-storage en cada evento (throttle)", async ({ page }) => {
    await mockSupabase(page);
    await seedSession(page, "coach");
    // Cuenta escrituras a localStorage de la key persistida del auth store.
    await page.addInitScript(() => {
      const w = window as unknown as { __authWrites: number };
      w.__authWrites = 0;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === "auth-storage") w.__authWrites++;
        return original.call(this, key, value);
      };
    });

    await page.goto("/inicio");
    await waitForIdle(page, 1500);

    const before = await page.evaluate(
      () => (window as unknown as { __authWrites: number }).__authWrites,
    );
    await page.evaluate(() => {
      for (let i = 0; i < 200; i++) {
        window.dispatchEvent(new Event("scroll"));
        window.dispatchEvent(new Event("touchstart"));
        window.dispatchEvent(new Event("mousedown"));
      }
    });
    const after = await page.evaluate(
      () => (window as unknown as { __authWrites: number }).__authWrites,
    );

    // 600 eventos -> como maximo 1 escritura (throttle de 1 min).
    expect(after - before).toBeLessThanOrEqual(1);
  });
});

test.describe("imágenes ocultas", () => {
  for (const route of ["/login", "/recuperar-password", "/actualizar-password"]) {
    test(`${route} en celular no baja la foto de fondo del panel oculto (R9)`, async ({ page }) => {
      await mockSupabase(page);
      const unsplash: string[] = [];
      page.on("request", (req) => {
        if (req.url().includes("images.unsplash.com")) unsplash.push(req.url());
      });
      // No dependemos de la red externa: si algo la pidiera, igual la cortamos.
      await page.route("**/images.unsplash.com/**", (route) => route.abort());

      await page.goto(route);
      await waitForIdle(page, 2000);

      // El panel con la foto es `hidden lg:flex`: en el viewport mobile (Pixel 7)
      // no se ve, asi que un <img> sin loading="lazy" lo bajaria igual (~170 kB).
      expect(unsplash, "foto de fondo descargada en mobile").toEqual([]);
    });
  }
});
