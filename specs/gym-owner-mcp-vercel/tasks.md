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
  `gym_mcp.query_audit_log`. Todavía sin OAuth. ✅ verificado el 2026-09-12.
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

- [x] **T4 — `db.ts`: dos pools de `pg`** (`gym_owner_readonly`,
  `gym_mcp_service`)
  Satisfies: (base de US-1, US-5)
  Depends on: T0
  Notes: mismo criterio que `packages/mcp-server/src/db.ts` — pool a nivel de
  módulo, errores sanitizados (nunca exponer la connection string), TODO
  documentado sobre el cert real del pooler si se usa `rejectUnauthorized:
  false` en el arranque.
  Resultado: creado `packages/gym-owner-mcp/src/db.ts` con dos pools de `pg` a
  nivel de módulo (`gym_owner_readonly` vía `GYM_OWNER_RO_DATABASE_URL`,
  `gym_mcp_service` vía `GYM_MCP_SERVICE_DATABASE_URL`), cada uno falla al
  importar con un mensaje claro si falta su env var. Errores sanitizados
  contra las passwords/connection strings de AMBOS roles (no solo el pool que
  falló). `queryReadonly<T>` / `queryService<T>` devuelven `result.rows` y
  relanzan `Error` sanitizado; `closePools()` cierra ambos. `ssl:
  { rejectUnauthorized: false }` en los dos, con el mismo TODO de seguridad
  sobre el cert real del pooler que `packages/mcp-server/src/db.ts`. Tamaño de
  pool `max: 3` (en vez de `max: 2`) con `idleTimeoutMillis` /
  `connectionTimeoutMillis` de 10s, documentado en comentario: a diferencia
  del stdio efímero de `packages/mcp-server`, acá el módulo puede recibir
  invocaciones serverless concurrentes. También creado
  `packages/gym-owner-mcp/src/load-env.ts` (mismo patrón que
  `packages/mcp-server/src/load-env.ts`), reusable para las tasks de Fase B/C
  que necesiten cargar el `.env` del paquete en dev. Agregadas dependencias
  reales `pg`/`@types/pg` (mismas versiones que `packages/mcp-server`) al
  `package.json` del paquete; `npm install` desde la raíz dejó
  `package-lock.json` con un diff limpio (solo las dos entradas nuevas del
  workspace, sin bump de versiones existentes). Smoke test manual (script
  descartable corrido una vez con `npx tsx` y borrado después, cargando el
  `.env` real del paquete): confirmado — ambos pools conectan contra
  producción y devuelven los conteos esperados (`queryReadonly` sobre
  `public.profiles`, `queryService` con `n = 5` tablas de `gym_mcp`).
  `npm --workspace @stability/gym-owner-mcp run typecheck` sin errores.

- [x] **T5 — `create-server.ts`: factory + `instructions`/`prompts`/`resources`**
  Satisfies: US-9
  Depends on: T4
  Notes: instructions de negocio (qué es Stability, tono), 1 prompt de
  ejemplo ("resumen semanal"), el Brand Brief como resource leyendo un archivo
  estático del repo (sin integración con Plane en esta iteración, por US-9).
  Resultado: creados `packages/gym-owner-mcp/src/types.ts` (tipo
  `CoachIdentity` — `{ profileId, label }`, con comentario explícito de que es
  un placeholder de desarrollo hasta T15, cuando el middleware de auth va a
  resolver la identidad real por request) y
  `packages/gym-owner-mcp/src/create-server.ts` (`createServer(identity)`,
  `identity` obligatorio). Registra `instructions` de negocio (qué es
  Stability, qué tablas hay incluida `student_profiles`, y que las consultas
  quedan auditadas), el prompt `resumen_semanal` (sin argumentos, guía de
  texto que referencia `query_gym_data` sin ejecutar SQL) y el resource
  `brand-brief` (`gym-owner-mcp://brand-brief`) que lee
  `packages/gym-owner-mcp/resources/brand-brief.md` (creado con placeholder:
  título, nota de que la sync con Plane queda fuera de alcance por US-9, y
  secciones vacías `## Tono` / `## Paleta` / `## Terminología`). Todavía NO
  registra tools — el comentario en `createServer` deja explícito que T7 llama
  ahí a `registerQueryGymData(server, identity)`. Agregadas
  `@modelcontextprotocol/server` (2.0.0, misma versión que
  `packages/mcp-server`) y `zod` (^4.3.6) como dependencias reales del
  paquete. `npm --workspace @stability/gym-owner-mcp run typecheck` sin
  errores.

