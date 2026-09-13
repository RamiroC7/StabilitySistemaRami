// Recalcula completed_days de una asignacion a partir de las filas reales en
// workout_completions — es la misma logica que ya usaba performCompletionSync
// al guardar, extraida aca para poder reutilizarla tambien al borrar un
// entrenamiento (sin duplicarla).
//
// NO toca `status`: total_days es la cantidad de dias DISTINTOS de la
// plantilla semanal (no la duracion real del programa), asi que
// "completed_days >= total_days" no es un criterio valido de "plan
// terminado" — marcaria completado a cualquier alumno que termine su primera
// semana. El status pasa a 'completed' solo por accion del coach o por el
// cron de fin de vigencia (complete_expired_assignments, basado en end_date).
import { supabase } from "@/lib/supabase";

export async function recomputeAssignmentProgress(
  studentId: string,
  assignmentId: string,
  // Si se pasa, tambien actualiza current_day_number (uso: acabo de guardar
  // este dia). Al borrar no se pasa — no hay un "dia actual" obvio al deshacer.
  touchedDayNumber?: number,
): Promise<{ success: boolean; error?: string }> {
  const { data: assignmentData, error: readErr } = await supabase
    .from("training_plan_assignments")
    .select("completed_days, start_date")
    .eq("id", assignmentId)
    .single();

  if (readErr || !assignmentData) {
    return {
      success: false,
      error: readErr?.message ?? "No se pudo leer la asignación",
    };
  }

  // Mismo criterio que al guardar: contar day_number unicos desde
  // (start_date - 1 dia), para que un cambio de fecha de inicio del coach
  // excluya completions viejas y el contador arranque limpio.
  const startDateISO = assignmentData.start_date
    ? assignmentData.start_date.slice(0, 10)
    : null;

  let startDateMinus1: string | null = null;
  if (startDateISO) {
    const d = new Date(startDateISO + "T00:00:00");
    d.setDate(d.getDate() - 1);
    startDateMinus1 =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");
  }

  const completionsQuery = supabase
    .from("workout_completions")
    .select("day_number")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId);

  const startTimestampUTC = startDateMinus1
    ? new Date(startDateMinus1 + "T00:00:00").toISOString()
    : null;

  const { data: allCompletions } = startTimestampUTC
    ? await completionsQuery.gte("completed_at", startTimestampUTC)
    : await completionsQuery;

  const uniqueCompletedDays = new Set(
    (allCompletions ?? []).map((c) => c.day_number),
  );
  const newCompletedDays = uniqueCompletedDays.size;

  // El alumno no tiene UPDATE directo sobre training_plan_assignments (solo
  // coaches, ver supabase/schema/policies.sql) — se usa una RPC
  // SECURITY DEFINER que solo permite tocar el progreso de la propia fila.
  const { error: updateErr } = await supabase.rpc(
    "update_own_assignment_progress",
    {
      p_assignment_id: assignmentId,
      p_completed_days: newCompletedDays,
      p_current_day_number: touchedDayNumber ?? null,
    },
  );

  if (updateErr) return { success: false, error: updateErr.message };

  return { success: true };
}
