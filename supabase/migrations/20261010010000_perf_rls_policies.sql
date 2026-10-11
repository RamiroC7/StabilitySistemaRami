-- Rendimiento RLS (RENDIMIENTO.md D-01, D-02) — reglas R27/R30 de la skill
-- rendimiento-stability.
--
-- 1) auth_rls_initplan: `auth.uid()` pelado se re-evalua por fila; con
--    `(select auth.uid())` Postgres lo evalua una sola vez por query.
-- 2) multiple_permissive_policies: varias policies permisivas del mismo
--    (tabla, accion, rol) se evaluan todas con OR por cada fila. Se fusionan en
--    una sola con el OR explicito. El acceso resultante es IDENTICO.
-- 3) Las policies `to public` que dependian de auth.uid() pasan a
--    `to authenticated`: para anon auth.uid() es NULL y daban false igual.
--    `mcp_ro_read` (rol mcp_readonly) no se toca.
-- 4) SEGURIDAD: "training_plans: coaches can delete any" NO comparaba el
--    usuario (`exists (select 1 from profiles where role='coach')` es true para
--    cualquiera mientras exista algun coach), asi que cualquier usuario
--    autenticado podia borrar planes. Ahora exige que el usuario SEA coach.
--    (En esta app todos los coaches pueden borrar cualquier plan: se mantiene.)
--
-- Todo va en una transaccion (apply_migration): no hay ventana sin policies.
-- ROLLBACK: supabase/rollback/20261010010000_rls_policies_before.sql

-- ── exercise_categories ─────────────────────────────────────────────────────
alter policy "exercise_categories: coaches can delete" on public.exercise_categories
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'coach'));
alter policy "exercise_categories: coaches can insert" on public.exercise_categories
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'coach'));
alter policy "exercise_categories: coaches can update" on public.exercise_categories
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'coach'));

-- ── exercise_stages ─────────────────────────────────────────────────────────
alter policy "exercise_stages: coaches can delete" on public.exercise_stages
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'coach'));
alter policy "exercise_stages: coaches can insert" on public.exercise_stages
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'coach'));
alter policy "exercise_stages: coaches can update" on public.exercise_stages
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'coach'));

-- ── exercises ───────────────────────────────────────────────────────────────
alter policy "exercises: coaches can delete" on public.exercises
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'coach'));
alter policy "exercises: coaches can insert" on public.exercises
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'coach'));
alter policy "exercises: coaches can update" on public.exercises
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'coach'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'coach'));

-- ── exercise_weight_logs (fusiona 3 DELETE y 2 SELECT) ──────────────────────
drop policy "Coaches can delete student exercise weight logs" on public.exercise_weight_logs;
drop policy "Students can delete own exercise weight logs" on public.exercise_weight_logs;
drop policy "students_delete_own_exercise_weight_logs" on public.exercise_weight_logs;
create policy "exercise_weight_logs: owner or coach can delete" on public.exercise_weight_logs
  for delete to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1 from public.training_plan_assignments tpa
      where tpa.student_id = exercise_weight_logs.student_id
        and tpa.coach_id = (select auth.uid())
    )
  );

drop policy "Coaches can read student exercise weight logs" on public.exercise_weight_logs;
drop policy "Students can read own exercise weight logs" on public.exercise_weight_logs;
create policy "exercise_weight_logs: owner or coach can read" on public.exercise_weight_logs
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1 from public.training_plan_assignments tpa
      where tpa.student_id = exercise_weight_logs.student_id
        and tpa.coach_id = (select auth.uid())
    )
  );

alter policy "Students can insert own exercise weight logs" on public.exercise_weight_logs
  with check (student_id = (select auth.uid()));

-- ── macrocycle_months / objectives / weeks / macrocycles ────────────────────
alter policy macrocycle_months_delete on public.macrocycle_months
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy macrocycle_months_insert on public.macrocycle_months
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy macrocycle_months_update on public.macrocycle_months
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));

alter policy objectives_delete on public.macrocycle_objectives
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy objectives_insert on public.macrocycle_objectives
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy objectives_update on public.macrocycle_objectives
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));

alter policy macrocycle_weeks_delete on public.macrocycle_weeks
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy macrocycle_weeks_insert on public.macrocycle_weeks
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy macrocycle_weeks_update on public.macrocycle_weeks
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));

alter policy macrocycles_delete on public.macrocycles
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy macrocycles_insert on public.macrocycles
  with check (
    exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach')
    or (select auth.uid()) = student_id
  );
alter policy macrocycles_update on public.macrocycles
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));

-- ── plan_folders ────────────────────────────────────────────────────────────
alter policy "Coaches can delete folders" on public.plan_folders
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy "Coaches can create folders" on public.plan_folders
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy "Coaches can view all folders" on public.plan_folders
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy "Coaches can update folders" on public.plan_folders
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'))
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));

