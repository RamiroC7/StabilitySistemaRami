# Requirements: MCP Server para Sistema Alfa

**Status:** Approved
**Last updated:** 2026-08-30
**Aprobado por:** Máximo — 2026-08-30

## Summary

Exponer los datos de entrenamiento de Sistema Alfa (alumnos, planes, adherencia, progresión de cargas) a través de un servidor MCP, para que un coach pueda consultarlos en lenguaje natural desde Claude Desktop. El servidor se construye como pieza reutilizable: los mismos tools servirán después a un digest automático por cron y a un chat embebido en la PWA.

Este spec cubre **dos fases**:

- **Fase 1 — Preparación**: reestructurar el repo a monorepo y extraer a un paquete compartido la lógica de lectura que hoy vive dentro de hooks de React. Sin cambio visible para el usuario final.
- **Fase 2 — MCP server**: el servidor, su autenticación y un set acotado de tools de **solo lectura**, consumibles desde Claude Desktop.

## Goals

1. Un coach puede preguntar en lenguaje natural por el estado de sus alumnos y obtener respuestas correctas, sin abrir la app ni escribir SQL.
2. La lógica de **derivación** que sí está compartida (alerta de RPE, estado de vencimiento) tiene una sola implementación consumida por la SPA y por el MCP server. `computeAdherence` vive en el mismo paquete pero por ahora solo la usa el MCP (ver Non-goals). El **acceso a datos** queda duplicado por diseño — ver Constraints.
3. El servidor queda listo para sumar un segundo y tercer consumidor (cron, BFF) sin reescribirlo.
4. Ningún secreto de servidor (service-role key, tokens) queda expuesto en el bundle del browser.
5. Al terminar la Fase 1, la PWA se comporta exactamente igual que antes: mismo build, mismo deploy, cero regresiones.

## Non-goals

Explícitamente **fuera de alcance** de este spec:

- **Tools de escritura** (crear/editar/asignar/duplicar planes). Se difieren a un spec posterior, porque requieren resolver antes la falta de atomicidad en las operaciones multi-tabla.
- **Chat embebido en la PWA** y el BFF que lo alimenta.
- **Worker de cron / digests automáticos.**
- **Refactorizar toda la lógica de negocio.** Solo se extrae lo que las tools de lectura necesitan (~6 flujos), no las ~6.000 líneas de `hooks/` y `store/`.
- **Migrar las agregaciones a SQL.** Hoy se calculan en JS; se mantienen así en esta iteración.
- **Corregir el bug de la constancia semanal de la app** (`calculateWeekAttendance` usa `total_days` como días/semana). Documentado en `notes-adherence.md`; va al spec de correcciones aparte. El tool de US-2 no lo hereda porque define su propia fórmula.
- **Refactorizar la PWA para que use `computeAdherence`.** Como el cálculo de la PWA es distinto (y bugueado) y su corrección es otro spec, en esta iteración `computeAdherence` lo usa solo el MCP server. Queda en `packages/domain` para que el spec de corrección lo reutilice después.
- **Corregir los hallazgos del linter de seguridad** (`get_monthly_ranking` y `handle_new_user` ejecutables por `anon`). Son problemas reales pero preexistentes e independientes; van por separado. Nota: bajar el esquema y las policies al repo **sí está en alcance** (D-4), pero solo como lectura/versionado, sin modificarlas.
- **Adoptar migraciones versionadas como práctica de ahora en más.** Se baja el esquema una vez; el proceso de migraciones queda para otro momento.
- **Acceso MCP para alumnos.** Solo coaches.

## Actores

- **Coach**: `profiles.role = 'coach'`. Todos los coaches tienen acceso equivalente a todos los planes y todos los alumnos; no hay particionamiento por coach.
- **Alumno**: `profiles.role = 'student'`. No debe tener acceso al MCP server bajo ninguna circunstancia.
- **Administrador del sistema** (Máximo): emite y revoca tokens de acceso al MCP.

## User stories

### US-1: Consultar el listado de alumnos

Como coach, quiero pedirle a Claude el listado de alumnos con su estado, para orientarme sin abrir la app.

**Acceptance criteria:**

- WHEN el coach pide el listado de alumnos THE SYSTEM SHALL devolver nombre, estado de archivado y si tiene una asignación activa, para todos los alumnos de la plataforma.
- THE SYSTEM SHALL permitir filtrar por alumnos activos o archivados.
- IF no hay alumnos que cumplan el filtro THEN THE SYSTEM SHALL devolver una lista vacía y no un error.

### US-2: Consultar adherencia de un alumno

Como coach, quiero saber cuánto entrenó un alumno en un rango de fechas, para detectar abandono temprano.

