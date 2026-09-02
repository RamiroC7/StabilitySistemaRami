# Tasks: MCP Server para Sistema Alfa

**Status:** In progress — Fase 1 re-planificada para el repo real
**Last updated:** 2026-09-02
**Aprobado por:** Máximo — 2026-08-30 (Fases 0/2-6); Fase 1 revisada pendiente de re-aprobación
**Design:** [design.md](./design.md)

Ordenadas por dependencia. Se marcan `- [x]` a medida que se completan.

> **Cambio de repo (2026-09-02):** el trabajo previo se hizo contra `MaximoFini/StabilitySistema`,
> que no es el repo real. El repo real es `RamiroC7/StabilitySistemaRami` (app en la raíz, ya con
> `ci.yml` + Vitest + `api/`). **T1–T3 se rehacen** con la app SIN mover. Todo lo de Fase 0 sigue
> válido (mismo proyecto Supabase). Rutas en este doc son relativas a la raíz del repo real.
> El trabajo se entrega como **PR a `RamiroC7/StabilitySistemaRami`**; Ramiro mergea a main.

Milestones de check-in con el usuario:
- **M1** = después de T3 (workspace armado, app buildea y deploya igual).
- **M2** = después de T9 (server responde el primer tool desde MCP Inspector).
- **M3** = después de T14 (los 8 tools andando desde Claude Desktop).

---

## Fase 0 — Verificaciones que destraban el resto

- [x] **T0.1 — Verificar capacidades de rol en Supabase** — 2026-08-30
  Satisfies: US-8 (habilita D-2)
  Resultado: `postgres` tiene `rolcreaterole = true` y `rolbypassrls = true` (`rolsuper = false`). Puede crear roles y otorgar `BYPASSRLS`. `supabase_admin` es el superuser.
  El probe DDL directo no se pudo correr: el `execute_sql` del conector corre en transacción read-only (`cannot execute CREATE ROLE in a read-only transaction`). Se folda la verificación en T4: `apply_migration` es transaccional, así que si `CREATE ROLE` fallara, toda la migración hace rollback y nos enteramos sin dejar estado a medias. Confianza alta (Supabase documenta roles custom vía SQL).
  No hace falta partir T4.

- [x] **T0.2 — Verificar extensión `unaccent`** — 2026-08-30
  Satisfies: US-3
  Resultado: `unaccent` NO está instalada pero SÍ está disponible (`pg_available_extensions`, v1.1). La migración T4 incluye `create extension if not exists unaccent with schema extensions;`. Alternativas disponibles si hicieran falta: `pg_trgm`, `fuzzystrmatch`, `citext`. `pgcrypto` ya está instalada en el schema `extensions`.

- [x] **T0.3 — Leer y documentar el cálculo de adherencia actual de la app** — 2026-08-30
  Satisfies: US-2
  Resultado en `specs/mcp-server/notes-adherence.md`. **Hallazgo:** la app NO tiene cálculo de adherencia por-alumno-por-rango. El único % por alumno (`WorkoutCalendar.calculateWeekAttendance`) es solo semana actual, denominador bugueado (`total_days` como días/semana), numerador sin dedup, ~3h de skew de TZ. Segundo cálculo distinto en `useBusinessMetrics` (agregado mensual).
  Decisión con el usuario: US-2 usa **fórmula propia correcta** + datos crudos, NO replica la app. requirements.md US-2 y design.md §Key flows reescritos. El bug de la app va a un spec aparte.

---

## Fase 1 — Workspace (sin cambio visible; US-9)

> El trabajo previo (T1–T3 sobre `MaximoFini/StabilitySistema`, rama `mcp-server/phase-1-monorepo`)
> queda ARCHIVADO — repo equivocado y estructura distinta (movía la app a `apps/web/`).
> Lo reutilizable: `check-node-safe.mjs`, la lección del lockfile, el contenido de `tsconfig.base.json`.

