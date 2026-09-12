# Tasks: Acceso read-only de coaches vía MCP remoto en Vercel

**Status:** Approved
**Last updated:** 2026-09-12
**Design:** [design.md](./design.md)

Ordenadas por dependencia. Se marcan `- [x]` a medida que se completan.

> **Nota de ejecución:** cada task de implementación (todo lo de Fase A en
> adelante, no la planificación) se implementa con un subagente dedicado, no
> inline en la sesión principal — pedido explícito de Máximo. Fase A primero,
> en una rama antes de tocar producción; T3 (aplicar la migración) requiere
> aprobación explícita con el SQL a la vista, igual que se hizo con
> `mcp_readonly`.

Milestones de check-in con el usuario:
- **M1** = después de T9: `query_gym_data` responde una pregunta real contra
  producción desde el Inspector local, con fila de auditoría en
  `gym_mcp.query_audit_log`. Todavía sin OAuth.
- **M2** = después de T15: el flujo OAuth completo (DCR → login → code → token)
  funciona de punta a punta contra un cliente de prueba; un token inválido o
  revocado es rechazado.
- **M3** = después de T20: los 3 coaches conectados de forma independiente
  desde Claude real, checklist de seguridad corrido.

---

## Fase A — Workspace y base de datos

- [x] **T0 — Scaffold `packages/gym-owner-mcp` como workspace nuevo**
  Satisfies: US-8
  Notes: `package.json` (`@stability/gym-owner-mcp`, privado), `tsconfig.json`
  extends `tsconfig.base.json`. Como `"workspaces": ["packages/*"]` ya está en
  la raíz, no hay que tocar el `package.json` raíz. Verificar que `npm install`
  desde la raíz sigue sin romper el build/lint/test de la app ni de
  `packages/mcp-server` (misma diligencia que hizo la Fase 1 del spec
  hermano — comparar antes/después).
  Resultado: creados `package.json`, `tsconfig.json`, `src/index.ts`
  (placeholder) y `.gitignore` en `packages/gym-owner-mcp`, sin dependencias
  de runtime (solo `devDependencies`: `@types/node`, `typescript`, mismas
  versiones que `packages/mcp-server`). `npm install` desde la raíz agregó 1
  paquete; `package-lock.json` solo sumó el link del workspace nuevo (más
  metadata `"peer": true` en binarios opcionales de `esbuild`, sin bump de
  versiones). Verificado desde la raíz: `npm run build` (Vite, igual que
  antes), `npm run lint` (0 errores, mismo warning preexistente de
  `RegisterPage.tsx`), `npx vitest run` (17 archivos / 72 tests, igual que
  antes), `npm run check:node-safe` (OK, 10 archivos de `packages/domain`).
  El root `tsconfig.json` (`tsc -b`) no referencia `packages/*`, así que no
  compila el paquete nuevo; se verificó aparte con
  `npm --workspace @stability/gym-owner-mcp run typecheck` y `run build`
  (ambos OK). `packages/mcp-server` y `packages/domain` quedaron intactos.

- [x] **T1 — SQL de la migración: rol `gym_owner_readonly`, schema `gym_mcp`,
  rol `gym_mcp_service`, tablas de `gym_mcp`**
  Satisfies: US-3, US-4
  Depends on: T0
  Notes: un archivo nuevo en `supabase/migrations/` (mismo patrón que
  `20260902000000_mcp_server_setup.sql`), con el SQL completo de
  design.md §Data model. Los passwords de ambos roles se generan aparte y NO
  se commitean (igual que con `mcp_readonly`).
  Resultado: creado `supabase/migrations/20260912000000_gym_owner_mcp_setup.sql`.
  Versión inicial con `CREATE ROLE gym_owner_readonly` + `ALTER TABLE ... OWNER
  TO gym_mcp_service` — **reescrita durante T2** (ver esa nota) porque
  `gym_owner_readonly` ya existía en producción out-of-band y porque `OWNER TO`
  falla si quien migra no es superuser ni miembro del rol nuevo. La versión
  final commiteada usa `ALTER ROLE` para `gym_owner_readonly` y `GRANT`
  explícito (no `OWNER TO`) para las tablas de `gym_mcp` — documentado en el
  docblock del propio archivo.

