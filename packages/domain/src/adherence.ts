/**
 * `computeAdherence` — US-2, formula PROPIA y correcta (NO replica la app).
 *
 * La app (`WorkoutCalendar.calculateWeekAttendance`) tiene un calculo de
 * adherencia bugueado: usa `total_days` como si fuera dias/semana, solo mira
 * la semana actual, y no dedupe el numerador. Ver
 * `specs/mcp-server/notes-adherence.md` para el relevamiento completo y
 * `specs/mcp-server/design.md` > "Key flows" > "Calculo de adherencia (US-2)"
 * para las reglas exactas que esta funcion implementa:
 *
 *   1. Para cada assignment con `status !== 'cancelled'`: se calculan las
 *      semanas de solape entre `[startDate, endDate]` y `[from, to]`
 *      (fraccional, sin redondear), y `expected = daysPerWeek * overlapWeeks`.
 *   2. `expectedWorkouts` = suma de todos los `expected`.
 *   3. `completedWorkouts` = completions con `completedAt` (convertido a la
 *      TZ fija) dentro de `[from, to]`, deduplicadas por
 *      `(dayNumber, fecha local)` — SIN mirar a que assignment pertenecen.
 *   4. `adherencePct = expectedWorkouts > 0 ? round(completed/expected*100) : null`.
 *      Sin tope superior (puede pasar 100).
 *   5. `hasAssignmentInRange` = hubo al menos un assignment no cancelado con
 *      solape > 0 dias con el rango pedido.
 *
 * Funcion PURA: no hace I/O. El caller (el tool `get_student_adherence`)
 * arma `AdherenceInput` a partir de filas ya traidas de la base.
 */
import { DEFAULT_TIME_ZONE, instantToLocalDateStr, zonedDateTimeToInstant } from "./timezone.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AdherenceAssignmentInput {
  id: string;
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "YYYY-MM-DD" */
  endDate: string;
  status: string;
  /** `training_plans.days_per_week` — NUNCA `total_days` (ver notes-adherence.md §8.1). */
  daysPerWeek: number;
}

export interface AdherenceCompletionInput {
  dayNumber: number;
  /** ISO UTC, tal cual viene de `workout_completions.completed_at`. */
  completedAt: string;
}

export interface AdherenceInput {
  /** "YYYY-MM-DD", inclusive. */
  from: string;
  /** "YYYY-MM-DD", inclusive. */
  to: string;
  /** Default `DEFAULT_TIME_ZONE`. */
  timeZone?: string;
  assignments: AdherenceAssignmentInput[];
  completions: AdherenceCompletionInput[];
}

export interface AdherencePerAssignment {
  id: string;
  /** Semanas de solape entre el assignment y el rango pedido (fraccional). */
  overlapWeeks: number;
  /** `daysPerWeek * overlapWeeks` para este assignment. */
  expected: number;
}

export interface AdherenceResult {
  hasAssignmentInRange: boolean;
  /** Fraccional — el redondeo final es solo sobre `adherencePct`. */
  expectedWorkouts: number;
  /** Dedup por `(dayNumber, fecha local)`. */
  completedWorkouts: number;
  /** `null` cuando `expectedWorkouts === 0` (US-2: nunca `0%` en ese caso). */
  adherencePct: number | null;
  perAssignment: AdherencePerAssignment[];
}

export function computeAdherence(input: AdherenceInput): AdherenceResult {
  const timeZone = input.timeZone ?? DEFAULT_TIME_ZONE;

  const rangeStart = zonedDateTimeToInstant(input.from, "00:00:00.000", timeZone);
  const rangeEnd = zonedDateTimeToInstant(input.to, "23:59:59.999", timeZone);

  const activeAssignments = input.assignments.filter((a) => a.status !== "cancelled");

  let expectedWorkouts = 0;
  let hasAssignmentInRange = false;
  const perAssignment: AdherencePerAssignment[] = [];

  for (const assignment of activeAssignments) {
    const assignmentStart = zonedDateTimeToInstant(assignment.startDate, "00:00:00.000", timeZone);
    const assignmentEnd = zonedDateTimeToInstant(assignment.endDate, "23:59:59.999", timeZone);

    const overlapStart = Math.max(assignmentStart, rangeStart);
    const overlapEnd = Math.min(assignmentEnd, rangeEnd);
    // +1ms: overlapEnd cae en el limite "23:59:59.999" de un dia (inclusive),
    // asi que un solo dia de solape da overlapMs === MS_PER_DAY exacto, no
    // MS_PER_DAY - 1. Equivale a "dias de solape + 1" contando por fecha,
    // que es la formula de design.md (rule 1).
    const overlapMs = overlapEnd - overlapStart + 1;

    if (overlapMs <= 0) {
      perAssignment.push({ id: assignment.id, overlapWeeks: 0, expected: 0 });
      continue;
    }

    hasAssignmentInRange = true;
    const overlapWeeks = overlapMs / MS_PER_DAY / 7;
    const expected = assignment.daysPerWeek * overlapWeeks;

    expectedWorkouts += expected;
    perAssignment.push({ id: assignment.id, overlapWeeks, expected });
  }

  const seenCompletions = new Set<string>();
  for (const completion of input.completions) {
    const instant = new Date(completion.completedAt).getTime();
    if (Number.isNaN(instant) || instant < rangeStart || instant > rangeEnd) continue;

    const localDate = instantToLocalDateStr(completion.completedAt, timeZone);
    seenCompletions.add(`${completion.dayNumber}|${localDate}`);
  }
  const completedWorkouts = seenCompletions.size;

  const adherencePct =
    expectedWorkouts > 0 ? Math.round((completedWorkouts / expectedWorkouts) * 100) : null;

  return {
    hasAssignmentInRange,
    expectedWorkouts,
    completedWorkouts,
    adherencePct,
    perAssignment,
  };
}