- [x] **T6 — `audit.ts`: log-antes-de-ejecutar, fail-closed**
  Satisfies: US-5
  Depends on: T4, T2
  Notes: `insertAuditRow({coach_profile_id, question, sql})` contra
  `gym_mcp_service` → si falla el insert, propaga el error y **no** se corre
  el SQL de datos. `updateAuditRow(id, {row_count, duration_ms, error})`
  best-effort después de ejecutar (no bloquea la respuesta si falla el
  update).
  Resultado: creado `packages/gym-owner-mcp/src/audit.ts` con
  `insertAuditRow` (INSERT vía `queryService`, devuelve `id`, deja propagar
  cualquier error sin try/catch — es lo que hace fail-closed a US-5) y
  `updateAuditRow` (UPDATE vía `queryService`, try/catch propio que solo hace
  `console.error` si falla, nunca tira). Test `audit.test.ts`
  (`vi.mock("./db.js", ...)`, mismo patrón que `list-students.test.ts`): caso
  feliz de `insertAuditRow` (devuelve el `id`), `insertAuditRow` propaga el
  error si `queryService` rechaza, caso feliz de `updateAuditRow`, y
  `updateAuditRow` no tira si `queryService` rechaza (solo loguea, verificado
  con un spy de `console.error`). `npx tsc --noEmit` y
  `npx vitest run packages/gym-owner-mcp` (4 tests) sin errores.

- [x] **T7 — Tool `query_gym_data`**
  Satisfies: US-1, US-5
  Depends on: T5, T6
  Notes: Zod `{ question: string().min(1), sql: string().min(1) }`; llama
  `audit.ts` antes, corre el SQL contra el pool `gym_owner_readonly`, devuelve
  `{ rows, row_count, truncated: false }` (sin límite de filas explícito en
  esta iteración — ver design.md §Open questions). Tests de contrato: SQL con
  error de sintaxis → `isError` legible sin credenciales; intento de
  `DELETE`/`UPDATE` → falla con el error de Postgres, no con una validación de
  app.
  Resultado: creado `packages/gym-owner-mcp/src/tools/query-gym-data.ts` con
  `createQueryGymDataHandler(identity)` (handler puro, exportado por separado
  de `registerQueryGymData` — mismo patrón que `listStudentsHandler` de
  `packages/mcp-server`) y `registerQueryGymData(server, identity)`. El
  handler llama `insertAuditRow` SIN try/catch (fail-closed: el error se
  propaga y el framework de `@modelcontextprotocol/server` lo convierte en
  `isError` — confirmado leyendo el dispatch real de `tools/call` en
  `node_modules/@modelcontextprotocol/server/dist/mcp-*.mjs`, que envuelve
  `executeToolHandler` en un solo `try/catch` y arma
  `{ isError: true, content: [...] }` con cualquier excepción no atrapada, así
  que no hacía falta armar un try/catch propio para ese paso), corre
  `queryReadonly(sql)`, y llama `updateAuditRow` best-effort tanto en el caso
  feliz como en el de error de SQL. `create-server.ts` (T5) actualizado para
  llamar `registerQueryGymData(server, identity)`, sacando el placeholder.
  Test `query-gym-data.test.ts` (`vi.mock("../db.js", ...)` +
  `vi.mock("../audit.js", ...)` con `vi.hoisted`): caso feliz (row_count
  correcto, `updateAuditRow` con `error: null`); fail-closed — `insertAuditRow`
  rechaza → el handler propaga el error y `queryReadonly` NUNCA se llama
  (`expect(queryReadonlyMock).not.toHaveBeenCalled()`, el test más importante
  de los tres, US-5); `queryReadonly` rechaza → `isError: true`, mensaje sin
  `postgres(ql)?://` ni `password`, y `updateAuditRow` recibe el error.
  `npx tsc --noEmit` y `npx vitest run packages/gym-owner-mcp` (2 archivos, 7
  tests) sin errores. `npm run lint` desde la raíz: 0 errores (mismo warning
  preexistente de `RegisterPage.tsx`, nada nuevo).