- [x] **T2 — Aplicar la migración a producción**
  Satisfies: US-3, US-4
  Depends on: T1
  Notes: **requiere aprobación explícita del usuario con el SQL a la vista**
  antes de ejecutar — es DDL sobre `hcvytsitbsandaphsxyn`. Vía
  `apply_migration` (transaccional) o dashboard. El archivo de migración va al
  repo; los passwords no.
  Resultado (2026-09-12): usuario aprobó el SQL a la vista. Al aplicar,
  `apply_migration` rechazó `CREATE ROLE gym_owner_readonly` (`already
  exists`) — el rol ya estaba en producción, creado fuera de esta sesión, con
  `CONNECTION LIMIT 5` / `idle_in_transaction_session_timeout 60s` /
  `search_path public, extensions` (valores de un borrador anterior a
  `design.md`) y password ya seteado, pero **sin ningún `GRANT SELECT`**.
  Confirmado con el usuario (no asumido): se ajustó con `ALTER ROLE` a los
  valores del diseño aprobado y se conservó el password existente en vez de
  recrear el rol. Un segundo intento falló en `ALTER TABLE ... OWNER TO
  gym_mcp_service` (`must be able to SET ROLE`, el rol que migra no es
  superuser ni miembro de `gym_mcp_service`); se resolvió con `GRANT` +
  `ALTER DEFAULT PRIVILEGES` explícitos en vez de `OWNER TO`. Migración
  aplicada con éxito en el tercer intento. Passwords seteados aparte (no en
  el archivo versionado) vía `apply_migration` con un nombre separado
  (`gym_owner_mcp_set_passwords`) porque `execute_sql` corre en transacción
  read-only y no puede correr `ALTER ROLE ... PASSWORD`. `supabase/migrations/
  20260912000000_gym_owner_mcp_setup.sql` reescrito para reflejar el SQL
  realmente aplicado (no el borrador original).

- [x] **T3 — Verificar ambos roles conectando directo**
  Satisfies: US-3, US-4
  Depends on: T2
  Notes: como rol `gym_owner_readonly` — confirmar que ve filas de varias
  tablas de `public` (incluida `student_profiles`, por la decisión de
  alcance), que `INSERT`/`UPDATE`/`DELETE`/`CREATE TABLE` fallan. Como rol
  `gym_mcp_service` — confirmar que puede `INSERT`/`SELECT` en las tablas de
  `gym_mcp`, y que **no** puede leer ninguna tabla de `public` (debe fallar
  con `permission denied for table ...` — tiene `USAGE` de schema por el
  default de Postgres a `PUBLIC`, pero ningún grant de tabla).
  Resultado: verificado con un script `pg` ad-hoc contra el pooler
  (`aws-1-us-east-1.pooler.supabase.com:6543`, borrado después de usarlo por
  llevar los passwords en claro). `gym_owner_readonly`: `profiles` (50),
  `student_profiles` (36), `training_plans` (194) — todas legibles; `INSERT`/
  `UPDATE`/`CREATE TABLE` → `cannot execute ... in a read-only transaction`.
  `gym_mcp_service`: `INSERT`/`SELECT`/`DELETE` en `gym_mcp.oauth_clients` OK
  (fila de prueba insertada y borrada); `SELECT` en `public.profiles` →
  `permission denied for table profiles` (confirma la nota corregida de T1,
  no "for schema"). Los dos roles se comportan exactamente como pide el
  diseño.

---

## Fase B — Skeleton del server MCP (sin auth todavía)