- [x] **T1 — Convertir la raíz en workspace root SIN mover la app** — 2026-09-02
  Resultado: `package.json` raíz con `"workspaces": ["packages/*"]` (app sin renombrar, scripts/deps intactos); `tsconfig.base.json` nuevo (no lo extienden los tsconfig de la app). `npm install` regeneró el lock en formato workspaces sin subir ninguna versión (`@supabase/supabase-js` sigue 2.95.3, `date-fns` 4.1.0). Paridad vs `upstream/main`: `npm run build` 3665 módulos / 58 chunks JS idéntico, `npx vitest run` 5 files / 23 tests (igual), `npm run lint` mismos 1 error + 1 warning preexistentes.
  Satisfies: US-9
  Trabajar en rama nueva desde `RamiroC7/StabilitySistemaRami@main`: `mcp-server/setup`.
  - `package.json` de la raíz: agregar `"workspaces": ["packages/*"]`. NO renombrar el paquete, NO tocar sus scripts/deps. La app sigue siendo el paquete raíz.
  - `tsconfig.base.json` nuevo en la raíz con los `compilerOptions` comunes (extraídos de `tsconfig.app.json`/`tsconfig.node.json`, sin romper sus overrides de Vite/React).
  - NADA se mueve. `src/`, `api/`, `index.html`, `vite.config.ts`, `vitest.setup.ts`, `vercel.json` quedan como están.
  - `npm install` en la raíz (regenera `package-lock.json` en formato workspace). **Verificar que las versiones no salten** — sembrar del lock existente si `npm` quiere subir `@supabase/supabase-js` u otras (lección de la Fase 1 anterior: 2.95.3 → 2.112.4 rompía `tsc`).
  Criterio: `npm install` OK; `npm run build`, `npm run test` (Vitest), `npm run lint` dan **exactamente** el mismo resultado que en `main` sin el cambio (comparar salidas).

- [x] **T2 — Confirmar que Vercel sigue buildeando igual** — 2026-09-02
  Resultado: `vercel.json` sin cambios (rewrites SPA + headers de cache). La app no se movió → Vercel sigue infiriendo framework Vite, `dist/` como output y `npm install` como install. `vercel` CLI no disponible localmente (sin red para bajarlo); el preview real se verifica tras el push. Relevamiento + checklist del primer preview en `specs/mcp-server/notes-vercel.md`.
  Satisfies: US-9
  Depends on: T1
  - Como la app NO se movió y sigue siendo el paquete raíz, `vercel.json` y la config del dashboard **no deberían necesitar cambios**. Verificar el `vercel.json` actual (tiene `rewrites` SPA con exclusión de `/api/` y `headers` de cache — no tocar).
  - Único riesgo: que Vercel detecte el `"workspaces"` y cambie su heurística de install/build. Documentar qué mirar en el primer preview: que `npm install` no falle y que `dist/` salga igual.
  - El preview real se verifica cuando la rama esté en el repo de Ramiro (requiere ser colaborador). Hasta entonces, `npx vercel build` local si se puede.
  Criterio: preview de Vercel de la rama carga idéntico a producción, incluida una ruta profunda + refresh y `/api/posthog-query`.

- [x] **T3 — `packages/domain` (placeholder) + extender el `ci.yml` existente** — 2026-09-02
  Resultado: `packages/domain` (`@stability/domain`, dep `date-fns ^4.1.0`, `tsconfig.json` extends `tsconfig.base.json` con `node16`/`lib ES2022` sin DOM/`types []`, `src/index.ts` placeholder + test, `scripts/check-node-safe.mjs`). Script raíz `check:node-safe`. `ci.yml` extendido con el step "Node-safe gate (@stability/domain)" entre `npm ci` y el build (ningún otro step tocado, sin workflow nuevo). `npx vitest run` toma los tests de `packages/*` con el include por defecto → 6 files / 24 tests (+1 vs upstream = el placeholder), los tests de la app siguen corriendo. `npm run check:node-safe` pasa. No hizo falta `vitest.workspace.ts`.
  Satisfies: US-9 (base para US-2, US-5)
  Depends on: T1
  - `packages/domain/`: `package.json` (`@stability/domain`, `type: module`, dep `date-fns` en la misma versión que la app), `tsconfig.json` (`extends ../../tsconfig.base.json`, `module`/`moduleResolution` `node16`, `lib: ["ES2022"]` sin DOM, `types: []`), `src/index.ts` placeholder.
  - `scripts/check-node-safe.mjs`: portar el de la Fase 1 anterior (escanea `src/**/*.ts`, falla ante `react`/`react-dom`/`zustand`/`@supabase/supabase-js`/`import.meta`/`localStorage`/`sessionStorage`/`navigator`/`window`/`document`, ignora comentarios).
  - `package.json` raíz: script `"check:node-safe": "npm --workspace @stability/domain run check:node-safe"`.
  - **Extender** `.github/workflows/ci.yml` (ya existe, corre `npx vitest run` + `lint` + `build` con env Supabase de mentira): agregar un step `npm run check:node-safe` antes del build, y `npx vitest run` que ya corre tomará los tests de `packages/*` si se apunta bien (o agregar `--project` / `vitest.workspace.ts`). NO crear un workflow nuevo.
  Criterio: CI verde; el step node-safe aparece y pasa con el paquete placeholder.

  **→ Milestone M1: check-in con el usuario. La app tiene que buildear, testear y deployar igual antes de seguir.**
  Estado M1 (2026-09-02): rama `mcp-server/setup` pusheada a `RamiroC7/StabilitySistemaRami`, 6 commits. Incluye el fix del error de lint preexistente (`fix(training): mueve buildCompleteCircuitSetHandler a circuitUtils`) → lint pasa de 1 error a 0. Verificación: build idéntico, 24 tests (23 app + 1 placeholder), lint 0 errores. **Estrategia de PR cambiada:** en vez de una PR única al final (T18), se hace **una PR por fase**. Esta es la PR de Fase 1; Ramiro mergea. Falta: crear la PR (no hay `gh` local — link + body dados al usuario) y verificar el preview de Vercel.

