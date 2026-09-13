-- Limpieza de inconsistencias en el esquema `public` (sesión 2026-09-12).
-- Aplicado vía `apply_migration` contra hcvytsitbsandaphsxyn, en varios pasos:
--
-- 1. DROP de 2 tablas sin uso, 0 filas siempre: `body_measurements`,
--    `workout_logs`. Ninguna referencia en el código de la app ni en los
--    paquetes de `packages/`.
--
-- 2. DROP de `student_profiles.status` (35/35 filas en 'active', constraint
--    permitía 'archived'/'deleted' pero nunca se escribió desde el código).
--    El archivado real de un alumno se maneja con `is_archived` + `archived_at`
--    en la misma tabla (ver src/features/students/StudentProfile.tsx).
--
-- 3. DROP de `profiles.is_archived` (42/42 filas en `false`, nunca se
--    escribía desde el frontend). Resultó tener UN consumidor real:
--    `packages/gym-owner-mcp/src/oauth/authorize-callback.ts` lo usaba para
--    revocar acceso OAuth a un coach puntual — nunca se ejerció en
--    producción. Decisión: se sacó ese chequeo del código (ya no bloquea por
--    "coach archivado", solo por `role != 'coach'`) en vez de recrear la
--    columna. Si se necesita revocar acceso a un coach en el futuro, hay que
--    reintroducir un mecanismo para eso.
--
-- 4. DROP de `profiles.profile_image` (42/42 filas en NULL). La foto de
--    perfil real vive en `student_profiles.profile_image_url`. Se ajustaron
--    3 fallbacks en el frontend (authStore.ts, StudentProfile.tsx,
--    useTrainingPlans.ts) y la función `get_monthly_ranking` (leía
--    `p.profile_image` directo — se cambió a
--    `student_profiles.profile_image_url`, lo cual además corrige un bug:
--    el ranking mensual mostraba siempre avatar vacío).
--
-- 5. `packages/mcp-server` tool `list_students` filtraba "archivado" contra
--    `profiles.is_archived` (ya eliminada, y de todos modos NUNCA reflejó el
--    estado real: siempre era `false`). El dato real vive en
--    `student_profiles.is_archived`, tabla que `mcp_readonly` tiene
--    prohibida por PII (ver 20260902000000_mcp_server_setup.sql §5). Se
--    otorgó una excepción column-level: SOLO `is_archived`, ninguna columna
--    con datos personales.

drop table if exists public.body_measurements;
drop table if exists public.workout_logs;

alter table public.student_profiles drop column if exists status;

alter table public.profiles drop column if exists is_archived;
alter table public.profiles drop column if exists profile_image;

create or replace function public.get_monthly_ranking(p_month_start date)
 returns table(student_id uuid, first_name text, last_name text, profile_image text, attendance_count bigint)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    wc.student_id,
    p.first_name,
    p.last_name,
    sp.profile_image_url as profile_image,
    count(*) as attendance_count
  from public.workout_completions wc
  join public.profiles p on p.id = wc.student_id
  left join public.student_profiles sp on sp.id = wc.student_id
  where
    date_trunc('month', wc.completed_at at time zone 'America/Argentina/Buenos_Aires')::date
    = p_month_start
  group by wc.student_id, p.first_name, p.last_name, sp.profile_image_url
  order by
    attendance_count desc,
    min(wc.completed_at at time zone 'America/Argentina/Buenos_Aires') asc;
$function$;

-- Excepción column-level: list_students necesita is_archived, pero el resto
-- de student_profiles queda fuera del alcance de mcp_readonly por PII.
grant select (is_archived) on public.student_profiles to mcp_readonly;
create policy mcp_ro_read on public.student_profiles for select to mcp_readonly using (true);
