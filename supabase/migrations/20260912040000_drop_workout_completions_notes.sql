-- DROP de workout_completions.notes (sesión 2026-09-12). 0/993 filas con
-- valor. Nunca aparece en ningún .select() ni en el upsert real
-- (src/lib/offlineWorkoutQueue.ts arma la fila con rpe, mood, mood_comment,
-- series_log, etc., pero nunca notes). Mismo patrón que las columnas
-- anteriores de esta sesión (ver 20260912010000, 20260912030000).
alter table public.workout_completions drop column if exists notes;
