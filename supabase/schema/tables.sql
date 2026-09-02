-- =====================================================================
-- SNAPSHOT DEL ESQUEMA `public` — proyecto Supabase hcvytsitbsandaphsxyn
-- Generado: 2026-08-30 (solo lectura, vía MCP execute_sql)
-- NO ES UNA MIGRACIÓN EJECUTABLE. Ver README.md en esta carpeta.
-- 18 tablas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles  (45 filas) — extiende auth.users
-- ---------------------------------------------------------------------
CREATE TABLE public.profiles (
    id            uuid        NOT NULL,
    email         text        NOT NULL,
    first_name    text        NOT NULL,
    last_name     text        NOT NULL,
    role          text        NOT NULL,
    profile_image text        NULL,
    created_at    timestamptz NULL DEFAULT now(),
    updated_at    timestamptz NULL DEFAULT now(),
    is_archived   boolean     NULL DEFAULT false,
    CONSTRAINT profiles_pkey       PRIMARY KEY (id),
    CONSTRAINT profiles_email_key  UNIQUE (email),
    CONSTRAINT profiles_id_fkey    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['student'::text, 'coach'::text]))
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- student_profiles  (31 filas) — 1:1 con profiles (solo role='student')
-- ---------------------------------------------------------------------
CREATE TABLE public.student_profiles (
    id                  uuid          NOT NULL,
    phone               text          NOT NULL,
    instagram           text          NULL,
    profile_image_url   text          NULL,
    birth_date          date          NOT NULL,
    gender              text          NOT NULL,
    height_cm           numeric(5,2)  NOT NULL,
    weight_kg           numeric(5,2)  NOT NULL,
    -- (ordinal 9 fue eliminado en el pasado)
    activity_level      text          NOT NULL,
    primary_goal        text          NOT NULL,
    training_experience text          NOT NULL,
    sports              text          NOT NULL,
    previous_injuries   text          NULL,
    medical_conditions  text          NULL,
    created_at          timestamptz   NULL DEFAULT now(),
    updated_at          timestamptz   NULL DEFAULT now(),
    status              text          NULL DEFAULT 'active'::text,
    is_archived         boolean       NULL DEFAULT false,
    archived_at         timestamptz   NULL,
    CONSTRAINT student_profiles_pkey    PRIMARY KEY (id),
    CONSTRAINT student_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT student_profiles_activity_level_check      CHECK (activity_level = ANY (ARRAY['sedentary'::text,'light'::text,'moderate'::text,'active'::text,'very_active'::text])),
    CONSTRAINT student_profiles_gender_check              CHECK (gender = ANY (ARRAY['male'::text,'female'::text,'other'::text])),
    CONSTRAINT student_profiles_height_cm_check           CHECK (height_cm >= 100 AND height_cm <= 250),
    CONSTRAINT student_profiles_weight_kg_check           CHECK (weight_kg >= 30 AND weight_kg <= 300),
    CONSTRAINT student_profiles_primary_goal_check        CHECK (primary_goal = ANY (ARRAY['aesthetic'::text,'sports'::text,'health'::text,'rehabilitation'::text])),
    CONSTRAINT student_profiles_training_experience_check CHECK (training_experience = ANY (ARRAY['none'::text,'beginner'::text,'intermediate'::text,'advanced'::text])),
    CONSTRAINT student_profiles_status_check              CHECK (status = ANY (ARRAY['active'::text,'archived'::text,'deleted'::text]))
);
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- plan_folders  (40 filas) — carpetas anidables de planes
-- ---------------------------------------------------------------------
CREATE TABLE public.plan_folders (
    id         uuid        NOT NULL DEFAULT gen_random_uuid(),
    coach_id   uuid        NOT NULL,
    name       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    parent_id  uuid        NULL,
    CONSTRAINT plan_folders_pkey           PRIMARY KEY (id),
    CONSTRAINT plan_folders_coach_id_fkey  FOREIGN KEY (coach_id)  REFERENCES public.profiles(id)     ON DELETE CASCADE,
    CONSTRAINT plan_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.plan_folders(id) ON DELETE CASCADE
);
ALTER TABLE public.plan_folders ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- training_plans  (158 filas)
-- ---------------------------------------------------------------------
CREATE TABLE public.training_plans (
    id               uuid        NOT NULL DEFAULT gen_random_uuid(),
    coach_id         uuid        NOT NULL,
    title            text        NOT NULL,
    description      text        NULL,
    start_date       date        NOT NULL,
    end_date         date        NOT NULL,
    total_days       integer     NOT NULL,
    days_per_week    integer     NOT NULL,
    total_weeks      integer     NOT NULL,
    plan_type        text        NULL,
    difficulty_level text        NULL,
    is_template      boolean     NULL DEFAULT false,
    is_archived      boolean     NULL DEFAULT false,
    created_at       timestamptz NULL DEFAULT now(),
    updated_at       timestamptz NULL DEFAULT now(),
    folder_id        uuid        NULL,
    CONSTRAINT training_plans_pkey           PRIMARY KEY (id),
    CONSTRAINT training_plans_coach_id_fkey  FOREIGN KEY (coach_id)  REFERENCES public.profiles(id)     ON DELETE CASCADE,
    CONSTRAINT training_plans_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.plan_folders(id) ON DELETE SET NULL
);
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- training_plan_days  (536 filas)
-- ---------------------------------------------------------------------
CREATE TABLE public.training_plan_days (
    id            uuid        NOT NULL DEFAULT gen_random_uuid(),
    plan_id       uuid        NOT NULL,
    day_number    integer     NOT NULL,
    day_name      text        NOT NULL,
    display_order integer     NOT NULL,
    created_at    timestamptz NULL DEFAULT now(),
    CONSTRAINT training_plan_days_pkey         PRIMARY KEY (id),
    CONSTRAINT training_plan_days_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.training_plans(id) ON DELETE CASCADE
);
ALTER TABLE public.training_plan_days ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- training_plan_exercises  (5565 filas) — tabla más grande
-- ---------------------------------------------------------------------
CREATE TABLE public.training_plan_exercises (
    id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
    day_id              uuid        NOT NULL,
    stage_id            uuid        NULL,
    stage_name          text        NOT NULL,
    exercise_name       text        NOT NULL,
    video_url           text        NULL,
    series              integer     NOT NULL,
    reps                text        NOT NULL,
    -- (ordinal 9 fue eliminado en el pasado)
    pause               text        NOT NULL,
    notes               text        NULL,
    coach_instructions  text        NULL,
    display_order       integer     NOT NULL,
    created_at          timestamptz NULL DEFAULT now(),
    write_weight        boolean     NOT NULL DEFAULT false,
    carga               text        NOT NULL DEFAULT '-'::text,
    cardio_duration_min integer     NULL,
    circuit_group       text        NULL,
    CONSTRAINT training_plan_exercises_pkey          PRIMARY KEY (id),
    CONSTRAINT training_plan_exercises_day_id_fkey   FOREIGN KEY (day_id)   REFERENCES public.training_plan_days(id) ON DELETE CASCADE,
    CONSTRAINT training_plan_exercises_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.exercise_stages(id)   ON DELETE SET NULL
);
ALTER TABLE public.training_plan_exercises ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- training_plan_assignments  (111 filas)
-- ---------------------------------------------------------------------
CREATE TABLE public.training_plan_assignments (
    id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
    plan_id               uuid        NOT NULL,
    student_id            uuid        NOT NULL,
    coach_id              uuid        NOT NULL,
    assigned_at           timestamptz NULL DEFAULT now(),
    start_date            date        NOT NULL,
    end_date              date        NOT NULL,
    status                text        NULL DEFAULT 'active'::text,
    current_day_number    integer     NULL DEFAULT 1,
    completed_days        integer     NULL DEFAULT 0,
    personalization_notes text        NULL,
    created_at            timestamptz NULL DEFAULT now(),
    updated_at            timestamptz NULL DEFAULT now(),
    CONSTRAINT training_plan_assignments_pkey            PRIMARY KEY (id),
    CONSTRAINT training_plan_assignments_plan_id_fkey    FOREIGN KEY (plan_id)    REFERENCES public.training_plans(id) ON DELETE CASCADE,
    CONSTRAINT training_plan_assignments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)       ON DELETE CASCADE,
    CONSTRAINT training_plan_assignments_coach_id_fkey   FOREIGN KEY (coach_id)   REFERENCES public.profiles(id)       ON DELETE CASCADE,
    CONSTRAINT training_plan_assignments_status_check    CHECK (status = ANY (ARRAY['active'::text,'completed'::text,'paused'::text,'cancelled'::text]))
);
ALTER TABLE public.training_plan_assignments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- workout_completions  (898 filas)
-- ---------------------------------------------------------------------
CREATE TABLE public.workout_completions (
    id               uuid                  NOT NULL DEFAULT gen_random_uuid(),
    student_id       uuid                  NOT NULL,
    assignment_id    uuid                  NOT NULL,
    day_number       integer               NOT NULL,
    completed_at     timestamptz           NOT NULL DEFAULT now(),
    rpe              integer               NULL,
    total_sets_done  integer               NULL,
    series_log       jsonb                 NULL,
    notes            text                  NULL,
    created_at       timestamptz           NOT NULL DEFAULT now(),
    mood             character varying(10) NULL,
    mood_comment     text                  NULL,
    initial_mood     character varying     NULL,
    duration_minutes integer               NULL,
    CONSTRAINT workout_completions_pkey              PRIMARY KEY (id),
    CONSTRAINT workout_completions_student_id_fkey   FOREIGN KEY (student_id)    REFERENCES public.profiles(id)                  ON DELETE CASCADE,
    CONSTRAINT workout_completions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.training_plan_assignments(id) ON DELETE CASCADE
);
ALTER TABLE public.workout_completions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- exercise_weight_logs  (848 filas)
-- ---------------------------------------------------------------------
CREATE TABLE public.exercise_weight_logs (
    id              uuid        NOT NULL DEFAULT gen_random_uuid(),
    student_id      uuid        NOT NULL,
    assignment_id   uuid        NOT NULL,
    exercise_id     uuid        NOT NULL,   -- sin FK declarada
    exercise_name   text        NOT NULL,
    plan_day_number integer     NOT NULL,
    plan_day_name   text        NOT NULL,
    series          integer     NOT NULL,
    sets_detail     jsonb       NOT NULL,
    logged_at       timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT exercise_weight_logs_pkey               PRIMARY KEY (id),
    CONSTRAINT exercise_weight_logs_student_id_fkey    FOREIGN KEY (student_id)    REFERENCES public.profiles(id)                  ON DELETE CASCADE,
    CONSTRAINT exercise_weight_logs_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.training_plan_assignments(id) ON DELETE CASCADE
);
ALTER TABLE public.exercise_weight_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- exercise_stages  (4 filas) — catálogo
-- ---------------------------------------------------------------------
CREATE TABLE public.exercise_stages (
    id            uuid        NOT NULL DEFAULT gen_random_uuid(),
    name          text        NOT NULL,
    color         text        NOT NULL DEFAULT '#3B82F6'::text,
    display_order integer     NOT NULL,
    -- (ordinal 5 fue eliminado en el pasado)
    created_at    timestamptz NULL DEFAULT now(),
    updated_at    timestamptz NULL DEFAULT now(),
    CONSTRAINT exercise_stages_pkey PRIMARY KEY (id)
);
ALTER TABLE public.exercise_stages ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- exercise_categories  (17 filas) — catálogo
-- ---------------------------------------------------------------------
CREATE TABLE public.exercise_categories (
    id         uuid        NOT NULL DEFAULT gen_random_uuid(),
    name       text        NOT NULL,
    -- (ordinales 3 y 5 fueron eliminados en el pasado)
    color      text        NULL DEFAULT '#3B82F6'::text,
    created_at timestamptz NULL DEFAULT now(),
    updated_at timestamptz NULL DEFAULT now(),
    CONSTRAINT exercise_categories_pkey     PRIMARY KEY (id),
    CONSTRAINT exercise_categories_name_key UNIQUE (name)
);
ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- exercises  (587 filas) — biblioteca de ejercicios
-- ---------------------------------------------------------------------
CREATE TABLE public.exercises (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    category_id uuid        NOT NULL,
    video_url   text        NULL,
    created_by  uuid        NOT NULL,
    created_at  timestamptz NULL DEFAULT now(),
    updated_at  timestamptz NULL DEFAULT now(),
    notes       text        NULL,
    CONSTRAINT exercises_pkey             PRIMARY KEY (id),
    CONSTRAINT exercises_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.exercise_categories(id) ON DELETE RESTRICT,
    CONSTRAINT exercises_created_by_fkey  FOREIGN KEY (created_by)  REFERENCES public.profiles(id)            ON DELETE CASCADE
);
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- body_measurements  (0 filas)
-- ---------------------------------------------------------------------
CREATE TABLE public.body_measurements (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    student_id  uuid        NOT NULL,
    date        date        NOT NULL DEFAULT CURRENT_DATE,
    weight      numeric     NOT NULL,
    body_fat    numeric     NULL,
    muscle_mass numeric     NULL,
    notes       text        NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT body_measurements_pkey             PRIMARY KEY (id),
    CONSTRAINT body_measurements_student_id_fkey  FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT body_measurements_weight_check      CHECK (weight      >= 20 AND weight      <= 400),
    CONSTRAINT body_measurements_body_fat_check    CHECK (body_fat    >= 1  AND body_fat    <= 60),
    CONSTRAINT body_measurements_muscle_mass_check CHECK (muscle_mass >= 10 AND muscle_mass <= 200)
);
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- workout_logs  (0 filas) — legacy / no usada
-- ---------------------------------------------------------------------
CREATE TABLE public.workout_logs (
    id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
    student_id          uuid        NOT NULL,
    assignment_id       uuid        NULL,
    plan_name           text        NOT NULL DEFAULT ''::text,
    day_name            text        NOT NULL DEFAULT ''::text,
    date                date        NOT NULL DEFAULT CURRENT_DATE,
    duration_minutes    integer     NOT NULL DEFAULT 0,
    total_volume        numeric     NOT NULL DEFAULT 0,
    exercises_completed integer     NOT NULL DEFAULT 0,
    rpe                 integer     NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT workout_logs_pkey               PRIMARY KEY (id),
    CONSTRAINT workout_logs_student_id_fkey    FOREIGN KEY (student_id)    REFERENCES public.profiles(id)                  ON DELETE CASCADE,
    CONSTRAINT workout_logs_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.training_plan_assignments(id) ON DELETE SET NULL,
    CONSTRAINT workout_logs_rpe_check          CHECK (rpe >= 1 AND rpe <= 10)
);
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- macrocycles  (20 filas)
-- ---------------------------------------------------------------------
CREATE TABLE public.macrocycles (
    id         uuid        NOT NULL DEFAULT gen_random_uuid(),
    student_id uuid        NOT NULL,
    start_date date        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT macrocycles_pkey                      PRIMARY KEY (id),
    CONSTRAINT macrocycles_student_id_start_date_key UNIQUE (student_id, start_date),
    CONSTRAINT macrocycles_student_id_fkey           FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.macrocycles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- macrocycle_objectives  (7 filas) — catálogo
-- ---------------------------------------------------------------------
CREATE TABLE public.macrocycle_objectives (
    id            uuid        NOT NULL DEFAULT gen_random_uuid(),
    name          text        NOT NULL,
    color         text        NOT NULL DEFAULT '#6B7280'::text,
    display_order integer     NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT macrocycle_objectives_pkey PRIMARY KEY (id)
);
ALTER TABLE public.macrocycle_objectives ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- macrocycle_months  (120 filas)
-- ---------------------------------------------------------------------
CREATE TABLE public.macrocycle_months (
    id            uuid        NOT NULL DEFAULT gen_random_uuid(),
    macrocycle_id uuid        NOT NULL,
    month_index   smallint    NOT NULL,
    objective_id  uuid        NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT macrocycle_months_pkey                          PRIMARY KEY (id),
    CONSTRAINT macrocycle_months_macrocycle_id_month_index_key UNIQUE (macrocycle_id, month_index),
    CONSTRAINT macrocycle_months_macrocycle_id_fkey            FOREIGN KEY (macrocycle_id) REFERENCES public.macrocycles(id)           ON DELETE CASCADE,
    CONSTRAINT macrocycle_months_objective_id_fkey             FOREIGN KEY (objective_id)  REFERENCES public.macrocycle_objectives(id) ON DELETE SET NULL,
    CONSTRAINT macrocycle_months_month_index_check             CHECK (month_index >= 0 AND month_index <= 5)
);
ALTER TABLE public.macrocycle_months ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- macrocycle_weeks  (480 filas)
-- ---------------------------------------------------------------------
CREATE TABLE public.macrocycle_weeks (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    month_id    uuid        NOT NULL,
    week_number smallint    NOT NULL,
    notes       text        NOT NULL DEFAULT ''::text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT macrocycle_weeks_pkey                     PRIMARY KEY (id),
    CONSTRAINT macrocycle_weeks_month_id_week_number_key UNIQUE (month_id, week_number),
    CONSTRAINT macrocycle_weeks_month_id_fkey            FOREIGN KEY (month_id) REFERENCES public.macrocycle_months(id) ON DELETE CASCADE,
    CONSTRAINT macrocycle_weeks_week_number_check        CHECK (week_number >= 1 AND week_number <= 4)
);
ALTER TABLE public.macrocycle_weeks ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- TRIGGERS (no internos) sobre public
-- =====================================================================
CREATE TRIGGER update_exercise_categories_updated_at        BEFORE UPDATE ON public.exercise_categories       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exercise_stages_updated_at            BEFORE UPDATE ON public.exercise_stages           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exercises_updated_at                  BEFORE UPDATE ON public.exercises                 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER plan_folders_updated_at                      BEFORE UPDATE ON public.plan_folders              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER on_profile_updated                           BEFORE UPDATE ON public.profiles                  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER on_student_profile_updated                   BEFORE UPDATE ON public.student_profiles          FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER validate_student_role            BEFORE INSERT OR UPDATE ON public.student_profiles          FOR EACH ROW EXECUTE FUNCTION validate_student_profile();
CREATE TRIGGER update_training_plan_assignments_updated_at  BEFORE UPDATE ON public.training_plan_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_plans_updated_at             BEFORE UPDATE ON public.training_plans            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
