# @stability/mcp-server

Servidor **MCP (Model Context Protocol)** de **solo lectura** sobre la base Postgres
de Sistema Alfa (Supabase). Expone un conjunto acotado de tools para que un asistente
(Claude Desktop) responda preguntas sobre alumnos, planes, adherencia, RPE y
vencimientos — sin poder escribir nada.

## Estado (2026-09-02)

| Fase | Qué | Estado |
|------|-----|--------|
| **Fase 3 — esqueleto (T7–T9)** | scaffold del paquete, `db.ts`, factory + transport stdio, **1 tool** (`list_plans`) | ✅ este entregable |
| Fase 4 — auth y auditoría (T10–T11) | `auth.ts` (token → `profiles.id`, exige `role='coach'`), `audit.ts`, envoltura del dispatch | ⬜ otro dev |
| Fase 5 — los 7 tools restantes (T12–T14) | `get_student_adherence`, `get_exercise_progression`, `get_expiring_plans`, `get_rpe_alerts`, `list_students`, `get_plan` + `@stability/domain` | ⬜ otro dev |
| Fase 6 — Claude Desktop + HTTP (T15–T16) | config de Claude Desktop, `http.ts` (escrito, no desplegado) | ⬜ otro dev |

### Los 8 tools planeados (design.md §Interfaces)

| Tool | US | Estado |
|------|----|--------|
| `list_plans` | US-6 | ✅ implementado |
| `get_plan` | US-6 | ⬜ T14 |
| `list_students` | US-1 | ⬜ T14 |
| `get_student_adherence` | US-2 | ⬜ T12 |
| `get_exercise_progression` | US-3 | ⬜ T13 |
| `get_expiring_plans` | US-4 | ⬜ T14 |
| `get_rpe_alerts` | US-5 | ⬜ T13 |

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

El comando + args del server van **antes** de `--method` (así los parsea el CLI del
Inspector). `src/stdio.ts` carga `.env` del cwd solo (`src/load-env.ts`).

```bash
cd packages/mcp-server
npx @modelcontextprotocol/inspector --cli tsx src/stdio.ts --method tools/list
npx @modelcontextprotocol/inspector --cli tsx src/stdio.ts \
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

## Dónde va la auth (Fase 4 / T10)

El **seam** está marcado con `// TODO(Fase 4 / T10)` en:

- `src/create-server.ts` — punto de intercepción del dispatch (validar token antes, auditar después).
- `src/stdio.ts` — `assertAuthFromEnv()` antes de `serveStdio`: si `MCP_ACCESS_TOKEN` falta o es inválido → `console.error` + `process.exit(1)`.
- `src/tools/index.ts` — nota sobre las dos formas de envolver los handlers.

`auth.ts` debe: `sha256(token)` → `SELECT ... FROM mcp.access_tokens WHERE token_hash=$1`,
join `profiles`, chequear `revoked_at IS NULL`, `expires_at`, y `role = 'coach'`.
Cualquier fallo → un único error `"No autorizado"` (US-7).

## Operación (para más adelante)

- **Emitir un token:** `scripts/mint-token.ts` (se escribe en Fase 4). Inserta en
  `mcp.access_tokens` el `sha256` del token en claro y devuelve el token una sola vez.
- **Revocar:** `UPDATE mcp.access_tokens SET revoked_at = now() WHERE id = ...`. No requiere redeploy.
- **Rotar la password de `mcp_readonly`:** `ALTER ROLE mcp_readonly WITH PASSWORD '...'` y actualizar `DATABASE_URL` donde esté configurado.
- **Agregar una tabla nueva a un tool futuro:** hace falta `GRANT SELECT ON public.<tabla> TO mcp_readonly` + una policy `FOR SELECT TO mcp_readonly USING (true)` en su propia migración. Sin eso, RLS default-deny devuelve 0 filas.

## Estructura

```
packages/mcp-server/
├─ src/
│  ├─ stdio.ts          # entrypoint: serveStdio(createServer) + SIGINT/SIGTERM
│  ├─ load-env.ts       # carga .env del cwd (process.loadEnvFile), zero-dep
│  ├─ create-server.ts  # factory createServer() -> McpServer  (seam de auth acá)
│  ├─ db.ts             # pg.Pool a nivel módulo + query<T>() + closePool()
│  ├─ rows.ts           # tipos de fila angostos de las 7 tablas
│  └─ tools/
│     ├─ index.ts       # registerAllTools(server)
│     └─ list-plans.ts  # tool list_plans (US-6)
├─ .env.example
├─ tsconfig.json        # extends ../../tsconfig.base.json, module nodenext, outDir build/
└─ package.json
```

`src/http.ts` (transport HTTP) es **T16**, no está en este entregable.
