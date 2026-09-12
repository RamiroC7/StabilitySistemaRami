# Requirements: Acceso read-only de coaches vía MCP remoto en Vercel

**Status:** Approved
**Last updated:** 2026-09-12
**Aprobado por:** Máximo — 2026-09-12

## Summary

Server MCP remoto, hosteado en Vercel, que le permite a los coaches de Stability
consultar en lenguaje natural (desde Claude Desktop, claude.ai o mobile) los
datos de entrenamiento del gimnasio, con acceso estrictamente de solo lectura
garantizado a nivel de base de datos. Es la Fase 1 de
[docs/gym-owner-mcp-access.md](../../docs/gym-owner-mcp-access.md), y un
sistema deliberadamente separado del `mcp_readonly` / `packages/mcp-server`
existente (ver esa sección del doc).

## Goals

1. Un coach pregunta en lenguaje natural y obtiene respuestas correctas sobre
   alumnos, planes, adherencia y progresión, sin abrir la app, sin terminal y
   sin escribir SQL.
2. Cada coach se autentica con su propia identidad — el sistema soporta hoy a
   Máximo y está listo para sumar a los otros 2 coaches de Stability sin
   rediseño.
3. Una escritura (INSERT/UPDATE/DELETE/DDL) es estructuralmente imposible,
   sin depender de que el modelo "se porte bien".
4. Toda pregunta libre queda auditada (quién, qué preguntó, qué SQL corrió,
   cuántas filas) antes de ejecutarse, como base para promover preguntas
   frecuentes a reports fijos en una fase posterior.
5. Ninguna credencial de producción llega nunca al dispositivo de un coach.
6. Funciona como conector remoto (Vercel) desde el día uno — no un `.mcpb`
   local — así que sirve desde Desktop, claude.ai y mobile por igual.
7. Convive con la app en producción y con `mcp_readonly` / `packages/mcp-server`
   sin tocar ninguno de los dos.

## Non-goals

- **Reports parametrizados y guardrails estadísticos de `n` mínimo** — Fase 2
  del doc madre. `query_gym_data` (SQL libre) es el único camino en esta
  iteración.
- **Multi-tenancy real (más de un gimnasio)** — Fase 3. Este spec asume un solo
  gimnasio (Stability) con varios coaches, todos con visibilidad equivalente.
- **Imágenes on-brand (`@vercel/og`) y alertas proactivas por cron** — Fase 3.
- **Enmascarar o excluir columnas sensibles (PII, salud).** Decisión explícita
  de este spec (ver Constraints): `gym_owner_readonly` ve **todas** las tablas
  de `public`, incluida `student_profiles`. Es un riesgo de compliance
  aceptado a propósito, no un olvido — difiere de `mcp_readonly`, que sí la
  excluye.
- **Vistas en español / renombrado de columnas.** El coach consulta las tablas
  reales tal como están; no hay capa de traducción en esta iteración.
- **Unificar o migrar `api/ai-chat.js`** a este server. Queda documentado como
  una pieza aparte y sin resolver (ver `specs/mcp-server/handoff-estado.md`),
  fuera de alcance acá.
- **Tools de escritura**, bajo ninguna forma.

## Actores

- **Coach** (`profiles.role = 'coach'`): hoy Máximo; a corto plazo los otros 2
  coaches de Stability. Todos con acceso equivalente — no hay particionamiento
  de datos por coach, solo de identidad/auditoría.
- **Alumno** (`profiles.role = 'student'`): sin acceso a este conector bajo
  ninguna circunstancia.
- **Administrador** (Máximo): provisiona el rol de base de datos, las env vars
  de Vercel, y da/revoca acceso de login a cada coach.

## User stories

### US-1: Preguntar en lenguaje natural

Como coach, quiero pedirle a Claude datos del gimnasio en lenguaje natural,
para obtener respuestas sin abrir la app ni escribir SQL.

**Acceptance criteria:**

- WHEN un coach hace una pregunta sobre los datos del gimnasio THE SYSTEM
  SHALL traducirla a una consulta SQL de solo lectura contra
  `gym_owner_readonly` y devolver el resultado.
