import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { mockSupabase, seedSession } from "./helpers";

// R35: la foto de perfil se achica en el navegador ANTES de subirse. Se sube una
// foto "de celular" de varios MB (ruido, que no comprime bien) y se verifica que
// lo que sale hacia Storage es una miniatura liviana en WebP.

test("alumno: la foto de perfil se comprime a WebP liviano antes de subirse", async ({ page }) => {
  await mockSupabase(page);
  await seedSession(page, "student");

  const userId = "00000000-0000-4000-8000-000000000001";
  await page.route("**/auth/v1/user", (route) =>
    route.fulfill({ status: 200, json: { id: userId, aud: "authenticated", role: "authenticated" } }),
  );

  const uploads: { url: string; bytes: number; body: string }[] = [];
  await page.route("**/storage/v1/object/profile-images/**", (route) => {
    const req = route.request();
    const buf = req.postDataBuffer();
    uploads.push({ url: req.url(), bytes: buf?.length ?? 0, body: buf?.toString("latin1") ?? "" });
    return route.fulfill({ status: 200, json: { Key: "profile-images/x" } });
  });

  // Ruido aleatorio 3000x2250: un JPEG pesado, como una foto sin procesar.
  const width = 3000;
  const height = 2250;
  const noise = Buffer.alloc(width * height * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
  const photo = await sharp(noise, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
  expect(photo.length, "la foto de prueba debe ser pesada").toBeGreaterThan(1024 * 1024);

  await page.goto("/entrenamiento/perfil");
  await page.locator("input[type=file]").setInputFiles({
    name: "foto-celular.jpg",
    mimeType: "image/jpeg",
    buffer: photo,
  });

  await expect.poll(() => uploads.length, { timeout: 15_000 }).toBe(1);
  const [upload] = uploads;

  console.log(`foto original ${photo.length} B -> subida ${upload.bytes} B`);
  expect(upload.url).toMatch(/avatar-\d+\.webp/);
  expect(upload.body).toContain("image/webp");
  expect(upload.bytes, `subio ${upload.bytes} B`).toBeLessThan(60 * 1024);
  expect(upload.bytes).toBeLessThan(photo.length / 20);
});