- [x] **T8 — Endpoint HTTP con `mcp-handler` (Streamable HTTP stateless)**
  Satisfies: US-1, US-6
  Depends on: T5
  Notes: sin auth todavía (T15 la agrega). Verificar localmente con
  `npx @modelcontextprotocol/inspector@2` contra `http://localhost:<puerto>`.
  Resultado: creado `packages/gym-owner-mcp/src/http.ts`, mismo patrón de
  conversión Node↔web-standard que el sibling `packages/mcp-server/src/http.ts`
  (`toWebRequest`/`sendWebResponse` con `stream.Readable.toWeb`/`fromWeb`, sin
  dependencia nueva) pero sin ninguna lógica de auth (T15 la agrega) — la
  factory de `createMcpHandler` siempre construye el server con la constante
  `DEV_IDENTITY` (`profileId` placeholder
  `00000000-0000-0000-0000-000000000000`, documentada en `types.ts` desde T5).
  `hostHeaderValidationResponse`/`originValidationResponse` con
  `localhostAllowedHostnames()`/`localhostAllowedOrigins()` igual que el
  sibling. Endpoint en `/mcp`, 404 para cualquier otro path. Puerto vía
  `GYM_OWNER_MCP_HTTP_PORT`, default `8788`. Shutdown limpio en SIGINT/SIGTERM
  (`mcpHandler.close()` + `closePools()`, plural, de `db.ts`). Agregado script
  `"dev:http": "tsx src/http.ts"` a `package.json`. `npx tsc --noEmit` sin
  errores. Verificado localmente: `npx tsx src/http.ts` (con el `.env` real)
  levantó y logueó `servidor MCP HTTP escuchando en http://localhost:8788/mcp`;
  un POST `initialize` real por `curl` devolvió `HTTP 200` con
  `serverInfo.name = "gym-owner-mcp"` y las `instructions` de negocio (no
  connection refused). Proceso matado después (`taskkill` sobre el PID que
  escuchaba el puerto 8788, confirmado libre después).

- [x] **T9 — Verificación M1: `query_gym_data` end-to-end contra producción**
  Depends on: T7, T8
  Notes: pregunta real desde el Inspector (ej. "planes activos"), confirmar
  fila en `gym_mcp.query_audit_log` con el SQL real y `row_count` correcto.
  Resultado (2026-09-12): server levantado con `npx tsx src/http.ts`
  (`.env` real) en `http://localhost:8788/mcp`.
  `npx @modelcontextprotocol/inspector@2 --cli --transport http --server-url
  http://localhost:8788/mcp --method tools/list` confirmó `query_gym_data`
  (único tool, con su `inputSchema` real). `tools/call` con
  `question="cuántos planes de entrenamiento activos hay"` y
  `sql="select count(*)::int as activos from public.training_plans where
  is_archived = false"` devolvió `structuredContent = { rows: [{ activos: 142
  }], row_count: 1, truncated: false }`. Confirmada la fila de auditoría con un
  script ad-hoc (`tsx`, reusando `queryService`/`closePools` de `db.ts`,
  borrado después de usarlo): `select question, sql, row_count from
  gym_mcp.query_audit_log where coach_profile_id =
  '00000000-0000-0000-0000-000000000000' order by ts desc limit 1` devolvió
  `question`/`sql` idénticos a los del `tools/call` y `row_count = 1` — coincide
  exactamente. Servidor detenido después (proceso `tsx src/http.ts` matado,
  puerto 8788 confirmado libre).

  **→ Milestone M1: check-in con el usuario. ✅ verificado el 2026-09-12.**

---

## Fase C — Authorization Server OAuth

