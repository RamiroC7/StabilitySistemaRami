// Subset de la fuente Material Symbols (regla R10 de rendimiento-stability).
//
// La fuente completa pesa ~1,14 MB (woff2, medido 2026-10-10); la app usa ~100
// iconos con ejes fijos (FILL 0, wght 400: ver src/index.css). Google Fonts
// permite pedir solo los iconos necesarios con `icon_names=`.
//
//   node scripts/material-icons.mjs           # imprime la lista y la URL
//   node scripts/material-icons.mjs --check   # falla si index.html no cubre los iconos usados
//
// La lista es un SUPERSET a proposito: incluye los iconos escritos en JSX y todo
// literal snake_case de los archivos que usan `material-symbols-outlined` (para
// cubrir nombres dinamicos como `icon: "light_mode"` en arrays). Google ignora
// los nombres que no son iconos.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

/** Nombres de iconos usados en `src/`, ordenados alfabeticamente. */
export function collectIconNames(srcDir = path.join(ROOT, "src")) {
  const names = new Set();
  for (const file of walk(srcDir)) {
    const code = fs.readFileSync(file, "utf8");
    if (!code.includes("material-symbols")) continue;

    // Icono escrito directo en JSX: <span className="material-symbols-outlined ...">name</span>
    for (const m of code.matchAll(/material-symbols-outlined[^>]*>\s*([a-z][a-z0-9_]*)\s*</g)) {
      names.add(m[1]);
    }
    // Nombres dinamicos: cualquier literal snake_case del archivo.
    for (const m of code.matchAll(/["'`]([a-z][a-z0-9]*(?:_[a-z0-9]+)*)["'`]/g)) {
      names.add(m[1]);
    }
  }
  return [...names].sort();
}

export const FONT_AXES = "wght,FILL@400,0";

// OJO: Inter/Lexend van en un request APARTE (ver index.html). Si icon_names se
// mezcla con otras familias, Google recorta tambien sus glifos (Inter quedaba
// en 7 kB, sin la mayoria de los caracteres).
export const TEXT_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Lexend:wght@300;400;500;600;700&display=swap";

export function iconsFontUrl(names) {
  return (
    `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:${FONT_AXES}` +
    `&icon_names=${names.join(",")}&display=swap`
  );
}

/** Iconos incluidos hoy en la URL de index.html (null si no hay icon_names). */
export function iconsInIndexHtml(html) {
  const m = html.match(/icon_names=([a-z0-9_,]+)/);
  return m ? new Set(m[1].split(",")) : null;
}

/** URL de Google Fonts con solo los iconos pedidos (ejes fijos FILL 0, wght 400). */
export function fontUrl(names) {
  return `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@400,0&icon_names=${names.join(",")}&display=swap`;
}

function main() {
  const names = collectIconNames();
  if (process.argv.includes("--check")) {
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    const included = iconsInIndexHtml(html);
    if (!included) {
      console.error("✗ index.html no usa icon_names: se esta cargando la fuente Material Symbols completa (~1,14 MB).");
      process.exit(1);
    }
    // Solo exigimos los iconos escritos directo en JSX; los literales son superset.
    const missing = names.filter((n) => !included.has(n));
    if (missing.length > 0) {
      console.error(`✗ Faltan ${missing.length} iconos en icon_names de index.html:\n  ${missing.join(", ")}`);
      console.error("  Regenera la URL con: node scripts/material-icons.mjs");
      process.exit(1);
    }
    console.log(`✓ index.html cubre los ${names.length} nombres de iconos de src/.`);
    return;
  }
  console.log(`${names.length} nombres:\n${names.join(",")}\n\nURL:\n${fontUrl(names)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