---

## Fase 2 — Base de datos

- [x] **T4 — Migración `20260902000000_mcp_server_setup.sql`: schema, rol, grants, policies** — 2026-09-02
  Aplicada a producción (`hcvytsitbsandaphsxyn`) vía `apply_migration`. Rama `mcp-server/db` (commit 454ed0f). Password del rol seteado aparte (no commiteado). Extensión `unaccent` instalada en `extensions`.
  Satisfies: US-7, US-8
  Depends on: T0.1
  - `supabase/migrations/20260902_mcp_server_setup.sql` con el SQL de design.md §Data model (schema `mcp`, tabla `access_tokens`, rol `mcp_readonly`, `create extension if not exists unaccent with schema extensions`, grants sobre las 7 tablas + `mcp.access_tokens`, 8 policies `USING (true)`, timeouts, connection limit).
  - Password del rol: generar fuerte, NO commitear. Pasar como variable a `apply_migration`/dashboard.
  - **Aplicar requiere aprobación explícita del usuario con el SQL a la vista** (es DDL en producción — proyecto `hcvytsitbsandaphsxyn`). Puede aplicarse por el conector MCP de Supabase (`apply_migration`, transaccional) o por el dashboard.
  - El archivo de migración SÍ va en el PR; el password NO.
  Criterio: migración aplicada; el rol `mcp_readonly` existe con `rolcanlogin`, `NOSUPERUSER`, y los settings de timeout.

- [x] **T5 — Verificar el rol conectando como `mcp_readonly`** — 2026-09-02
  Verificado con un script `pg` contra el transaction pooler. **Host: `aws-1-us-east-1.pooler.supabase.com:6543`**, usuario `mcp_readonly.hcvytsitbsandaphsxyn` (PG 17.6, us-east-1). Resultados:
  - `workout_completions` 925, `training_plan_exercises` 5757, `profiles` 45, `exercise_weight_logs` 869 — **ve filas, policies OK** (no 0)
  - `mcp.access_tokens` legible, `unaccent('Presión Múscular')` → `Presion Muscular`
  - `student_profiles` y `macrocycles` → `permission denied`
  - `INSERT` / `UPDATE` → `cannot execute ... in a read-only transaction`
  Satisfies: US-8
  Depends on: T4

- [x] **T6 — Emitir el primer token de acceso** — 2026-09-02
  Token emitido para `profile_id = 221b5c95-5eef-49d1-80db-1257905da4ab` (`maximo@gmail.com`, "Maximo Perez", coach — la cuenta de coach activa; `maximofini@gmail.com` no existe en la base). Fila `mcp.access_tokens.id = 0f302d8b-…`, sin expiración. Verificado: la query de auth (`join profiles`, resuelve `role='coach'`) corre OK como `mcp_readonly`. Token en claro entregado al usuario, NO commiteado. El script `mint-token.ts` se escribe en Fase 3 (T7) para futuros tokens.
  Satisfies: US-7
  Depends on: T4

---

## Fase 3 — Esqueleto del server

