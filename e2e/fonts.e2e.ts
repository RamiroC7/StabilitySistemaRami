import { test, expect } from "@playwright/test";
import { mockSupabase } from "./helpers";

// R10 (rendimiento-stability): Material Symbols va recortado a los iconos usados.
// Si falta un icono en `icon_names` de index.html, en pantalla aparece el NOMBRE
// del icono como texto ("light_mode") en vez del glifo. Este test lo detecta.
//
// Usa Google Fonts de verdad (red real). Si no hay red se saltea.

// Iconos que se eligen dinamicamente (props / arrays / objetos), los mas faciles
// de olvidar al regenerar la lista.
const DYNAMIC_ICONS = [
  "light_mode",
  "wb_sunny",
  "dark_mode",
  "bedtime",
  "inbox",
  "ads_click",
  "login",
  "history",
  "calendar_month",
  "monitoring",
  "view_timeline",
  "military_tech",
  "health_and_safety",
  "assignment_late",
  "assignment_turned_in",
  "event_busy",
  "person",
  "search",
  "close",
  "chevron_right",
];

test("los iconos se renderizan como glifo con la fuente recortada", async ({ page }) => {
  await mockSupabase(page);

  const fontResponses: { url: string; bytes: number }[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("fonts.gstatic.com")) {
      fontResponses.push({
        url: res.url(),
        bytes: (await res.body().catch(() => Buffer.alloc(0))).length,
      });
    }
  });

  await page.goto("/login");

  const loaded = await page
    .evaluate(async () => {
      try {
        await document.fonts.load('24px "Material Symbols Outlined"', "search");
        return document.fonts.check('24px "Material Symbols Outlined"');
      } catch {
        return false;
      }
    })
    .catch(() => false);
  test.skip(!loaded, "Sin acceso a Google Fonts: no se puede verificar la fuente");

  // Cada icono debe medir ~1 caracter de ancho (glifo), no el ancho del texto.
  const widths = await page.evaluate(async (names) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const out: Record<string, number> = {};
    for (const name of names) {
      const span = document.createElement("span");
      span.className = "material-symbols-outlined";
      span.textContent = name;
      host.appendChild(span);
    }
    await document.fonts.ready;
    for (const span of Array.from(host.children) as HTMLElement[]) {
      out[span.textContent ?? ""] = span.getBoundingClientRect().width;
    }
    return out;
  }, DYNAMIC_ICONS);

  for (const name of DYNAMIC_ICONS) {
    // 24px de fuente => el glifo mide ~24px; el texto "military_tech" mediria >100px.
    expect(widths[name], `icono "${name}" no se renderiza como glifo`).toBeLessThan(40);
  }

  // Nunca se baja la fuente completa (~1,1 MB).
  const symbols = fontResponses.filter((f) => f.bytes > 0);
  for (const f of symbols) {
    expect(f.bytes, `fuente muy pesada: ${f.url}`).toBeLessThan(200 * 1024);
  }
});
