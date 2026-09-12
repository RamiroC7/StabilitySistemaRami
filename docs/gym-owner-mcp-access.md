# Acceso read-only del coach a la base de datos — Spec

**Objetivo:** que el dueño/coach de un gimnasio (usuario no técnico) consulte
datos en lenguaje natural desde Claude, con acceso estrictamente de solo lectura.

| Fase | Alcance | Estado |
|---|---|---|
| 1 — MVP remoto | Rol read-only + server MCP remoto en Vercel + OAuth + tool con auditoría | Implementada (2026-09-12) — ver [specs/gym-owner-mcp-vercel/](../specs/gym-owner-mcp-vercel/tasks.md). En producción: `https://gym-owner-mcp.vercel.app/mcp`. Onboarding de los 3 coaches en curso (Máximo conectado y validado end-to-end; Agustín y Juan pendientes de loguearse). |
| 2 — Reports parametrizados | SQL fijo para preguntas frecuentes, híbrido con SQL libre | Diseñada, no implementar aún |
| 3 — Multi-tenancy y proactividad | Multi-gimnasio real, imágenes on-brand, alertas por cron | Diseñada, disparar al 2º-3er gym |

> **Cambio respecto a la versión anterior de este doc:** Fase 1 iba a ser un
> `.mcpb` local (stdio, sin auth, instalado a mano en la máquina del coach) y
> recién en Fase 3 se migraba a un server remoto en Vercel. Se decidió adelantar
> el hosting en Vercel a Fase 1 — un solo server desde el arranque, sin paso
> intermedio de `.mcpb`. Lo que queda para cuando aparezca el 2º/3er gimnasio no
> es "mudarse a la nube", es *multi-tenancy real* (día 1 alcanza con una env var
> por gimnasio) y las features proactivas (alertas, imágenes on-brand).

## Restricciones de diseño

- Cero terminal, cero SQL, cero edición manual de config por parte del coach
- Bloqueo de escritura garantizado a nivel de base de datos — no a nivel de
  aplicación ni por confianza en el modelo
- Sin terceros custodiando las credenciales de producción
- Sin construir un MCP server desde cero (se parte de un server/base existente)
- Reusable: Stability es un boilerplate aplicado a distintos gimnasios

## Relación con `packages/mcp-server` / rol `mcp_readonly`

Ya existe otro MCP server en este repo ([specs/mcp-server/](../specs/mcp-server/requirements.md),
`packages/mcp-server`, rol Postgres `mcp_readonly`) — 7 tools de solo lectura,
auth por token personal, transport stdio en uso desde Claude Code/Desktop y un
transport HTTP escrito pero sin desplegar. Se evaluó reusarlo y **se decidió
conscientemente construir un sistema aparte** (2026-09-12):

- `mcp_readonly` es una herramienta interna, pensada para un dev con un token
  personal vía stdio. El acceso de los coaches de Stability al negocio es un
  producto distinto: varios coaches (hoy Máximo, después los otros 2 de
  Stability), sin terminal, vía conector remoto en Vercel.
- Un modelo multi-coach real pide identidad por persona (idealmente OAuth) y
  reusabilidad entre gimnasios — más cercano al objetivo original de este doc
  que al alcance de `mcp_readonly` (single-token, `role='coach'` sin
  particionar).
- Costo aceptado: dos roles de solo lectura y dos servers MCP conviven contra
  la misma base de producción. Si en algún momento se quiere unificar, el
  punto de partida sería desplegar el `http.ts` que ya existe en
  `packages/mcp-server` en vez de este doc — queda anotado acá para quien lo
  retome.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| MCP oficial de Supabase | Sus flags `--read-only` y `--project-ref` acotan, pero la credencial vive en el plano de la Management API (personal access token u OAuth de cuenta), no en un rol de Postgres aislado. La documentación de Supabase dice explícitamente que no se le debe dar a usuarios finales |
