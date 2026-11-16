// Aviso "Tenés cargado tu nuevo plan" para el alumno.
//
// Se muestra una sola vez por asignación (assignmentId). Si el coach edita o
// reprograma el plan actual, la asignación es la misma → no vuelve a salir.
// Para no avisarle a todos su plan actual el día que se publica esto, solo
// cuenta como "nuevo" un plan que arranca hace 7 días o menos (o en el futuro).

const STORAGE_KEY = "new_plan_notice_seen";
const MAX_REMEMBERED = 20;
export const NEW_PLAN_WINDOW_DAYS = 7;

export function shouldAnnounceNewPlan(
  assignment: { assignmentId: string; startDate: string },
  seenIds: string[],
  now: Date = new Date(),
): boolean {
  if (!assignment.assignmentId || seenIds.includes(assignment.assignmentId)) return false;
  const start = new Date(`${assignment.startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return false;
  const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() - NEW_PLAN_WINDOW_DAYS);
  return start >= limit;
}

export function readSeenPlanNotices(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markPlanNoticeSeen(assignmentId: string): void {
  try {
    const ids = readSeenPlanNotices().filter((id) => id !== assignmentId);
    ids.push(assignmentId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-MAX_REMEMBERED)));
  } catch {
    // Sin localStorage: en el peor caso el aviso vuelve a salir otro día.
  }
}