- [x] **T10 — `gym_mcp.oauth_clients` + `POST /register` (DCR)**
  Satisfies: US-2, US-7
  Depends on: T0, T2
  Notes: cliente público (sin secreto), valida que `redirect_uris` sea
  `https://` (o `http://localhost` para debugging local).
  Resultado: creado `packages/gym-owner-mcp/src/oauth/clients.ts` con
  `registerClient` (valida CADA `redirect_uri` contra `https://` o
  `http://localhost` con cualquier puerto vía `new URL(...)`, tira
  `InvalidRedirectUriError` tipado ANTES de tocar la base si alguna es
  inválida — sin insert parcial; `client_id` random de
  `crypto.randomBytes(16).toString('hex')`; insert vía `queryService`) y
  `findClient` (select por `client_id` vía `queryService`, `null` si no
  existe). Cliente público: la respuesta de `registerClient` siempre trae
  `token_endpoint_auth_method: "none"`. Test `clients.test.ts`
  (`vi.mock("../db.js", ...)`): rechazo de una sola `redirect_uri` inválida,
  rechazo si CUALQUIERA de varias lo es (con assert de que `queryService`
  nunca se llama), rechazo de lista vacía, caso feliz con `https://` +
  `http://localhost:<puerto>` mezclados, `client_name` opcional (null si no
  se manda), y `findClient` feliz/`null`. `npx tsc --noEmit` y
  `npx vitest run packages/gym-owner-mcp` (3 archivos, 14 tests) sin errores.

- [x] **T11 — Endpoints de metadata OAuth**
  Satisfies: US-2, US-7
  Depends on: T0
  Notes: `GET /.well-known/oauth-authorization-server` y
  `/.well-known/oauth-protected-resource`, `code_challenge_methods_supported:
  ["S256"]`.
  Resultado: creado `packages/gym-owner-mcp/src/oauth/metadata.ts` con
  `buildAuthServerMetadata(issuer)` y `buildProtectedResourceMetadata(issuer)`,
  puro cálculo sin DB ni estado — el `issuer` se recibe como parámetro (lo
  calcula `http.ts` a partir de la request real recién en T15, cuando se
  cablean las rutas; este archivo no hardcodea ningún host). Test
  `metadata.test.ts`: shape exacto de ambos objetos para un issuer de
  ejemplo. `npx tsc --noEmit` y `npx vitest run packages/gym-owner-mcp` (4
  archivos, 16 tests) sin errores.

- [x] **T12 — `GET /authorize`: página de login con Supabase Auth**
  Satisfies: US-2, US-7
  Depends on: T10, T11
  Notes: HTML mínimo + `@supabase/supabase-js` client-side con la anon key del
  proyecto real; valida `client_id`/`redirect_uri` contra `oauth_clients`
  antes de mostrar el form.
  Resultado: creado `packages/gym-owner-mcp/src/oauth/authorize-page.ts` con
  `renderAuthorizePage(params)` — HTML standalone (sin build step) que carga
  `@supabase/supabase-js@2` desde jsdelivr ANTES del script inline, un form
  mínimo (email + password), y JS inline que hace
  `signInWithPassword` y, si falla, muestra el error en la página en texto
  plano (sin redirigir); si funciona, hace `POST /authorize/callback` con
  `{ supabase_access_token, client_id, redirect_uri, code_challenge, state }`
  y sigue `redirect_to` de la respuesta JSON con `window.location.href`.
  `client_id`/`state`/etc se interpolan con dos escapes distintos según el
  contexto: `escapeHtml` para los atributos `data-*` del form, `escapeJsString`
  para los literales dentro del `<script>` inline (evita que un `state`
  hostil rompa el string JS o inyecte un `</script>` de cierre). La
  validación de `client_id`/`redirect_uri` contra `oauth_clients` (400 antes
  de renderizar) queda cableada en `http.ts` recién en T15, junto con el resto
  de las rutas — decisión explícita permitida por la nota de la task. Test
  `authorize-page.test.ts` (contenido, no integración): orden CDN-antes-que-
  inline, valores interpolados presentes, POST a `/authorize/callback` +
  `window.location.href`, y que un `state` con `"><script>` no aparece sin
  escapar en el HTML resultante. `npx tsc --noEmit` y
  `npx vitest run packages/gym-owner-mcp` (5 archivos, 21 tests) sin errores.