| MCP server propio desde cero | Costo de desarrollo y mantenimiento innecesario |
| `mcpMyAdmin` / `contextflo` (hosteados, pagos) | Terceros custodiando credenciales de prod + costo recurrente. `contextflo` además está pensado para equipos con gobernanza y dashboards — overkill |
| Claude Code para el coach | Requiere plan pago y es una herramienta de terminal |
| Editar `claude_desktop_config.json` a mano por coach | No escala, y fue la fuente de todos los errores de setup en las pruebas |
| `.mcpb` local distribuido por gimnasio | Válido y más simple de implementar, pero implica reinstalar manualmente en cada update, credenciales viajando a la máquina del coach, y solo funciona en Claude Desktop (no claude.ai ni mobile). Se descarta a favor de ir directo a remoto |

---

# Fase 1 — MVP remoto (Vercel desde el día uno)

```
Coach (Claude Desktop / claude.ai / mobile, plan free)
  → Custom Connector (URL + login OAuth, una sola vez)
    → nube de Anthropic
      → Vercel (mcp-handler, Streamable HTTP stateless, región us-east-1)
        → Supavisor transaction mode (:6543)
          → rol gym_owner_readonly (solo SELECT)
```

## Supabase — una vez por gimnasio

### Rol

```sql
CREATE ROLE gym_owner_readonly WITH
    LOGIN
    PASSWORD '<generada, no reusar entre gyms>'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION
    BYPASSRLS            -- necesario si las tablas tienen RLS activado (ver nota)
    CONNECTION LIMIT 5;

ALTER ROLE gym_owner_readonly SET default_transaction_read_only = on;
ALTER ROLE gym_owner_readonly SET statement_timeout = '30s';
ALTER ROLE gym_owner_readonly SET idle_in_transaction_session_timeout = '60s';

GRANT USAGE ON SCHEMA public TO gym_owner_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO gym_owner_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT ON TABLES TO gym_owner_readonly;
```

Sin GRANT de INSERT/UPDATE/DELETE/DDL — ahí vive la garantía real de
solo-lectura. `ALTER DEFAULT PRIVILEGES` cubre también las tablas futuras.

**Nota RLS (verificado contra el proyecto real de Stability,
`hcvytsitbsandaphsxyn`):** las tablas de `public` tienen Row Level Security
activado. Un rol con `GRANT SELECT` pero sin `BYPASSRLS` ni políticas propias
se conecta bien pero ve 0 filas. Por eso el rol lleva `BYPASSRLS` — combinado
con `default_transaction_read_only = on`, sigue sin poder escribir nada. Si se
prefiere no dar `BYPASSRLS`, la alternativa es una policy explícita
`USING (true)` por tabla, pero esa no cubre tablas futuras automáticamente.

Sumar además: límite de filas por query a nivel de la tool (no solo
`statement_timeout`), para que una pregunta ambigua no dispare un full table
scan sobre producción.

### Vistas en español (definir contra el schema real)

Evaluar exponer vistas en vez de tablas directas, con:
- Nombres de columna en español, legibles para el coach
- Columnas sensibles (PII, salud, teléfonos, pagos) excluidas o enmascaradas —
  aplica la Ley de Protección de Datos Personales (Argentina) si el coach puede
  ver datos de salud de alumnos. En el schema real esto aplica sobre todo a
  `student_profiles`
- El rol tendría SELECT solo sobre las vistas, no sobre las tablas base

### Documentación del schema para el modelo

`COMMENT ON TABLE` / `COMMENT ON COLUMN` en lo más consultado, para que el
significado de negocio viaje con el schema:

```sql
COMMENT ON TABLE socios IS 'Cada fila es un socio. is_active=false significa baja, no eliminado.';
```

### Connection string

```
postgresql://gym_owner_readonly.<project_ref>:<password>@aws-<n>-<region>.pooler.supabase.com:6543/postgres
```

El usuario lleva el sufijo del project ref. Esta credencial vive **solo** en
las env vars del deployment de Vercel — nunca en la máquina del coach ni en el
repo.

## MCP server remoto sobre Vercel

