// Recalcula completed_days/status de una asignacion a partir de las filas
// reales en workout_completions — es la misma logica que ya usaba
// performCompletionSync al guardar, extraida aca para poder reutilizarla
// tambien al borrar un entrenamiento (sin duplicarla).
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
    .select("completed_days, start_date, plan_id, training_plans(total_days)")
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

  const planInfo = (
    Array.isArray(assignmentData.training_plans)
      ? assignmentData.training_plans[0]
      : assignmentData.training_plans
  ) as { total_days: number } | null;
  const totalDays = planInfo?.total_days ?? 0;

  const newStatus: "active" | "completed" =
    newCompletedDays >= totalDays ? "completed" : "active";

  const updatePayload: {
    completed_days: number;
    status: "active" | "completed";
    current_day_number?: number;
  } = {
    completed_days: newCompletedDays,
    status: newStatus,
  };
  if (touchedDayNumber !== undefined) {
    updatePayload.current_day_number = touchedDayNumber;
  }

  const { error: updateErr } = await supabase
    .from("training_plan_assignments")
    .update(updatePayload)
    .eq("id", assignmentId);

  if (updateErr) return { success: false, error: updateErr.message };

  return { success: true };
}
