# @stability/gym-owner-mcp

Server MCP **remoto**, hosteado en Vercel, que le permite a los coaches de
Stability consultar en lenguaje natural (desde Claude Desktop, claude.ai o
mobile) los datos de entrenamiento del gimnasio — alumnos, planes, adherencia,
progresión — con acceso **estrictamente de solo lectura garantizado a nivel de
Postgres**, no por convención de código ni por confianza en el modelo.

Es un sistema **separado** de `packages/mcp-server` (rol `mcp_readonly`,
transport stdio, uso interno con token personal). Se evaluó reusarlo y se
decidió conscientemente construir uno aparte: el acceso de los coaches es un
producto distinto (varios coaches, sin terminal, identidad individual vía
OAuth, conector remoto). Ver
[`docs/gym-owner-mcp-access.md`](../../docs/gym-owner-mcp-access.md) §"Relación
con `packages/mcp-server`" para el detalle completo de esa decisión.

## Arquitectura

Streamable HTTP (`mcp-handler`, modo stateless) sobre Vercel Node Functions.
El server implementa su propia Authorization Server OAuth 2.1 (PKCE + Dynamic
Client Registration) porque Supabase Auth no se expone como AS genérico para
terceros — la identidad se verifica delegando a `GET /auth/v1/user` de
Supabase Auth, y el server mapea esa identidad a `profiles` antes de emitir su
propio token. Los datos se leen con el rol `gym_owner_readonly`
(`BYPASSRLS` + solo `SELECT`); la contabilidad propia del server (clientes
OAuth, tokens, auditoría) vive en el schema `gym_mcp` con el rol
`gym_mcp_service`, separado y sin ningún acceso a `public`.

Detalle completo (diagramas, contratos de cada endpoint, modelo de datos,
trade-offs): [`specs/gym-owner-mcp-vercel/design.md`](../../specs/gym-owner-mcp-vercel/design.md).

## Cómo correr local

```bash
cp packages/gym-owner-mcp/.env.example packages/gym-owner-mcp/.env
```

Completar en `.env`:

| Variable | Para qué |
|---|---|
| `GYM_OWNER_RO_DATABASE_URL` | connection string del rol `gym_owner_readonly` (transaction pooler, `:6543`). |
| `GYM_MCP_SERVICE_DATABASE_URL` | connection string del rol `gym_mcp_service` (schema `gym_mcp`: tokens OAuth + audit log). |
| `SUPABASE_URL` | URL del proyecto Supabase real, para el login OAuth y la verificación server-side de sesión. |
| `SUPABASE_ANON_KEY` | anon key del mismo proyecto (pública, la que ya usa la app). |
| `GYM_OWNER_MCP_ALLOWED_HOSTS` | opcional en local (el allowlist de host/origin ya acepta `localhost` por default). Necesaria en producción — ver más abajo. |

`npm install` se corre desde la raíz del repo (workspace).

```bash
npm --workspace @stability/gym-owner-mcp run dev:http   # levanta en http://localhost:8788/mcp
```

Puerto configurable con `GYM_OWNER_MCP_HTTP_PORT` (default `8788`).

### Probar con el MCP Inspector

```bash
npx @modelcontextprotocol/inspector@2 --cli --transport http \
  --server-url http://localhost:8788/mcp --method tools/list
```

Esto lista `query_gym_data`. Para probar `tools/call` hace falta un
`access_token` válido (`Authorization: Bearer <token>`) — el Inspector solo
no completa el login.

**El flujo OAuth completo (DCR → `/authorize` con login real → code → token)
no se puede probar de punta a punta solo con el Inspector**: `/authorize`
sirve una página HTML con `supabase-js` que necesita un browser real para el
login. Para validar el flujo completo, usar el deploy real con Claude
Desktop/claude.ai directamente (agregar el conector con la URL de producción),
o levantar `/authorize` en un browser a mano siguiendo los query params de
`design.md` §Interfaces.

## Deploy a Vercel

Proyecto **standalone**: se deploya directo desde `packages/gym-owner-mcp/`
con `vercel deploy` (no vía el mecanismo de "Root Directory" de un monorepo
vinculado a Git), para no tocar el `vercel.json`/build de la app principal.
`vercel.json` reescribe todo el tráfico a `/api/handler` (una sola Node
Function, `api/handler.ts`, que delega a `handleRequest` de
`src/request-handler.ts` — la misma lógica de ruteo que usa el bootstrap
local `src/http.ts`, sin duplicarla). No puede ser Edge Function: el
Authorization Server usa `node:crypto` (`createHash`/`randomBytes`), no
soportado completo en runtime Edge.

El `tsconfig.json` del paquete es **autocontenido** (no extiende
`../../tsconfig.base.json` como el resto de los paquetes del monorepo) porque
Vercel compila `packages/gym-owner-mcp/` de forma aislada — un tsconfig que
depende de un archivo fuera de ese directorio no resuelve en el build de
Vercel. `api/` queda deliberadamente fuera del `include` de ese tsconfig
(tiene `rootDir: "src"` para que `npm run build` local siga emitiendo a
`build/`); Vercel compila `api/*.ts` con su propio builder (`@vercel/node`),
así que no hace falta que esté incluido para que el deploy funcione.

Comandos reales usados:

```bash
vercel link --yes
# por stdin, NUNCA como argumento de CLI (para no dejar secretos en el historial de shell):
vercel env add GYM_OWNER_RO_DATABASE_URL production
vercel env add GYM_MCP_SERVICE_DATABASE_URL production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add GYM_OWNER_MCP_ALLOWED_HOSTS production
vercel deploy --prod --yes
```

Las 5 env vars de producción son las mismas de la tabla de arriba;
`GYM_OWNER_MCP_ALLOWED_HOSTS` en producción está seteada al hostname pelado
del deploy (sin protocolo), coma-separado si hay más de uno.

## Bugs reales encontrados en el primer deploy

Ninguno se manifestaba en local (`tsx src/http.ts`) ni en los tests con
mocks — solo aparecieron contra el deploy real de Vercel:

1. **Host/Origin rechazados con 403.** El allowlist de
   `hostHeaderValidationResponse`/`originValidationResponse` solo tenía
   `localhost`. Fix: `GYM_OWNER_MCP_ALLOWED_HOSTS` (hostnames pelados,
   coma-separados) se suma a ese allowlist.
2. **`POST` con body real se colgaba indefinidamente**, sin error ni timeout
   visible. Causa: pasar `Readable.toWeb(req)` como `body` de un `Request`
   web-standard y después llamar `.json()`/`.text()` sobre esa request nunca
   resuelve en el runtime Node de Vercel (sí funciona en `node:http` local —
   por eso no se detectó antes). **Advertencia para quien toque
   `request-handler.ts`:** `toWebRequest` buferea el body entero a mano
   (`req.on('data'|'end')`) en vez de pasarlo como stream — no volver a
   stream sin confirmar que sigue andando en Vercel. De paso se agregó un
   timeout manual de 8s en `db.ts` como red de seguridad para conexiones
   colgadas.
3. **El cliente MCP de Claude manda tráfico a `/`** en vez de `/mcp` si el
   coach pega la URL del conector sin el sufijo. Por eso el server acepta
   ambas rutas como alias.

## Operación

### Generar un password nuevo para un rol (`gym_owner_readonly` / `gym_mcp_service`)

```sql
ALTER ROLE <rol> PASSWORD '<generado>';
```

Vía el conector de Supabase (`execute_sql`/`apply_migration` no sirven para
esto porque corren en transacción read-only) o el dashboard. Después:

```bash
vercel env rm <NAME> production
vercel env add <NAME> production   # por stdin
vercel deploy --prod --yes
```

### Revocar el acceso de un coach puntual

```sql
UPDATE gym_mcp.access_tokens SET revoked_at = now() WHERE coach_profile_id = '<uuid>';
UPDATE gym_mcp.refresh_tokens SET revoked_at = now() WHERE coach_profile_id = '<uuid>';
```

Manual por SQL en esta iteración — decisión consciente documentada en
`design.md` (alcanza con 3 coaches; revisar si escala en Fase 3), no un
permanente.

### Agregar un coach nuevo

Si ya tiene `profiles.role = 'coach'` y no está archivado, alcanza con que
agregue el conector (`https://<deploy>/mcp`) en Claude Desktop o claude.ai y
haga su propio login — no hace falta ninguna acción de infraestructura de
nuestro lado. Si `role` no es `'coach'` (o está archivado),
`/authorize/callback` lo rechaza con `access_denied` sin emitir ningún token.

### Checklist antes de dar acceso real a un coach

De `docs/gym-owner-mcp-access.md` §"Checklist antes de entregar acceso real",
los ítems que ya aplican a este sistema:

- [ ] Password generada por rol, nunca reusada entre `gym_owner_readonly` y `gym_mcp_service`.
- [ ] Password rotada si alguna vez quedó expuesta en texto plano.
- [ ] Test de `DELETE`/`UPDATE`/`INSERT`/DDL desde Claude real → debe fallar a nivel de base.
- [ ] `statement_timeout` configurado en ambos roles.
- [ ] OAuth funcionando end-to-end: un usuario sin token válido no puede llamar ninguna tool.
- [ ] Plan de revocación puntual verificado (ver arriba).

## Qué NO está implementado todavía

- **Reports parametrizados** (SQL fijo para preguntas frecuentes) — Fase 2 de
  `docs/gym-owner-mcp-access.md`. Hoy `query_gym_data` (SQL libre) es el único
  camino.
- **Multi-tenancy real** (más de un gimnasio) — Fase 3. Hoy asume un solo
  gimnasio (Stability) con varios coaches, todos con visibilidad equivalente.
- **Imágenes on-brand (`@vercel/og`) y alertas proactivas por cron** — Fase 3.
- **Rotación automática de `refresh_token`.** `POST /token` con
  `grant_type=refresh_token` devuelve el mismo refresh token que mandó el
  cliente, solo emite un `access_token` nuevo — decisión chica documentada en
  el código (`src/oauth/token.ts`).
- **Límite explícito de filas en `query_gym_data`.** Se confía en el
  `statement_timeout` de 30s del rol `gym_owner_readonly` como única barrera
  de performance; revisar si el volumen crece (ver `design.md` §Open
  questions).

## Fuente de verdad completa

Requirements, diseño y el historial completo de implementación (incluidos los
bugs reales encontrados en cada fase del deploy, en las notas "Resultado:" de
cada task): [`specs/gym-owner-mcp-vercel/`](../../specs/gym-owner-mcp-vercel/).