**Por qué remoto desde Fase 1 y no `.mcpb` local:** el `.mcpb` evita el
problema de editar `claude_desktop_config.json` a mano, pero sigue atado a
Claude Desktop, requiere reinstalar en cada update, y la credencial de
Supabase viaja embebida en el archivo hasta la máquina del coach. Yendo
directo a un endpoint remoto se resuelve todo eso a la vez y funciona también
en claude.ai y mobile.

- **Paquete:** `mcp-handler` (antes `@vercel/mcp-adapter`), con el template de
  Next.js oficial de Vercel para MCP servers.
- **Transporte:** Streamable HTTP en **modo stateless**
  (`sessionIdGenerator: undefined`) por sobre SSE — evita sumar Redis
  (Upstash) para manejar estado de sesión. A confirmar si el patrón de uso
  (tool calls puntuales, sin llamadas encadenadas con estado) lo permite; si
  no alcanza, sumar Redis recién ahí.
- **Región de la función:** `us-east-1`, la misma que el proyecto de Supabase
  (`hcvytsitbsandaphsxyn`), para minimizar latencia por query.
- **Conexión a Postgres:** Supavisor transaction mode (`:6543`) — pensado
  justamente para este patrón serverless, sin pooling propio del lado de
  Vercel.

### Auth (bloque de trabajo más grande de este cambio)

Antes esto era exclusivo de Fase 3. Al mover el hosting a Vercel desde el día
uno, el endpoint queda expuesto en internet público y **no puede quedar sin
autenticación** — a diferencia del `.mcpb`, donde la barrera era "quien tiene
el archivo tiene acceso".

- Implementar OAuth 2.0 siguiendo la guía oficial de Vercel para conectores.
- Con un solo gimnasio activo, alcanza con mapear 1 identidad autenticada → 1
  gimnasio (env var), sin necesidad todavía del modelo multi-tenant completo
  de Fase 3.
- Onboarding del coach: pegar la URL del connector en Claude y loguearse una
  vez — sigue cumpliendo "cero terminal, cero SQL, cero config manual".

### Contexto de negocio para el modelo

Lo que en el diseño anterior vivía en los campos nativos de un
`manifest.json` de `.mcpb` (`instructions`, `prompts`, `resources`) ahora vive
directamente en el código del server:
- **Instructions:** contexto de negocio (qué es Stability, convenciones del
  schema, tono esperado) devuelto en la respuesta de inicialización del server.
- **Prompts:** atajos para casos frecuentes (informe mensual de alumno,
  resumen semanal), expuestos como MCP prompts.
- **Resources:** manual de marca (tono, paleta, terminología), sincronizado
  desde el Brand Brief en Plane (proyecto "Content") — lo define el dueño y/o
  marketing, no es tarea de ingeniería.

## Auditoría de uso

El objetivo no es solo seguridad (para eso alcanzan `pg_stat_statements` y los
logs de Postgres), sino entender **qué pregunta el coach y cómo**, para mejorar
prompts, instructions y reports. El SQL ejecutado no refleja la intención
original, y MCP no le pasa al server la pregunta literal del chat.

**Solución:** tool custom en vez de un passthrough genérico de SQL.

```
query_gym_data(question: string, sql: string)
```

`question` es obligatorio — la descripción de la tool le exige al modelo
completarlo con la pregunta del coach parafraseada. El server loguea
`{ timestamp, gym_id, question, sql, row_count }` **antes** de ejecutar. Al
correr en Vercel, el destino natural es una tabla en un schema al que
`gym_owner_readonly` no tenga ningún acceso (en vez del archivo local que
tenía sentido para un server stdio).

Uso de los logs: detectar preguntas frecuentes (→ nuevos prompts o reports),
fricción repetida (→ ajustar instructions), y necesidades no cubiertas
(→ nuevas vistas). Informar al coach que sus consultas quedan registradas.

## Distribución y versionado

- Un solo deploy en Vercel (`git push` actualiza a todos los coaches al
  instante, sin reinstalar nada de su lado)
- Semantic versioning del server
- Las credenciales reales de Supabase viven como env vars en Vercel — nunca
  en el repo ni en un artefacto que se distribuya

## Casos de uso habilitados