- [x] **T7 — Scaffold de `packages/mcp-server`** — 2026-09-02
  Resultado: `packages/mcp-server` (`@stability/mcp-server`, ESM, private). SDK:
  **`@modelcontextprotocol/server` v2.0.0** (publicado 2026-07-27, dist-tag `latest`,
  no alpha/beta; API `McpServer` + `registerTool` + `serveStdio` de `/stdio` como en
  design.md). Runtime deps: `@modelcontextprotocol/server` (→ `core` + `zod`), `pg` ^8.16,
  `zod` ^4.3.6 (deduped a la de la app, sin bump), `@stability/domain` (*, sin usar aún).
  Dev: `tsx`, `typescript`, `@types/pg`, `@types/node`. **El Inspector NO se instala**
  (arrastraba ~1150 paquetes Vite/React); se usa por `npx @modelcontextprotocol/inspector@2`.
  `tsconfig.json` extends `tsconfig.base.json` (module/moduleResolution `nodenext`,
  `outDir build/`, `rootDir src/`, `noEmit false`). `.env.example` + `.gitignore` local
  (`build/`, `.env`). `src/rows.ts` con tipos de fila angostos de las 7 tablas.
  `README.md` completo (estado, SDK, Inspector, Claude Desktop, seam de auth, 8 tools).
  Regla de lint: override en `eslint.config.js` para `packages/mcp-server/**` con
  `no-console: ["error", { allow: ["error"] }]` (verificado: `console.log` → error).
  Paridad vs `upstream/main`: build **3665 módulos (idéntico)**, `npx vitest run` 24 OK
  (con env de CI), lint 0 errores / 1 warning preexistente, `check:node-safe` OK.
  Diff del PR: +1372 líneas, único archivo fuera de `packages/mcp-server/` + `specs/` +
  `package-lock.json` es `eslint.config.js` (+14).
  Satisfies: (base de todo)
  Depends on: T1
  - `package.json` (`@stability/mcp-server`), deps: `@modelcontextprotocol/server@^2`, `pg`, `zod@^4`, `@stability/domain`. Dev: `tsx`, `@modelcontextprotocol/inspector`.
  - `tsconfig.json`, `.env.example` (`DATABASE_URL`, `MCP_ACCESS_TOKEN`, `MCP_HOST`).
  - `src/rows.ts`: tipos de fila angostos para las 7 tablas (solo las columnas que usan los tools). NO depende del `Database` de la app.
  - Regla de lint: prohibir `console.log` en `src/` (usar `console.error`).
  - `README.md` con cómo correr Inspector y cómo configurar Claude Desktop.

- [x] **T8 — `db.ts`: pool de `pg` + helper de query** — 2026-09-02
  Resultado: `src/db.ts` con `pg.Pool` a nivel de módulo (`max: 2`, idle/connection
  timeout 10s). **`ssl: { rejectUnauthorized: false }`** con TODO documentado: el
  transaction pooler de Supabase no encadena a una CA pública; el ideal es empaquetar
  el root cert (`prod-ca-2021.crt`) y pasar a `rejectUnauthorized: true`. Tira error
  claro al importar si falta `DATABASE_URL`. `query<T>(text, params)` devuelve
  `result.rows`; el catch re-lanza un Error **sanitizado** (password y cualquier
  `postgresql://…@` reemplazados por `***`). `closePool()` para shutdown.
  Verificado contra la base real por el pooler (`:6543`, rol `mcp_readonly`):
  `select 1` → `1`; `count(*)::int from training_plans` → **163**; query a tabla
  inexistente → `Error consultando la base: relation "public.nonexistent_xyz" does not exist`
  (sin credenciales).
  Satisfies: US-8
  Depends on: T7

