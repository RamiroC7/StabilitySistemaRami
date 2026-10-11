-- ROLLBACK de 20261010010000_perf_rls_policies.sql
--
-- Estado EXACTO de las RLS policies de `public` justo antes de esa migracion
-- (volcado de pg_policies el 2026-10-10 por MCP). NO es una migracion: se
-- ejecuta a mano, solo si hace falta volver atras.
--
-- Paso 1: borra todas las policies actuales de public.
-- Paso 2: recrea las originales.
-- Va todo en una transaccion: o queda todo o no cambia nada.

begin;

do $$
declare
  r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "exercise_categories: coaches can delete" on public.exercise_categories as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text)))));
create policy "exercise_categories: coaches can insert" on public.exercise_categories as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text)))));
create policy "exercise_categories: authenticated can view all" on public.exercise_categories as permissive for select to authenticated
  using (true);
create policy "exercise_categories: coaches can update" on public.exercise_categories as permissive for update to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text)))));

create policy "exercise_stages: coaches can delete" on public.exercise_stages as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text)))));
create policy "exercise_stages: coaches can insert" on public.exercise_stages as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text)))));
create policy "exercise_stages: authenticated can view all" on public.exercise_stages as permissive for select to authenticated
  using (true);
create policy "exercise_stages: coaches can update" on public.exercise_stages as permissive for update to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text)))));

create policy "Coaches can delete student exercise weight logs" on public.exercise_weight_logs as permissive for delete to public
  using ((EXISTS ( SELECT 1 FROM training_plan_assignments tpa WHERE ((tpa.student_id = exercise_weight_logs.student_id) AND (tpa.coach_id = auth.uid())))));
create policy "Students can delete own exercise weight logs" on public.exercise_weight_logs as permissive for delete to public
  using ((student_id = auth.uid()));
create policy students_delete_own_exercise_weight_logs on public.exercise_weight_logs as permissive for delete to public
  using ((auth.uid() = student_id));
create policy "Students can insert own exercise weight logs" on public.exercise_weight_logs as permissive for insert to authenticated
  with check ((student_id = auth.uid()));
create policy "Coaches can read student exercise weight logs" on public.exercise_weight_logs as permissive for select to public
  using ((EXISTS ( SELECT 1 FROM training_plan_assignments tpa WHERE ((tpa.student_id = exercise_weight_logs.student_id) AND (tpa.coach_id = auth.uid())))));
create policy "Students can read own exercise weight logs" on public.exercise_weight_logs as permissive for select to authenticated
  using ((student_id = auth.uid()));
create policy mcp_ro_read on public.exercise_weight_logs as permissive for select to mcp_readonly
  using (true);

create policy "exercises: coaches can delete" on public.exercises as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text)))));
create policy "exercises: coaches can insert" on public.exercises as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text)))));
create policy "exercises: authenticated can view all" on public.exercises as permissive for select to authenticated
  using (true);
create policy "exercises: coaches can update" on public.exercises as permissive for update to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text)))))
  with check ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text)))));

create policy macrocycle_months_delete on public.macrocycle_months as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy macrocycle_months_insert on public.macrocycle_months as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy macrocycle_months_select on public.macrocycle_months as permissive for select to authenticated
  using (true);
create policy macrocycle_months_update on public.macrocycle_months as permissive for update to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));

create policy objectives_delete on public.macrocycle_objectives as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy objectives_insert on public.macrocycle_objectives as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy objectives_select on public.macrocycle_objectives as permissive for select to authenticated
  using (true);
create policy objectives_update on public.macrocycle_objectives as permissive for update to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));

create policy macrocycle_weeks_delete on public.macrocycle_weeks as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy macrocycle_weeks_insert on public.macrocycle_weeks as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy macrocycle_weeks_select on public.macrocycle_weeks as permissive for select to authenticated
  using (true);
create policy macrocycle_weeks_update on public.macrocycle_weeks as permissive for update to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));

create policy macrocycles_delete on public.macrocycles as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy macrocycles_insert on public.macrocycles as permissive for insert to authenticated
  with check (((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))) OR (auth.uid() = student_id)));
create policy macrocycles_select on public.macrocycles as permissive for select to authenticated
  using (true);
create policy macrocycles_update on public.macrocycles as permissive for update to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));

create policy "Coaches can delete folders" on public.plan_folders as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy "Coaches can create folders" on public.plan_folders as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy "Coaches can view all folders" on public.plan_folders as permissive for select to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy "Coaches can update folders" on public.plan_folders as permissive for update to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))))
  with check ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));