- Informes de progreso por alumno (RPE, asistencia, evolución)
- Detección de riesgo de baja
- Resumen financiero, si Stability maneja cobros
- Comparativas mes a mes
- Tareas programadas (Claude Tasks) — se configuran manualmente en la app una
  vez conectado el connector
- Ideas de contenido para Instagram/LinkedIn combinando datos reales con el
  tono del Brand Brief — sin automatizar la publicación

## Checklist antes de entregar acceso real

- [ ] Password generada por gimnasio, nunca reusada
- [ ] Password rotada si alguna vez quedó expuesta en texto plano
- [ ] Test de `DELETE`/`UPDATE`/`INSERT`/DDL desde Claude → debe fallar
- [ ] `statement_timeout` y límite de filas configurados
- [ ] Columnas sensibles filtradas o enmascaradas (`student_profiles` incluida)
- [ ] Logging de queries activado a nivel Postgres (respaldo de seguridad)
- [ ] OAuth funcionando end-to-end: un usuario sin login no puede llamar tools
- [ ] Plan de revocación: si el gym se da de baja o cambia de dueño, se rota el
      rol completo, no solo la password

## Próximos pasos — Fase 1

1. Escribir el SQL final de rol + vistas + `COMMENT ON` (con el fix de
   `BYPASSRLS`/policies ya incorporado arriba) y validarlo contra
   `hcvytsitbsandaphsxyn`
2. Armar el server MCP con `mcp-handler` sobre Vercel — Streamable HTTP
   stateless, validar si alcanza sin Redis para el patrón de uso real
3. Implementar OAuth 2.0 para el endpoint (guía de Vercel para conectores)
4. Portar `instructions`/`prompts`/`resources` al código del server
5. Definir cómo se sincroniza el manual de marca desde Plane al resource
6. Implementar `query_gym_data(question, sql)` con logging previo a una tabla
   en schema separado
7. Deploy en Vercel, alta del custom connector en Claude, correr el checklist
   de seguridad antes de dar acceso real

---

# Fase 2 — Reports parametrizados

Se activa cuando los logs de `query_gym_data` empiecen a mostrar patrones
repetidos en uso real.

**Precedente:** el OCI Managed MCP Service de Oracle (2026) formaliza este
patrón. En vez de que el modelo genere SQL libre en cada pregunta, un
administrador define de antemano queries fijas y parametrizadas ("SQL Reports"),
cada una publicada como su propia tool. El modelo elige qué tool llamar y
completa los parámetros. Oracle reserva el SQL libre para usuarios técnicos
(`MCP_Operator`) y limita a los de negocio (`MCP_User`) a los reports aprobados.

## Diseño: dos caminos que conviven

```
Pregunta del coach
  → ¿matchea un report parametrizado? → tool fija (SQL revisado)
  → si no                             → query_gym_data (SQL libre, como Fase 1)
```

`query_gym_data` no se retira nunca. Ambos caminos loguean igual.

**Por qué conviene, cuando el volumen lo justifica:** cero riesgo de query
inesperada en lo más frecuente; performance predecible (se indexa sabiendo qué
va a correr); auditoría más limpia (`informe_mensual(mes=agosto)` agrega mejor
que pares `{question, sql}` distintos). Los prompts de Fase 1 son los
candidatos naturales a graduarse a tools fijas.

## Auto-detección de candidatos

Las preguntas no se comparan por texto literal ("cuántos socios activos hay" vs.
"decime el total de socios activos" son la misma pregunta y no matchean como
texto). Lo comparable es la forma del SQL:

1. Normalizar el SQL logueado: literales (fechas, números, strings) →
   placeholders, dejando una forma canónica
2. Agrupar por forma canónica en ventana de tiempo (ej. 30 días)
3. 3+ apariciones → se marca como **candidato**, no se promueve solo
4. Revisión manual: los valores que variaron entre apariciones son los
   parámetros a exponer; se nombra la tool y se agrega al catálogo

**La promoción es manual a propósito:** una query que corrió 3 veces sin
problema puede romper con más volumen; el nombre y la forma final los define una
persona; y es el único punto donde el sistema modificaría su propia superficie
de capacidades.