- [ ] **T4 — `db.ts`: dos pools de `pg`** (`gym_owner_readonly`,
  `gym_mcp_service`)
  Satisfies: (base de US-1, US-5)
  Depends on: T0
  Notes: mismo criterio que `packages/mcp-server/src/db.ts` — pool a nivel de
  módulo, errores sanitizados (nunca exponer la connection string), TODO
  documentado sobre el cert real del pooler si se usa `rejectUnauthorized:
  false` en el arranque.

- [ ] **T5 — `create-server.ts`: factory + `instructions`/`prompts`/`resources`**
  Satisfies: US-9
  Depends on: T4
  Notes: instructions de negocio (qué es Stability, tono), 1 prompt de
  ejemplo ("resumen semanal"), el Brand Brief como resource leyendo un archivo
  estático del repo (sin integración con Plane en esta iteración, por US-9).

- [ ] **T6 — `audit.ts`: log-antes-de-ejecutar, fail-closed**
  Satisfies: US-5
  Depends on: T4, T2
  Notes: `insertAuditRow({coach_profile_id, question, sql})` contra
  `gym_mcp_service` → si falla el insert, propaga el error y **no** se corre
  el SQL de datos. `updateAuditRow(id, {row_count, duration_ms, error})`
  best-effort después de ejecutar (no bloquea la respuesta si falla el
  update).

- [ ] **T7 — Tool `query_gym_data`**
  Satisfies: US-1, US-5
  Depends on: T5, T6
  Notes: Zod `{ question: string().min(1), sql: string().min(1) }`; llama
  `audit.ts` antes, corre el SQL contra el pool `gym_owner_readonly`, devuelve
  `{ rows, row_count, truncated: false }` (sin límite de filas explícito en
  esta iteración — ver design.md §Open questions). Tests de contrato: SQL con
  error de sintaxis → `isError` legible sin credenciales; intento de
  `DELETE`/`UPDATE` → falla con el error de Postgres, no con una validación de
  app.

- [ ] **T8 — Endpoint HTTP con `mcp-handler` (Streamable HTTP stateless)**
  Satisfies: US-1, US-6
  Depends on: T5
  Notes: sin auth todavía (T15 la agrega). Verificar localmente con
  `npx @modelcontextprotocol/inspector@2` contra `http://localhost:<puerto>`.

- [ ] **T9 — Verificación M1: `query_gym_data` end-to-end contra producción**
  Depends on: T7, T8
  Notes: pregunta real desde el Inspector (ej. "planes activos"), confirmar
  fila en `gym_mcp.query_audit_log` con el SQL real y `row_count` correcto.

  **→ Milestone M1: check-in con el usuario.**

---

## Fase C — Authorization Server OAuth

- [ ] **T10 — `gym_mcp.oauth_clients` + `POST /register` (DCR)**
  Satisfies: US-2, US-7
  Depends on: T0, T2
  Notes: cliente público (sin secreto), valida que `redirect_uris` sea
  `https://` (o `http://localhost` para debugging local).

- [ ] **T11 — Endpoints de metadata OAuth**
  Satisfies: US-2, US-7
  Depends on: T0
  Notes: `GET /.well-known/oauth-authorization-server` y
  `/.well-known/oauth-protected-resource`, `code_challenge_methods_supported:
  ["S256"]`.

- [ ] **T12 — `GET /authorize`: página de login con Supabase Auth**
  Satisfies: US-2, US-7
  Depends on: T10, T11
  Notes: HTML mínimo + `@supabase/supabase-js` client-side con la anon key del
  proyecto real; valida `client_id`/`redirect_uri` contra `oauth_clients`
  antes de mostrar el form.

- [ ] **T13 — `POST /authorize/callback`: verificar identidad y emitir código**
  Satisfies: US-2
  Depends on: T12
  Notes: `GET {SUPABASE_URL}/auth/v1/user` con el token de la sesión →
  `SELECT role, is_archived FROM public.profiles WHERE id = $1` (pool
  `gym_owner_readonly`) → si no es coach activo, `403` sin emitir código; si
  es coach, genera `code`, guarda en `gym_mcp.access_grants` (hash, PKCE
  challenge, TTL 5 min), redirect con `?code=...&state=...`.

