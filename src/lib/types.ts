// Database types for exercise planning

export interface ExerciseStage {
  id: string;
  name: string;
  display_order: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface PlanExercise {
  id: string;
  day_id: string;
  stage_id: string;
  stage_name?: string;
  exercise_name: string;
  video_url?: string | null;
  series: number | string;
  reps: string;
  carga: string;
  pause: string;
  notes: string;
  order: number;
  write_weight?: boolean;
  cardio_duration_min?: number | string;
  circuit_group?: string | null;
}