## Guardrails estadísticos contra sobreinterpretación

**Problema:** un LLM con acceso a datos responde con la misma seguridad tenga 3
filas o 3000. Si el coach pregunta "¿qué categoría mejoró más?" y una categoría
tiene 3 alumnos, va a recibir un ganador coronado sobre ruido — y no tiene
formación para detectarlo. Es el riesgo más concreto de que el producto haga
daño real: decisiones de negocio tomadas sobre muestras que no significan nada.

**Idea trasplantada de:** medicina basada en evidencia y analítica de producto,
donde reportar el `n` junto al resultado es obligatorio, no opcional.

Va en Fase 2 porque acá ya se está tocando la capa de tools a fondo (firmas,
salidas, SQL revisado a mano) — el guardrail es un campo más en una estructura
de respuesta que se está definiendo igual.

### Dos niveles, con garantías distintas

**En reports parametrizados (garantizado por código):** cada report declara su
`n` mínimo. Si la muestra no llega al umbral, la respuesta lo dice
explícitamente en vez de devolver un ranking o un ganador.

**En `query_gym_data` (depende del modelo):** el SQL es libre, así que no se
sabe de antemano qué está agrupando. La vía factible es que el server devuelva
siempre el `row_count` junto al resultado, y que las instructions le indiquen
al modelo que advierta cuando la muestra es chica.

**Límite conocido a documentar:** en el camino libre el guardrail depende de que
el modelo haga caso; en los reports fijos está garantizado por código.

## Catálogo inicial de candidatos

Estimación según lo que se sabe del producto — validar contra el schema real.

| Report | Parámetros | Para qué |
|---|---|---|
| `socios_activos` | — | La pregunta más básica |
| `altas_bajas` | `desde`, `hasta` | Movimiento de socios |
| `progreso_alumno` | `alumno_id`, `desde`, `hasta` | RPE y asistencia de un alumno |
| `riesgo_baja` | `dias_sin_asistir` | Contacto proactivo del coach |
| `rpe_promedio_categoria` | `categoria`, `periodo` | Carga de esfuerzo por disciplina |
| `top_mejora` | `periodo`, `top_n` | Insumo para contenido en redes |
| `ocupacion_por_clase` | `dia_semana` | Decisiones de horarios |
| `resumen_financiero` | `mes` | Ingresos, pagos vencidos |
| `cumpleanos_mes` | `mes` | Alto valor humano, bajo costo |

## Próximos pasos — Fase 2

1. Normalización de SQL (literales → placeholders) sobre los logs
2. Agrupación por forma canónica + ventana + umbral, generando candidatos
3. Validar el catálogo contra el schema real y priorizar
4. Definir la firma de tool para reports y cómo conviven con `query_gym_data`
5. Implementar los guardrails estadísticos: umbral de `n` mínimo declarado por
   report, `row_count` siempre en la respuesta de `query_gym_data`, e
   instrucción en las instructions para advertir sobre muestras chicas
6. Evaluar si conviene diferenciar roles de acceso (coach vs. admin) al estilo
   `MCP_User`/`MCP_Operator`, o si alcanza con un solo rol read-only

---

# Fase 3 — Multi-tenancy real y proactividad

**Criterio de disparo:** al llegar al segundo o tercer gimnasio activo — el
punto donde un mapeo identidad→gimnasio hardcodeado (una env var) deja de
alcanzar y donde el volumen justifica invertir en features proactivas.

> El hosting en Vercel y el OAuth ya están resueltos desde Fase 1 — lo que
> queda acá es lo que solo importa a partir de varios gimnasios conviviendo en
> el mismo deploy, más las features que generan valor sin que el coach
> pregunte nada.

## Multi-tenancy real

- Mapeo identidad → gimnasio → rol/credencial de Supabase, en vez de una env
  var fija por deployment
- Tests explícitos de aislamiento entre gimnasios (que un coach nunca pueda,
  ni por error de implementación, ver datos de otro gym)
- Evaluar si el modelo de auth necesita evolucionar (ej. claims por tenant en
  el token OAuth)

