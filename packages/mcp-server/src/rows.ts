/**
 * Tipos de fila ANGOSTOS para las 7 tablas que consultan los tools.
 *
 * Solo se declaran las columnas que los tools leen — NO es el tipo `Database`
 * generado de la app (`src/lib/supabase.ts`). El server consulta con `pg` crudo,
 * asi que estos tipos describen el shape de `result.rows`, no el esquema completo.
 *
 * Al agregar un tool nuevo que necesite una columna mas, se agrega aca. Si necesita
 * una tabla nueva, ademas hay que darle GRANT + policy a `mcp_readonly` (ver README).
 *
 * Nombres y tipos tomados como referencia de `src/lib/supabase.ts` de la app.
 */

/** public.profiles */
export interface ProfileRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "student" | "coach";
}

/** public.training_plans */
export interface TrainingPlanRow {
  id: string;
  title: string;
  description: string | null;
  total_days: number;
  days_per_week: number;
  total_weeks: number;
  is_template: boolean;
  is_archived: boolean;
}

/** public.training_plan_days */
export interface TrainingPlanDayRow {
  id: string;
  plan_id: string;
  day_number: number;
  day_name: string;
  display_order: number;
}

/** public.training_plan_exercises */
export interface TrainingPlanExerciseRow {
  id: string;
  day_id: string;
  stage_name: string | null;
  exercise_name: string;
  series: number;
  reps: string;
  carga: string;
  pause: string;
  notes: string | null;
  display_order: number;
}

/** public.training_plan_assignments */
export interface TrainingPlanAssignmentRow {
  id: string;
  plan_id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  status: "active" | "completed" | "paused" | "cancelled";
}

/** public.workout_completions */
export interface WorkoutCompletionRow {
  id: string;
  student_id: string;
  assignment_id: string;
  day_number: number;
  completed_at: string;
  rpe: number | null;
}

/** public.exercise_weight_logs */
export interface ExerciseWeightLogRow {
  id: string;
  student_id: string;
  exercise_name: string;
  plan_day_name: string;
  series: number;
  sets_detail: Array<{
    set_number: number;
    target_reps: string;
    actual_reps: string | null;
    kg: number | null;
  }>;
  logged_at: string;
}
