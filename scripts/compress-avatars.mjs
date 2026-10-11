// Comprime las fotos de perfil YA subidas (R35). Una sola vez.
//
//   node scripts/compress-avatars.mjs            -> PRUEBA EN SECO: descarga los originales a
//                                                   backups/avatars/ y comprime en local. No
//                                                   escribe nada en Supabase.
//   node scripts/compress-avatars.mjs --apply    -> sube las versiones livianas como archivos NUEVOS
//                                                   y apunta student_profiles.profile_image_url a ellos.
//                                                   Los originales NO se tocan ni se borran.
//   node scripts/compress-avatars.mjs --rollback -> vuelve las URLs a las originales (rollback.json).
//
// --apply y --rollback necesitan la clave de servicio, que NO esta en el repo:
//   PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY = "<clave>"   (Dashboard > Settings > API)
// Las policies de Storage solo dejan a cada usuario escribir en su propia carpeta.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "backups", "avatars");
const listFile = path.join(dir, "list.json");
const rollbackFile = path.join(dir, "rollback.json");

const MAX_PX = 320; // igual que src/lib/compressAvatar.ts
const TARGET_BYTES = 40 * 1024;
const QUALITIES = [80, 70, 60, 50, 40];

const mode = process.argv.includes("--apply")
  ? "apply"
  : process.argv.includes("--rollback")
    ? "rollback"
    : "dry";

const env = Object.fromEntries(
  (existsSync(path.join(root, ".env")) ? readFileSync(path.join(root, ".env"), "utf8") : "")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);
const SUPABASE_URL = (process.env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

if (!SUPABASE_URL) throw new Error("Falta VITE_SUPABASE_URL en .env");
if (mode !== "dry" && !SERVICE_KEY) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY en el entorno (ver el encabezado del script).");
  process.exit(1);
}

const rows = JSON.parse(readFileSync(listFile, "utf8")); // [{ id, url }]
const apiHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

async function patchUrl(id, from, to) {
  // Compare-and-set: solo si sigue apuntando a `from` (no pisa un cambio hecho mientras tanto).
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/student_profiles?id=eq.${id}&profile_image_url=eq.${encodeURIComponent(from)}`,
    {
      method: "PATCH",
      headers: { ...apiHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ profile_image_url: to }),
    },
  );
  if (!res.ok) throw new Error(`PATCH ${id}: ${res.status} ${await res.text()}`);
  return (await res.json()).length; // filas actualizadas (0 = cambio concurrente)
}

if (mode === "rollback") {
  const done = JSON.parse(readFileSync(rollbackFile, "utf8"));
  for (const { id, oldUrl, newUrl } of done) {
    const n = await patchUrl(id, newUrl, oldUrl);
    console.log(`${n ? "ok " : "SKIP"} ${id}`);
  }
  process.exit(0);
}

mkdirSync(path.join(dir, "originals"), { recursive: true });
mkdirSync(path.join(dir, "compressed"), { recursive: true });

const report = [];
for (const { id, url } of rows) {
  const file = url.split("/").pop();
  const origPath = path.join(dir, "originals", `${id}__${file}`);
  const outPath = path.join(dir, "compressed", `${id}.webp`);

  // 1) Backup local del original (bucket publico: GET sin credenciales).
  if (!existsSync(origPath)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo bajar ${url}: ${res.status}`);
    writeFileSync(origPath, Buffer.from(await res.arrayBuffer()));
  }
  const original = readFileSync(origPath);

  // 2) Compresion: <= 320 px, EXIF aplicado, WebP bajando calidad hasta ~40 kB.
  let best = null;
  for (const q of QUALITIES) {
    const buf = await sharp(original)
      .rotate()
      .resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: q })
      .toBuffer();
    if (!best || buf.length < best.length) best = buf;
    if (buf.length <= TARGET_BYTES) break;
  }
  writeFileSync(outPath, best);
  const meta = await sharp(best).metadata();
  report.push({ id, url, before: original.length, after: best.length, dims: `${meta.width}x${meta.height}`, best });
  console.log(`${id.slice(0, 8)}  ${kb(original.length).padStart(10)} -> ${kb(best.length).padStart(8)}  ${meta.width}x${meta.height}`);
}

const sum = (k) => report.reduce((s, r) => s + r[k], 0);
console.log(`\nTotal: ${kb(sum("before"))} -> ${kb(sum("after"))} (${((1 - sum("after") / sum("before")) * 100).toFixed(1)} % menos), ${report.length} fotos`);
console.log(`Backup de originales: ${path.relative(root, path.join(dir, "originals"))}`);

if (mode === "dry") {
  console.log("\nPRUEBA EN SECO: no se escribio nada en Supabase. Para aplicar: --apply");
  process.exit(0);
}

// 3) Subida como archivos NUEVOS (nunca se pisa el original) + actualizar la URL.
const applied = existsSync(rollbackFile) ? JSON.parse(readFileSync(rollbackFile, "utf8")) : [];
for (const r of report) {
  if (applied.some((a) => a.id === r.id)) {
    console.log(`ya aplicado ${r.id.slice(0, 8)}`);
    continue;
  }
  const objectPath = `${r.id}/avatar-${Date.now()}.webp`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/profile-images/${objectPath}`, {
    method: "POST",
    headers: { ...apiHeaders, "Content-Type": "image/webp", "Cache-Control": "max-age=31536000", "x-upsert": "false" },
    body: r.best,
  });
  if (!up.ok) throw new Error(`Subida ${r.id}: ${up.status} ${await up.text()}`);

  const newUrl = `${SUPABASE_URL}/storage/v1/object/public/profile-images/${objectPath}`;
  const check = await fetch(newUrl);
  if (!check.ok || (await check.arrayBuffer()).byteLength !== r.after) throw new Error(`Verificacion fallida ${r.id}`);

  const n = await patchUrl(r.id, r.url, newUrl);
  applied.push({ id: r.id, oldUrl: r.url, newUrl });
  writeFileSync(rollbackFile, JSON.stringify(applied, null, 2));
  console.log(`${n ? "ok  " : "SKIP (la URL cambio mientras tanto)"} ${r.id.slice(0, 8)} ${kb(r.before)} -> ${kb(r.after)}`);
}
console.log(`\nListo. Rollback: node scripts/compress-avatars.mjs --rollback  (${path.relative(root, rollbackFile)})`);
