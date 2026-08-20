// Extraido de useActiveAssignment.ts para poder testearlo sin depender de
// React, Supabase ni del resto del hook — es logica pura de fechas.

export interface PendingDayCandidate {
  day_number: number;
}

export interface CompletionForPendingDay {
  assignment_id: string;
  day_number: number;
  completed_at: string | null;
}

/**
 * Elige el proximo dia pendiente de entrenar para un alumno, a partir de
 * los dias del plan (ya ordenados por day_number) y sus entrenamientos
 * completados.
 *
 * Regla: un dia del plan cuenta como "completado" solo si la fecha LOCAL
 * (no UTC) de esa sesion es >= al mayor entre (start_date - 1 dia) y el
 * lunes de la semana actual. Esto hace que:
 *  - un entrenamiento cerca de medianoche (ej: 22:26 hora Argentina) se
 *    cuente en el dia local correcto, aunque en UTC ya sea el dia
 *    siguiente (completed_at se guarda en UTC).
 *  - cada semana "reinicie" el conteo de dias completados desde el lunes,
 *    para que un alumno con plan de varias semanas siga viendo el dia
 *    correcto de ESTA semana, no arrastre completados de semanas viejas.
 *
 * Si todos los dias del plan ya estan completados (segun esa ventana),
 * devuelve el ultimo dia. Si la lista de dias esta vacia, devuelve null.
 *
 * "now" es inyectable para tests (via vi.setSystemTime en produccion se
 * usa el reloj real, sin pasar el parametro).
 */
export function selectPendingDay<T extends PendingDayCandidate>(
  sortedDays: T[],
  completions: CompletionForPendingDay[],
  assignmentId: string,
  startDate: string | null,
  now: Date = new Date(),
): T | null {
  const toLocalDateStr = (iso: string) => {
    const d = new Date(iso);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  };

  const assignmentStartDay = startDate ? startDate.slice(0, 10) : null;

  let assignmentStartDayMinus1: string | null = null;
  if (assignmentStartDay) {
    const d = new Date(assignmentStartDay + "T00:00:00");
    d.setDate(d.getDate() - 1);
    assignmentStartDayMinus1 =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");
  }

  const getMondayOfCurrentWeekStr = (): string => {
    const dayOfWeek = now.getDay(); // 0=Dom, 1=Lun, ...
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return (
      monday.getFullYear() +
      "-" +
      String(monday.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(monday.getDate()).padStart(2, "0")
    );
  };

  const currentWeekMondayLocal = getMondayOfCurrentWeekStr();

  // Cota inferior efectiva: la mas reciente entre "un dia antes del inicio
  // del plan" y "el lunes de esta semana".
  const effectiveLowerBound =
    assignmentStartDayMinus1 && assignmentStartDayMinus1 > currentWeekMondayLocal
      ? assignmentStartDayMinus1
      : currentWeekMondayLocal;

  const completedDayNumbers = new Set(
    completions
      .filter((c) => {
        if (c.assignment_id !== assignmentId) return false;
        const completedLocalDay = toLocalDateStr(c.completed_at ?? "");
        return completedLocalDay >= effectiveLowerBound;
      })
      .map((c) => c.day_number),
  );

  let dayData = sortedDays.find((day) => !completedDayNumbers.has(day.day_number));
  if (!dayData && sortedDays.length > 0) {
    dayData = sortedDays[sortedDays.length - 1];
  }

  return dayData ?? null;
}