- [x] **T13 — `POST /authorize/callback`: verificar identidad y emitir código**
  Satisfies: US-2
  Depends on: T12
  Notes: `GET {SUPABASE_URL}/auth/v1/user` con el token de la sesión →
  `SELECT role, is_archived FROM public.profiles WHERE id = $1` (pool
  `gym_owner_readonly`) → si no es coach activo, `403` sin emitir código; si
  es coach, genera `code`, guarda en `gym_mcp.access_grants` (hash, PKCE
  challenge, TTL 5 min), redirect con `?code=...&state=...`.
  Resultado: creados `packages/gym-owner-mcp/src/oauth/verify-supabase-session.ts`
  (`verifySupabaseSession(token, fetchImpl = fetch)` — `GET
  {SUPABASE_URL}/auth/v1/user` con `Authorization`/`apikey`, `fetchImpl`
  inyectable para test sin red real; `null` ante cualquier motivo de rechazo:
  no-ok, sin `id`, red caída, o faltan `SUPABASE_URL`/`SUPABASE_ANON_KEY`) y
  `packages/gym-owner-mcp/src/oauth/authorize-callback.ts` con
  `handleAuthorizeCallback(input, deps)` (función pura con las 4 dependencias
  inyectadas: `verifySupabaseSession`, `findClient`, `queryReadonly`,
  `insertAccessGrant` — así los tests pasan `vi.fn()` fake sin mockear módulos
  enteros), `insertAccessGrant` (implementación real: genera `code` de 32
  bytes hex, lo guarda hasheado sha256 en `gym_mcp.access_grants` con
  `expires_at = now() + 5 minutos`, devuelve el `code` en claro UNA vez) y
  `authorizeCallback` (wiring real para `http.ts`, con las dependencias de
  producción). Orden de validación tal cual el spec: `findClient` +
  `redirect_uri` matchea PRIMERO (400 `invalid_client`, sin llamar a
  Supabase); luego `verifySupabaseSession` (401 `access_denied` si `null`);
  luego `SELECT role, is_archived FROM public.profiles` — decisión chica:
  la query NO trae `first_name`/`last_name` acá (a diferencia del `SELECT`
  sugerido en el prompt/design.md), porque `coach_label` se resuelve aparte
  en T14 en el momento de `/token` — evita pedir columnas que ni siquiera se
  usarían si el flujo termina en `access_denied` en este paso, documentado en
  un comentario. Perfil inexistente, `role != 'coach'`, o `is_archived` → los
  tres devuelven el mismo `access_denied`/403 SIN insertar ningún grant (US-2,
  el criterio más importante de la Fase C). Coach activo → inserta el grant y
  devuelve `{ redirectTo: "<redirect_uri>?code=...&state=..." }`. Test
  `authorize-callback.test.ts` (deps 100% fake, sin `vi.mock` de módulos
  salvo un mock mínimo de `../db.js` para que el import estático de
  `insertAccessGrant`/`authorizeCallback` no reviente por falta de env vars
  en el entorno de test): `client_id`/`redirect_uri` inválido →
  `invalid_client` con `verifySupabaseSession` NUNCA llamado; sesión de
  Supabase inválida → `access_denied` sin insertar grant; `role='student'` →
  `access_denied` sin insertar grant; coach archivado → `access_denied` sin
  insertar grant; perfil inexistente → `access_denied` sin insertar grant;
  coach activo → inserta el grant con los params correctos y devuelve
  `redirectTo` con `code` y `state`. Test `verify-supabase-session.test.ts`
  aparte (`fetchImpl` mockeado con `vi.fn()`, nunca red real): 200 con `id` →
  identidad; no-ok, red caída, sin `id`, o faltan env vars → `null` en los
  cuatro casos (el último sin siquiera llamar a `fetchImpl`). `npx tsc
  --noEmit` y `npx vitest run packages/gym-owner-mcp` (7 archivos, 33 tests)
  sin errores.

