-- Fix de seguimiento de progreso en training_plan_assignments (sesión
-- 2026-09-12, continuación de 20260912010000_cleanup_dead_columns.sql).
-- Aplicado vía `apply_migration` contra hcvytsitbsandaphsxyn, en varios pasos:
--
-- 1. BUG REAL (no columna muerta): `completed_days` y `current_day_number`
--    tenían lógica de escritura activa y correcta (src/lib/assignmentProgress.ts),
--    pero la policy RLS de UPDATE en `training_plan_assignments` solo
--    permite coaches — no hay policy para que el alumno actualice su propia
--    fila. Supabase no tira error cuando un UPDATE no matchea ninguna fila
--    por RLS (0 filas afectadas, silencioso), así que las 116 filas
--    quedaron para siempre en completed_days=0, current_day_number=1,
--    pese a haber asignaciones con hasta 57 workout_completions reales.
--
-- 2. Fix: función `update_own_assignment_progress` (SECURITY DEFINER) que el
--    alumno invoca vía RPC — verifica student_id = auth.uid() adentro y solo
--    puede tocar completed_days/current_day_number de su propia fila. Se
--    prefirió sobre agregar una policy UPDATE amplia para no abrir el resto
--    de columnas (fechas, plan_id, coach_id) a escritura desde el cliente.
--
-- 3. Backfill one-time de las 116 filas existentes con el valor real
--    calculado desde workout_completions (mismo criterio que
--    assignmentProgress.ts). Excluye asignaciones 'cancelled' (decisión
--    explícita del coach, no debía revertirse por completions viejas).
--
-- 4. Se descartó completar `status` en el mismo backfill/RPC: la lógica
--    original (`completed_days >= total_days`) está mal para TODOS los
--    planes del sistema — `total_days` es la cantidad de días DISTINTOS de
--    la plantilla semanal (ej. 4), no la duración real del programa
--    (`total_weeks` × 7, vía start_date/end_date). El primer backfill sí
--    la aplicó y marcó 62 filas 'completed', 11 de las cuales seguían
--    dentro de su end_date — esos alumnos hubieran dejado de ver su plan
--    activo en el home (useActiveAssignment.ts filtra status='active').
--    Se revirtió el status de esas 62 filas a 'active' antes de continuar.
--
-- 5. Reemplazo: `status` pasa a 'completed' SOLO por acción del coach o por
--    el cron diario `complete_expired_assignments` (pg_cron, 06:00 UTC),
--    basado en end_date vencido — la duración real del programa, no en
--    días de plantilla tocados.
--
-- 6. DROP de `training_plan_assignments.personalization_notes` (0/116 con
--    valor, sin lectura/escritura en ningún componente) — mismo patrón que
--    las columnas de 20260912010000.
--
-- 7. `api/ai-chat.js` (Vercel function, no revisada en la limpieza anterior)
--    consultaba `profiles.is_archived` directo en 3 tools
--    (buscarAlumnosInactivos, buscarAlumnosSinPlan, calcularAdherenciaAlumnos)
--    y listaba `body_measurements`/`workout_logs` como tablas consultables
--    — todo roto por los cambios de 20260912010000. Se corrigió a
--    `student_profiles.is_archived` (embebido vía PostgREST) y se sacaron
--    las tablas eliminadas de ALLOWED_TABLES/PROFILE_FK_COLUMNS y del
--    system prompt.

create or replace function public.update_own_assignment_progress(
  p_assignment_id uuid,
  p_completed_days integer,
  p_current_day_number integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  select student_id into v_student_id
  from public.training_plan_assignments
  where id = p_assignment_id
  for update;

  if v_student_id is null then
    raise exception 'assignment not found';
  end if;

  if v_student_id <> auth.uid() then
    raise exception 'not authorized';
  end if;

  if p_completed_days < 0 then
    raise exception 'invalid completed_days: %', p_completed_days;
  end if;

  update public.training_plan_assignments
  set
    completed_days = p_completed_days,
    current_day_number = coalesce(p_current_day_number, current_day_number),
    updated_at = now()
  where id = p_assignment_id;
end;
$$;

revoke all on function public.update_own_assignment_progress(uuid, integer, integer) from public;
grant execute on function public.update_own_assignment_progress(uuid, integer, integer) to authenticated;

-- Backfill one-time (idempotente si se re-corre: solo actualiza filas donde
-- hay completions reales, y solo completed_days/current_day_number).
with completions as (
  select
    tpa.id as assignment_id,
    tp.total_days,
    count(distinct wc.day_number) as completed_days,
    (array_agg(wc.day_number order by wc.completed_at desc))[1] as last_day_number
  from public.training_plan_assignments tpa
  join public.training_plans tp on tp.id = tpa.plan_id
  join public.workout_completions wc
    on wc.assignment_id = tpa.id
   and wc.student_id = tpa.student_id
   and wc.completed_at >= (tpa.start_date - 1)::timestamp
  where tpa.status <> 'cancelled'
  group by tpa.id, tp.total_days
)
update public.training_plan_assignments tpa
set
  completed_days = least(c.completed_days, c.total_days),
  current_day_number = coalesce(c.last_day_number, tpa.current_day_number),
  updated_at = now()
from completions c
where tpa.id = c.assignment_id;

create extension if not exists pg_cron;

create or replace function public.complete_expired_assignments()
returns void
language sql
security definer
set search_path = public
as $$
  update public.training_plan_assignments
  set status = 'completed', updated_at = now()
  where status = 'active'
    and end_date < current_date;
$$;

select cron.schedule(
  'complete-expired-assignments-daily',
  '0 6 * * *',
  $$select public.complete_expired_assignments();$$
) where not exists (
  select 1 from cron.job where jobname = 'complete-expired-assignments-daily'
);

alter table public.training_plan_assignments drop column if exists personalization_notes;
