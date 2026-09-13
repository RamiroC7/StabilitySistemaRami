-- =====================================================================
-- FUNCIONES del esquema `public` — proyecto hcvytsitbsandaphsxyn
-- Snapshot generado: 2026-08-30 (pg_get_functiondef). NO ES MIGRACIÓN.
-- Actualizado 2026-09-12: +2 funciones nuevas al final (grants distintos,
-- ver cada una) — ver supabase/migrations/20260912010000_cleanup_dead_columns.sql.
-- Las 6 originales. GRANTs idénticos en todas:
--   {=X/postgres, postgres=X/postgres, anon=X/postgres,
--    authenticated=X/postgres, service_role=X/postgres}
-- es decir: EXECUTE para PUBLIC + anon + authenticated + service_role.
-- =====================================================================

-- ---------------------------------------------------------------------
-- get_monthly_ranking(p_month_start date)  -- SQL, STABLE, SECURITY DEFINER
-- Ranking mensual de asistencias: cuenta workout_completions del mes,
-- con la fecha convertida a la zona America/Argentina/Buenos_Aires.
-- ---------------------------------------------------------------------
-- 2026-09-12: `p.profile_image` no existe mas (columna eliminada, ver
-- supabase/migrations/20260912010000_cleanup_dead_columns.sql). La foto de
-- perfil real vive en student_profiles.profile_image_url.
CREATE OR REPLACE FUNCTION public.get_monthly_ranking(p_month_start date)
 RETURNS TABLE(student_id uuid, first_name text, last_name text, profile_image text, attendance_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    wc.student_id,
    p.first_name,
    p.last_name,
    sp.profile_image_url AS profile_image,
    COUNT(*) AS attendance_count
  FROM public.workout_completions wc
  JOIN public.profiles p ON p.id = wc.student_id
  LEFT JOIN public.student_profiles sp ON sp.id = wc.student_id
  WHERE
    DATE_TRUNC('month', wc.completed_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    = p_month_start
  GROUP BY wc.student_id, p.first_name, p.last_name, sp.profile_image_url
  ORDER BY
    attendance_count DESC,
    MIN(wc.completed_at AT TIME ZONE 'America/Argentina/Buenos_Aires') ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_monthly_ranking(date) TO PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- handle_new_user()  -- trigger, plpgsql, SECURITY DEFINER
-- Se dispara desde auth.users (trigger en el esquema auth, fuera de este
-- snapshot) y crea la fila en public.profiles. Rol por defecto: 'coach'.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'coach')
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- Si el perfil ya existe, ignorar el error
        RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- handle_updated_at()  -- trigger, plpgsql, SECURITY INVOKER
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- set_updated_at()  -- trigger, plpgsql, SECURITY INVOKER
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at = now(); return new; end;
$function$;

GRANT EXECUTE ON FUNCTION public.set_updated_at() TO PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- update_updated_at_column()  -- trigger, plpgsql, SECURITY INVOKER
-- (tercera copia funcionalmente idéntica a las dos anteriores)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- validate_student_profile()  -- trigger, plpgsql, SECURITY INVOKER
-- Usado por el trigger validate_student_role en student_profiles.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_student_profile()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = NEW.id AND role = 'student'
    ) THEN
        RAISE EXCEPTION 'Solo los alumnos pueden tener un perfil de estudiante';
    END IF;
    RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.validate_student_profile() TO PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- update_own_assignment_progress(...)  -- plpgsql, SECURITY DEFINER
-- Agregada 2026-09-12. El alumno NO tiene UPDATE directo sobre
-- training_plan_assignments (solo coaches, ver policies.sql) — esta función
-- le permite actualizar SOLO completed_days/current_day_number de su propia
-- fila (verifica student_id = auth.uid() adentro), sin abrir el resto de
-- columnas a escritura desde el cliente. NO toca `status` — ver nota en
-- complete_expired_assignments más abajo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_own_assignment_progress(p_assignment_id uuid, p_completed_days integer, p_current_day_number integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- 2026-09-13: REVOKE de solo PUBLIC no alcanzaba (ALTER DEFAULT PRIVILEGES
-- de este proyecto le da EXECUTE a anon/authenticated por fuera de PUBLIC) —
-- se revoca explícitamente de cada rol. Ver 20260913000000_tighten_new_function_grants.sql.
REVOKE EXECUTE ON FUNCTION public.update_own_assignment_progress(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_assignment_progress(uuid, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------
-- complete_expired_assignments()  -- sql, SECURITY DEFINER
-- Agregada 2026-09-12, corrida por pg_cron a diario (job
-- "complete-expired-assignments-daily", 06:00 UTC). Es el ÚNICO lugar que
-- marca una asignación 'completed' automáticamente, y lo hace por end_date
-- vencido — NUNCA por completed_days alcanzando total_days, porque
-- total_days es la cantidad de días DISTINTOS de la plantilla semanal (no
-- la duración real del programa): ese criterio marcaría 'completed' a
-- cualquier alumno con una rutina que se repite apenas termine su primera
-- semana, aunque el programa siga vigente por meses.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_expired_assignments()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.training_plan_assignments
  set status = 'completed', updated_at = now()
  where status = 'active'
    and end_date < current_date;
$function$;

-- 2026-09-13: no debe ser invocable via /rest/v1/rpc por nadie — solo la
-- corre pg_cron (como `postgres`, que no depende de estos grants).
REVOKE EXECUTE ON FUNCTION public.complete_expired_assignments() FROM PUBLIC, anon, authenticated, mcp_readonly;

-- select cron.schedule(
--   'complete-expired-assignments-daily',
--   '0 6 * * *',
--   $$select public.complete_expired_assignments();$$
-- );
