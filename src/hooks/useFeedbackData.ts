import { useMemo } from "react";
import { useStudentConstancia } from "./useStudentConstancia";
import { useWorkoutCompletions } from "./useWorkoutCompletions";
import { useExerciseWeightLogs, type SetDetail } from "./useExerciseWeightLogs";

// ── Períodos ───────────────────────────────────────────────────────────────
// El feedback dejó de ser una ventana móvil ("últimos N días") elegible en
// cualquier momento: ahora es un reporte de semana o mes CALENDARIO fijo,
// visible solo durante una ventana horaria puntual en horario Argentina (ver
// getFeedbackAvailability más abajo). Las opciones "15 días" y "21 días" se
// eliminaron.

export type FeedbackPeriod = "week" | "month";

export interface FeedbackPeriodConfig {
  key: FeedbackPeriod;
  tabLabel: string;
}

export const FEEDBACK_PERIODS: FeedbackPeriodConfig[] = [
  { key: "week", tabLabel: "Semanal" },
  { key: "month", tabLabel: "Mensual" },
];

const ART_TZ = "America/Argentina/Buenos_Aires";

// ── Disponibilidad (horario Argentina) ──────────────────────────────────────
//
// Argentina no tiene horario de verano desde 2009: es UTC-3 todo el año. Al
// ser un offset fijo, alcanza con correr el instante UTC y leer sus
// componentes UTC para obtener la "hora de pared" en ART, sin depender de la
// zona horaria del dispositivo que ejecuta el código (navegador del
// profesor, servidor, test runner, etc.) ni de una librería de timezones.
const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

interface ArtParts {
  year: number;
  month: number; // 0-indexado, como Date
  date: number;
  weekday: number; // 0 = domingo ... 6 = sábado
}

