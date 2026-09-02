-- =====================================================================
-- RLS POLICIES del esquema `public` — proyecto hcvytsitbsandaphsxyn
-- Snapshot generado: 2026-08-30 desde pg_policies. NO ES MIGRACIÓN.
-- Todas las 18 tablas tienen relrowsecurity = true, relforcerowsecurity = false.
-- Todas las policies son PERMISSIVE.
--
-- NOTA: varias policies están declaradas para el rol `public` (no
-- `authenticated`). En la práctica igual dependen de auth.uid(), que es NULL
-- para `anon`, pero cualquier rol nuevo (p.ej. el read-only de D-2) las
-- hereda automáticamente salvo que se declare BYPASSRLS o se le nieguen GRANTs.
-- Policies con roles={public}: exercise_weight_logs (3 DELETE + SELECT coaches),
-- workout_completions (DELETE + SELECT coaches), training_plan_assignments
-- (SELECT/UPDATE/DELETE coaches), training_plans (SELECT coaches).
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
CREATE POLICY "profiles: authenticated can view all" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles: users can view own" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "profiles: users can insert own" ON public.profiles
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: users can update own" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO authenticated USING (id = auth.uid());

-- ---------------------------------------------------------------------
-- student_profiles
-- ---------------------------------------------------------------------
CREATE POLICY "student_profiles: authenticated can view all" ON public.student_profiles
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "student_profiles: students can insert own" ON public.student_profiles
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "student_profiles: students can update own" ON public.student_profiles
  AS PERMISSIVE FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "student_profiles: coaches can update any" ON public.student_profiles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text))));

-- ---------------------------------------------------------------------
-- training_plans
-- ---------------------------------------------------------------------
CREATE POLICY "training_plans: all coaches can view all plans" ON public.training_plans
  AS PERMISSIVE FOR SELECT TO public
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "training_plans: students can view assigned" ON public.training_plans
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1 FROM training_plan_assignments tpa
                  WHERE ((tpa.plan_id = training_plans.id) AND (tpa.student_id = auth.uid()))));

CREATE POLICY "training_plans: coaches can insert" ON public.training_plans
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (coach_id = auth.uid());

CREATE POLICY "training_plans: coaches can update any" ON public.training_plans
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING      (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))))
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

-- OJO: bug conocido — esta policy NO filtra por profiles.id = auth.uid(),
-- basta con que exista ALGÚN coach en la tabla profiles.
CREATE POLICY "training_plans: coaches can delete any" ON public.training_plans
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles WHERE (profiles.role = 'coach'::text)));

-- ---------------------------------------------------------------------
-- training_plan_days
-- ---------------------------------------------------------------------
CREATE POLICY "plan_days: coaches can manage any" ON public.training_plan_days
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))))
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "plan_days: students can view assigned" ON public.training_plan_days
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1 FROM training_plan_assignments tpa
                  WHERE ((tpa.plan_id = training_plan_days.plan_id) AND (tpa.student_id = auth.uid()))));

-- ---------------------------------------------------------------------
-- training_plan_exercises
-- ---------------------------------------------------------------------
CREATE POLICY "plan_exercises: coaches can manage any" ON public.training_plan_exercises
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))))
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "plan_exercises: students can view assigned" ON public.training_plan_exercises
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1
                  FROM (training_plan_days tpd
                        JOIN training_plan_assignments tpa ON ((tpa.plan_id = tpd.plan_id)))
                  WHERE ((tpd.id = training_plan_exercises.day_id) AND (tpa.student_id = auth.uid()))));

-- ---------------------------------------------------------------------
-- training_plan_assignments
-- ---------------------------------------------------------------------
CREATE POLICY "assignments: all coaches can view all" ON public.training_plan_assignments
  AS PERMISSIVE FOR SELECT TO public
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "assignments: students can view own" ON public.training_plan_assignments
  AS PERMISSIVE FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "assignments: coaches can insert" ON public.training_plan_assignments
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (coach_id = auth.uid());

CREATE POLICY "assignments: all coaches can update all" ON public.training_plan_assignments
  AS PERMISSIVE FOR UPDATE TO public
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "assignments: all coaches can delete all" ON public.training_plan_assignments
  AS PERMISSIVE FOR DELETE TO public
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

-- ---------------------------------------------------------------------
-- workout_completions
-- ---------------------------------------------------------------------
CREATE POLICY "Coaches can read all workout completions" ON public.workout_completions
  AS PERMISSIVE FOR SELECT TO public
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "Students can read own workout completions" ON public.workout_completions
  AS PERMISSIVE FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Students can insert own workout completions" ON public.workout_completions
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

CREATE POLICY "students_delete_own_workout_completions" ON public.workout_completions
  AS PERMISSIVE FOR DELETE TO public USING (auth.uid() = student_id);

-- ---------------------------------------------------------------------
-- exercise_weight_logs
-- ---------------------------------------------------------------------
CREATE POLICY "Coaches can read student exercise weight logs" ON public.exercise_weight_logs
  AS PERMISSIVE FOR SELECT TO public
  USING (EXISTS ( SELECT 1 FROM training_plan_assignments tpa
                  WHERE ((tpa.student_id = exercise_weight_logs.student_id) AND (tpa.coach_id = auth.uid()))));