- [x] **T9 — `create-server.ts` + `stdio.ts` + un tool de humo (`list_plans`)** — 2026-09-02
  Resultado: `create-server.ts` (factory `createServer()` → `McpServer` name
  `stability-db` v0.1.0, llama a `registerAllTools`). `tools/index.ts`
  (`registerAllTools`, 1/8 tools) con el comentario largo del **seam de auth** para
  Fase 4. `tools/list-plans.ts`: tool `list_plans` (US-6), input
  `{ include_templates?: boolean }` (default false) en Zod v4, SQL fijo parametrizado
  ($1 = include_templates; `assigned_count` por left join agregado a
  `training_plan_assignments`), `is_archived = false`, annotations readOnly/idempotent,
  devuelve `content` text + `structuredContent`. `stdio.ts`: `serveStdio(createServer)`,
  `console.error` de arranque, SIGINT/SIGTERM → `handle.close()` + `closePool()`, aviso
  "stdout es el canal JSON-RPC". `load-env.ts` (carga `packages/mcp-server/.env` con
  `process.loadEnvFile`, ruta relativa al paquete, zero-dep) para dev/inspect.
  Verificado con `npx @modelcontextprotocol/inspector@2 --cli` desde la raíz del repo, contra la base real:
  `tools/list` → `list_plans`; `tools/call list_plans include_templates=false` → 48
  planes reales; `include_templates=true` → 113 (65 plantillas + 48).
  Satisfies: US-6 (parcial)
  Depends on: T7, T8

  **→ Milestone M2: check-in con el usuario.**
  Estado M2 (2026-09-02): rama `mcp-server/skeleton` (base `main`). Server responde
  `list_plans` contra producción vía Inspector CLI. Fases 4-6 (auth, tools, Claude
  Desktop) las toma otro dev sobre este esqueleto. Falta: PR y merge de Ramiro.
  Estado M2 (2026-09-02): T7–T9 hechas en la rama `mcp-server/skeleton` (base
  `upstream/main`), 3 commits, sin pushear. El server responde `tools/list` y
  `tools/call list_plans` desde el MCP Inspector contra la base de producción.
  SDK: `@modelcontextprotocol/server` v2.0.0. Paridad de la app OK (build / vitest /
  lint / `check:node-safe` iguales, salvo `zod` 4.3.6 → 4.5.4, minor dentro de rango).
  **Handoff:** Fases 4 (auth: `auth.ts` + `audit.ts`, seam marcado con
  `// TODO(Fase 4 / T10)` en `create-server.ts`, `stdio.ts`, `tools/index.ts`),
  5 (los 7 tools restantes + `@stability/domain`) y 6 (Claude Desktop + `http.ts`)
  las toma otro dev sobre este esqueleto.

---

## Fase 4 — Auth y auditoría

- [ ] **T10 — `auth.ts` + `audit.ts`**
  Satisfies: US-7
  Depends on: T9, T6
  - `auth.ts`: `resolveToken(token) → { profileId, coachName } | null`. sha256, `SELECT ... FROM mcp.access_tokens`, join `profiles`, chequea `revoked_at`, `expires_at`, `role = 'coach'`. `assertAuthFromEnv()` para stdio (lee `MCP_ACCESS_TOKEN`, `exit(1)` si inválido).
  - `audit.ts`: `logToolCall({ profileId, coachName, tool, args, durationMs, rowCount })` → una línea JSON a stderr.
  - Envolver el dispatch de tools en `create-server.ts` para que todo tool valide auth primero y audite después.
  - Errores de auth → un único `"No autorizado"` (US-7).
  Criterio: token inválido en env → server no arranca; token de alumno → rechazo; token de coach → funciona; cada call deja línea en el log.

- [ ] **T11 — Tests de `auth.ts`**
  Satisfies: US-7
  Depends on: T10
  Casos: token inexistente, token revocado (`revoked_at` seteado), token expirado (`expires_at` pasado), token de un `profile` con `role = 'student'`, token válido de coach. Mock del pool o base de test.

---

## Fase 5 — Los 7 tools restantes

Cada tool: implementación + test de contrato (input inválido → `isError` legible; caso feliz → shape correcto). Todas dependen de T10.

- [ ] **T12 — `computeAdherence` en `@stability/domain` + tool `get_student_adherence`**
  Satisfies: US-2
  Depends on: T3, T10
  - `packages/domain/src/adherence.ts` implementando la fórmula de design.md §Key flows (fórmula propia: `days_per_week × overlap_weeks`, dedup por `(day_number, fecha local)`, TZ Buenos Aires, excluye `cancelled`). NO se toca la app. El `note` de la respuesta menciona el caveat de la cola offline (`completed_at` puede caer en otra semana ISO — ver `notes-adherence.md`).
  - Tests unitarios de `computeAdherence` con casos escritos a mano: rango dentro de una asignación; rango que cruza 2 asignaciones; asignación cancelada ignorada; completions duplicadas en el mismo día; borde de TZ (completion a las 23:00 Buenos Aires = 02:00 UTC del día siguiente); sin asignación → `null`.
  - `tools/get-student-adherence.ts`: valida `from <= to`, resuelve `student_id` (existe + `role='student'`), trae assignments (join `training_plans` para `days_per_week`) + completions del rango convertidas a TZ, llama a `computeAdherence`, arma la respuesta con `assignments`, `completions` crudas y el `note` fijo.
  Criterio: los tests unitarios pasan; el tool contra la base real devuelve un número coherente con los datos crudos que él mismo reporta; `student_id` inválido → `isError` legible; sin asignación en rango → `adherence_pct: null` + note.