## Generación de imágenes on-brand con `@vercel/og`

En vez de que reports como `top_mejora` o `informe_mensual` devuelvan solo
texto, la tool arma una imagen real usando `ImageResponse` (JSX + CSS, arranca
casi instantáneo en el edge), leyendo colores/tipografía/tono directo del
resource del Brand Brief. Convierte al conector de "contesta preguntas" a
"entrega el asset terminado" — conecta directo con el caso de uso de contenido
para Instagram/LinkedIn de Fase 1.

**Flujo:** el coach pide algo compartible → la tool corre el report → genera
la imagen con la paleta del Brand Brief → la guarda en **Vercel Blob**
(necesario porque la función es stateless, no se puede devolver el binario
directo por el protocolo MCP) → el tool result le devuelve a Claude una URL
lista para abrir.

## Alertas proactivas con Vercel Cron Jobs

**Problema que resuelve:** en todo el diseño anterior, el sistema solo habla
cuando el coach pregunta. Si tres alumnos dejaron de venir hace tres semanas,
el dato está en la base pero nadie se entera hasta que a alguien se le ocurre
preguntar.

**Por qué esto y no Claude Tasks:** las Tasks dependen de que cada coach las
configure en su cuenta, una por una, y consumen su cuota de plan free. Con
Vercel Cron la lógica vive del lado de Stability: se escribe una vez y corre
para todos los gimnasios, sin que ningún coach configure nada.

### Configuración

```json
{
  "crons": [
    { "path": "/api/cron/alerta-riesgo-baja", "schedule": "0 12 * * 1" }
  ]
}
```

Vercel hace un GET a esa ruta en el horario indicado (siempre UTC) con un
header `Authorization: Bearer ${CRON_SECRET}` — **verificarlo en el handler es
obligatorio**, o cualquiera con la URL puede disparar la lógica.

**Límite a tener en cuenta:** el plan Hobby permite 2 cron jobs con frecuencia
máxima diaria; Pro levanta eso a jobs ilimitados con frecuencia por minuto.
Para arrancar con 2 alertas alcanza Hobby.

### Entrega de la alerta: bandeja consultada, no push

Claude no puede iniciar una conversación por su cuenta, así que el cron **no
notifica** — escribe el resultado en una tabla de alertas, y el conector la
consulta cuando el coach abre Claude ("¿hay algo nuevo para mí?"). La tabla
vive en un schema aparte al que `gym_owner_readonly` tiene SELECT, y el cron
escribe con otra credencial.

### Casos para Stability

| Cron | Cuándo | Qué hace |
|---|---|---|
| Alerta de riesgo de baja | Lunes | Alumnos sin asistir hace X días, antes de perderlos |
| Resumen semanal | Lunes | El informe llega solo, sin que nadie lo pida |
| Anomalías | Diario | Caída inusual de asistencia, ingreso fuera de patrón |
| Cumpleaños de la semana | Lunes | Empujado en vez de consultado |

**Reusa los reports de Fase 2 sin duplicar lógica:**
`riesgo_baja(dias_sin_asistir)` se ejecuta igual venga de una pregunta del
coach o de un cron. Lo único que cambia es el disparador. Y se encadena con
`@vercel/og`: el cron corre el report → genera la imagen on-brand → la deja
lista en la bandeja, para que el lunes a la mañana el coach ya la tenga
esperándolo.

## Próximos pasos — Fase 3

1. Diseñar y migrar el modelo multi-tenant: mapeo de identidad → gimnasio →
   rol, con tests explícitos de aislamiento entre gimnasios
2. Validar límites de ejecución de Fluid compute contra queries reales de
   mayor volumen (con varios gyms conviviendo en el mismo deploy)
3. Implementar la generación de imágenes on-brand con `@vercel/og` para los
   reports pensados como contenido compartible, con Vercel Blob para persistir
   el resultado
4. Implementar los Vercel Cron Jobs de alertas proactivas: tabla de bandeja en
   schema aparte, verificación del `CRON_SECRET` en el handler, y tool en el
   conector para que el coach consulte si hay algo nuevo
