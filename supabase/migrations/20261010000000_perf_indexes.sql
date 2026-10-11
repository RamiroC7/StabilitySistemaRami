-- Rendimiento (RENDIMIENTO.md D-03, D-04, D-05) — regla R26/R28 de la skill
-- rendimiento-stability.
--
-- 1) Indices en FKs que no tenian (advisor `unindexed_foreign_keys`).
-- 2) Indices compuestos para los accesos reales de la app (historial/ranking/
--    alertas por alumno; asignaciones activas por alumno).
-- 3) Eliminar indices redundantes o sin uso (stats desde 2025-12-08, 0 scans).
--
-- Las tablas son chicas (<10k filas): los CREATE/DROP INDEX toman locks de
-- milisegundos, por eso va sin CONCURRENTLY (una migracion corre en una
-- transaccion y CONCURRENTLY no puede).
--
-- ROLLBACK (si hiciera falta volver atras):
--   drop index if exists public.idx_ewl_assignment_id,
--     public.idx_macrocycle_months_objective_id, public.idx_plan_folders_parent_id,
--     public.idx_training_plan_exercises_stage_id,
--     public.idx_workout_completions_student_completed,
--     public.idx_tpa_student_status_end;
--   drop index if exists gym_mcp.idx_access_grants_client_id,
--     gym_mcp.idx_access_tokens_client_id, gym_mcp.idx_refresh_tokens_client_id,
--     mcp.idx_mcp_access_tokens_profile_id;
--   create index idx_profiles_email on public.profiles using btree (email);
--   create index idx_student_profiles_birth_date  on public.student_profiles using btree (birth_date);
--   create index idx_student_profiles_goal        on public.student_profiles using btree (primary_goal);
--   create index idx_student_profiles_is_archived on public.student_profiles using btree (is_archived);
--   create index idx_student_profiles_phone       on public.student_profiles using btree (phone);

-- ── 1. FKs sin indice ───────────────────────────────────────────────────────
create index if not exists idx_ewl_assignment_id
  on public.exercise_weight_logs using btree (assignment_id);
create index if not exists idx_macrocycle_months_objective_id
  on public.macrocycle_months using btree (objective_id);
create index if not exists idx_plan_folders_parent_id
  on public.plan_folders using btree (parent_id);
create index if not exists idx_training_plan_exercises_stage_id
  on public.training_plan_exercises using btree (stage_id);

create index if not exists idx_access_grants_client_id
  on gym_mcp.access_grants using btree (client_id);
create index if not exists idx_access_tokens_client_id
  on gym_mcp.access_tokens using btree (client_id);
create index if not exists idx_refresh_tokens_client_id
  on gym_mcp.refresh_tokens using btree (client_id);
create index if not exists idx_mcp_access_tokens_profile_id
  on mcp.access_tokens using btree (profile_id);

-- ── 2. Compuestos para los accesos reales ───────────────────────────────────
-- Historial, ranking y alertas leen las completions de un alumno ordenadas por
-- fecha. (idx_workout_completions_student_id queda redundante por prefijo, pero
-- se mantiene hasta confirmar con EXPLAIN en una tabla mas grande.)
create index if not exists idx_workout_completions_student_completed
  on public.workout_completions using btree (student_id, completed_at desc);

-- Asignaciones activas/pausadas vigentes de un alumno (fetchStudents,
-- vencimientos, policies "students can view ...").
create index if not exists idx_tpa_student_status_end
  on public.training_plan_assignments using btree (student_id, status, end_date);

-- ── 3. Redundantes / sin uso ────────────────────────────────────────────────
-- profiles_email_key (UNIQUE) ya es un indice btree sobre email: este es identico.
drop index if exists public.idx_profiles_email;

-- 0 scans desde 2025-12-08; tabla de ~30 filas (siempre seq scan).
drop index if exists public.idx_student_profiles_birth_date;
drop index if exists public.idx_student_profiles_goal;
drop index if exists public.idx_student_profiles_is_archived;
drop index if exists public.idx_student_profiles_phone;
