# T0.3 — Cómo la app calcula HOY la "adherencia" / "constancia"

> Relevamiento de solo lectura. Fuente de verdad: código real del repo
> `RamiroC7/StabilitySistemaRami`, rama `main`, commit `7be51dd`.
> La app está en la RAÍZ del repo (`src/…`), no bajo `professors-platform/`.
> Objetivo: poder implementar una función pura `computeAdherence` en el MCP server.

---

## Cambios vs. análisis anterior (2026-08-30)

El análisis anterior se hizo contra una versión previa del código. Contra el código REAL:

1. **`useStudentConstancia` sigue SIN calcular ningún porcentaje.** La query 1 (assignments)
   y la query 2 (completions) son **idénticas** a lo documentado antes (mismas tablas,
   columnas, filtros y orden). **Sin cambios.**

2. **El único `%` de adherencia por-alumno sigue estando en
   `WorkoutCalendar.tsx` → `calculateWeekAttendance()`** y **la lógica es la misma**.
   Solo se corrieron los números de línea (antes `66-110`, ahora `82-126`). El "+53 líneas"
   del diff de `WorkoutCalendar.tsx` es UI (mascota, layout de dos columnas, `completionsByDate`
   para abrir el detalle del día), **no** tocó el cálculo.
   - Denominador: sigue usando `assignment.daysPerWeek` (= `total_days ?? days_per_week ?? 3`)
     de **una sola semana**, del **primer** assignment que solapa, con `break`. **Bug intacto.**
   - Numerador: sigue siendo `thisWeekCompletions.length` = **cantidad de filas**, sin dedup,
     sin filtrar `assignment_id`, sin filtrar `status`. **Intacto.**
   - `Math.round(...)`, `Math.min(percentage, 100)`, piso `0`. **Intacto.**
   - Skew de TZ (~3h): `new Date(assignment.startDate)` sigue sin `T00:00:00`
     (`WorkoutCalendar.tsx:106-107`), `new Date(c.completedAt)` vs límites locales. **Intacto.**

3. **`daysPerWeek = tp?.total_days ?? tp?.days_per_week ?? 3`** sigue en
   `useStudentConstancia.ts:178` — el bug del denominador (usa `total_days`, el total del
   plan, no días/semana) **NO se corrigió**.

4. **Segundo cálculo en `useBusinessMetrics.ts` (dashboard de negocio): sin cambios
   relevantes.** Sigue en `~395-415`, ventana = mes, `days_per_week ?? 3`, divide por
   `weeksInMonth`, promedia entre assignments. Ver §9.

5. **NUEVO — se extrajo lógica a funciones separadas + tests** (esto es lo que más cambió):
   - `src/lib/pendingDay.ts` (`selectPendingDay`) — **función PURA** con `now` inyectable +
     7 tests. Es la lógica de "próximo día pendiente" que antes vivía inline en
     `useActiveAssignment.ts:232-240`. **No es adherencia**, pero es reutilizable (§10).
   - `src/lib/assignmentProgress.ts` (`recomputeAssignmentProgress`) — **NO es pura**
     (hace I/O a Supabase). Es la lógica de recálculo de `completed_days`/`status` que antes
     estaba inline en `saveCompletion` (`useWorkoutCompletions.ts:209-228`), factorizada para
     compartirla entre guardar / borrar / sincronizar cola. Dedup por `day_number` con `new Set`. + tests.
   - `src/lib/offlineWorkoutQueue.ts` — **NUEVO**. Cola de escritura offline en `localStorage`.
     Afecta *cuándo* y *con qué `completed_at`* se crean las completions (§8, §9).
   - `src/lib/rpeHelpers.ts` (`detectRpeAlert`) — **lógica idéntica** a antes, ahora con
     `rpeHelpers.test.ts` (US-5: se puede reutilizar tal cual).
   - `useActiveAssignment.ts` — refactor: ahora llama a `selectPendingDay`; la Q1 agrega
     `.eq("status","active").gte("end_date", todayISO)`. `daysPerWeek = days_per_week ??
     total_days ?? 0` (sigue **inconsistente** con `useStudentConstancia`).

