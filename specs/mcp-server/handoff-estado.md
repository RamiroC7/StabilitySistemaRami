# MCP Server — estado real vs. planificación inicial

**Fecha:** 2026-09-06
**Para:** dev que continúa el trabajo del MCP server
**Specs de referencia:** [requirements.md](./requirements.md) · [design.md](./design.md) · [tasks.md](./tasks.md)

---

## Veredicto corto

**El protocolo MCP nunca llegó a producción — pero eso tampoco era el objetivo de este spec.**
La Fase 2 apuntaba a un server **stdio, local, en la máquina del coach, contra Claude Desktop**
(uso personal, no infraestructura de producción). El deploy HTTP estaba explícitamente
diferido (D-1) "hasta que exista un segundo consumidor".

Lo que sí pasó y **no** estaba planeado: el **chat embebido en la PWA** — que en el spec era
un *futuro consumidor* del MCP server (goal #3) — se construyó por afuera
(`api/ai-chat.js`, commit `d9ce31a`), **sin usar el MCP server ni `@stability/domain`**,
con Gemini y `supabase-js` directo. Eso es lo que llegó a los coaches en producción.

Resultado: el MCP server quedó **terminado, testeado y mergeado a `main`… y sin nadie que
lo consuma**. Funciona, pero está desenchufado.

---

## HECHO (todo mergeado a `main`, PRs #3 y #5)

| Plan | Estado |
|---|---|
| **Fase 0** — verificar capacidades del rol Postgres, extensión `unaccent`, relevar el cálculo de adherencia de la app | ✅ T0.1–T0.3 |
| **Fase 1** — monorepo sin mover la app: `"workspaces"` en la raíz, `packages/domain`, `packages/mcp-server`, `tsconfig.base.json`, `ci.yml` extendido, gate `check:node-safe` | ✅ T1–T3 (US-9) |
| **Fase 2 — base de datos (aplicada a producción `hcvytsitbsandaphsxyn`)** — migración `20260902000000_mcp_server_setup.sql`: schema `mcp`, tabla `mcp.access_tokens`, rol `mcp_readonly` (`GRANT SELECT` sobre 7 tablas, `default_transaction_read_only = on`, `statement_timeout = 15s`, `connection limit 5`), 8 policies `USING (true)`, extensión `unaccent`. Primer token emitido para el profile de coach `221b5c95-5eef-49d1-80db-1257905da4ab`. | ✅ T4–T6 (US-7, US-8) |
| **Fase 3 — esqueleto** — `db.ts` (pool `pg` a nivel de módulo, por el transaction pooler `:6543`), `create-server.ts` (factory), `stdio.ts`, tool de humo `list_plans` | ✅ T7–T9 |
| **Fase 4 — auth y auditoría** — `auth.ts` (`resolveToken`: sha256 → `mcp.access_tokens` JOIN `profiles`, exige `role = 'coach'`, rechazo opaco `"No autorizado"` sin distinguir causa; `assertAuthFromEnv` en el arranque de stdio → `exit(1)` si falla), `audit.ts` (línea JSON a stderr por cada tool call exitosa), seam `guardToolDispatch` que envuelve `registerTool` antes de registrar tools + tests (`auth.test.ts`, 8 casos) | ✅ T10–T11 (US-7) |
| **Fase 5 — los 7 tools** — `list_students`, `get_student_adherence`, `get_exercise_progression`, `get_expiring_plans`, `get_rpe_alerts`, `list_plans`, `get_plan`. Cada uno con query SQL fija parametrizada (**no hay `run_sql`**) + test de contrato. `@stability/domain`: `computeAdherence`, `rpe.detectRpeAlert` (copia con gate `diff` en CI), `getExpirationStatus`, helpers `timezone.ts` | ✅ T12–T14 (US-1..US-6) |
| **T16 — transport HTTP** — `http.ts` escrito: `createMcpHandler` de la SDK montado a mano sobre `node:http` (sin Express — el paquete del sketch no existía), auth por `Authorization: Bearer`, protección DNS-rebinding con los helpers reales de la SDK. **Escrito, NO desplegado** (como pedía el plan). | ✅ T16 (D-1) |
| Bug real encontrado y corregido en el camino: milisegundos en `timezone.ts` + mocks sin resetear + el build compilaba los tests | ✅ commit `20db892` |
| `.mcp.json` en la raíz con el **Supabase MCP hosted** (read-only, feature `database`) para uso desde Claude Code | ✅ — es MCP "en uso", pero es el de Supabase, no el server propio, y es herramienta de dev |

**Cobertura de user stories:** US-1 a US-9 implementadas y testeadas a nivel de contrato.
El código sigue el diseño casi al pie de la letra. Única desviación documentada: `http.ts`
sin Express (ver el docblock del archivo y el README).

---

## NO HECHO

| Plan | Estado | Impacto |
|---|---|---|
| **T15 — configurar Claude Desktop y validar las user stories end-to-end** desde el chat en lenguaje natural | ❌ pendiente | **El server nunca se probó contra un cliente MCP real**, solo con el MCP Inspector CLI (`npx @modelcontextprotocol/inspector@2 --cli`). Es "the last mile". |
| **T17 — regenerar el snapshot de esquema** (`supabase/schema/*.sql`) con el schema `mcp`, el rol y las policies + marcar los 3 specs como `Done` | ❌ | Los specs siguen en `In progress` / `Approved`. |
| **T18 — PR final descriptivo** a `RamiroC7/StabilitySistemaRami` | ⚠️ parcial | Se cambió la estrategia a "una PR por fase" (#3, #5) y se mergearon; nunca hubo el PR de cierre con la descripción completa. |
| **Deploy del transport HTTP** (D-1: Railway/Fly cuando aparezca un 2º consumidor) | ❌ | Diferido a propósito. `http.ts` tiene un checklist de deploy en el README (TLS termina antes del proceso, cert real del pooler `prod-ca-2021.crt`, `MCP_HOST` al dominio real, automatizar la emisión de tokens, reevaluar la auditoría con múltiples réplicas). |
| **`scripts/mint-token.ts`** — emisión de tokens automatizada | ❌ no existe | Los tokens se emiten a mano con `INSERT INTO mcp.access_tokens ...` desde el SQL editor de Supabase (el hash se calcula con `node -e "...createHash('sha256')..."`). |
| **Consumidor #2 — worker de cron / digest automático** | ❌ | Era goal #3. Fuera de alcance de este spec, pero es la razón de ser del diseño factory/reutilizable. |
| **Consumidor #3 — chat en la PWA** | ⚠️ se hizo, pero **sin el MCP** | Ver "La desviación que importa". |
| **La app adopta `computeAdherence` / unifica `rpeHelpers`** | ❌ | La PWA sigue con `calculateWeekAttendance` (denominador bugueado, `total_days` como días/semana). Estaba diferido al "spec de correcciones", que todavía no existe. |
| **`db.ts` con cert real** (`rejectUnauthorized: false` hoy) | ❌ | TODO documentado en `db.ts`. Aceptable para stdio local; obligatorio antes de un deploy HTTP. |

---

## La desviación que importa

El spec vendía el MCP server como **"pieza reutilizable: los mismos tools servirán después a
un digest por cron y a un chat embebido en la PWA"** (Summary + goal #3).

Cuando llegó el momento del chat en la PWA (`api/ai-chat.js`, commit `d9ce31a`), **no se
reusó nada**:

- No habla MCP — es una Vercel Serverless Function HTTP común.
- No usa `packages/mcp-server` ni `@stability/domain`.
- Reimplementa el "solo lectura" desde cero (lista blanca de tablas `ALLOWED_TABLES` + regex
  `WRITE_INTENT_RE` anti-escritura) en vez de apoyarse en el rol `mcp_readonly`.
- Usa **Gemini** (`gemini-3.5-flash-lite`, nivel gratis) en vez del stack MCP/Anthropic.
- El acceso a datos es `supabase-js` con el **JWT del coach logueado** → RLS de la app aplica
  (cada coach ve lo suyo). El MCP server, en cambio, usa policies `USING (true)` ("todos los
  coaches ven todo").
- **Expone `student_profiles` (PII)**, que el MCP server excluye a propósito de los grants.
  (Decisión explícita de Ramiro el 5-sep: "que no tome nada como sensible, pero que no borre
  ni escriba".)

### Las tres piezas que terminaron conviviendo

| Pieza | Protocolo | Modelo | Acceso a datos | Estado |
|---|---|---|---|---|
| `packages/mcp-server` | MCP (stdio) | el cliente que lo use | `pg` + rol `mcp_readonly`, 7 tablas, 7 tools fijos | build completo, **sin cablear a ningún cliente**; HTTP sin desplegar |
| `.mcp.json` → Supabase hosted MCP | MCP (http) | Claude Code / Desktop | Supabase hosted, feature `database`, read-only | activo como herramienta de dev |
| `api/ai-chat.js` | HTTP normal (no MCP) | Gemini flash-lite | `supabase-js` + JWT del coach (RLS) | **en producción, es lo que usan los coaches** |

---

## Cómo probar el MCP server hoy (sin Claude Desktop)

Se puede levantar desde una sesión de **Claude Code** como server MCP stdio. Pasos:

1. **Build:** `cd packages/mcp-server && npm run build` → genera `build/stdio.js`.
2. **Credenciales:** crear `packages/mcp-server/.env` (gitignoreado) a partir de `.env.example`:
   - `DATABASE_URL` — connection string del rol `mcp_readonly` por el pooler
     (`postgresql://mcp_readonly.hcvytsitbsandaphsxyn:<pw>@aws-1-us-east-1.pooler.supabase.com:6543/postgres`).
   - `MCP_ACCESS_TOKEN` — el token en claro emitido en T6 (fila `mcp.access_tokens.id = 0f302d8b-…`).
3. **Registrar el server** en `.mcp.json` de la raíz (entrada `stability-db`). No hace falta
   pasar `env` ahí: `stdio.ts` importa `load-env.ts`, que lee `packages/mcp-server/.env`.
   **No poner secretos en `.mcp.json` — es un archivo trackeado.**
4. Reiniciar la sesión de Claude Code / re-aprobar el server con `/mcp`.

> ⚠️ **Landmine que T15 nunca detectó:** el README dice arrancar con `node build/stdio.js`,
> pero eso **está roto**. `@stability/domain` no tiene build (`package.json` apunta a
> `./src/index.ts` y `index.ts` importa `./adherence.js` estilo nodenext), así que el
> `build/stdio.js` compilado no puede resolver el paquete de dominio en runtime con `node`.
> **Arreglo aplicado (2026-09-06):** la entrada de `.mcp.json` corre el server con `tsx`
> (`node node_modules/tsx/dist/cli.mjs packages/mcp-server/src/stdio.ts`), que transpila el
> `.ts` del dominio al vuelo. Verificado end-to-end: `tools/list` (7 tools) + `list_plans`
> devuelve 49 planes reales de producción, auth resuelve a "Maximo Perez" (coach), línea de
> auditoría a stderr, stdout limpio. Para un deploy real (o volver a `node build/`), hay que
> darle un build a `@stability/domain` o bundlear.

Verificación rápida sin Claude Code (MCP Inspector CLI, desde la raíz del repo):

```bash
npx @modelcontextprotocol/inspector@2 --cli tsx packages/mcp-server/src/stdio.ts --method tools/list
npx @modelcontextprotocol/inspector@2 --cli tsx packages/mcp-server/src/stdio.ts \
  --method tools/call --tool-name list_plans --tool-arg include_templates=false
```

---

## Trabajo restante para "cerrar" el spec

1. **T15** — validar las 7 tools desde un cliente MCP real (Claude Desktop o Claude Code) con
   prompts en lenguaje natural; revisar que las líneas de auditoría salen a stderr y que no
   hay ruido en stdout.
2. **T17** — `supabase db pull` (o regenerar a mano) el snapshot de `supabase/schema/` con el
   schema `mcp`; marcar `requirements.md` / `design.md` / `tasks.md` como `Done`.
3. **T18** — PR de cierre (o al menos actualizar el README con el estado final).
4. Decidir qué se hace con la **duplicación**: o el `api/ai-chat.js` migra a consumir el MCP
   server (vía el transport HTTP, que habría que desplegar), o se acepta que son dos caminos
   distintos y se documenta el porqué. Hoy no está decidido ni escrito.
5. Escribir el **spec de correcciones** pendiente (bug de `calculateWeekAttendance`, adopción
   de `computeAdherence` y `rpeHelpers` unificados en la app, fix de la policy de
   `exercise_weight_logs`, los 2 bugs de seguridad preexistentes anotados en
   `supabase/schema/policies.sql`).