**Contexto (revisado 2026-08-30 tras T0.3):** la app **no tiene** un cálculo de adherencia por alumno para un rango arbitrario. El único % por alumno (`WorkoutCalendar.calculateWeekAttendance`) es solo de la semana actual y tiene un denominador bugueado (`notes-adherence.md`). Por lo tanto US-2 **no puede** "coincidir con la app" — define una fórmula propia, correcta y documentada. El bug de la app se corrige en un spec aparte.

**Acceptance criteria:**

- WHEN el coach pide la adherencia de un alumno con un rango de fechas THE SYSTEM SHALL devolver: entrenamientos completados en el rango, entrenamientos esperados en el rango, porcentaje de cumplimiento, y los datos crudos que sustentan el cálculo (lista de completions con fecha/día/RPE, y las asignaciones activas que solapan el rango).
- THE SYSTEM SHALL calcular "esperados" como `days_per_week × número de semanas del solapamiento entre cada asignación no cancelada y el rango pedido`, sumando sobre todas las asignaciones que solapan.
- THE SYSTEM SHALL calcular "completados" como la cantidad de `workout_completions` del alumno en el rango, deduplicadas por `(day_number, fecha local)`.
- THE SYSTEM SHALL usar la zona horaria `America/Argentina/Buenos_Aires` para todos los límites de fecha.
- THE SYSTEM SHALL excluir las asignaciones con `status = 'cancelled'` del cálculo de esperados.
- THE SYSTEM SHALL documentar en la respuesta (o en la descripción del tool) que este número no corresponde a ninguna pantalla de la app.
- IF el alumno no tiene ninguna asignación no cancelada que solape el rango THEN THE SYSTEM SHALL devolver `adherence_pct = null` con un mensaje explícito, no `0%`.
- IF el `student_id` no existe o no es un alumno THEN THE SYSTEM SHALL devolver un error legible que nombre el problema.
- IF `from > to` THEN THE SYSTEM SHALL devolver un error de validación.

### US-3: Consultar progresión de cargas

Como coach, quiero ver cómo evolucionó la carga de un alumno en un ejercicio, para decidir si progresarlo.

**Acceptance criteria:**

- WHEN el coach pide la progresión de un alumno en un ejercicio THE SYSTEM SHALL devolver las series registradas ordenadas cronológicamente, con fecha, repeticiones objetivo, repeticiones reales y kg.
- THE SYSTEM SHALL aceptar el nombre del ejercicio de forma aproximada (sin exigir coincidencia exacta de mayúsculas o acentos).
- IF no hay registros de carga para ese alumno y ejercicio THEN THE SYSTEM SHALL devolver una lista vacía indicando que no hay registros.

### US-4: Detectar planes por vencer

Como coach, quiero saber a qué alumnos se les vence el plan pronto, para renovarlos a tiempo.

**Acceptance criteria:**

- WHEN el coach pide los vencimientos próximos con una ventana en días THE SYSTEM SHALL devolver las asignaciones activas cuya `end_date` cae dentro de esa ventana, ordenadas por fecha de vencimiento ascendente.
- THE SYSTEM SHALL incluir también las asignaciones activas ya vencidas, marcadas como tales.

### US-5: Detectar alertas de RPE

Como coach, quiero que Claude me avise qué alumnos vienen reportando RPE alto, para prevenir sobreentrenamiento.

**Acceptance criteria:**

- WHEN el coach pide las alertas de RPE THE SYSTEM SHALL evaluar los últimos entrenamientos de cada alumno aplicando la misma regla que usa hoy la app (`detectRpeAlert`) y devolver solo los alumnos en alerta.
- THE SYSTEM SHALL devolver, por cada alumno en alerta, los valores de RPE que dispararon la alerta.

### US-6: Consultar un plan

Como coach, quiero consultar el contenido de un plan, para revisarlo o usarlo como referencia.

**Acceptance criteria:**

- WHEN el coach pide el listado de planes THE SYSTEM SHALL devolver todos los planes no archivados con título, cantidad de días y cantidad de alumnos asignados.
- WHEN el coach pide el detalle de un plan THE SYSTEM SHALL devolver sus días y, por cada día, los ejercicios con etapa, series, repeticiones, carga y pausa, en el orden definido.

### US-7: Autenticación y límite de acceso

Como administrador, quiero controlar quién accede al MCP server, para que solo coaches autorizados puedan leer los datos de la plataforma.

**Acceptance criteria:**

- WHEN una petición llega sin token válido THE SYSTEM SHALL rechazarla sin ejecutar ninguna tool y sin revelar detalle del motivo más allá de "no autorizado".
- WHEN un token válido resuelve a un perfil cuyo `role` no es `'coach'` THE SYSTEM SHALL rechazar la petición.
- IF el token está expirado o revocado THEN THE SYSTEM SHALL rechazar la petición.
- THE SYSTEM SHALL permitir revocar un token sin necesidad de redeployar el servidor.
- THE SYSTEM SHALL almacenar los tokens hasheados, nunca en texto plano.

