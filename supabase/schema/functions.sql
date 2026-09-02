-- =====================================================================
-- FUNCIONES del esquema `public` — proyecto hcvytsitbsandaphsxyn
-- Snapshot generado: 2026-08-30 (pg_get_functiondef). NO ES MIGRACIÓN.
-- 6 funciones. GRANTs idénticos en todas:
--   {=X/postgres, postgres=X/postgres, anon=X/postgres,
--    authenticated=X/postgres, service_role=X/postgres}
-- es decir: EXECUTE para PUBLIC + anon + authenticated + service_role.
-- =====================================================================

-- ---------------------------------------------------------------------
-- get_monthly_ranking(p_month_start date)  -- SQL, STABLE, SECURITY DEFINER
-- Ranking mensual de asistencias: cuenta workout_completions del mes,
-- con la fecha convertida a la zona America/Argentina/Buenos_Aires.
-- ---------------------------------------------------------------------
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
    p.profile_image,
    COUNT(*) AS attendance_count
  FROM public.workout_completions wc
  JOIN public.profiles p ON p.id = wc.student_id
  WHERE
    DATE_TRUNC('month', wc.completed_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    = p_month_start
  GROUP BY wc.student_id, p.first_name, p.last_name, p.profile_image
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
