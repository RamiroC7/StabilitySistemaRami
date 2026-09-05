# @stability/mcp-server

Servidor **MCP (Model Context Protocol)** de **solo lectura** sobre la base Postgres
de Sistema Alfa (Supabase). Expone un conjunto acotado de tools para que un asistente
(Claude Desktop) responda preguntas sobre alumnos, planes, adherencia, RPE y
vencimientos — sin poder escribir nada.

## Estado (2026-09-03)

| Fase | Qué | Estado |
|------|-----|--------|
| Fase 3 — esqueleto (T7–T9) | scaffold del paquete, `db.ts`, factory + transport stdio, **1 tool** (`list_plans`) | ✅ |
| Fase 4 — auth y auditoría (T10–T11) | `auth.ts` (token → `profiles.id`, exige `role='coach'`), `audit.ts`, envoltura del dispatch en `create-server.ts` | ✅ |
| **Fase 5 — los 6 tools restantes (T12–T14)** | `get_student_adherence`, `get_exercise_progression`, `get_expiring_plans`, `get_rpe_alerts`, `list_students`, `get_plan` + `@stability/domain` | ✅ este entregable |
| Fase 6 — Claude Desktop + HTTP (T15–T16) | config de Claude Desktop, `http.ts` (escrito, no desplegado) | ⬜ pendiente |

### Los 7 tools (design.md §Interfaces)

> Nota: el Overview de `design.md` y algunos comentarios previos hablan de "8 tools";
> la sección §Interfaces (la fuente de verdad de los contratos) define exactamente 7.
> Se implementaron los 7.

| Tool | US | Estado |
|------|----|--------|
| `list_plans` | US-6 | ✅ implementado |
| `get_plan` | US-6 | ✅ implementado |
| `list_students` | US-1 | ✅ implementado |
| `get_student_adherence` | US-2 | ✅ implementado |
| `get_exercise_progression` | US-3 | ✅ implementado |
| `get_expiring_plans` | US-4 | ✅ implementado |
| `get_rpe_alerts` | US-5 | ✅ implementado |

> Deliberadamente **no** hay un tool `run_sql`. Cada tool es una query fija
> parametrizada; el modelo nunca compone SQL. Ver design.md §Trade-offs.

## SDK

Usa **`@modelcontextprotocol/server` v2.0.0** (el paquete "server" del monorepo
`typescript-sdk`, no el viejo `@modelcontextprotocol/sdk` v1). v2 trae:

- factory + `serveStdio(createServer)` de fábrica (una definición de tools, dos transports — stdio hoy, HTTP en T16),
- Zod v4 nativo (el repo ya usa Zod v4),
- `server.registerTool(name, { inputSchema, annotations, ... }, handler)`.

Si v2 diera problemas serios, el fallback es `@modelcontextprotocol/sdk` v1.x con
el patrón manual (`new Server()` + `StdioServerTransport` + `setRequestHandler`).

## Requisitos

- Node ≥ 20 (el repo usa 22).
- El rol `mcp_readonly` y el schema `mcp` ya existen en producción (migración
  `supabase/migrations/20260902000000_mcp_server_setup.sql`, Fase 2, ya aplicada).

## Configuración local

```bash
cp packages/mcp-server/.env.example packages/mcp-server/.env
# editar .env con la connection string real del rol mcp_readonly
```

`.env` (gitignoreado — el patrón `.env` de `.gitignore` de la raíz lo cubre):

| Variable | Para qué |
|----------|----------|
| `DATABASE_URL` | connection string del rol `mcp_readonly` por el **transaction pooler** (`aws-1-us-east-1.pooler.supabase.com:6543`). NO la conexión directa (`:5432`, solo IPv6). |
| `MCP_ACCESS_TOKEN` | (Fase 4) token de acceso personal para modo stdio. Hoy no se valida. |
| `MCP_HOST` | (Fase 4 / T16, HTTP) hosts permitidos para protección de DNS rebinding. |