**Conclusión rápida:** el cálculo de adherencia de la app **no cambió** (mismos bugs). Lo nuevo
es infraestructura (cola offline) y refactors que **dan al MCP dos funciones de fecha
reutilizables** (`selectPendingDay` pura, `recomputeAssignmentProgress` no-pura).

---

## 1. Input — queries exactas

### 1.a `useStudentConstancia(studentId)` — `src/hooks/useStudentConstancia.ts`

**Query 1 — assignments** (`useStudentConstancia.ts:106-122`):

```ts
const { data: assignments } = await supabase
  .from("training_plan_assignments")
  .select(`
    id,
    start_date,
    end_date,
    status,
    training_plans ( title, days_per_week, total_days )
  `)
  .eq("student_id", studentId)
  .order("start_date", { ascending: false });
```

- Tabla `training_plan_assignments`, join embebido a `training_plans`.
- Filtro único: `.eq("student_id", studentId)`.
- Orden: `start_date` **DESC** (el `start_date` más reciente primero — importa para §4).
- **NO** filtra `status` → incluye `cancelled` / `paused` / `completed` / `active`.
- **NO** filtra por fecha/rango.
- `assignments` vacío → guarda `[]` y termina (`:125-129`).

**Query 2 — completions** (`useStudentConstancia.ts:134-140`):

```ts
const { data: completions } = await supabase
  .from("workout_completions")
  .select("id, assignment_id, day_number, completed_at, initial_mood, mood, mood_comment, rpe, duration_minutes")
  .in("assignment_id", assignmentIds)   // assignmentIds = assignments.map(a => a.id)
  .order("completed_at", { ascending: false });
```

- Filtro único: `.in("assignment_id", assignmentIds)` (todos los assignments del alumno,
  cualquier status). Orden `completed_at` DESC. **Sin** filtro de fecha, **sin** dedup.

**Post-procesamiento** (`:144-181`): agrupa completions por `assignment_id` en
`completionsByAssignment` y arma un `PlanConstancia[]`, uno por assignment. Campo clave:

```ts
daysPerWeek: tp?.total_days ?? tp?.days_per_week ?? 3,   // :178  ← BUG, ver gotcha #1
sessions:    completionsByAssignment[a.id] ?? [],        // :179
```

Formato de fechas: `start_date`/`end_date` = `"YYYY-MM-DD"` (columna `date`, sin hora),
guardadas tal cual. `completed_at` = ISO UTC (`timestamptz`), guardada tal cual.

### 1.b `useWorkoutCompletions(studentId)` — `src/hooks/useWorkoutCompletions.ts`

`WorkoutCalendar` usa este hook para el **numerador** (no las `sessions` de `useStudentConstancia`).

Query de lectura (`useWorkoutCompletions.ts:105-111`):

```ts
const { data } = await supabase
  .from("workout_completions")
  .select("id, assignment_id, day_number, completed_at, rpe, total_sets_done, duration_minutes")
  .eq("student_id", studentId)
  .order("completed_at", { ascending: false });
```

- Filtro único: `.eq("student_id", studentId)`. **Sin rango de fecha, sin filtro de assignment.**
  Devuelve TODAS las completions históricas del alumno, de todos los planes.
- `completedDates` (`:350-352`): `new Set(completions.map(c => c.completedAt.slice(0,10)))` —
  dedup por fecha `"YYYY-MM-DD"`, se usa solo para pintar días en el calendario, **no** para el %.

### 1.c Inserción de una completion — `saveCompletion` (`useWorkoutCompletions.ts:144-262`) + cola offline

- `completionId = crypto.randomUUID()` generado **en el cliente** (`:174`). Permite reintentar
  sin duplicar (upsert por `id`).
- Con conexión: `performCompletionSync(item)` (`offlineWorkoutQueue.ts:99-166`):
  - **`upsert`** en `workout_completions` con `{ id, student_id, assignment_id, day_number, rpe,
    initial_mood, mood, mood_comment, total_sets_done, duration_minutes, series_log }`,
    `{ onConflict: "id" }` (`:104-121`). **NO incluye `completed_at`** → lo pone la DB
    (`default now()`) **en el momento del sync** (ver §9).
  - Luego `recomputeAssignmentProgress(studentId, assignmentId, dayNumber)` (§10).
  - Luego upsert de `exercise_weight_logs`.
