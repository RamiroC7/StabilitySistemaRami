-- =====================================================================
-- ÍNDICES del esquema `public` — proyecto hcvytsitbsandaphsxyn
-- Snapshot generado: 2026-08-30 desde pg_indexes. NO ES MIGRACIÓN.
-- Incluye los índices implícitos de PRIMARY KEY / UNIQUE (marcados).
-- =====================================================================

-- body_measurements
-- CREATE UNIQUE INDEX body_measurements_pkey ON public.body_measurements USING btree (id);  -- PK
CREATE INDEX idx_body_measurements_student_date ON public.body_measurements USING btree (student_id, date DESC);

-- exercise_categories
-- CREATE UNIQUE INDEX exercise_categories_pkey     ON public.exercise_categories USING btree (id);    -- PK
-- CREATE UNIQUE INDEX exercise_categories_name_key ON public.exercise_categories USING btree (name);  -- UNIQUE

-- exercise_stages
-- CREATE UNIQUE INDEX exercise_stages_pkey ON public.exercise_stages USING btree (id);  -- PK

-- exercise_weight_logs
-- CREATE UNIQUE INDEX exercise_weight_logs_pkey ON public.exercise_weight_logs USING btree (id);  -- PK
CREATE INDEX idx_ewl_student_id    ON public.exercise_weight_logs USING btree (student_id);
CREATE INDEX idx_ewl_exercise_name ON public.exercise_weight_logs USING btree (exercise_name);
CREATE INDEX idx_ewl_logged_at     ON public.exercise_weight_logs USING btree (logged_at);

-- exercises
-- CREATE UNIQUE INDEX exercises_pkey ON public.exercises USING btree (id);  -- PK
CREATE INDEX idx_exercises_category_id ON public.exercises USING btree (category_id);
CREATE INDEX idx_exercises_created_by  ON public.exercises USING btree (created_by);

-- macrocycle_months
-- CREATE UNIQUE INDEX macrocycle_months_pkey ON public.macrocycle_months USING btree (id);  -- PK
-- CREATE UNIQUE INDEX macrocycle_months_macrocycle_id_month_index_key ON public.macrocycle_months USING btree (macrocycle_id, month_index);  -- UNIQUE

-- macrocycle_objectives
-- CREATE UNIQUE INDEX macrocycle_objectives_pkey ON public.macrocycle_objectives USING btree (id);  -- PK

-- macrocycle_weeks
-- CREATE UNIQUE INDEX macrocycle_weeks_pkey ON public.macrocycle_weeks USING btree (id);  -- PK
-- CREATE UNIQUE INDEX macrocycle_weeks_month_id_week_number_key ON public.macrocycle_weeks USING btree (month_id, week_number);  -- UNIQUE

-- macrocycles
-- CREATE UNIQUE INDEX macrocycles_pkey ON public.macrocycles USING btree (id);  -- PK
-- CREATE UNIQUE INDEX macrocycles_student_id_start_date_key ON public.macrocycles USING btree (student_id, start_date);  -- UNIQUE

-- plan_folders
-- CREATE UNIQUE INDEX plan_folders_pkey ON public.plan_folders USING btree (id);  -- PK
CREATE INDEX idx_plan_folders_coach_id ON public.plan_folders USING btree (coach_id);
-- NOTA: no hay índice sobre plan_folders(parent_id) pese al self-FK.

-- profiles
-- CREATE UNIQUE INDEX profiles_pkey      ON public.profiles USING btree (id);     -- PK
-- CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email);  -- UNIQUE
CREATE INDEX idx_profiles_email       ON public.profiles USING btree (email);
CREATE INDEX idx_profiles_role        ON public.profiles USING btree (role);
CREATE INDEX idx_profiles_is_archived ON public.profiles USING btree (is_archived, created_at DESC);

-- student_profiles
-- CREATE UNIQUE INDEX student_profiles_pkey ON public.student_profiles USING btree (id);  -- PK
CREATE INDEX idx_student_profiles_birth_date  ON public.student_profiles USING btree (birth_date);
CREATE INDEX idx_student_profiles_goal        ON public.student_profiles USING btree (primary_goal);
CREATE INDEX idx_student_profiles_is_archived ON public.student_profiles USING btree (is_archived);
CREATE INDEX idx_student_profiles_phone       ON public.student_profiles USING btree (phone);
CREATE INDEX idx_student_profiles_status      ON public.student_profiles USING btree (status);

-- training_plan_assignments
-- CREATE UNIQUE INDEX training_plan_assignments_pkey ON public.training_plan_assignments USING btree (id);  -- PK
CREATE INDEX idx_training_plan_assignments_student ON public.training_plan_assignments USING btree (student_id);
CREATE INDEX idx_training_plan_assignments_coach   ON public.training_plan_assignments USING btree (coach_id);
CREATE INDEX idx_training_plan_assignments_plan    ON public.training_plan_assignments USING btree (plan_id);
-- NOTA: no hay índice compuesto (student_id, status, end_date).

-- training_plan_days
-- CREATE UNIQUE INDEX training_plan_days_pkey ON public.training_plan_days USING btree (id);  -- PK
CREATE INDEX idx_training_plan_days_plan ON public.training_plan_days USING btree (plan_id);

-- training_plan_exercises
-- CREATE UNIQUE INDEX training_plan_exercises_pkey ON public.training_plan_exercises USING btree (id);  -- PK
CREATE INDEX idx_training_plan_exercises_day ON public.training_plan_exercises USING btree (day_id);
-- NOTA: no hay índice sobre stage_id.

-- training_plans
-- CREATE UNIQUE INDEX training_plans_pkey ON public.training_plans USING btree (id);  -- PK
CREATE INDEX idx_training_plans_coach     ON public.training_plans USING btree (coach_id);
CREATE INDEX idx_training_plans_archived  ON public.training_plans USING btree (is_archived);
CREATE INDEX idx_training_plans_folder_id ON public.training_plans USING btree (folder_id);

-- workout_completions
-- CREATE UNIQUE INDEX workout_completions_pkey ON public.workout_completions USING btree (id);  -- PK
CREATE INDEX idx_workout_completions_student_id    ON public.workout_completions USING btree (student_id);
CREATE INDEX idx_workout_completions_completed_at  ON public.workout_completions USING btree (completed_at);
CREATE INDEX idx_workout_completions_assignment_id ON public.workout_completions USING btree (assignment_id);
-- NOTA: los índices sobre student_id y completed_at son SEPARADOS; no existe
-- el compuesto (student_id, completed_at).

-- workout_logs
-- CREATE UNIQUE INDEX workout_logs_pkey ON public.workout_logs USING btree (id);  -- PK
CREATE INDEX idx_workout_logs_student_date ON public.workout_logs USING btree (student_id, date DESC);