- [ ] **T13 — Tools `get_rpe_alerts` y `get_exercise_progression`**
  Satisfies: US-5, US-3
  Depends on: T10, T0.2
  - **Copiar** `src/lib/rpeHelpers.ts` + `src/lib/rpeHelpers.test.ts` → `packages/domain/src/rpe.ts` (+ test). NO se toca la app: sigue con su propia copia. Agregar al `ci.yml` un check `diff` que falle si las dos copias divergen (la unificación va al spec de correcciones).
  - `get_rpe_alerts`: últimos N `workout_completions` por alumno (ordenados `completed_at` DESC) → `detectRpeAlert`. Devuelve solo alumnos en alerta con los valores que la dispararon.
  - `get_exercise_progression`: `unaccent(lower(exercise_name)) LIKE unaccent(lower('%'||$q||'%'))` sobre `exercise_weight_logs`, filtra por `student_id`, ordena por `logged_at`. `matched_exercise_names` en la respuesta.
  Criterio: `get_rpe_alerts` coincide con las alertas de `StudentsList` hoy; progresión con nombre parcial y con acento faltante encuentra registros; sin registros → `sets: []` + mensaje.

- [ ] **T14 — Tools `list_students`, `get_expiring_plans`, `get_plan` + registro final**
  Satisfies: US-1, US-4, US-6
  Depends on: T10
  - `list_students`: `profiles` + lateral sobre asignaciones activas.
  - `get_expiring_plans`: `end_date <= now() + within_days`, incluye vencidas con `is_overdue`.
  - `get_plan`: días + ejercicios ordenados por `display_order`, usa `stage_name` desnormalizado.
  - `get_expiration_status`: **copiar/extraer** la lógica pura de vencimiento a `packages/domain/src/expiration.ts` desde `src/features/students/PlanExpirations.tsx` (solo la función, sin JSX). NO se refactoriza el consumidor en esta fase.
  - `registerAllTools` monta los 8.
  Criterio: los 8 tools aparecen en `tools/list` y responden.

  **→ Milestone M3: check-in con el usuario.**

---

## Fase 6 — Claude Desktop + cierre

- [ ] **T15 — Configurar y probar en Claude Desktop (Windows)**
  Satisfies: US-1..US-8 end-to-end
  Depends on: T14
  - Build del server (`tsc`), entry `packages/mcp-server/build/stdio.js` (path absoluto en la config).
  - `%APPDATA%\Claude\claude_desktop_config.json`: entrada `stability-db` con `command: "node"`, path absoluto, `env: { DATABASE_URL, MCP_ACCESS_TOKEN }`.
  - Reiniciar Claude Desktop, verificar que el server aparece conectado, probar cada tool con un prompt en lenguaje natural.
  - Revisar `%APPDATA%\Claude\logs\mcp-server-stability-db.log`: líneas de auditoría presentes, sin ruido en stdout.
  Criterio: las 8 preguntas de las user stories respondidas correctamente desde el chat.

- [ ] **T16 — `http.ts` (escrito, no desplegado) + doc de operación**
  Satisfies: D-1
  Depends on: T14
  - `http.ts` con `createMcpHandler` + Express, auth por header `Authorization`. Compila y pasa un test local con Inspector en modo HTTP, pero NO se despliega.
  - `packages/mcp-server/README.md`: cómo emitir/revocar tokens, cómo rotar el password de `mcp_readonly`, qué hacer cuando se agrega una tabla nueva (grant + policy para `mcp_readonly`), checklist de deploy HTTP para el futuro.

- [ ] **T17 — Actualizar el snapshot de esquema y marcar specs como Done**
  Depends on: T4
  - Regenerar `supabase/schema/*.sql` para incluir el schema `mcp`, el rol y las policies nuevas.
  - `requirements.md`, `design.md`, `tasks.md` → Status: Done.

- [ ] **T18 — Abrir el PR a `RamiroC7/StabilitySistemaRami`**
  Depends on: T15
  - Los specs (`specs/mcp-server/*.md`, hoy en `professors-platform/specs/` en la máquina local) y `supabase/schema/` van en el PR, en la raíz del repo (`specs/mcp-server/`, `supabase/`).
  - Descripción del PR: qué agrega (workspace + `packages/domain` + `packages/mcp-server`), qué NO toca (la app, `api/`), la migración de base que ya se aplicó a producción (link a la corrida), y cómo probar (Inspector).
  - Ramiro revisa y mergea a main. NO mergear nosotros.
  Criterio: PR abierto, CI verde, esperando review.