- [ ] **T14 — `POST /token`: intercambio de código y refresh**
  Satisfies: US-2
  Depends on: T13
  Notes: `authorization_code` (valida PKCE verifier, código no usado ni
  expirado) y `refresh_token`. Emite `access_token` (TTL ~1h) +
  `refresh_token` (TTL ~30 días), ambos hasheados en `gym_mcp.access_tokens` /
  `gym_mcp.refresh_tokens`.

- [ ] **T15 — Middleware de auth para tool calls**
  Satisfies: US-2, US-3
  Depends on: T14, T8
  Notes: envuelve el dispatch de tools (mismo patrón que `guardToolDispatch`
  de `packages/mcp-server`) — resuelve el `Bearer <token>` contra
  `gym_mcp.access_tokens` (hash, no expirado, no revocado) antes de cualquier
  tool call; rechazo opaco sin ejecutar la tool si falla. Test: token
  inexistente/expirado/revocado → rechazado; token válido → pasa
  `coach_profile_id` a `audit.ts`.

- [ ] **T16 — Verificación M2: flujo OAuth completo de punta a punta**
  Depends on: T15
  Notes: contra un cliente de prueba (Inspector con soporte OAuth, o un
  script manual) — DCR → login → code → token → `query_gym_data` exitoso;
  repetir con un token revocado a mano (`UPDATE gym_mcp.access_tokens SET
  revoked_at = now()`) y confirmar rechazo inmediato.

  **→ Milestone M2: check-in con el usuario.**

---

## Fase D — Deploy y validación con clientes reales

- [ ] **T17 — Alta del proyecto de Vercel**
  Satisfies: US-6, US-8
  Depends on: T9, T16
  Notes: proyecto nuevo, root directory `packages/gym-owner-mcp`, región
  `us-east-1`. Env vars: connection strings de ambos roles,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Ningún secreto en el repo.

- [ ] **T18 — Deploy a producción y smoke test del endpoint**
  Depends on: T17
  Notes: confirmar que los endpoints de metadata OAuth y el endpoint MCP
  responden por HTTPS en la URL real de Vercel.

- [ ] **T19 — Conectar a Máximo como primer coach real desde Claude**
  Satisfies: US-1..US-9 end-to-end
  Depends on: T18
  Notes: agregar el conector remoto en Claude Desktop o claude.ai pegando la
  URL, completar el login OAuth, y validar en lenguaje natural cada
  acceptance criterion relevante de US-1 a US-9 ("the last mile" — el
  equivalente a T15 del spec hermano).

- [ ] **T20 — Checklist de seguridad**
  Satisfies: US-3
  Depends on: T19
  Notes: desde Claude real, intentar un `DELETE`/`UPDATE`/`INSERT`/`CREATE
  TABLE` vía `query_gym_data` → confirmar que los 4 fallan a nivel de base;
  confirmar que ninguna respuesta ni mensaje de error expone una connection
  string o password.

- [ ] **T21 — Onboardear a los otros 2 coaches**
  Satisfies: US-2
  Depends on: T20
  Notes: cada uno hace su propio DCR + login (no comparten token); confirmar
  en `gym_mcp.query_audit_log` que las preguntas de cada coach quedan
  atribuidas a su propio `coach_profile_id`.

  **→ Milestone M3: check-in con el usuario.**

---

## Fase E — Cierre

- [ ] **T22 — README de `packages/gym-owner-mcp`**
  Notes: cómo correr local (Inspector), env vars necesarias, cómo generar un
  password de rol nuevo, cómo revocar el acceso de un coach (SQL manual),
  checklist de deploy.

- [ ] **T23 — Marcar los specs como Done**
  Depends on: T21
  Notes: `requirements.md` y `design.md` de esta feature → `Status: Done`;
  actualizar la tabla de estado en `docs/gym-owner-mcp-access.md` (Fase 1 →
  Implementada).