-- ── profiles ────────────────────────────────────────────────────────────────
alter policy "profiles: users can insert own" on public.profiles
  with check (id = (select auth.uid()));
alter policy "profiles: users can update own" on public.profiles
  using (id = (select auth.uid()));
-- "authenticated can view all" ya usa `true`: esta (id = uid) era redundante.
drop policy "profiles: users can view own" on public.profiles;

-- ── student_profiles (fusiona 2 UPDATE) ─────────────────────────────────────
alter policy "student_profiles: students can insert own" on public.student_profiles
  with check (id = (select auth.uid()));
drop policy "student_profiles: coaches can update any" on public.student_profiles;
drop policy "student_profiles: students can update own" on public.student_profiles;
create policy "student_profiles: owner or coach can update" on public.student_profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'coach')
  );

-- ── training_plan_assignments (fusiona 2 SELECT) ────────────────────────────
alter policy "assignments: all coaches can delete all" on public.training_plan_assignments
  to authenticated
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy "assignments: all coaches can update all" on public.training_plan_assignments
  to authenticated
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy "assignments: coaches can insert" on public.training_plan_assignments
  with check (coach_id = (select auth.uid()));

drop policy "assignments: all coaches can view all" on public.training_plan_assignments;
drop policy "assignments: students can view own" on public.training_plan_assignments;
create policy "assignments: coaches or owner can view" on public.training_plan_assignments
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach')
  );

-- ── training_plan_days (la policy ALL se parte para no solaparse en SELECT) ─
drop policy "plan_days: coaches can manage any" on public.training_plan_days;
drop policy "plan_days: students can view assigned" on public.training_plan_days;
create policy "plan_days: coaches can insert" on public.training_plan_days
  for insert to authenticated
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
create policy "plan_days: coaches can update" on public.training_plan_days
  for update to authenticated
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'))
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
create policy "plan_days: coaches can delete" on public.training_plan_days
  for delete to authenticated
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
create policy "plan_days: coaches or assigned students can view" on public.training_plan_days
  for select to authenticated
  using (
    exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach')
    or exists (
      select 1 from public.training_plan_assignments tpa
      where tpa.plan_id = training_plan_days.plan_id and tpa.student_id = (select auth.uid())
    )
  );

-- ── training_plan_exercises (idem) ──────────────────────────────────────────
drop policy "plan_exercises: coaches can manage any" on public.training_plan_exercises;
drop policy "plan_exercises: students can view assigned" on public.training_plan_exercises;
create policy "plan_exercises: coaches can insert" on public.training_plan_exercises
  for insert to authenticated
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
create policy "plan_exercises: coaches can update" on public.training_plan_exercises
  for update to authenticated
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'))
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
create policy "plan_exercises: coaches can delete" on public.training_plan_exercises
  for delete to authenticated
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
create policy "plan_exercises: coaches or assigned students can view" on public.training_plan_exercises
  for select to authenticated
  using (
    exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach')
    or exists (
      select 1
      from public.training_plan_days tpd
      join public.training_plan_assignments tpa on tpa.plan_id = tpd.plan_id
      where tpd.id = training_plan_exercises.day_id and tpa.student_id = (select auth.uid())
    )
  );

-- ── training_plans ──────────────────────────────────────────────────────────
-- FIX DE SEGURIDAD: ahora exige que el usuario sea coach (antes: cualquiera).
alter policy "training_plans: coaches can delete any" on public.training_plans
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));
alter policy "training_plans: coaches can insert" on public.training_plans
  with check (coach_id = (select auth.uid()));
alter policy "training_plans: coaches can update any" on public.training_plans
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'))
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach'));

drop policy "training_plans: all coaches can view all plans" on public.training_plans;
drop policy "training_plans: students can view assigned" on public.training_plans;
create policy "training_plans: coaches or assigned students can view" on public.training_plans
  for select to authenticated
  using (
    exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach')
    or exists (
      select 1 from public.training_plan_assignments tpa
      where tpa.plan_id = training_plans.id and tpa.student_id = (select auth.uid())
    )
  );

-- ── workout_completions (fusiona 2 SELECT) ──────────────────────────────────
alter policy students_delete_own_workout_completions on public.workout_completions
  to authenticated
  using ((select auth.uid()) = student_id);
alter policy "Students can insert own workout completions" on public.workout_completions
  with check (student_id = (select auth.uid()));

drop policy "Coaches can read all workout completions" on public.workout_completions;
drop policy "Students can read own workout completions" on public.workout_completions;
create policy "workout_completions: owner or coach can read" on public.workout_completions
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'coach')
  );
