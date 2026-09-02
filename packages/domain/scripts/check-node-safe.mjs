#!/usr/bin/env node
// Gate: @stability/domain tiene que seguir siendo ejecutable en un Node pelado.
// Sale con codigo 1 si algun packages/domain/src/**/*.ts referencia APIs de
// browser/framework FUERA de comentarios y strings. Imprime archivo:linea del
// primer hallazgo de cada regla.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");

/** @type {string[]} */
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (full.endsWith(".ts")) files.push(full);
  }
})(srcDir);

const rules = [
  { label: "import from 'react'", re: /\bfrom\s+['"]react['"]/ },
  { label: "import from 'react-dom'", re: /\bfrom\s+['"]react-dom['"]/ },
  { label: "import from 'zustand'", re: /\bfrom\s+['"]zustand['"]/ },
  { label: "import from '@supabase/supabase-js'", re: /\bfrom\s+['"]@supabase\/supabase-js['"]/ },
  { label: "require('react'|'react-dom'|'zustand'|'@supabase/supabase-js')", re: /\brequire\(\s*['"](?:react|react-dom|zustand|@supabase\/supabase-js)['"]\s*\)/ },
  { label: "import.meta", re: /\bimport\.meta\b/ },
  { label: "localStorage", re: /\blocalStorage\b/ },
  { label: "sessionStorage", re: /\bsessionStorage\b/ },
  { label: "navigator", re: /\bnavigator\b/ },
  { label: "window", re: /\bwindow\b/ },
  { label: "document", re: /\bdocument\b/ },
];

// Reemplaza el contenido de strings (y sus delimitadores) por espacios, para
// no disparar el gate por una palabra dentro de un literal. Se corre despues
// de haber removido comentarios en la linea. Deja intactos los import/require
// (sus paths son justamente lo que queremos detectar): si la linea arranca
// como import/export ... from o tiene require(, no se toca.
function stripStrings(line) {
  if (/\b(?:import|export)\b.*\bfrom\b/.test(line) || /\brequire\(/.test(line)) {
    return line;
  }
  return line.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, (m) => " ".repeat(m.length));
}

function stripLineComment(line) {
  const i = line.indexOf("//");
  return i === -1 ? line : line.slice(0, i);
}

const violations = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  let inBlockComment = false;
  lines.forEach((raw, idx) => {
    let line = raw;
    if (inBlockComment) {
      const end = line.indexOf("*/");
      if (end === -1) return;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    const open = line.indexOf("/*");
    if (open !== -1) {
      const end = line.indexOf("*/", open + 2);
      if (end === -1) {
        line = line.slice(0, open);
        inBlockComment = true;
      } else {
        line = line.slice(0, open) + line.slice(end + 2);
      }
    }
    line = stripStrings(stripLineComment(line));
    for (const rule of rules) {
      if (rule.re.test(line)) {
        violations.push({ file: relative(root, file), line: idx + 1, label: rule.label, text: raw.trim() });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("check:node-safe FALLO — @stability/domain no puede usar APIs de browser/framework:\n");
  const seen = new Set();
  for (const v of violations) {
    if (seen.has(v.label)) continue;
    seen.add(v.label);
    console.error(`  ${v.file}:${v.line}  [${v.label}]\n    ${v.text}`);
  }
  process.exit(1);
}

console.log(`check:node-safe OK — ${files.length} archivo(s) escaneados en packages/domain/src.`);