- [x] **T14 — `POST /token`: intercambio de código y refresh**
  Satisfies: US-2
  Depends on: T13
  Notes: `authorization_code` (valida PKCE verifier, código no usado ni
  expirado) y `refresh_token`. Emite `access_token` (TTL ~1h) +
  `refresh_token` (TTL ~30 días), ambos hasheados en `gym_mcp.access_tokens` /
  `gym_mcp.refresh_tokens`.
  Resultado: creado `packages/gym-owner-mcp/src/oauth/token.ts` con
  `exchangeAuthorizationCode` (busca el grant por `sha256(code)` en
  `gym_mcp.access_grants` vía `queryService`; `invalid_grant` si no existe,
  `used_at` no es null, expiró, o `client_id`/`redirect_uri` no matchean;
  valida PKCE con `base64url(sha256(codeVerifier)) === code_challenge`
  usando `digest('base64url')` directo de Node, sin reemplazo manual de
  caracteres; marca `used_at = now()` ANTES de emitir tokens para que un
  reintento con el mismo `code` caiga en el chequeo de arriba; resuelve
  `coach_label` con un `SELECT first_name, last_name FROM public.profiles`
  vía `queryReadonly` — sin tocar `access_grants`, que no tiene esa columna;
  emite `access_token`/`refresh_token` de 32 bytes hex cada uno, hasheados
  sha256 en `gym_mcp.access_tokens`/`gym_mcp.refresh_tokens` con TTL de 1h/30
  días) y `refreshAccessToken` (busca por hash en `refresh_tokens`,
  `invalid_grant` si no existe/revocado/expirado/`client_id` no matchea;
  **decisión chica documentada en comentario**: no rotamos el `refresh_token`
  en esta iteración — se devuelve el mismo que mandó el cliente, solo se
  emite un `access_token` nuevo; `coach_label` se re-resuelve en cada
  refresh en vez de guardarse en `refresh_tokens`, para no dejarlo desactualizado
  si el coach cambia de nombre). Test `token.test.ts` (`vi.mock("../db.js")`,
  `code_challenge` real calculado con `createHash('sha256').digest('base64url')`
  sobre un `code_verifier` fijo para que el PKCE matchee de verdad en el caso
  feliz): code válido con PKCE correcto → tokens emitidos con el formato hex
  esperado y el `UPDATE ... set used_at = now()` verificado con el hash
  correcto; code ya usado → `invalid_grant` sin llegar a marcar nada de
  nuevo; `code_verifier` que no matchea → `invalid_grant`; code expirado →
  `invalid_grant`; code inexistente → `invalid_grant`; `client_id` no
  matchea → `invalid_grant`; refresh válido → nuevo `access_token` con el
  mismo `refresh_token`; refresh revocado/expirado/inexistente/`client_id`
  no matchea → `invalid_grant` en los cuatro casos. `npx tsc --noEmit` y
  `npx vitest run packages/gym-owner-mcp` (8 archivos, 44 tests) sin errores.

- [x] **T15 — Middleware de auth para tool calls**
  Satisfies: US-2, US-3
  Depends on: T14, T8
  Notes: envuelve el dispatch de tools (mismo patrón que `guardToolDispatch`
  de `packages/mcp-server`) — resuelve el `Bearer <token>` contra
  `gym_mcp.access_tokens` (hash, no expirado, no revocado) antes de cualquier
  tool call; rechazo opaco sin ejecutar la tool si falla. Test: token
  inexistente/expirado/revocado → rechazado; token válido → pasa
  `coach_profile_id` a `audit.ts`.
  Resultado: creado `packages/gym-owner-mcp/src/oauth/resolve-bearer.ts` con
  `resolveBearerToken(token)` — `sha256(token)` hex → `SELECT coach_profile_id,
  coach_label FROM gym_mcp.access_tokens WHERE token_hash = $1 AND
  revoked_at IS NULL AND expires_at > now()` vía `queryService`; `null` si no
  hay fila (cubre inexistente/revocado/expirado sin distinguirlos, igual que
  el filtro vive en el propio SQL), identity si la hay. Reescrito
  `packages/gym-owner-mcp/src/http.ts`: sacado `DEV_IDENTITY`; `/mcp` ahora
  extrae `Authorization: Bearer <token>`, llama `resolveBearerToken`, y si es
  `null` responde `401 { "error": "No autorizado." }` SIN construir el
  server ni pasarle nada al handler de MCP (mismo patrón `ctx.authInfo.extra`
  que ya usa `packages/mcp-server/src/http.ts` para pasar la identidad ya
  resuelta a `createServer`, sin volver a pegarle a la base por cada tool
  call dentro del mismo request). Cableadas las 6 rutas de T10-T14 en el
  mismo `handleRequest` (ANTES del chequeo de Bearer, que solo aplica a
  `/mcp`): `GET /.well-known/oauth-authorization-server`,
  `GET /.well-known/oauth-protected-resource`, `POST /register`,
  `GET /authorize` (valida `client_id`/`redirect_uri` contra `findClient`
  ANTES de renderizar — 400 sin mostrar el form si no matchean, tal como
  pedía T12), `POST /authorize/callback` (traduce `{ redirectTo }` de
  `authorizeCallback` a `{ redirect_to }` JSON, o `{ error }` con el
  `status` que ya trae el resultado), `POST /token` (soporta
  `application/x-www-form-urlencoded` y JSON en el body, dispatch por
  `grant_type` a `exchangeAuthorizationCode`/`refreshAccessToken`, 400 si el
  resultado trae `error`). `issuerFromRequest` calcula protocolo+host de la
  request real (con `x-forwarded-proto`/`x-forwarded-host` como fuente de
  verdad detrás del proxy de Vercel, y el `localhost:<GYM_OWNER_MCP_HTTP_PORT>`
  que ya arma `toWebRequest` como fallback local) — sin hardcodear ningún
  host, tal como pedía T11. Reusa `toWebRequest`/`sendWebResponse` de T8 para
  todas las rutas nuevas, sin duplicar esa conversión. Actualizado el
  comentario de `CoachIdentity` en `types.ts` (ya no es un placeholder: la
  resuelve `resolveBearerToken` por request) y el docblock de
  `create-server.ts` en consecuencia. Test `resolve-bearer.test.ts`
  (`vi.mock("../db.js", ...)`): token válido → identity correcta (con el
  hash correcto verificado en la llamada a `queryService`); inexistente,
  revocado y expirado → `null` en tres tests separados (cada uno simula que
  el `WHERE` de la query ya excluyó la fila, devolviendo `[]`); token vacío
  → `null` sin llegar a consultar la base. `npx tsc --noEmit` y
  `npx vitest run packages/gym-owner-mcp` (9 archivos, 49 tests) sin
  errores. No se levantó el server localmente para este task (el `.env` real
  no se toca en la Fase C, por instrucción explícita) — la verificación
  end-to-end en memoria queda para T16.