- Sin conexión (o error de red): `enqueueCompletion(item)` → `localStorage["pending-completions"]`
  + actualización optimista de la cache (`completedAt: item.queuedAt`, ISO de cuando se encoló).
- La cola se vacía con `flushPendingCompletions()`: al montar el hook (`:268-270`) y en el
  listener `window "online"` (`offlineWorkoutQueue.ts:214-218`). Guard `isFlushing` evita
  concurrencia. Entradas con `queuedAt` > 7 días se **descartan** (`MAX_QUEUE_AGE_DAYS`).

### 1.d `recomputeAssignmentProgress` — `src/lib/assignmentProgress.ts`

Recalcula `training_plan_assignments.completed_days` y `status`:

```ts
const uniqueCompletedDays = new Set((allCompletions ?? []).map((c) => c.day_number));  // :60-62
const newCompletedDays = uniqueCompletedDays.size;                                     // :63
```

- `allCompletions` = filas de `workout_completions` de ese `assignment_id` + `student_id` con
  `completed_at >= (start_date - 1 día)` convertido a UTC (`:46-58`).
- Dedup **por `day_number`**. `status = "completed"` cuando `newCompletedDays >= total_days`
  (`:72-73`). **Este contador NO es el `%` de `WorkoutCalendar`.**

---

## 2. "Entrenamientos esperados" (denominador)

Todo en `WorkoutCalendar.tsx:calculateWeekAttendance()` (`:82-126`).

```ts
// WorkoutCalendar.tsx:104-114  (cita textual)
let expectedDays = 0;
for (const assignment of assignments) {
  const assignStart = new Date(assignment.startDate);
  const assignEnd = new Date(assignment.endDate);

  // Check if assignment is active this week
  if (assignEnd >= startOfWeek && assignStart <= endOfWeek) {
    expectedDays = assignment.daysPerWeek;
    break; // Use first active assignment
  }
}
```

- `assignments = plans.map(p => ({ startDate, endDate, daysPerWeek }))`
  (`WorkoutCalendar.tsx:27-31`), en el mismo orden que `useStudentConstancia` → **`start_date` DESC**.
- Denominador = **`daysPerWeek` de UNA semana**. No se multiplica por semanas del plan, del
  rango ni del solapamiento.
- **NO** cuenta `training_plan_days` reales (`useStudentConstancia` ni los trae).
- **Sin** `Math.ceil`/`floor`/redondeo: es el entero `daysPerWeek` tal cual.
- `daysPerWeek` = `training_plans.total_days ?? days_per_week ?? 3` (`useStudentConstancia.ts:178`).
- "Activo esta semana" = **solapamiento** de `[assignStart, assignEnd]` con
  `[startOfWeek, endOfWeek]`. **No** mira `status`. Toma el **primero** y `break` (§4).
- Ninguno solapa → `expectedDays = 0`.

`startOfWeek` / `endOfWeek` (`WorkoutCalendar.tsx:83-95`, cita textual):

```ts
const now = new Date();
const startOfWeek = new Date(now);
const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
startOfWeek.setDate(now.getDate() + diff);
startOfWeek.setHours(0, 0, 0, 0);               // lunes 00:00 local

const endOfWeek = new Date(startOfWeek);
endOfWeek.setDate(startOfWeek.getDate() + 6);
endOfWeek.setHours(23, 59, 59, 999);            // domingo 23:59:59.999 local
```

---

## 3. "Entrenamientos completados" (numerador)

```ts
// WorkoutCalendar.tsx:98-101  (cita textual)
const thisWeekCompletions = completions.filter((c) => {
  const completedDate = new Date(c.completedAt);
  return completedDate >= startOfWeek && completedDate <= endOfWeek;
});
```

- `completions` viene de `useWorkoutCompletions` → **TODAS** las completions del alumno
  (todos los planes).
- Filtro: instante absoluto `new Date(completed_at)` dentro de `[startOfWeek, endOfWeek]`
  (límites en hora local del dispositivo).
