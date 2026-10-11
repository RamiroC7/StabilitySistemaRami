// Chequeo estatico de las migraciones NUEVAS de supabase/migrations/.
// Reglas R27 y R30 de .claude/skills/rendimiento-stability/SKILL.md:
//
//   R27: en policies RLS nunca `auth.uid()` pelado; siempre `(select auth.uid())`
//        (si no, Postgres lo re-evalua por fila: lint auth_rls_initplan).
//   R30: toda funcion nueva en public/api necesita `revoke execute ... from anon`
//        (el proyecto da EXECUTE a anon/authenticated por default privileges).
//   R26: toda FK nueva necesita un indice sobre sus columnas (lint
//        unindexed_foreign_keys).
//
// Solo mira migraciones con timestamp >= CUTOFF: las anteriores quedan exentas.
//   node scripts/check-migrations.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CUTOFF = "20261010000000";

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
}

/** Devuelve la lista de problemas (strings) de un archivo de migracion. */
export function checkMigration(sql, name = "migration.sql") {
  const problems = [];
  const code = stripComments(sql);

  // R27 — auth.uid() / auth.jwt() pelados.
  for (const m of code.matchAll(/auth\.(uid|jwt)\(\)/g)) {
    const before = code.slice(Math.max(0, m.index - 12), m.index);
    if (!/\(\s*select\s+$/i.test(before)) {
      problems.push(
        `${name}: auth.${m[1]}() sin envolver. Usa (select auth.${m[1]}()) — R27.`,
      );
    }
  }

  // R30 — funciones nuevas sin revoke a anon.
  const created = new Set();
  for (const m of code.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+((?:public|api)\.\w+)\s*\(/gi,
  )) {
    created.add(m[1].toLowerCase());
  }
  for (const fn of created) {
    const revoked = new RegExp(
      `revoke\\s+(?:all|execute)\\s+on\\s+function\\s+${fn.replace(".", "\\.")}\\s*\\([^)]*\\)\\s+from\\s+[^;]*\\banon\\b`,
      "i",
    ).test(code);
    if (!revoked) {
      problems.push(
        `${name}: la funcion ${fn} no hace "revoke execute ... from anon" — R30.`,
      );
    }
  }

  // R26 — FKs nuevas sin indice (chequeo simple por columna).
  for (const m of code.matchAll(
    /alter\s+table\s+(?:only\s+)?([\w.]+)\s+add\s+(?:constraint\s+\w+\s+)?foreign\s+key\s*\(([^)]+)\)/gi,
  )) {
    const table = m[1].toLowerCase();
    const cols = m[2].split(",")[0].trim().toLowerCase();
    const indexed = new RegExp(
      `create\\s+(?:unique\\s+)?index[^;]*\\bon\\s+${table.replace(".", "\\.")}[^;]*\\(\\s*${cols}\\b`,
      "i",
    ).test(code);
    if (!indexed) {
      problems.push(`${name}: FK ${table}(${cols}) sin indice — R26.`);
    }
  }

  return problems;
}

function main() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && f.slice(0, 14) >= CUTOFF)
    .sort();

  const problems = files.flatMap((f) =>
    checkMigration(fs.readFileSync(path.join(dir, f), "utf8"), f),
  );

  console.log(`Migraciones revisadas (>= ${CUTOFF}): ${files.length}`);
  if (problems.length > 0) {
    console.error(`\n✗ ${problems.length} problema(s):`);
    for (const p of problems) console.error("  -", p);
    process.exit(1);
  }
  console.log("✓ Las migraciones nuevas cumplen R26, R27 y R30.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
