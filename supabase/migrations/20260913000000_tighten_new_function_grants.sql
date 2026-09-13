-- Hallazgo del testeo post-deploy (2026-09-13): el security advisor de
-- Supabase marcó que `update_own_assignment_progress` y
-- `complete_expired_assignments` (agregadas en 20260912020000) eran
-- ejecutables por `anon` vía /rest/v1/rpc, pese al `revoke all ... from
-- public` de esa migración. Causa: este proyecto tiene ALTER DEFAULT
-- PRIVILEGES que le da EXECUTE a anon/authenticated en funciones nuevas por
-- fuera del pseudo-rol PUBLIC — revocar de PUBLIC no alcanza, hay que
-- revocar de cada rol explícitamente.
--
-- update_own_assignment_progress: debe quedar solo para `authenticated`
-- (el propio alumno, verificado adentro con auth.uid()).
-- complete_expired_assignments: no debería ser invocable vía API en
-- absoluto — solo la corre pg_cron (como `postgres`, que no depende de
-- estos grants).
revoke execute on function public.update_own_assignment_progress(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.update_own_assignment_progress(uuid, integer, integer) to authenticated;

revoke execute on function public.complete_expired_assignments() from public, anon, authenticated, mcp_readonly;