- Numerador = **`thisWeekCompletions.length`** = cantidad de **filas**:
  - **NO** deduplica por `day_number`.
  - **NO** deduplica por fecha.
  - **NO** filtra por `assignment_id` (una completion de otro plan del alumno cuenta).
  - **NO** filtra por `status` del assignment.

### Los `new Set(...)` — ninguno alimenta el `%`

1. `assignmentProgress.ts:60-62` — `new Set(allCompletions.map(c => c.day_number))`: dedup
   `day_number` para recalcular `completed_days`/`status` (§1.d).
2. `pendingDay.ts:90-98` — `new Set(completions.filter(...).map(c => c.day_number))`: dedup
   `day_number` para elegir el "próximo día pendiente" (no adherencia).
3. `WorkoutCalendar.tsx:67-69` — `completedDates = new Set(completions.map(c =>
   c.completedAt.slice(0,10)))`: dedup **fecha** solo para pintar el calendario.

El numerador (`thisWeekCompletions.length`) **no pasa por ningún Set**.

---

## 4. Múltiples asignaciones solapadas

- `useStudentConstancia.ts:144-181` solo **agrupa** completions por assignment y arma un
  `PlanConstancia` por assignment (no suma, no promedia).
- El **denominador** se decide en `WorkoutCalendar.tsx:105-114`: itera y toma el **PRIMERO
  que solapa** la semana actual, luego `break`. Como `plans` está ordenado por `start_date`
  DESC, gana el de **`start_date` más reciente** entre los que solapan. Los demás se ignoran
  para el denominador.
- El **numerador NO** se restringe a ese plan: cuenta todas las completions del alumno en la
  semana (§3). Con 2 planes solapados el numerador puede superar el denominador → capea a 100.

---

## 5. Sin asignación en el rango (semana)

- `calculateWeekAttendance()` devuelve `{ expected: 0, completed: <count real>, percentage: 0 }`
  (`WorkoutCalendar.tsx:121-125`). Nunca `null` / `NaN` / `{}`.
  - `percentage = expectedDays > 0 ? Math.round(...) : 0` → `0` cuando no hay plan.
- UI: si `attendance.expected > 0` muestra la barra; si no, muestra **"Sin plan activo esta
  semana"** (`WorkoutCalendar.tsx:288-295`).
- `useStudentConstancia` sin assignments → `plans = []`; el tab "Constancia" en
  `StudentProfile.tsx` muestra estado vacío pero igual renderiza `<WorkoutCalendar>`.

---

## 6. El porcentaje — fórmula exacta y formato

```ts
// WorkoutCalendar.tsx:116-125  (cita textual)
const percentage =
  expectedDays > 0
    ? Math.round((thisWeekCompletions.length / expectedDays) * 100)
    : 0;

return {
  expected: expectedDays,
  completed: thisWeekCompletions.length,
  percentage: Math.min(percentage, 100), // Cap at 100%
};
```

- Fórmula: `round( completed / expected * 100 )`, `expected = daysPerWeek` (una semana).
- `Math.round` (medio hacia arriba). Cap superior `100` con `Math.min`. Piso natural `0`.
- `expected === 0` → `0` (sin división).

Display (`WorkoutCalendar.tsx:228-296`):
- Badge `` `${attendance.percentage}%` `` (`:241`).
- Barra `style={{ width: `${attendance.percentage}%` }}` (`:249`).
- Detalle `` `${attendance.completed} de ${attendance.expected}` `` + `"entrenamientos
  completados esta semana"` (`:255-258`).
- Label de sección: **"Constancia de la semana"** (`:238`).
- Mascota: `>= 100` → `contento.webp`; `completed > 0` → `neutro.webp`; si no → `triste.webp`
  (`:264-285`).

`StudentProfile.tsx` (tab "Constancia") NO calcula ningún `%`: lista sesiones por plan y
embebe `<WorkoutCalendar>`.

---

## 7. Ventana temporal por defecto

- **No existe** parámetro de rango en ningún lado.
- Ventana fija: **semana calendario actual, lunes 00:00:00.000 → domingo 23:59:59.999**, en
  hora **local del dispositivo**, sobre `new Date()` al momento del render
  (`WorkoutCalendar.tsx:83-95`).
