-- Endurecimiento de funciones (advisor de seguridad, 2026-10-10) — regla R30.
--
-- 1) get_monthly_ranking es SECURITY DEFINER y era ejecutable por `anon` via
--    /rest/v1/rpc: cualquiera sin loguearse podia ver nombres, apellidos y fotos
--    de los alumnos. Solo la usan alumnos/coaches logueados (NewsRanking).
-- 2) handle_new_user (trigger SECURITY DEFINER sobre auth.users) tampoco tiene
--    por que ser invocable por API. Un trigger NO necesita que el rol que
--    dispara el evento tenga EXECUTE (solo se chequea al crear el trigger).
-- 3) Las funciones de trigger sin search_path fijo (lint
--    function_search_path_mutable) pasan a `search_path = public`. Todas
--    referencian objetos con schema explicito, asi que el comportamiento no cambia.
--
-- ROLLBACK:
--   grant execute on function public.get_monthly_ranking(date) to anon;
--   grant execute on function public.handle_new_user() to anon, authenticated;
--   alter function public.handle_new_user() reset search_path;
--   alter function public.handle_updated_at() reset search_path;
--   alter function public.set_updated_at() reset search_path;
--   alter function public.update_updated_at_column() reset search_path;
--   alter function public.validate_student_profile() reset search_path;

revoke execute on function public.get_monthly_ranking(date) from public, anon, authenticated;
grant  execute on function public.get_monthly_ranking(date) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter function public.handle_new_user()            set search_path = public;
alter function public.handle_updated_at()          set search_path = public;
alter function public.set_updated_at()             set search_path = public;
alter function public.update_updated_at_column()   set search_path = public;
alter function public.validate_student_profile()   set search_path = public;