CREATE POLICY "Students can read own exercise weight logs" ON public.exercise_weight_logs
  AS PERMISSIVE FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Students can insert own exercise weight logs" ON public.exercise_weight_logs
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

CREATE POLICY "Coaches can delete student exercise weight logs" ON public.exercise_weight_logs
  AS PERMISSIVE FOR DELETE TO public
  USING (EXISTS ( SELECT 1 FROM training_plan_assignments tpa
                  WHERE ((tpa.student_id = exercise_weight_logs.student_id) AND (tpa.coach_id = auth.uid()))));

CREATE POLICY "Students can delete own exercise weight logs" ON public.exercise_weight_logs
  AS PERMISSIVE FOR DELETE TO public USING (student_id = auth.uid());

-- duplicada de la anterior (mismo efecto)
CREATE POLICY "students_delete_own_exercise_weight_logs" ON public.exercise_weight_logs
  AS PERMISSIVE FOR DELETE TO public USING (auth.uid() = student_id);

-- ---------------------------------------------------------------------
-- exercise_stages  (catálogo)
-- ---------------------------------------------------------------------
CREATE POLICY "exercise_stages: authenticated can view all" ON public.exercise_stages
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "exercise_stages: coaches can insert" ON public.exercise_stages
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text))));

CREATE POLICY "exercise_stages: coaches can update" ON public.exercise_stages
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text))));

CREATE POLICY "exercise_stages: coaches can delete" ON public.exercise_stages
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text))));

-- ---------------------------------------------------------------------
-- exercise_categories  (catálogo)
-- ---------------------------------------------------------------------
CREATE POLICY "exercise_categories: authenticated can view all" ON public.exercise_categories
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "exercise_categories: coaches can insert" ON public.exercise_categories
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text))));

CREATE POLICY "exercise_categories: coaches can update" ON public.exercise_categories
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text))));

CREATE POLICY "exercise_categories: coaches can delete" ON public.exercise_categories
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text))));

-- ---------------------------------------------------------------------
-- exercises
-- ---------------------------------------------------------------------
CREATE POLICY "exercises: authenticated can view all" ON public.exercises
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "exercises: coaches can insert" ON public.exercises
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text))));

CREATE POLICY "exercises: coaches can update" ON public.exercises
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING      (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text))))
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text))));

CREATE POLICY "exercises: coaches can delete" ON public.exercises
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text))));

-- ---------------------------------------------------------------------
-- plan_folders
-- ---------------------------------------------------------------------
CREATE POLICY "Coaches can view all folders" ON public.plan_folders
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "Coaches can create folders" ON public.plan_folders
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "Coaches can update folders" ON public.plan_folders
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING      (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))))
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "Coaches can delete folders" ON public.plan_folders
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

-- ---------------------------------------------------------------------
-- body_measurements
-- ---------------------------------------------------------------------
CREATE POLICY "body_measurements: students can view own" ON public.body_measurements
  AS PERMISSIVE FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "body_measurements: coaches can view students" ON public.body_measurements
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1 FROM training_plan_assignments tpa
                  WHERE ((tpa.student_id = body_measurements.student_id) AND (tpa.coach_id = auth.uid()))));

CREATE POLICY "body_measurements: students can insert own" ON public.body_measurements
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

CREATE POLICY "body_measurements: students can update own" ON public.body_measurements
  AS PERMISSIVE FOR UPDATE TO authenticated USING (student_id = auth.uid());

-- ---------------------------------------------------------------------
-- workout_logs (legacy)
-- ---------------------------------------------------------------------
CREATE POLICY "workout_logs: students can view own" ON public.workout_logs
  AS PERMISSIVE FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "workout_logs: coaches can view students" ON public.workout_logs
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1 FROM training_plan_assignments tpa
                  WHERE ((tpa.student_id = workout_logs.student_id) AND (tpa.coach_id = auth.uid()))));

CREATE POLICY "workout_logs: students can insert own" ON public.workout_logs
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

-- ---------------------------------------------------------------------
-- macrocycles / macrocycle_months / macrocycle_weeks / macrocycle_objectives
-- SELECT abierto a cualquier `authenticated` (qual = true) en las cuatro.
-- ---------------------------------------------------------------------
CREATE POLICY "macrocycles_select" ON public.macrocycles
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "macrocycles_insert" ON public.macrocycles
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))) OR (auth.uid() = student_id));

CREATE POLICY "macrocycles_update" ON public.macrocycles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "macrocycles_delete" ON public.macrocycles
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "macrocycle_months_select" ON public.macrocycle_months
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "macrocycle_months_insert" ON public.macrocycle_months
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "macrocycle_months_update" ON public.macrocycle_months
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "macrocycle_months_delete" ON public.macrocycle_months
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "macrocycle_weeks_select" ON public.macrocycle_weeks
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "macrocycle_weeks_insert" ON public.macrocycle_weeks
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "macrocycle_weeks_update" ON public.macrocycle_weeks
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "macrocycle_weeks_delete" ON public.macrocycle_weeks
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "objectives_select" ON public.macrocycle_objectives
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY "objectives_insert" ON public.macrocycle_objectives
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "objectives_update" ON public.macrocycle_objectives
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));

CREATE POLICY "objectives_delete" ON public.macrocycle_objectives
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text))));