- No es "última semana móvil" ni "último mes" ni "desde el inicio del plan".

---

## 8. Gotchas

1. **`daysPerWeek` no es días-por-semana.** En `useStudentConstancia.ts:178` es
   `total_days ?? days_per_week ?? 3`. `total_days` = total de sesiones de TODO el plan
   (ej. 24). Si el plan tiene `total_days` seteado (siempre lo tiene: es `NOT NULL` en el
   `Insert`, ver `supabase.ts:108`), el denominador semanal queda inflado y la constancia da
   casi siempre bajísima. `useActiveAssignment.ts:159-160` y `useBusinessMetrics.ts:405` usan
   `days_per_week` primero — **inconsistente entre hooks**.

2. **Estados de asignación: no se excluye ninguno** en el path de adherencia. `cancelled` /
   `paused` / `completed` cuentan como "plan activo esta semana" si su `[start_date, end_date]`
   solapa. `status = "active"` solo se filtra en `useActiveAssignment.ts:104` (no participa del `%`).

3. **Zonas horarias / no hay `AT TIME ZONE`.** Ningún path del `%` usa
   `America/Argentina/Buenos_Aires` ni SQL `AT TIME ZONE`.
   - Límites de semana: `Date` local (`setHours`).
   - `completed_at`: `new Date(iso)` (instante UTC) comparado contra límites locales. Una
     completion `2026-03-02T01:26:00Z` = `2026-03-01 22:26` local (UTC-3) puede caer en otra
     semana/día.
   - `start_date`/`end_date` (`"YYYY-MM-DD"`): `new Date("2026-03-02")` se parsea como **UTC
     midnight** → en UTC-3 es `2026-03-01 21:00` local. `WorkoutCalendar.tsx:106-107` hace
     `new Date(assignment.startDate)` **sin** `T00:00:00` → ~3h de skew en el solape.
   - Nota: `pendingDay.ts` y `assignmentProgress.ts` **sí** convierten a fecha local
     (`toLocalDateStr`) — pero usan la TZ del runtime, no una fija.

4. **Numerador cuenta filas duplicadas.** Dos `workout_completions` del mismo `day_number` en
   la misma semana → cuentan 2. No hay unique constraint sobre `(assignment_id, day_number)`;
   el upsert de la cola es solo `onConflict: "id"` (UUID de cliente), no impide que el alumno
   complete el mismo día dos veces a propósito.

5. **Numerador ignora el plan.** Completions de otro plan (o de un plan `cancelled`) del mismo
   alumno, dentro de la semana, suman al numerador aunque el denominador sea de otro plan (§4).

6. **Cola offline (`offlineWorkoutQueue.ts`) desfasa `completed_at`.** Ver §9.

7. **Tipos generados desactualizados.** `useStudentConstancia.ts:137` selecciona
   `initial_mood`, pero `workout_completions.Row` en `src/lib/supabase.ts:266-281` **no** lo
   lista (la columna existe: se hace upsert en `offlineWorkoutQueue.ts:112`). Confiar en la
   DB, no en `supabase.ts`. Ídem `duration_minutes` (sí está en el Row) y `series_log`.

8. **RLS asumido.** Estos hooks no filtran `coach_id` a nivel query; se asume RLS en Supabase.

---

## 9. NUEVO — ¿la cola offline genera completions duplicadas o `completed_at` desfasado?

`src/lib/offlineWorkoutQueue.ts`.

### Duplicados: **NO** (por diseño)

- Cada completion lleva un `id` (`localId`) generado con `crypto.randomUUID()` **en el
  cliente**, ANTES de encolar (`useWorkoutCompletions.ts:174`).
- La escritura es siempre `upsert(..., { onConflict: "id" })` (`offlineWorkoutQueue.ts:104-121`).
  Reintentar la misma entrada N veces → 1 sola fila.
- `flushPendingCompletions` tiene guard `isFlushing` (`:174`) contra el doble disparo
  (listener `online` + retry al montar).
- Entradas que fallan quedan en `remaining` y se reintentan; las vencidas (> 7 días) se
  descartan sin escribir.
