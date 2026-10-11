// Chequeo de presupuestos de rendimiento sobre el build de produccion (dist/).
// Reglas y justificacion: .claude/skills/rendimiento-stability/SKILL.md y
// RENDIMIENTO.md (seccion 6.1). Se corre en CI despues de `npm run build`:
//
//   node scripts/check-perf-budget.mjs
//
// Si algun presupuesto se excede el proceso termina con codigo 1. Para subir
// un limite hay que justificarlo en el PR Y actualizar la skill/RENDIMIENTO.md.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const ASSETS = path.join(DIST, "assets");

const KB = 1024;

// ── Presupuestos (bytes) ────────────────────────────────────────────────────
// Linea base medida el 2026-10-10 (ver RENDIMIENTO.md seccion 1): JS critico
// ~566 kB, CSS 117 kB, precache 2.068 kB (tras la Fase 1).
export const BUDGETS = {
  criticalJs: 580 * KB, // entry + modulepreload de index.html, sin gzip
  criticalJsGzip: 190 * KB,
  routeChunk: 100 * KB, // cualquier chunk que no sea vendor-* ni libreria pesada async
  css: 125 * KB,
  precache: 2300 * KB,
  image: 150 * KB, // cualquier imagen servida (public/ -> dist/)
};

// Chunks que SON pesados por naturaleza pero solo se cargan async y estan
// excluidos del precache. No cuentan contra `routeChunk`.
const HEAVY_ASYNC = [/^jspdf/, /^html2canvas/, /^vendor-/, /^index\.es-/, /^purify/];

const errors = [];
const info = [];
const fmt = (b) => `${(b / KB).toFixed(1)} kB`;

function fail(msg) {
  errors.push(msg);
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.join(e.parentPath ?? e.path, e.name));
}

if (!fs.existsSync(DIST)) {
  console.error("No existe dist/. Corre `npm run build` antes de este script.");
  process.exit(1);
}

// ── 1. JS critico: entry + modulepreload ────────────────────────────────────
const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
const criticalRefs = new Set();
for (const m of html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)) criticalRefs.add(m[1]);
for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)) criticalRefs.add(m[1]);

let criticalRaw = 0;
let criticalGzip = 0;
for (const ref of criticalRefs) {
  const file = path.join(DIST, ref.replace(/^\//, ""));
  if (!fs.existsSync(file)) continue;
  const buf = fs.readFileSync(file);
  criticalRaw += buf.length;
  criticalGzip += zlib.gzipSync(buf).length;
}
info.push(`JS critico: ${fmt(criticalRaw)} (gzip ${fmt(criticalGzip)}) en ${criticalRefs.size} archivos`);
if (criticalRaw > BUDGETS.criticalJs) {
  fail(`JS critico ${fmt(criticalRaw)} > presupuesto ${fmt(BUDGETS.criticalJs)}. Algo nuevo entro al entry: usa import() dinamico.`);
}
if (criticalGzip > BUDGETS.criticalJsGzip) {
  fail(`JS critico (gzip) ${fmt(criticalGzip)} > presupuesto ${fmt(BUDGETS.criticalJsGzip)}.`);
}

// ── 2. Chunks de ruta y CSS ─────────────────────────────────────────────────
for (const file of listFiles(ASSETS)) {
  const name = path.basename(file);
  const size = fs.statSync(file).size;
  if (name.endsWith(".js")) {
    const isHeavyAllowed = HEAVY_ASYNC.some((re) => re.test(name));
    if (!isHeavyAllowed && size > BUDGETS.routeChunk) {
      fail(`Chunk ${name} pesa ${fmt(size)} > ${fmt(BUDGETS.routeChunk)}. Dividilo (lazy) o justifica el aumento.`);
    }
  } else if (name.endsWith(".css")) {
    if (size > BUDGETS.css) fail(`CSS ${name} pesa ${fmt(size)} > ${fmt(BUDGETS.css)}.`);
  }
}

// ── 3. Precache del Service Worker ──────────────────────────────────────────
const swPath = path.join(DIST, "sw.js");
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, "utf8");
  const urls = new Set([...sw.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1]));
  let precache = 0;
  for (const url of urls) {
    const file = path.join(DIST, url.split("?")[0]);
    if (fs.existsSync(file)) precache += fs.statSync(file).size;
  }
  info.push(`Precache SW: ${fmt(precache)} en ${urls.size} entradas`);
  if (precache > BUDGETS.precache) {
    fail(`Precache del SW ${fmt(precache)} > ${fmt(BUDGETS.precache)}. Agrega el chunk pesado a workbox.globIgnores.`);
  }
}

// ── 4. Imagenes servidas ────────────────────────────────────────────────────
const IMG_RE = /\.(png|jpe?g|webp|avif|gif)$/i;
for (const file of listFiles(DIST)) {
  if (!IMG_RE.test(file)) continue;
  const size = fs.statSync(file).size;
  if (size > BUDGETS.image) {
    fail(`Imagen ${path.relative(DIST, file)} pesa ${fmt(size)} > ${fmt(BUDGETS.image)}. Redimensionala/recomprimila.`);
  }
}

// ── 5. Assets huerfanos en public/ ──────────────────────────────────────────
// Un archivo de public/ debe estar referenciado por nombre en src/, index.html,
// vite.config.ts o api/. (Las splash screens se referencian desde index.html.)
const PUBLIC = path.join(ROOT, "public");
const haystackFiles = [
  ...listFiles(path.join(ROOT, "src")),
  ...listFiles(path.join(ROOT, "api")),
  path.join(ROOT, "index.html"),
  path.join(ROOT, "vite.config.ts"),
].filter((f) => fs.existsSync(f) && /\.(tsx?|jsx?|html|css|json|mjs)$/.test(f));
const haystack = haystackFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");

for (const file of listFiles(PUBLIC)) {
  const base = path.basename(file);
  if (!haystack.includes(base)) {
    fail(`public/${path.relative(PUBLIC, file).replace(/\\/g, "/")} no esta referenciado en ningun lado: borralo (sigue en git).`);
  }
}

// ── Resultado ───────────────────────────────────────────────────────────────
console.log("Presupuestos de rendimiento");
for (const line of info) console.log("  ·", line);
if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} presupuesto(s) excedido(s):`);
  for (const e of errors) console.error("  -", e);
  process.exit(1);
}
console.log("✓ Todos los presupuestos se cumplen.");
