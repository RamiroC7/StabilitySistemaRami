// Borra del bucket `profile-images` los archivos que NINGUNA fila referencia
// (originales ya reemplazados por compress-avatars.mjs + fotos huerfanas). R35.
//
//   node scripts/delete-unused-avatars.mjs
//        -> PRUEBA EN SECO (por defecto): lista lo que borraria y baja una copia local de cada
//           candidato a backups/avatars/deleted/. No borra nada en Supabase.
//   node scripts/delete-unused-avatars.mjs --delete --confirm=BORRAR --expect=<N>
//        -> borra de verdad. <N> es la cantidad exacta que mostro la prueba en seco.
//           Irreversible en el bucket: la unica copia queda en el backup local.
//
// Necesita la clave de servicio (no esta en el repo), solo en tu terminal:
//   PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY = "<clave>"
//
// Salvaguardas (el script aborta si alguna falla):
//   1. Todo archivo referenciado existe en el bucket y es WebP (o sea, el --apply de
//      compress-avatars.mjs ya se corrio).
//   2. Cada candidato tiene copia local con el mismo tamano antes de borrarse.
//   3. Las referencias se vuelven a leer justo antes de borrar: nada que haya pasado a estar
//      en uso entre la prueba y el borrado se elimina.
//   4. Nunca borra si no hay ninguna foto en uso, y el borrado exige --expect=<N> igual a la
//      cantidad de candidatos: si cambio algo desde la prueba en seco, aborta.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backupDir = path.join(root, "backups", "avatars", "deleted");
const BUCKET = "profile-images";
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

const doDelete = process.argv.includes("--delete");
const confirmed = process.argv.includes("--confirm=BORRAR");
const expectArg = process.argv.find((a) => a.startsWith("--expect="));
const expected = expectArg ? Number(expectArg.split("=")[1]) : null;

const env = Object.fromEntries(
  (existsSync(path.join(root, ".env")) ? readFileSync(path.join(root, ".env"), "utf8") : "")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);
const SUPABASE_URL = (process.env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const fail = (msg) => {
  console.error(`\nABORTADO: ${msg}`);
  process.exit(1);
};

if (!SUPABASE_URL) fail("Falta VITE_SUPABASE_URL en .env");
if (!KEY) fail("Falta SUPABASE_SERVICE_ROLE_KEY en el entorno (ver el encabezado del script).");
if (doDelete && !confirmed) fail("Para borrar hace falta ademas --confirm=BORRAR.");

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function json(url, init) {
  const res = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  if (!res.ok) fail(`${init?.method ?? "GET"} ${url} -> ${res.status} ${await res.text()}`);
  return res.json();
}

/** Todos los objetos del bucket: [{ name, size }] (name = "carpeta/archivo"). */
async function listObjects() {
  const list = (prefix, offset) =>
    json(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
  const out = [];
  const rootEntries = await list("", 0);
  for (const e of rootEntries) {
    if (e.id) {
      out.push({ name: e.name, size: e.metadata?.size ?? 0, mime: e.metadata?.mimetype });
      continue;
    }
    for (let offset = 0; ; offset += 1000) {
      const page = await list(e.name, offset);
      for (const f of page) {
        if (f.id) out.push({ name: `${e.name}/${f.name}`, size: f.metadata?.size ?? 0, mime: f.metadata?.mimetype });
      }
      if (page.length < 1000) break;
    }
  }
  return out;
}

/** Nombres de objeto referenciados desde la base. */
async function referencedNames() {
  const rows = [
    ...(await json(`${SUPABASE_URL}/rest/v1/student_profiles?select=profile_image_url&profile_image_url=not.is.null&limit=10000`)),
    ...(await json(`${SUPABASE_URL}/rest/v1/profiles?select=profile_image&profile_image=not.is.null&limit=10000`)),
  ];
  return new Set(
    rows
      .map((r) => r.profile_image_url ?? r.profile_image)
      .filter((u) => typeof u === "string" && u.includes(PUBLIC_PREFIX))
      .map((u) => decodeURIComponent(u.split(PUBLIC_PREFIX)[1].split("?")[0])),
  );
}

console.log(`Modo: ${doDelete ? "BORRAR" : "PRUEBA EN SECO (no se borra nada)"}\n`);

const objects = await listObjects();
const referenced = await referencedNames();
const byName = new Map(objects.map((o) => [o.name, o]));

// Salvaguarda 1: lo referenciado existe y ya esta comprimido.
if (referenced.size === 0) fail("Ninguna foto referenciada: no se borra nada.");
for (const name of referenced) {
  const o = byName.get(name);
  if (!o) fail(`La base referencia ${name} pero no existe en el bucket.`);
  if (o.mime !== "image/webp") fail(`${name} esta en uso y NO es WebP: falta correr compress-avatars.mjs --apply.`);
}

const candidates = objects.filter((o) => !referenced.has(o.name));
if (doDelete && expected !== candidates.length) {
  fail(`Hay ${candidates.length} candidatos y pasaste --expect=${expectArg?.split("=")[1] ?? "(nada)"}. Corre la prueba en seco y usa ese numero.`);
}

console.log(`Bucket: ${objects.length} objetos, ${referenced.size} en uso, ${candidates.length} sin referencia (${kb(candidates.reduce((s, o) => s + o.size, 0))}).\n`);

// Copia local de cada candidato (bucket publico: GET sin credenciales).
mkdirSync(backupDir, { recursive: true });
for (const o of candidates) {
  const local = path.join(backupDir, o.name.replace("/", "__"));
  if (!existsSync(local) || statSync(local).size !== o.size) {
    const res = await fetch(`${SUPABASE_URL}${PUBLIC_PREFIX}${o.name}`);
    if (!res.ok) fail(`No se pudo respaldar ${o.name}: ${res.status}`);
    writeFileSync(local, Buffer.from(await res.arrayBuffer()));
  }
  // Salvaguarda 2: la copia local coincide con el tamano del bucket.
  if (statSync(local).size !== o.size) fail(`La copia local de ${o.name} no coincide en tamano.`);
  console.log(`  ${doDelete ? "borrar" : "borraria"}  ${o.name}  ${kb(o.size)}`);
}
console.log(`\nCopias locales en ${path.relative(root, backupDir)}`);

if (!doDelete) {
  console.log("\nPRUEBA EN SECO: no se borro nada en Supabase.");
  console.log(`Para borrar: node scripts/delete-unused-avatars.mjs --delete --confirm=BORRAR --expect=${candidates.length}`);
  process.exit(0);
}

// Salvaguarda 3: releer referencias justo antes de borrar.
const referencedNow = await referencedNames();
const toDelete = candidates.filter((o) => !referencedNow.has(o.name));
if (toDelete.length !== candidates.length) {
  console.log(`(${candidates.length - toDelete.length} archivos pasaron a estar en uso: se saltean)`);
}

for (let i = 0; i < toDelete.length; i += 100) {
  const batch = toDelete.slice(i, i + 100).map((o) => o.name);
  await json(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: batch }),
  });
}
writeFileSync(path.join(root, "backups", "avatars", "deleted.json"), JSON.stringify(toDelete, null, 2));
console.log(`\nBorrados ${toDelete.length} archivos (${kb(toDelete.reduce((s, o) => s + o.size, 0))}). Lista en backups/avatars/deleted.json`);