- **Único vector de duplicado** (preexistente, no lo agrega la cola): el alumno completa
  deliberadamente el mismo `day_number` dos veces → 2 UUIDs distintos → 2 filas. El `%` las
  cuenta a ambas (§8.4).

### `completed_at` desfasado: **SÍ**

- El payload del `upsert` **no incluye `completed_at`** (`offlineWorkoutQueue.ts:106-119`).
  → la DB lo setea con `default now()` **en el momento del flush/sync**, no cuando el alumno
  terminó de entrenar.
- Si el alumno entrena sin señal un sábado a la noche y la app recién sincroniza el lunes,
  la fila queda con `completed_at` del lunes → cae en OTRA semana ISO y en OTRO día.
- `queuedAt` (ISO del momento de encolar) **sí** se captura en el item de la cola, pero solo
  se usa para (a) la actualización optimista de la cache local (`completedAt: item.queuedAt`,
  `useWorkoutCompletions.ts:214`) y (b) el vencimiento a 7 días. **Nunca se escribe en la DB.**
- Consecuencia para adherencia: cualquier cálculo keyed en `completed_at` (el de la app y el
  del MCP) hereda este skew para completions creadas offline. El MCP **no puede corregirlo**
  desde su lado; requeriría que la app mande `completed_at: item.queuedAt` en el upsert.
- Efecto secundario: mientras la entrada está en la cola, la cache local (usa `queuedAt`) y la
  DB (aún sin fila) discrepan hasta el primer `fetch(true)` post-sync.

---

## 10. NUEVO — ¿`assignmentProgress.ts` / `pendingDay.ts` son funciones puras reutilizables para US-2?

### `src/lib/pendingDay.ts` — **PURA, reutilizable directamente**

```ts
export interface PendingDayCandidate { day_number: number; }
export interface CompletionForPendingDay {
  assignment_id: string;
  day_number: number;
  completed_at: string | null;
}

export function selectPendingDay<T extends PendingDayCandidate>(
  sortedDays: T[],                       // días del plan, YA ordenados por day_number
  completions: CompletionForPendingDay[],
  assignmentId: string,
  startDate: string | null,             // "YYYY-MM-DD" o null
  now: Date = new Date(),               // inyectable para tests
): T | null
```

- Sin React, sin Supabase, sin acceso a red. `now` inyectable. 7 tests en `pendingDay.test.ts`.
- Lógica: un día del plan cuenta como "completado" solo si la fecha **LOCAL** de la sesión es
  `>= max(start_date - 1 día, lunes de la semana actual)`. Dedup por `day_number` (`new Set`).
  Si están todos completos → devuelve el último día. Lista vacía → `null`. Ignora completions
  de otro `assignment_id`.
- **Para US-2 ("próximo día pendiente"):** el MCP puede reutilizarla tal cual. Lo único a
  ajustar: `toLocalDateStr` usa la TZ del runtime (`d.getFullYear()`/`getMonth()`/`getDate()`).
  Para el MCP hay que forzar `America/Argentina/Buenos_Aires` (p. ej. con `Intl.DateTimeFormat`
  o `date-fns-tz`). También asume el "reinicio semanal desde el lunes" — si US-2 quiere el día
  pendiente global (sin reinicio) hay que parametrizar la cota inferior.

### `src/lib/assignmentProgress.ts` — **NO pura**

```ts
export async function recomputeAssignmentProgress(
  studentId: string,
  assignmentId: string,
  touchedDayNumber?: number,
): Promise<{ success: boolean; error?: string }>
```

- Hace `supabase.from(...).select()` y `.update()` internamente. No se puede reutilizar como
  función pura sin extraerle el núcleo: `new Set(completions.map(c => c.day_number)).size`
  filtrado por `completed_at >= (start_date - 1 día)`, comparado contra `total_days`.
- Ese núcleo (contar `day_number` únicos en una ventana) **sí** sirve de base para el conteo
  de "días completados" que necesita el MCP, pero hay que copiarlo/re-extraerlo.

### `src/lib/rpeHelpers.ts` — **PURA** (para US-5)

