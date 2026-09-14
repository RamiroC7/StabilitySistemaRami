import { useMemo } from "react";
import { useStudentConstancia } from "./useStudentConstancia";
import { useWorkoutCompletions } from "./useWorkoutCompletions";
import { useExerciseWeightLogs, type SetDetail } from "./useExerciseWeightLogs";

// ── Períodos ───────────────────────────────────────────────────────────────

export type FeedbackPeriod = "week" | "15d" | "21d" | "month";

export interface FeedbackPeriodConfig {
  key: FeedbackPeriod;
  tabLabel: string; // para el selector compacto
  label: string; // para el encabezado de la tarjeta
  days: number;
}

export const FEEDBACK_PERIODS: FeedbackPeriodConfig[] = [
  { key: "week", tabLabel: "Semanal", label: "Semanal", days: 7 },
  { key: "15d", tabLabel: "15 días", label: "Últimos 15 días", days: 15 },
  { key: "21d", tabLabel: "21 días", label: "Últimos 21 días", days: 21 },
  { key: "month", tabLabel: "Mensual", label: "Último mes", days: 30 },
];

// ── Types ──────────────────────────────────────────────────────────────────

export type AttendanceLevel = "complete" | "partial";
export type WeightLogStatus = "complete" | "partial" | "none";

export interface ExerciseWeeklyProgress {
  exerciseName: string;
  currentKg: number | null;
  previousKg: number | null;
  deltaKg: number | null;
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
  minutesTrained: number;
  avgRpe: number | null;
  weightLogStatus: WeightLogStatus;
  weightLogDays: number;
  exerciseProgress: ExerciseWeeklyProgress[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Ventana móvil de `days` días terminando hoy (inclusive). Se usa para los
// 4 períodos por igual, así cambiar de período no depende de en qué día de
// la semana/mes se mire el feedback.
function getRollingRange(days: number): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

// Peso de la primera serie registrada (mismo criterio que el cálculo de 1RM
// en useExerciseWeightLogs), usado como valor representativo del ejercicio.
function getFirstSetKg(setsDetail: SetDetail[]): number | null {
  const firstSet =
    setsDetail.find((s) => s.set_number === 1) ?? setsDetail[0] ?? null;
  if (!firstSet || firstSet.kg == null) return null;
  return firstSet.kg;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Cuántas sesiones "vale" un día puntual (daysPerWeek/7 del plan vigente
// ESE día). Evita estirar el daysPerWeek de un solo plan a todo el período:
// si el alumno cambió de plan o recién empezó, cada día pesa según el plan
// que realmente tenía asignado. plans ya viene ordenado por start_date
// desc, así que ante solapamientos gana el más reciente.
function dailyExpectedRate(
  plans: { startDate: string; endDate: string; daysPerWeek: number }[],
  dateKey: string,
): number {
  for (const plan of plans) {
    if (dateKey >= plan.startDate.slice(0, 10) && dateKey <= plan.endDate.slice(0, 10)) {
      return plan.daysPerWeek / 7;
    }
  }
  return 0;
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

  const data = useMemo<FeedbackData | null>(() => {
    if (!studentId) return null;

    const periodConfig =
      FEEDBACK_PERIODS.find((p) => p.key === period) ?? FEEDBACK_PERIODS[0];
    const { start, end } = getRollingRange(periodConfig.days);

    const periodCompletions = completions.filter((c) => {
      const completedDate = new Date(c.completedAt);
      return completedDate >= start && completedDate <= end;
    });

    const completedSessions = periodCompletions.length;
    const minutesTrained = periodCompletions.reduce(
      (sum, c) => sum + (c.durationMinutes ?? 0),
      0,
    );

    const rpes = periodCompletions
      .map((c) => c.rpe)
      .filter((r): r is number => r != null);
    const avgRpe =
      rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

    // Sesiones esperadas: se suma día por día según el plan realmente
    // vigente ese día (no se estira un solo daysPerWeek a todo el
    // período), así semana ⊂ 15 días ⊂ 21 días ⊂ mes queda consistente
    // incluso si el alumno cambió de plan o es nuevo. Si nunca tuvo
    // ningún plan asignado, se usa un valor por defecto de 3 días/semana
    // para todo el período (mismo fallback que antes).
    let expectedRaw = 0;
    if (plans.length === 0) {
      expectedRaw = (3 / 7) * periodConfig.days;
    } else {
      for (
        let d = new Date(start);
        d <= end;
        d.setDate(d.getDate() + 1)
      ) {
        expectedRaw += dailyExpectedRate(plans, toDateKey(d));
      }
    }
    const expectedSessions = Math.max(0, Math.round(expectedRaw));

    const attendancePercentage =
      expectedSessions > 0
        ? Math.min(Math.round((completedSessions / expectedSessions) * 100), 100)
        : completedSessions > 0
          ? 100
          : 0;
    const attendanceLevel: AttendanceLevel =
      attendancePercentage >= 100 ? "complete" : "partial";

    // Registro de pesos: por cada ejercicio con al menos un log en el
    // período, se compara contra el último log previo al inicio del
    // período (si existe) para saber si hubo avance.
    const exerciseProgress: ExerciseWeeklyProgress[] = [];
    const daysWithWeightLogs = new Set<string>();

    for (const group of groups) {
      const sortedLogs = group.logs; // ya viene ascendente por logged_at
      const periodLogs = sortedLogs.filter((l) => {
        const loggedDate = new Date(l.logged_at);
        return loggedDate >= start && loggedDate <= end;
      });
      if (periodLogs.length === 0) continue;

      for (const l of periodLogs) daysWithWeightLogs.add(l.logged_at.slice(0, 10));

      const latest = periodLogs[periodLogs.length - 1];
      const currentKg = getFirstSetKg(latest.sets_detail) ?? latest.calculated_rm ?? null;

      const priorLog = [...sortedLogs]
        .reverse()
        .find((l) => new Date(l.logged_at) < start);
      const previousKg = priorLog
        ? (getFirstSetKg(priorLog.sets_detail) ?? priorLog.calculated_rm ?? null)
        : null;

      const deltaKg =
        currentKg != null && previousKg != null
          ? Math.round((currentKg - previousKg) * 100) / 100
          : null;

      exerciseProgress.push({
        exerciseName: group.exercise_name,
        currentKg,
        previousKg,
        deltaKg,
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

    const rangeLabel = `${start.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`;

    return {
      period,
      periodLabel: periodConfig.label,
      rangeLabel,
      useSegmentedAttendance: period === "week",
      expectedSessions,
      completedSessions,
      attendancePercentage,
      attendanceLevel,
      minutesTrained,
      avgRpe,
      weightLogStatus,
      weightLogDays: daysWithWeightLogs.size,
      exerciseProgress,
    };
  }, [studentId, period, plans, completions, groups]);

  return {
    data,
    loading: loadingPlans || loadingCompletions || loadingWeightLogs,
  };
}