- [x] **T16 — Verificación M2: flujo OAuth completo de punta a punta**
  Depends on: T15
  Notes: contra un cliente de prueba (Inspector con soporte OAuth, o un
  script manual) — DCR → login → code → token → `query_gym_data` exitoso;
  repetir con un token revocado a mano (`UPDATE gym_mcp.access_tokens SET
  revoked_at = now()`) y confirmar rechazo inmediato.
  Resultado (2026-09-12): **verificación 100% con mocks, SIN login real —
  ningún test de esta task, ni de toda la Fase C, se conectó a Supabase Auth
  de verdad, creó una cuenta real, ni usó una password real de ningún
  coach.** Creado `packages/gym-owner-mcp/src/oauth/oauth-flow.test.ts`, un
  test de integración liviano con `gym_mcp.js` mockeado (`vi.mock("../db.js")`
  a nivel de `queryService`/`queryReadonly`) que corre la secuencia completa
  en memoria usando las funciones reales de T10-T15 (no reimplementa nada):
  `registerClient` (DCR) → `handleAuthorizeCallback` con
  `verifySupabaseSession` inyectado como `vi.fn()` fijo que devuelve
  `{ id: '<uuid-fake>' }` (simulando un login ya resuelto, nunca una llamada
  real a `/auth/v1/user`) y el mock de `queryReadonly` devolviendo un perfil
  `role='coach'`/`is_archived=false` → extrae el `code` real de la
  `redirectTo` devuelta → `exchangeAuthorizationCode` con el `code_verifier`
  correcto (PKCE real, calculado con `createHash('sha256').digest('base64url')`,
  no mockeado) → `resolveBearerToken` con el `access_token` recién emitido,
  confirmando que devuelve `{ profileId, label }` con el `coach_profile_id`
  y `coach_label` esperados. Caso negativo: revocación simulada — se mockea
  `queryService` para que el SELECT de `resolveBearerToken` devuelva `[]`
  (tal como pasaría de verdad después de `UPDATE gym_mcp.access_tokens SET
  revoked_at = now() ...`, porque el filtro `revoked_at IS NULL` vive en el
  propio SQL) y se confirma que devuelve `null`. La validación con un coach
  humano real y un cliente MCP real (Claude Desktop/claude.ai) queda
  explícitamente para **T19 (Fase D)** — no se adelantó nada de eso acá, ni
  se tocó el `.env` real del paquete en ningún momento de la Fase C. `npx tsc
  --noEmit` y `npx vitest run packages/gym-owner-mcp` (10 archivos, 51 tests)
  sin errores.

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