`detectRpeAlert(lastThreeRpes: (number | null)[]): "high" | "low" | null` — lógica **idéntica**
a la del análisis anterior, ahora con `rpeHelpers.test.ts`. Reutilizable tal cual: `"high"` si
los 3 RPE válidos son `>= 8`, `"low"` si los 3 son `<= 3`, `null` si hay menos de 3 válidos.

---

## 11. Segundo cálculo (agregado, nivel negocio) — referencia, NO es `computeAdherence`

`src/hooks/useBusinessMetrics.ts:387-415` produce `trainingFrequency.{ real, planned }` para el
dashboard del coach. **Sin cambios** vs. el análisis anterior:

```ts
// useBusinessMetrics.ts:395-415 (cita textual abreviada)
const activeAssignments = assignments.filter((a) => {
  if (!activeStudentIds.has(a.student_id)) return false;
  const aStart = new Date(a.start_date + "T00:00:00");
  const aEnd = new Date(a.end_date + "T00:00:00");
  return aStart <= mEnd && aEnd >= mStart;              // solape con el MES
});
let totalPlannedDaysPerWeek = 0;
activeAssignments.forEach((a) => {
  const tp = Array.isArray(a.training_plans) ? a.training_plans[0] : a.training_plans;
  const daysPerWeek = tp?.days_per_week ?? 3;           // acá SÍ days_per_week
  totalPlannedDaysPerWeek += daysPerWeek;
});
const plannedFrequency = activeAssignments.length > 0
  ? Math.round((totalPlannedDaysPerWeek / activeAssignments.length) * 10) / 10   // promedio
  : 0;
const realFrequency = activeStudentsCount > 0
  ? Math.round((completionsInMonth.length / activeStudentsCount / weeksInMonth) * 10) / 10
  : 0;
```

Ventana = **mes** (`weeksInMonth = daysInMonth / 7`), usa `days_per_week`, promedia entre
alumnos/assignments. Barra: `Math.min(100, Math.round((real / planned) * 100))`. Otra función
si el MCP necesita replicar el dashboard agregado.

---

## 12. Contrato implementable — `computeAdherence` (fórmula PROPIA correcta)

Decisión ya tomada: **el MCP NO replica el cálculo bugueado de la app.** Implementa una
fórmula propia y correcta.

- Denominador = `days_per_week × overlap_weeks` (semanas de solape entre el plan y el rango).
- Numerador = completions **deduplicadas** por `(day_number, fecha local)`.
- TZ fija: `America/Argentina/Buenos_Aires` para toda conversión de instante → fecha local.
- Excluye assignments con `status = "cancelled"`.
- Rango arbitrario (no solo "semana actual").