function toArtParts(instant: Date): ArtParts {
  const shifted = new Date(instant.getTime() - ART_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

// Inversa de toArtParts: instante UTC real de una fecha/hora "de pared" ART.
// year/month/date pueden desbordar (día 0, día 32, mes 12, etc.) — Date los
// normaliza correctamente (ej. día 0 de un mes = último día del anterior).
function artWallClockToUtc(
  year: number,
  month: number,
  date: number,
  hours: number,
  minutes = 0,
): Date {
  return new Date(Date.UTC(year, month, date, hours, minutes, 0, 0) + ART_OFFSET_MS);
}

function artDayStart(year: number, month: number, date: number): Date {
  return artWallClockToUtc(year, month, date, 0, 0);
}

// Fin de día inclusive (23:59:59.999 ART), calculado como "1ms antes de la
// medianoche siguiente" para no reimplementar el redondeo de segundos/ms.
function artDayEndInclusive(year: number, month: number, date: number): Date {
  return new Date(artWallClockToUtc(year, month, date + 1, 0, 0).getTime() - 1);
}

export interface FeedbackAvailability {
  available: boolean;
  rangeStart: Date;
  rangeEnd: Date;
  // Próximo instante (>= now) en que este período se habilita. Si
  // `available` ya es true no se usa para nada (la ventana actual sigue
  // vigente), solo tiene sentido para armar el mensaje de "disponible el...".
  nextAvailableAt: Date;
}

// Semanal: semana calendario lunes-domingo. El reporte de la semana que
// termina un domingo se habilita ESE domingo a las 10:00 ART (ya terminó el
// entrenamiento de la semana) y sigue visible hasta el lunes siguiente a las
// 20:00 ART — ese lunes es un día "de repaso", no se suma a la semana
// reportada. Fuera de esa ventana (martes a sábado, domingo antes de las 10,
// o lunes después de las 20) no está disponible.
function getWeeklyFeedbackWindow(now: Date): FeedbackAvailability {
  const p = toArtParts(now);

  // Domingo de referencia: si hoy es domingo o lunes, es el domingo de la
  // ventana vigente (hoy o ayer); cualquier otro día, el domingo más
  // reciente ya pasado (la ventana ya está cerrada, pero sirve de ancla
  // para calcular el rango). p.weekday funciona como corrimiento único para
  // los 3 casos: domingo=0 (hoy), lunes=1 (ayer), resto retrocede hasta el
  // domingo anterior. Se ancla al mediodía para evitar cualquier ambigüedad
  // de límite de día al normalizar con Date.UTC.
  const sundayAnchor = artWallClockToUtc(p.year, p.month, p.date - p.weekday, 12, 0);
  const sp = toArtParts(sundayAnchor);

  const windowStart = artWallClockToUtc(sp.year, sp.month, sp.date, 10, 0);
  const windowEnd = artWallClockToUtc(sp.year, sp.month, sp.date + 1, 20, 0);
  const available = now >= windowStart && now < windowEnd;

  const rangeStart = artDayStart(sp.year, sp.month, sp.date - 6);
  const rangeEnd = artDayEndInclusive(sp.year, sp.month, sp.date);

  const daysUntilNextSunday = (7 - p.weekday) % 7;
  const nextAvailableAt = artWallClockToUtc(
    p.year,
    p.month,
    p.date + daysUntilNextSunday,
    10,
    0,
  );

  return { available, rangeStart, rangeEnd, nextAvailableAt };
}

// Mensual: se habilita todo el día 1 del mes (00:00 a 23:59:59.999 ART) y
// muestra el mes calendario anterior completo.
function getMonthlyFeedbackWindow(now: Date): FeedbackAvailability {
  const p = toArtParts(now);
  const available = p.date === 1;

  // Date.UTC(year, month, 0) = "día 0" del mes actual = último día del mes
  // anterior. Da mes/año anteriores correctos sin lógica manual para
  // diciembre -> enero ni para la cantidad de días de cada mes (incluye
  // años bisiestos).
  const prevMonthLastDay = new Date(Date.UTC(p.year, p.month, 0));
  const prevYear = prevMonthLastDay.getUTCFullYear();
  const prevMonth = prevMonthLastDay.getUTCMonth();
  const prevMonthDays = prevMonthLastDay.getUTCDate();

  const rangeStart = artDayStart(prevYear, prevMonth, 1);
  const rangeEnd = artDayEndInclusive(prevYear, prevMonth, prevMonthDays);

  const nextAvailableAt = available
    ? artDayStart(p.year, p.month, 1) // ya disponible; no se usa en la UI
    : artDayStart(p.year, p.month + 1, 1);

  return { available, rangeStart, rangeEnd, nextAvailableAt };
}

export function getFeedbackAvailability(
  period: FeedbackPeriod,
  now: Date = new Date(),
): FeedbackAvailability {
  return period === "week"
    ? getWeeklyFeedbackWindow(now)
    : getMonthlyFeedbackWindow(now);
}

// ── Recordatorio ("hoy toca enviar feedback") ───────────────────────────────
//
// A diferencia de getFeedbackAvailability (que dice si HOY se puede ABRIR el
// feedback de un alumno puntual), esto es el aviso general para el
// profesor: "hoy es un día de feedback". Corre los lunes completos (aviso
// semanal) y el día 1 de cada mes completo (aviso mensual) — puede haber
// hasta 2 avisos el mismo día si un 1° cae lunes.
export interface FeedbackReminder {
  key: "week" | "month";
  message: string;
}

export function getFeedbackReminders(now: Date = new Date()): FeedbackReminder[] {
  const p = toArtParts(now);
  const reminders: FeedbackReminder[] = [];

  if (p.weekday === 1) {
    reminders.push({ key: "week", message: "Feedback semanal" });
  }

  if (p.date === 1) {
    const prevMonthLastDay = new Date(Date.UTC(p.year, p.month, 0));
    const monthName = prevMonthLastDay.toLocaleDateString("es-AR", {
      month: "long",
      timeZone: "UTC",
    });
    reminders.push({
      key: "month",
      // Salto de línea intencional: en el toast "¡envía los feedback!" va
      // en su propia línea, debajo de "Finalizó <mes>".
      message: `Finalizó ${monthName}\n¡envía los feedback!`,
    });
  }

  return reminders;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type AttendanceLevel = "complete" | "partial";
export type WeightLogStatus = "complete" | "partial" | "none";

export interface ExerciseWeeklyProgress {
  exerciseName: string;
  currentKg: number | null;
  previousKg: number | null;
  deltaKg: number | null;
  currentReps: number | null;
  previousReps: number | null;
  // Progresó de verdad en el período: el 1RM estimado (Epley, contempla
  // peso Y repeticiones a la vez) subió respecto del último registro
  // previo al período. Subir solo el peso, solo las reps, o ambos, cuenta
  // — comparar nada más el kg de la primera serie (como antes) ignoraba
  // el caso "mismo peso, más repeticiones" como progreso real.
  isRecord: boolean;
}

export interface FeedbackData {
  period: FeedbackPeriod;
  periodLabel: string;
  rangeLabel: string;
  useSegmentedAttendance: boolean; // pills por día (solo período semanal)
  expectedSessions: number;
  completedSessions: number;
  attendancePercentage: number; // 0-100, capped
  attendanceLevel: AttendanceLevel;
  avgMinutesPerSession: number | null;
  avgRpe: number | null;
  weightLogStatus: WeightLogStatus;
  weightLogDays: number;
  exerciseProgress: ExerciseWeeklyProgress[];
}

export type FeedbackResult =
  | { available: true; data: FeedbackData }
  | { available: false; nextAvailableAt: Date };

// Formas de entrada minimas que necesita el calculo (subset de los tipos
// reales de useStudentConstancia / useWorkoutCompletions / useExerciseWeightLogs),
// para poder testear la logica pura con fixtures sin pasar por Supabase.
export interface FeedbackPlanInput {
  startDate: string;
  endDate: string;
  daysPerWeek: number;
}

export interface FeedbackCompletionInput {
  completedAt: string;
  durationMinutes: number | null;
  rpe: number | null;
}

export interface FeedbackExerciseLogInput {
  logged_at: string;
  sets_detail: SetDetail[];
  calculated_rm?: number | null;
}

export interface FeedbackExerciseGroupInput {
  exercise_name: string;
  logs: FeedbackExerciseLogInput[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatArtDate(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: ART_TZ,
  });
}

// "Diciembre 2025" en vez de "1 dic – 31 dic": para un reporte de mes
// completo, el rango día a día no agrega información (siempre es el mes
// entero) y sin año es ambiguo al cruzar de año (ej. mirando en enero el
// feedback de diciembre del año anterior).
function formatArtMonthYear(d: Date): string {
  const label = d.toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: ART_TZ,
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Primera serie registrada (mismo criterio que el cálculo de 1RM en
// useExerciseWeightLogs), usada como set representativo del ejercicio.
function getFirstSet(setsDetail: SetDetail[]): SetDetail | null {
  return setsDetail.find((s) => s.set_number === 1) ?? setsDetail[0] ?? null;
}

function getFirstSetKg(setsDetail: SetDetail[]): number | null {
  const firstSet = getFirstSet(setsDetail);
  if (!firstSet || firstSet.kg == null) return null;
  return firstSet.kg;
}

function getFirstSetReps(setsDetail: SetDetail[]): number | null {
  const firstSet = getFirstSet(setsDetail);
  if (!firstSet || firstSet.actual_reps == null) return null;
  const reps = parseFloat(firstSet.actual_reps);
  return Number.isFinite(reps) ? reps : null;
}

// Clave "YYYY-MM-DD" del día en ART (NO en la zona horaria local del
// dispositivo que corre el código). Usar d.getFullYear()/getMonth()/getDate()
// acá sería un bug real: esos getters devuelven la fecha en la zona horaria
// del navegador de quien mira la pantalla, no en Argentina. Si el profesor
// tiene su equipo en otro huso horario (o incluso solo en un instante cerca
// de la medianoche), el día calculado se corre uno respecto al real, y la
// comparación de fecha contra los planes (dateKey >= plan.startDate...) deja
// de matchear ningún plan — expectedSessions da 0 aunque el alumno sí tenga
// un plan vigente y haya entrenado.
function toDateKey(d: Date): string {
  const p = toArtParts(d);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.date).padStart(2, "0")}`;
}

// Devuelve daysPerWeek "crudo" (no dividido por 7) del plan vigente ese día.
// Sumar estos enteros y dividir una sola vez al final (ver expectedRaw7 más
// abajo) evita arrastrar error de punto flotante: sumar daysPerWeek/7 día
// por día (ej. 3/7 = 0.42857142857142855, no representable exacto) muchas
// veces puede dar 2.9999999999999996 en vez de 3 — con Math.round no se
// notaba, pero con Math.floor eso se redondeaba hacia abajo de más.
function dailyExpectedDaysPerWeek(
  plans: FeedbackPlanInput[],
  dateKey: string,
): number {
  for (const plan of plans) {
    if (dateKey >= plan.startDate.slice(0, 10) && dateKey <= plan.endDate.slice(0, 10)) {
      return plan.daysPerWeek;
    }
  }
  return 0;
}

// ── Cálculo puro (testeable sin Supabase ni hooks de React) ────────────────

export function computeFeedbackData(
  period: FeedbackPeriod,
  plans: FeedbackPlanInput[],
  completions: FeedbackCompletionInput[],
  groups: FeedbackExerciseGroupInput[],
  now: Date = new Date(),
): FeedbackResult {
  const availability = getFeedbackAvailability(period, now);
  if (!availability.available) {
    return { available: false, nextAvailableAt: availability.nextAvailableAt };
  }

  const { rangeStart: start, rangeEnd: end } = availability;

  const periodCompletions = completions.filter((c) => {
    const completedDate = new Date(c.completedAt);
    return completedDate >= start && completedDate <= end;
  });

  const completedSessions = periodCompletions.length;

  // Promedio solo sobre sesiones que realmente tienen duración registrada.
  // durationMinutes queda null cuando la sesión se guardó sin el timer en
  // vivo corriendo (ej. carga manual/"guardado rápido" sin workoutStartedAt
  // — ver QuickSaveModal.tsx). Antes se sumaba tratando null como 0 y se
  // dividía por TODAS las sesiones completadas: si ninguna tenía duración
  // cargada, daba "0 min" — un promedio falso, no "sin datos".
  const durationsLogged = periodCompletions
    .map((c) => c.durationMinutes)
    .filter((m): m is number => m != null);
  const avgMinutesPerSession =
    durationsLogged.length > 0
      ? Math.round(durationsLogged.reduce((a, b) => a + b, 0) / durationsLogged.length)
      : null;

  const rpes = periodCompletions
    .map((c) => c.rpe)
    .filter((r): r is number => r != null);
  const avgRpe =
    rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

  // Sesiones esperadas: se suma día por día según el plan realmente vigente
  // ESE día (no se estira un solo daysPerWeek a todo el período), para que
  // un cambio de plan a mitad de la semana/mes no distorsione lo esperado.
  // Si nunca tuvo ningún plan asignado, se usa un valor por defecto de 3
  // días/semana para todo el período (mismo fallback que antes).
  //
  // Se acumula daysPerWeek SIN dividir (expectedRaw7 = suma de "séptimos"),
  // y se divide por 7 una sola vez al final para no arrastrar error de
  // punto flotante (ver comentario en dailyExpectedDaysPerWeek).
  // rangeEnd es inclusive y termina 1ms antes de la medianoche siguiente
  // (ver artDayEndInclusive), así que (end - start) ya equivale a "N días
  // menos 1ms" — Math.round lo lleva a N directo, sin sumar 1 aparte.
  const rangeDays = Math.round(
    (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  let expectedRaw7 = 0;
  if (plans.length === 0) {
    expectedRaw7 = 3 * rangeDays;
  } else {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      expectedRaw7 += dailyExpectedDaysPerWeek(plans, toDateKey(d));
    }
  }
  // Floor (no round): el objetivo esperado es una tasa continua
  // (daysPerWeek/7 por día) que solo da un entero "limpio" cuando el rango
  // es múltiplo de 7 días. Redondear hacia arriba castigaba una fracción de
  // semana incompleta con un entrenamiento "faltante" que nunca existió.
  const expectedSessions = Math.max(0, Math.floor(expectedRaw7 / 7));

  const attendancePercentage =
    expectedSessions > 0
      ? Math.min(Math.round((completedSessions / expectedSessions) * 100), 100)
      : completedSessions > 0
        ? 100
        : 0;
  const attendanceLevel: AttendanceLevel =
    attendancePercentage >= 100 ? "complete" : "partial";

  // Progreso de fuerza: por cada ejercicio con al menos un log en el
  // período, se compara contra el último log previo al inicio del período
  // (si existe) para saber si hubo un récord (1RM estimado más alto).
  const exerciseProgress: ExerciseWeeklyProgress[] = [];
  const daysWithWeightLogs = new Set<string>();

  for (const group of groups) {
    const sortedLogs = group.logs; // ya viene ascendente por logged_at
    const periodLogs = sortedLogs.filter((l) => {
      const loggedDate = new Date(l.logged_at);
      return loggedDate >= start && loggedDate <= end;
    });
    if (periodLogs.length === 0) continue;

    // Día en ART (no el corte crudo del string UTC): un registro a las
    // 00:30 UTC puede ser todavía "ayer" en Argentina.
    for (const l of periodLogs) daysWithWeightLogs.add(toDateKey(new Date(l.logged_at)));

    const latest = periodLogs[periodLogs.length - 1];
    const currentKg = getFirstSetKg(latest.sets_detail) ?? latest.calculated_rm ?? null;
    const currentReps = getFirstSetReps(latest.sets_detail);

    const priorLog = [...sortedLogs]
      .reverse()
      .find((l) => new Date(l.logged_at) < start);
    const previousKg = priorLog
      ? (getFirstSetKg(priorLog.sets_detail) ?? priorLog.calculated_rm ?? null)
      : null;
    const previousReps = priorLog ? getFirstSetReps(priorLog.sets_detail) : null;

    const deltaKg =
      currentKg != null && previousKg != null
        ? Math.round((currentKg - previousKg) * 100) / 100
        : null;

    const currentRm = latest.calculated_rm ?? null;
    const previousRm = priorLog?.calculated_rm ?? null;
    const isRecord =
      currentRm != null && previousRm != null && currentRm - previousRm > 0.01;

    exerciseProgress.push({
      exerciseName: group.exercise_name,
      currentKg,
      previousKg,
      deltaKg,
      currentReps,
      previousReps,
      isRecord,
    });
  }

  let weightLogStatus: WeightLogStatus;
  if (exerciseProgress.length === 0) {
    weightLogStatus = "none";
  } else if (daysWithWeightLogs.size < completedSessions) {
    weightLogStatus = "partial";
  } else {
    weightLogStatus = "complete";
  }

  const rangeLabel =
    period === "month"
      ? formatArtMonthYear(start)
      : `${formatArtDate(start)} – ${formatArtDate(end)}`;

  const data: FeedbackData = {
    period,
    periodLabel: period === "week" ? "Semanal" : "Mensual",
    rangeLabel,
    useSegmentedAttendance: period === "week",
    expectedSessions,
    completedSessions,
    attendancePercentage,
    attendanceLevel,
    avgMinutesPerSession,
    avgRpe,
    weightLogStatus,
    weightLogDays: daysWithWeightLogs.size,
    exerciseProgress,
  };

  return { available: true, data };
}

// TEMPORAL (QA): permite forzar el "now" del feedback con
// ?feedbackNow=2026-06-01T10:00:00-03:00 en la URL, para poder probar las
// ventanas de disponibilidad con datos reales sin esperar al día/hora real.
// Sacar esta función y su uso en useFeedbackData una vez terminada la prueba.
export function getDebugNowOverride(): Date | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = new URLSearchParams(window.location.search).get("feedbackNow");
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useFeedbackData(
  studentId: string | undefined,
  period: FeedbackPeriod,
) {
  const { plans, isLoading: loadingPlans } = useStudentConstancia(studentId);
  const { completions, loading: loadingCompletions } =
    useWorkoutCompletions(studentId);
  const { groups, loading: loadingWeightLogs } =
    useExerciseWeightLogs(studentId);

  const result = useMemo<FeedbackResult | null>(() => {
    if (!studentId) return null;
    const debugNow = getDebugNowOverride();
    return debugNow
      ? computeFeedbackData(period, plans, completions, groups, debugNow)
      : computeFeedbackData(period, plans, completions, groups);
  }, [studentId, period, plans, completions, groups]);

  return {
    result,
    loading: loadingPlans || loadingCompletions || loadingWeightLogs,
  };
}
