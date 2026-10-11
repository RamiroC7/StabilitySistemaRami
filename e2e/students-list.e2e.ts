import { test, expect } from "@playwright/test";
import { mockSupabase, seedSession } from "./helpers";

// Protege la lista de alumnos del coach:
//  - R12/R13: tarjetas memoizadas, filtro memoizado + useDeferredValue.
//  - R19/R20/R21: los datos vienen de RPCs del servidor, nunca de `.in()` con
//    la lista de UUID en la URL ni de tablas enteras bajadas al navegador.

const STUDENTS = [
  { id: "11111111-1111-4111-8111-111111111111", first_name: "Ana", last_name: "Perez", archived: false },
  { id: "22222222-2222-4222-8222-222222222222", first_name: "Bruno", last_name: "Gomez", archived: false },
  { id: "33333333-3333-4333-8333-333333333333", first_name: "Carla", last_name: "Diaz", archived: true },
];

let requestedUrls: string[] = [];

test.beforeEach(async ({ page }) => {
  requestedUrls = [];
  page.on("request", (req) => {
    if (req.url().includes(".supabase.co")) requestedUrls.push(req.url());
  });

  await mockSupabase(page);
  await seedSession(page, "coach");

  // Las rutas registradas despues tienen prioridad sobre mockSupabase.
  await page.route("**/rest/v1/rpc/get_students_overview*", (route) =>
    route.fulfill({
      status: 200,
      json: STUDENTS.map((s) => ({
        student_id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        profile_image_url: null,
        training_experience: "beginner",
        primary_goal: "health",
        activity_level: "moderate",
        phone: null,
        instagram: null,
        is_archived: s.archived,
        assignments: [],
      })),
    }),
  );
  await page.route("**/rest/v1/rpc/get_students_alerts*", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
});

test("lista alumnos, filtra por nombre y deja los archivados al final", async ({ page }) => {
  await page.goto("/inicio");

  const names = page.locator("h3");
  await expect(names).toHaveCount(3);
  // Carla esta archivada: va ultima.
  await expect(names.last()).toHaveText("Carla Diaz");

  await page.getByPlaceholder("Buscar alumno...").fill("bru");
  await expect(names).toHaveCount(1);
  await expect(names.first()).toHaveText("Bruno Gomez");

  await page.getByPlaceholder("Buscar alumno...").fill("");
  await expect(names).toHaveCount(3);
});

test("click en una tarjeta navega al perfil del alumno", async ({ page }) => {
  await page.goto("/inicio");
  await page.locator("h3", { hasText: "Ana Perez" }).click();
  await expect(page).toHaveURL(new RegExp(`/alumno/${STUDENTS[0].id}`));
});

test("carga alumnos con RPCs y sin listas de ids en la URL (R19-R21)", async ({ page }) => {
  await page.goto("/inicio");
  await expect(page.locator("h3")).toHaveCount(3);

  const rpcs = requestedUrls.filter((u) => u.includes("/rest/v1/rpc/"));
  expect(rpcs.some((u) => u.includes("get_students_overview"))).toBe(true);
  expect(rpcs.some((u) => u.includes("get_students_alerts"))).toBe(true);

  // Ninguna request de la pantalla puede traer un .in() con UUID en la URL, ni
  // bajar workout_completions entera.
  for (const url of requestedUrls) {
    expect(decodeURIComponent(url)).not.toMatch(/in\.\(/);
    expect(url).not.toContain("/rest/v1/workout_completions");
  }
});

// Fotos de alumnos: las originales pesan ~1,6 MB y se dibujan a 56 px. La lista
// debe pedir la miniatura transformada (nunca /object/public/) y, si la foto
// falla, caer al icono en vez de dejar un skeleton eterno.
test("avatares: pide la miniatura y cae a la predeterminada si la foto falla", async ({ page }) => {
  const base = "https://ci-placeholder.supabase.co/storage/v1";
  const photo = (id: string) => `${base}/object/public/profile-images/${id}/avatar-1.jpeg`;
  const PIXEL = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  const originals: string[] = [];
  const thumbs: string[] = [];

  await page.route("**/rest/v1/rpc/get_students_overview*", (route) =>
    route.fulfill({
      status: 200,
      json: STUDENTS.slice(0, 2).map((s) => ({
        student_id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        profile_image_url: photo(s.id),
        training_experience: "beginner",
        primary_goal: "health",
        activity_level: "moderate",
        phone: null,
        instagram: null,
        is_archived: false,
        assignments: [],
      })),
    }),
  );
  await page.route("**/storage/v1/object/public/**", (route) => {
    // Solo el reintento por fallo de miniatura (Bruno) puede llegar aca.
    originals.push(route.request().url());
    return route.fulfill({ status: 404, body: "" });
  });
  await page.route("**/storage/v1/render/image/public/**", (route) => {
    const url = route.request().url();
    thumbs.push(url);
    // Ana carga bien; la foto de Bruno devuelve 404.
    if (url.includes(STUDENTS[1].id)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, body: PIXEL, contentType: "image/png" });
  });

  await page.goto("/inicio");
  await expect(page.locator("h3")).toHaveCount(2);
  await expect.poll(() => thumbs.length).toBe(2);

  // La foto original solo se pide como reintento cuando falla la miniatura (Bruno).
  expect(originals.every((u) => u.includes(STUDENTS[1].id))).toBe(true);
  expect(thumbs.every((u) => /width=112&height=112/.test(u))).toBe(true);

  await expect(page.locator("img[alt='Ana Perez']")).toHaveCSS("opacity", "1");
  // Foto rota (404 en miniatura y original): cae a la imagen predeterminada.
  await expect(page.locator("img[alt='Bruno Gomez']")).toHaveAttribute("src", "/avatar-default.webp");
});

// Alumnos sin foto: todos muestran la imagen predeterminada (no un hueco ni un icono).
test("alumnos sin foto muestran la imagen predeterminada", async ({ page }) => {
  await page.goto("/inicio");
  await expect(page.locator("h3")).toHaveCount(3);
  for (const name of ["Ana Perez", "Bruno Gomez", "Carla Diaz"]) {
    await expect(page.locator(`img[alt='${name}']`)).toHaveAttribute("src", "/avatar-default.webp");
  }
  const res = await page.request.get("/avatar-default.webp");
  expect(res.ok()).toBe(true);
  expect(Number(res.headers()["content-length"])).toBeLessThan(10 * 1024);
});