`npm install` se corre **desde la raíz del repo** (es un workspace).

## Cómo correr

```bash
# desde packages/mcp-server/
npm run dev:stdio     # levanta el server por stdio (para debug manual)
npm run inspect       # abre el MCP Inspector (UI web) apuntando al server
npm run typecheck     # tsc --noEmit
npm run build         # tsc -> build/
```

### Verificar con el Inspector (CLI)

El Inspector **no se instala** como dependencia (arrastra un árbol enorme de Vite/React).
Se usa por `npx` on-demand — el script `npm run inspect` ya lo hace. El comando + args
del server van **antes** de `--method`. `src/stdio.ts` carga `packages/mcp-server/.env`
resuelto relativo al paquete (`src/load-env.ts`), así que corre igual desde la raíz del
repo o desde el dir del paquete.

```bash
npx @modelcontextprotocol/inspector@2 --cli tsx packages/mcp-server/src/stdio.ts --method tools/list
npx @modelcontextprotocol/inspector@2 --cli tsx packages/mcp-server/src/stdio.ts \
  --method tools/call --tool-name list_plans --tool-arg include_templates=false
```

## Claude Desktop

Se configura en **Fase 6 / T15**. Resumen (ver design.md §Key flows y §Componentes):

1. `npm run build` → entry `packages/mcp-server/build/stdio.js` (path absoluto).
2. En `%APPDATA%\Claude\claude_desktop_config.json`:

   ```json
   {
     "mcpServers": {
       "stability-db": {
         "command": "node",
         "args": ["C:\\ruta\\absoluta\\packages\\mcp-server\\build\\stdio.js"],
         "env": {
           "DATABASE_URL": "postgresql://mcp_readonly.<ref>:<pw>@aws-1-us-east-1.pooler.supabase.com:6543/postgres",
           "MCP_ACCESS_TOKEN": "<token emitido en mcp.access_tokens>"
         }
       }
     }
   }
   ```

3. Reiniciar Claude Desktop. Logs en `%APPDATA%\Claude\logs\mcp-server-stability-db.log`.

> ⚠️ **stdout es el canal JSON-RPC.** En `src/` solo se puede loguear con
> `console.error` (stderr). Un `console.log` rompe el protocolo. La regla de lint
> `no-console` del paquete (en `eslint.config.js`) lo prohíbe (`allow: ["error"]`).

## Auth y auditoría (Fase 4 / T10–T11)

`src/auth.ts` expone `resolveToken(token)`: `sha256(token)` →
`SELECT ... FROM mcp.access_tokens JOIN public.profiles`, chequea `revoked_at IS NULL`,
`expires_at` (`NULL` o futuro), y `role = 'coach'`. Cualquier motivo de rechazo
devuelve `null` — nunca se distingue la causa hacia afuera (US-7).

Dos puntos de uso:

- `assertAuthFromEnv()` — la llama `src/stdio.ts` **antes** de abrir el transport.
  Si `MCP_ACCESS_TOKEN` falta, o no resuelve a un coach, loguea el motivo a
  stderr y sale con `process.exit(1)` (Claude Desktop marca el server "failed").
- `guardToolDispatch(server)` en `src/create-server.ts` — envuelve
  `server.registerTool` **antes** de que `registerAllTools` registre ningún
  tool. Cada tool call vuelve a resolver el token (para dejar rastro por
  llamada, no solo al arrancar): si falla, la tool ni se ejecuta y la
  respuesta es `isError: true` con el texto `"No autorizado"`; si pasa, corre
  el handler real y audita con `src/audit.ts`.

`src/audit.ts` — `logToolCall(...)` emite una línea JSON a stderr por cada
tool call exitosa: `{ ts, profile_id, coach_name, tool, args, duration_ms, row_count }`.
`row_count` es best-effort (busca el primer array dentro de `structuredContent`).

Ni `src/tools/index.ts` ni los archivos de `src/tools/*.ts` (ni los que se
agreguen en Fase 5) necesitan importar nada de auth: el envoltorio en
`create-server.ts` es el único punto de intercepción.