create policy "profiles: users can insert own" on public.profiles as permissive for insert to authenticated
  with check ((id = auth.uid()));
create policy mcp_ro_read on public.profiles as permissive for select to mcp_readonly
  using (true);
create policy "profiles: authenticated can view all" on public.profiles as permissive for select to authenticated
  using (true);
create policy "profiles: users can view own" on public.profiles as permissive for select to authenticated
  using ((id = auth.uid()));
create policy "profiles: users can update own" on public.profiles as permissive for update to authenticated
  using ((id = auth.uid()));

create policy "student_profiles: students can insert own" on public.student_profiles as permissive for insert to authenticated
  with check ((id = auth.uid()));
create policy mcp_ro_read on public.student_profiles as permissive for select to mcp_readonly
  using (true);
create policy "student_profiles: authenticated can view all" on public.student_profiles as permissive for select to authenticated
  using (true);
create policy "student_profiles: coaches can update any" on public.student_profiles as permissive for update to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'coach'::text)))));
create policy "student_profiles: students can update own" on public.student_profiles as permissive for update to authenticated
  using ((id = auth.uid()));

create policy "assignments: all coaches can delete all" on public.training_plan_assignments as permissive for delete to public
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy "assignments: coaches can insert" on public.training_plan_assignments as permissive for insert to authenticated
  with check ((coach_id = auth.uid()));
create policy "assignments: all coaches can view all" on public.training_plan_assignments as permissive for select to public
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy "assignments: students can view own" on public.training_plan_assignments as permissive for select to authenticated
  using ((student_id = auth.uid()));
create policy mcp_ro_read on public.training_plan_assignments as permissive for select to mcp_readonly
  using (true);
create policy "assignments: all coaches can update all" on public.training_plan_assignments as permissive for update to public
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));

create policy "plan_days: coaches can manage any" on public.training_plan_days as permissive for all to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))))
  with check ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy mcp_ro_read on public.training_plan_days as permissive for select to mcp_readonly
  using (true);
create policy "plan_days: students can view assigned" on public.training_plan_days as permissive for select to authenticated
  using ((EXISTS ( SELECT 1 FROM training_plan_assignments tpa WHERE ((tpa.plan_id = training_plan_days.plan_id) AND (tpa.student_id = auth.uid())))));

create policy "plan_exercises: coaches can manage any" on public.training_plan_exercises as permissive for all to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))))
  with check ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy mcp_ro_read on public.training_plan_exercises as permissive for select to mcp_readonly
  using (true);
create policy "plan_exercises: students can view assigned" on public.training_plan_exercises as permissive for select to authenticated
  using ((EXISTS ( SELECT 1 FROM (training_plan_days tpd JOIN training_plan_assignments tpa ON ((tpa.plan_id = tpd.plan_id))) WHERE ((tpd.id = training_plan_exercises.day_id) AND (tpa.student_id = auth.uid())))));

-- OJO: esta policy original tiene el hueco de seguridad (no compara el usuario).
create policy "training_plans: coaches can delete any" on public.training_plans as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE (profiles.role = 'coach'::text))));
create policy "training_plans: coaches can insert" on public.training_plans as permissive for insert to authenticated
  with check ((coach_id = auth.uid()));
create policy mcp_ro_read on public.training_plans as permissive for select to mcp_readonly
  using (true);
create policy "training_plans: all coaches can view all plans" on public.training_plans as permissive for select to public
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy "training_plans: students can view assigned" on public.training_plans as permissive for select to authenticated
  using ((EXISTS ( SELECT 1 FROM training_plan_assignments tpa WHERE ((tpa.plan_id = training_plans.id) AND (tpa.student_id = auth.uid())))));
create policy "training_plans: coaches can update any" on public.training_plans as permissive for update to authenticated
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))))
  with check ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));

create policy students_delete_own_workout_completions on public.workout_completions as permissive for delete to public
  using ((auth.uid() = student_id));
create policy "Students can insert own workout completions" on public.workout_completions as permissive for insert to authenticated
  with check ((student_id = auth.uid()));
create policy "Coaches can read all workout completions" on public.workout_completions as permissive for select to public
  using ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'coach'::text)))));
create policy "Students can read own workout completions" on public.workout_completions as permissive for select to authenticated
  using ((student_id = auth.uid()));
create policy mcp_ro_read on public.workout_completions as permissive for select to mcp_readonly
  using (true);

commit;