- WHEN la consulta no devuelve filas THE SYSTEM SHALL devolver un resultado
  vacío, no un error.
- IF el SQL generado falla al ejecutar (columna inexistente, error de sintaxis)
  THEN THE SYSTEM SHALL devolver un mensaje de error legible, sin exponer la
  connection string ni credenciales en el mensaje.

### US-2: Autenticación individual por coach

Como administrador, quiero que cada coach se loguee con su propia identidad,
para que el audit log distinga quién preguntó qué y para poder revocarle el
acceso a uno sin afectar a los demás.

**Acceptance criteria:**

- WHEN un coach agrega el conector por primera vez THE SYSTEM SHALL pedirle
  loguearse con la cuenta que ya tiene en Supabase Auth (la misma que usa para
  entrar a la app).
- WHEN el login resuelve THE SYSTEM SHALL verificar que el `profiles`
  correspondiente tenga `role = 'coach'`, y rechazar la sesión si no.
- IF una petición llega sin sesión/token válido THEN THE SYSTEM SHALL
  rechazarla sin ejecutar ninguna tool.
- THE SYSTEM SHALL permitir revocar el acceso de un coach puntual sin afectar
  el login de los demás coaches.

### US-3: Solo lectura garantizada a nivel de base

Como administrador, quiero que una escritura sea imposible a nivel de base de
datos, para dar este acceso a un modelo sin depender de su buen
comportamiento.

**Acceptance criteria:**

- THE SYSTEM SHALL conectarse a Postgres exclusivamente con un rol
  (`gym_owner_readonly`) sin ningún grant de INSERT/UPDATE/DELETE/DDL.
- IF una tool intenta una escritura o DDL THEN THE SYSTEM SHALL fallar la
  operación a nivel de base (permission denied o read-only transaction), no
  solo por convención de código.
- THE SYSTEM SHALL fijar `default_transaction_read_only = on` a nivel de rol,
  como segunda barrera independiente del GRANT.

### US-4: Visibilidad completa pese a RLS

Como coach, quiero ver los datos reales del gimnasio en todas las tablas, para
que mis preguntas tengan respuesta completa.

**Acceptance criteria:**

- THE SYSTEM SHALL otorgar `SELECT` a `gym_owner_readonly` sobre todas las
  tablas existentes de `public`.
- THE SYSTEM SHALL configurar `ALTER DEFAULT PRIVILEGES` para que las tablas
  futuras de `public` también queden legibles automáticamente.
- THE SYSTEM SHALL otorgar `BYPASSRLS` a `gym_owner_readonly` para que las
  policies de RLS no le oculten filas (con las 18 tablas de `public` bajo RLS,
  sin esto el rol vería 0 filas pese al `GRANT SELECT`).

### US-5: Auditoría de preguntas libres

Como administrador, quiero que cada pregunta y el SQL que generó queden
logueados antes de ejecutarse, para revisar el uso real y más adelante
promover las preguntas frecuentes a reports fijos.

**Acceptance criteria:**

- WHEN se responde una pregunta vía `query_gym_data` THE SYSTEM SHALL loguear
  `{timestamp, coach_id, question, sql, row_count}` en un destino que el rol
  `gym_owner_readonly` no pueda leer, **antes** de ejecutar el SQL.
- THE SYSTEM SHALL exigir el parámetro `question` (la pregunta del coach
  parafraseada) en toda llamada a `query_gym_data` — la descripción de la tool
  SHALL instruir al modelo a completarlo siempre.
- IF el log no se puede escribir THEN THE SYSTEM SHALL NOT ejecutar el SQL
  (falla cerrado: sin registro, no hay ejecución).

### US-6: Ninguna credencial en el dispositivo del coach

Como administrador, quiero que la credencial de producción nunca salga de
Vercel, para que ningún dispositivo de un coach pueda filtrarla.

**Acceptance criteria:**

- THE SYSTEM SHALL almacenar la connection string de `gym_owner_readonly`
  únicamente como variable de entorno en Vercel.