### US-8: Solo lectura verificable

Como administrador, quiero garantía de que el MCP server no puede modificar datos en esta fase, para poder darle acceso a un modelo sin riesgo.

**Acceptance criteria:**

- THE SYSTEM SHALL exponer únicamente tools de lectura.
- IF una tool intenta ejecutar una escritura THEN THE SYSTEM SHALL fallar la operación a nivel de base de datos, no solo por convención en el código.

### US-9: La app sigue funcionando (Fase 1)

Como coach o alumno, quiero que la app siga funcionando igual durante el refactor, para no verme afectado por trabajo interno.

**Acceptance criteria:**

- WHEN se completa la reestructuración a monorepo THE SYSTEM SHALL buildear y deployar en Vercel con el mismo resultado que antes.
- THE SYSTEM SHALL conservar sin cambios el comportamiento de login, listado de alumnos, creación y asignación de planes, y registro de entrenamiento.

## Constraints

- **Stack existente**: React 19 + Vite + Supabase (Postgres, Auth, Storage). Deploy en Vercel. No hay backend propio hoy.
- **RLS está activa** en las 18 tablas de `public`, con 2 a 6 policies cada una. **Las policies no están versionadas en el repo**; viven solo en el proyecto Supabase remoto. Cualquier decisión de diseño que dependa de su contenido exacto debe verificarlo contra la base, no asumirlo.
- **No existen migraciones versionadas** más allá de dos `ALTER TABLE`. El esquema es la fuente remota.
- **Sin transacciones**: ninguna operación multi-tabla actual es atómica. Es la razón principal por la que las escrituras quedan fuera de alcance.
- **Una sola RPC existe** (`get_monthly_ranking`); toda otra agregación se hace en JS en el cliente.
- **Acoplamiento a Vite mínimo**: `import.meta.env` solo en `src/lib/supabase.ts`. El acoplamiento real es que muchos archivos importan un cliente Supabase singleton. (Conteos medidos contra `MaximoFini/StabilitySistema`; el repo real difiere algo pero la dirección es la misma — y ya no extraemos los hooks, así que no es load-bearing.)
- **La lógica de negocio está mayormente en hooks de React**, dentro de closures sobre `useAuthStore`. El repo real ya extrajo algunas piezas puras a `src/lib/` con tests (`rpeHelpers`, `pendingDay`, `assignmentProgress`) — patrón compatible con `packages/domain`. En este spec solo se copian `rpeHelpers` y la lógica de vencimiento; no se toca el resto.
- **El paquete compartido debe correr en Node**, por lo tanto no puede usar `import.meta.env`, `localStorage`, `navigator` ni APIs de browser.
- **La clave `anon` es pública** (está en el bundle). Cualquier secreto del MCP server debe vivir solo del lado servidor.
- **Dos capas de acceso a datos, por diseño.** Consecuencia directa de D-2: la SPA consulta vía PostgREST con el query builder de `supabase-js`; el MCP server consulta con SQL sobre driver `pg`. El paquete compartido contiene **tipos y funciones de derivación puras**, no construcción de queries. Cada consumidor trae sus filas a su manera y aplica la misma lógica de cálculo encima.
- **Contrapartida aceptada:** el MCP server puede agregar en SQL en vez de traer todo y sumar en JS, lo que lo hace más eficiente que la SPA para reportes. Pero exige verificar que ambos caminos produzcan el mismo número (ver US-2).

## Decisiones tomadas

Resueltas con el usuario el 2026-08-30, antes de aprobar este documento.

- **D-1 — Transport: ambos entrypoints, deploy diferido.** El server se escribe con transports stdio y HTTP desde el inicio, compartiendo la misma definición de tools. En esta fase solo se usa stdio, local, contra Claude Desktop. El deploy HTTP (Railway/Fly) queda listo pero no se ejecuta hasta que exista un segundo consumidor.
- **D-2 — Solo lectura: rol Postgres dedicado.** Se crea un rol con únicamente `GRANT SELECT` sobre las tablas necesarias, y el server conecta por driver `pg`. Un intento de escritura falla en la base, no por convención de código. Cumple US-8 de forma estructural.
- **D-3 — Identidad: token por coach, con auditoría.** Cada token resuelve a un `profiles.id`; se registra qué tool llamó cada coach y cuándo. La identidad no altera qué datos ve (todos ven todo), solo deja rastro y prepara el terreno para las escrituras futuras.
- **D-4 — Esquema versionado.** Se ejecuta `supabase db pull` para bajar esquema y RLS policies al repo antes de empezar el Design, que las necesita para definir los `GRANT` de D-2.

## Open questions

Ninguna. Las cuatro se cerraron arriba.
