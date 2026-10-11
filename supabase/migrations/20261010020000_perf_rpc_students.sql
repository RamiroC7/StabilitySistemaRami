-- Rendimiento: agregaciones en el servidor (RENDIMIENTO.md D-06, P0-01, P0-02)
-- — reglas R19/R20/R21/R30 de la skill rendimiento-stability.
--
-- Reemplazan, en la pantalla de alumnos del coach:
--   * fetchStudents: 3 requests con `.in("id", [todos los UUID])` (la URL crece
--     ~36 bytes por alumno y revienta el limite de largo con unos cientos).
--   * alertas de StudentsList: bajaba TODAS las workout_completions de TODOS los
--     alumnos (sin limite: PostgREST corta en 1.000 filas) solo para quedarse
--     con los ultimos 3 RPE por alumno y contar la asistencia de la semana.
--
-- SECURITY INVOKER: corren con los permisos (y la RLS) de quien llama, igual
-- que las consultas directas que reemplazan. No exponen nada nuevo.
--
-- ROLLBACK:
--   drop function if exists public.get_students_overview(date);
--   drop function if exists public.get_students_alerts(timestamptz, timestamptz);

create or replace function public.get_students_overview(p_today date default current_date)
returns table (
  student_id          uuid,
  first_name          text,
  last_name           text,
  profile_image_url   text,
  training_experience text,
  primary_goal        text,
  activity_level      text,
  phone               text,
  instagram           text,
  is_archived         boolean,
  assignments         jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    sp.profile_image_url,
    sp.training_experience,
    sp.primary_goal,
    sp.activity_level,
    sp.phone,
    sp.instagram,
    coalesce(sp.is_archived, false),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'plan_id',       a.plan_id,
            'plan_title',    coalesce(tp.title, 'Plan sin nombre'),
            'start_date',    a.start_date,
            'end_date',      a.end_date,
            'status',        a.status,
            'days_per_week', coalesce(tp.total_days, tp.days_per_week, 3)
          )
          order by a.start_date
        )
        from public.training_plan_assignments a
        left join public.training_plans tp on tp.id = a.plan_id
        where a.student_id = p.id
          and a.status in ('active', 'paused')
          and a.end_date >= p_today
      ),
      '[]'::jsonb
    )
  from public.profiles p
  join public.student_profiles sp on sp.id = p.id
  where p.role = 'student'
  order by p.created_at desc;
$$;

-- p_week_start / p_week_end: ventana de la semana pasada (lunes 00:00 a domingo
-- 23:59:59.999, en hora local del cliente) para contar la asistencia.
create or replace function public.get_students_alerts(
  p_week_start timestamptz,
  p_week_end   timestamptz
)
returns table (
  student_id      uuid,
  recent_rpes     integer[],
  last_week_count integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with ranked as (
    select
      wc.student_id,
      wc.rpe,
      wc.completed_at,
      row_number() over (partition by wc.student_id order by wc.completed_at desc) as rn
    from public.workout_completions wc
  )
  select
    r.student_id,
    -- ultimos 3 RPE (mas reciente primero); conserva los NULL como hacia el cliente
    (array_agg(r.rpe order by r.rn) filter (where r.rn <= 3)),
    (count(*) filter (where r.completed_at between p_week_start and p_week_end))::integer
  from ranked r
  group by r.student_id;
$$;

-- R30: este proyecto da EXECUTE a anon/authenticated por default privileges;
-- revocar de PUBLIC no alcanza, hay que revocar de cada rol.
revoke execute on function public.get_students_overview(date) from public, anon, authenticated;
grant  execute on function public.get_students_overview(date) to authenticated;

revoke execute on function public.get_students_alerts(timestamptz, timestamptz) from public, anon, authenticated;
grant  execute on function public.get_students_alerts(timestamptz, timestamptz) to authenticated;