- THE SYSTEM SHALL NOT incluir ninguna credencial de base de datos en el repo,
  en la config del conector, ni en ningún artefacto que llegue a la máquina de
  un coach.

### US-7: Alta sin fricción para un coach no técnico

Como coach, quiero agregar este conector sin tocar una terminal ni un archivo
de config, para poder usarlo en un solo flujo.

**Acceptance criteria:**

- WHEN un coach agrega el conector en Claude (Desktop o claude.ai) THE SYSTEM
  SHALL requerir únicamente pegar una URL y completar el login OAuth — nada de
  edición manual de JSON ni de terminal.

### US-8: Convivencia con lo existente

Como administrador, quiero que este server nuevo no interfiera con el deploy
de la app ni con `mcp_readonly` / `packages/mcp-server`, para no romper nada
que ya está en producción.

**Acceptance criteria:**

- THE SYSTEM SHALL deployarse como su propio proyecto de Vercel, con root
  directory `packages/gym-owner-mcp`, independiente del proyecto de Vercel de
  la app.
- THE SYSTEM SHALL NOT modificar el rol `mcp_readonly`, `packages/mcp-server`,
  ni ninguno de sus grants o policies.
- THE SYSTEM SHALL NOT cambiar el build, deploy o comportamiento en runtime de
  la app principal.

### US-9: Contexto de negocio y atajos para el modelo

Como coach, quiero que Claude entienda el contexto de Stability y tenga
atajos para preguntas frecuentes, para que las respuestas sean más precisas
sin que yo tenga que explicar el negocio cada vez.

**Acceptance criteria:**

- THE SYSTEM SHALL exponer instructions de negocio (qué es Stability,
  convenciones del schema, tono esperado) en la respuesta de inicialización
  del server MCP.
- THE SYSTEM SHALL exponer al menos un MCP prompt de ejemplo (p.ej. "resumen
  semanal") como atajo para un caso de uso frecuente.
- THE SYSTEM SHALL exponer el manual de marca (Brand Brief) como un MCP
  resource. La sincronización automática desde Plane queda fuera de alcance
  de esta iteración — el resource se actualiza a mano.

## Constraints

- **Base de datos:** Postgres 17.6 en el proyecto Supabase de producción
  `hcvytsitbsandaphsxyn`, alcanzado por Supavisor en modo transacción
  (`:6543`). RLS está activo en las 18 tablas de `public`.
- **Identidad:** los coaches ya tienen cuenta en Supabase Auth (la misma app
  la usa para login). El login del conector debe verificar contra ese mismo
  sistema de identidad, no crear uno nuevo.
- **Hosting:** Vercel, paquete `mcp-handler`, región de la función alineada a
  `us-east-1` (misma región que el proyecto Supabase). Preferencia por
  Streamable HTTP stateless (`sessionIdGenerator: undefined`); sumar Redis
  solo si el patrón de uso real lo exige.
- **Aislamiento de nombres:** el rol nuevo se llama `gym_owner_readonly`
  (no reusa ni modifica `mcp_readonly`); el paquete nuevo vive en
  `packages/gym-owner-mcp` (no toca `packages/mcp-server` ni `packages/domain`).
- **Riesgo aceptado:** exponer `student_profiles` y toda otra columna sensible
  sin enmascarar es una decisión consciente del administrador para esta
  iteración (ver Non-goals), no un descuido de diseño.
- **Monorepo:** seguir las convenciones ya establecidas (`tsconfig.base.json`,
  `workspaces`) para que el nuevo paquete no rompa el build/CI de la app ni de
  `packages/mcp-server`.

## Open questions

- **Mecánica exacta de la verificación OAuth contra Supabase Auth** desde el
  handler de Vercel (qué endpoint/flow de Supabase Auth se usa como IdP, cómo
  se mapea el usuario autenticado a `profiles.id`). No cambia ningún
  requirement de este documento, pero **el design.md debe resolverlo contra el
  schema real antes de aprobarse** — no asumirlo.