**Tests (T11):** `src/auth.test.ts` — token inexistente, revocado, expirado,
de un profile `role='student'`, y token válido de coach. Mockean `./db.js`
(`vi.mock`), así no hace falta `DATABASE_URL` para correrlos.

## Operación

- **Emitir un token:** hoy, a mano — `INSERT INTO mcp.access_tokens (token_hash, profile_id, label) VALUES (sha256(...), '<profile_id de un coach>', '<label>')`
  desde el SQL editor de Supabase (el hash se calcula con `node -e "console.log(require('crypto').createHash('sha256').update('<token-en-claro>').digest('hex'))"`,
  usando el mismo token en claro que despues va en `MCP_ACCESS_TOKEN`). **`scripts/mint-token.ts` (mencionado en design.md) todavía no existe** —
  automatizar esto (generar el token en claro + insertar su hash en un solo paso) queda pendiente, no es parte de T15/T16.
- **Revocar:** `UPDATE mcp.access_tokens SET revoked_at = now() WHERE id = ...`. No requiere redeploy.
- **Rotar la password de `mcp_readonly`:** `ALTER ROLE mcp_readonly WITH PASSWORD '...'` y actualizar `DATABASE_URL` donde esté configurado (Claude Desktop config y/o `.env` del deploy HTTP).
- **Agregar una tabla nueva a un tool futuro:** hace falta `GRANT SELECT ON public.<tabla> TO mcp_readonly` + una policy `FOR SELECT TO mcp_readonly USING (true)` en su propia migración. Sin eso, RLS default-deny devuelve 0 filas.

### Transport HTTP (`http.ts`, Fase 6 / T16) — escrito, NO desplegado

`src/http.ts` es un segundo entrypoint sobre la MISMA factory (`create-server.ts`) que usa
`stdio.ts` — design.md > "Una definición, dos transports" (D-1). Usa la API HTTP real de
`@modelcontextprotocol/server` v2.0.0 (`createMcpHandler`, un handler web-standard
`{ fetch, close }`) montada a mano sobre `node:http` — **no** el paquete
`@modelcontextprotocol/express` que mencionaba el sketch original de `design.md`: ese paquete
no está instalado (ni es dependencia del proyecto); `createMcpHandler` ya expone `fetch(request)`
web-standard y no hace falta Express. La conversión Node ↔ web-standard usa
`stream.Readable.toWeb`/`fromWeb` (Node core, sin dependencia nueva).

Auth por header: `Authorization: Bearer <token>` se resuelve una vez por request con el mismo
`resolveToken` de `auth.ts`, y ante cualquier rechazo responde `401` con el mismo
`UNAUTHORIZED_MESSAGE` opaco que usa stdio (US-7) — **no** se usa el `requireBearerAuth` /
`verifyBearerToken` de la SDK, porque esos están pensados para un Resource Server OAuth de
verdad (formato de error `invalid_token`, `WWW-Authenticate`) y nuestro modelo es un token
personal contra `mcp.access_tokens`, no OAuth. La identidad ya resuelta se pasa a
`createServer(auth)` vía `ctx.authInfo.extra` de `McpServerFactory` — por eso `create-server.ts`
ahora acepta un `authOverride?: ResolvedAuth` opcional (si no se pasa, sigue resolviendo
`MCP_ACCESS_TOKEN` desde el entorno en cada tool call, el comportamiento original de stdio/T10).

Protección DNS-rebinding con los helpers reales de la SDK (`hostHeaderValidationResponse` /
`originValidationResponse`, `localhostAllowedHostnames()` / `localhostAllowedOrigins()`); la
variable `MCP_HOST` (ver `.env.example`) se suma al allowlist para un deploy futuro detrás de
un dominio propio. Puerto: `MCP_HTTP_PORT` (default `8787`).