```ts
interface AdherenceInput {
  /** Rango de evaluación, inclusivo, en fechas locales AR. */
  from: string;            // "YYYY-MM-DD"
  to: string;              // "YYYY-MM-DD"
  timeZone?: string;       // default "America/Argentina/Buenos_Aires"

  assignments: Array<{
    id: string;
    startDate: string;     // "YYYY-MM-DD"
    endDate: string;       // "YYYY-MM-DD"
    status: "active" | "completed" | "paused" | "cancelled";
    daysPerWeek: number;   // training_plans.days_per_week  (NO total_days)
  }>;

  completions: Array<{
    assignmentId: string;
    dayNumber: number;
    completedAt: string;   // ISO UTC (tal cual viene de workout_completions)
  }>;
}

interface AdherenceResult {
  expected: number;        // Σ daysPerWeek_i × overlapWeeks_i  (por assignment no-cancelled)
  completed: number;       // # de (assignmentId?, dayNumber, fechaLocal) únicos en el rango
  percentage: number;      // clamp(round(completed / expected * 100), 0, 100); 0 si expected === 0
  hasPlanInRange: boolean; // expected > 0
  perAssignment: Array<{ assignmentId: string; expected: number; completed: number }>;
}

function computeAdherence(input: AdherenceInput): AdherenceResult {
  const tz = input.timeZone ?? "America/Argentina/Buenos_Aires";
  const rangeStart = localDateToInstant(input.from, tz);           // 00:00 AR
  const rangeEnd   = endOfLocalDay(input.to, tz);                  // 23:59:59.999 AR

  const plans = input.assignments.filter(a => a.status !== "cancelled");

  // 1. Denominador: por cada assignment, semanas de solape con el rango
  let expected = 0;
  const perAssignment = [];
  for (const a of plans) {
    const aStart = localDateToInstant(a.startDate, tz);
    const aEnd   = endOfLocalDay(a.endDate, tz);
    const from = maxInstant(aStart, rangeStart);
    const to   = minInstant(aEnd, rangeEnd);
    if (to < from) { perAssignment.push({ assignmentId: a.id, expected: 0, completed: 0 }); continue; }

    const overlapDays  = (to - from) / 86_400_000;                 // días calendario
    const overlapWeeks = overlapDays / 7;                          // fraccional (sin redondear acá)
    const exp = a.daysPerWeek * overlapWeeks;
    expected += exp;
    perAssignment.push({ assignmentId: a.id, expected: exp, completed: 0 });
  }

  // 2. Numerador: dedup por (assignmentId, dayNumber, fecha local AR) dentro del rango
  const planIds = new Set(plans.map(a => a.id));
  const seen = new Set<string>();
  for (const c of input.completions) {
    if (!planIds.has(c.assignmentId)) continue;                    // ignora planes cancelled / ajenos
    const t = new Date(c.completedAt).getTime();
    if (t < rangeStart || t > rangeEnd) continue;
    const localDay = instantToLocalDate(c.completedAt, tz);        // "YYYY-MM-DD" en AR
    const key = `${c.assignmentId}|${c.dayNumber}|${localDay}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const pa = perAssignment.find(p => p.assignmentId === c.assignmentId);
    if (pa) pa.completed++;
  }
  const completed = seen.size;

  // 3. Porcentaje
  const expectedRounded = Math.round(expected);                    // redondeo final del denominador
  const percentage = expectedRounded > 0
    ? Math.min(Math.max(Math.round((completed / expectedRounded) * 100), 0), 100)
    : 0;

  return {
    expected: expectedRounded,
    completed,
    percentage,
    hasPlanInRange: expectedRounded > 0,
    perAssignment,
  };
}
```

### Decisiones fijadas (divergencias explícitas vs. la app)

| Aspecto | App (buggy) | `computeAdherence` (MCP) |
|---|---|---|
| Campo del denominador | `total_days ?? days_per_week ?? 3` | **`days_per_week`** |
| Semanas del denominador | siempre 1 | **`overlap_weeks` reales** (fraccional, redondeo final) |
| Dedup del numerador | ninguno (cuenta filas) | **`(assignmentId, day_number, fecha local)`** |
| TZ | del dispositivo | **`America/Argentina/Buenos_Aires`** fija |
| `status` | no filtra nada | **excluye `cancelled`** (paused/completed sí cuentan) |
| Múltiples planes solapados | denominador de 1, numerador de todos | **suma por assignment** (`perAssignment` + total) |
| Rango | solo "semana actual" | **`from`/`to` arbitrario** |
| Sin plan en rango | `{expected:0, completed:count, percentage:0}` | `{expected:0, completed:0, percentage:0, hasPlanInRange:false}` |

### ¿Hay una función pura del repo que sirva de base?

- **`pendingDay.ts:selectPendingDay`** — no para el `%`, pero sí como **referencia de la
  conversión instante→fecha-local** y del patrón "dedup por `day_number` en una ventana".
  Copiar el enfoque de `toLocalDateStr` pero fijando la TZ (el original usa la del runtime).
- **`assignmentProgress.ts`** — su núcleo (`new Set(day_number).size` en ventana
  `completed_at >= start_date - 1d`) es la semilla del conteo de "días completados", pero está
  acoplado a Supabase: hay que re-extraerlo como función pura.
- **Nada en el repo calcula `overlap_weeks`** — es lógica nueva del MCP.

### Caveat de datos (no corregible desde el MCP)

Las completions creadas **offline** llegan con `completed_at` = momento del sync, no del
entrenamiento (§9). El dedup por `(day_number, fecha local)` **mitiga** duplicados pero no el
corrimiento de semana/día. Documentar como limitación conocida; la solución real es que la app
persista `queuedAt` como `completed_at` en el upsert de `offlineWorkoutQueue.ts`.