**Verificado:** `npx tsc --noEmit` y `npx eslint` limpios. **NO verificado:** correrlo de
verdad (`npx tsx src/http.ts`) ni probarlo con el Inspector en modo HTTP — bloqueado en el
entorno donde se escribió por el mismo problema de binarios nativos que bloquea Vitest/tsx ahí
(esbuild para la plataforma equivocada), y además no hay credenciales reales (`DATABASE_URL`)
disponibles en ese entorno. Antes de un deploy real, correr `npx tsx src/http.ts` con un
`.env` válido y probar con `npx @modelcontextprotocol/inspector@2` en modo HTTP contra
`http://localhost:8787/mcp`.

**Checklist para cuando se despliegue de verdad (no antes):**

- [ ] Elegir dónde corre (Vercel function, un servicio siempre-on — el pooler de Supabase
      está pensado para conexiones efímeras, así que una función serverless encaja mejor que
      un proceso long-running con el `pg.Pool` actual de `db.ts`, que asume un único proceso
      de vida corta como stdio; revisar el sizing del pool si el deploy es long-running).
- [ ] `MCP_HOST` al dominio real (ya no `localhost`) para que `hostHeaderValidationResponse`/
      `originValidationResponse` no rechacen el tráfico real.
- [ ] TLS/HTTPS termina antes de llegar a este proceso (no lo hace `http.ts`).
- [ ] Certificado real de Supabase para el pooler: sacar el `rejectUnauthorized: false` de
      `db.ts` (TODO ya documentado ahí) y pasar el cert (`prod-ca-2021.crt`).
      Ver `db.ts`.
- [ ] Automatizar la emisión de tokens (`scripts/mint-token.ts`, todavía no existe).
- [ ] Reevaluar la auditoría (D-3): un deploy HTTP con múltiples réplicas pierde la garantía de
      "un solo log de proceso" que tiene stdio — ver design.md > Trade-offs > "Auditoría (D-3)".
- [ ] Probar con el Inspector en modo HTTP antes de apuntarle un cliente real.

## Estructura

```
packages/mcp-server/
├─ src/
│  ├─ stdio.ts          # entrypoint 1: assertAuthFromEnv() + serveStdio(createServer) + SIGINT/SIGTERM
│  ├─ http.ts           # entrypoint 2 (T16, escrito, NO desplegado): createMcpHandler sobre node:http
│  ├─ load-env.ts       # carga packages/mcp-server/.env (process.loadEnvFile), zero-dep
│  ├─ create-server.ts  # factory createServer(authOverride?) -> McpServer + guardToolDispatch() (auth+auditoría)
│  ├─ auth.ts           # resolveToken(), assertAuthFromEnv(), hashToken() (Fase 4 / T10)
│  ├─ auth.test.ts      # tests de resolveToken (Fase 4 / T11)
│  ├─ audit.ts          # logToolCall() -> línea JSON a stderr (Fase 4 / T10)
│  ├─ db.ts             # pg.Pool a nivel módulo + query<T>() + closePool()
│  ├─ rows.ts           # tipos de fila angostos de las 7 tablas
│  └─ tools/
│     ├─ index.ts                       # registerAllTools(server) — monta los 7
│     ├─ errors.ts                      # toolError() compartido (isError: true)
│     ├─ list-plans.ts                  # tool list_plans (US-6)
│     ├─ get-plan.ts                    # tool get_plan (US-6)
│     ├─ list-students.ts               # tool list_students (US-1)
│     ├─ get-student-adherence.ts       # tool get_student_adherence (US-2)
│     ├─ get-exercise-progression.ts    # tool get_exercise_progression (US-3)
│     ├─ get-expiring-plans.ts          # tool get_expiring_plans (US-4)
│     └─ get-rpe-alerts.ts              # tool get_rpe_alerts (US-5)
├─ .env.example
├─ tsconfig.json        # extends ../../tsconfig.base.json, module nodenext, outDir build/
└─ package.json
```

`src/http.ts` (transport HTTP) es **T16**, no está en este entregable.
