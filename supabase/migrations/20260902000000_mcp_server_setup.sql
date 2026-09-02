-- MCP server de solo lectura — Fase 2.
--
-- Aditivo: crea un schema (`mcp`), una tabla de tokens, un rol de solo lectura
-- (`mcp_readonly`), sus grants y sus policies RLS. NO modifica ninguna tabla,
-- policy ni función existente. NO toca los roles anon / authenticated / service_role.
--
-- Aplicado a producción (proyecto hcvytsitbsandaphsxyn) el 2026-09-02 vía el
-- conector MCP de Supabase (apply_migration, transaccional). El Supabase CLI no
-- está en uso en este repo; este archivo es el registro versionado de ese cambio.
--
-- El password del rol NO está acá: se setea una sola vez con
--   alter role mcp_readonly password '<generado>';
-- y vive solo en el config local de Claude Desktop y en el .env del server.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extensión para matching aproximado de nombres de ejercicio (US-3)
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists unaccent with schema extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Schema propio del MCP. NO se agrega a los schemas expuestos por PostgREST.
-- ─────────────────────────────────────────────────────────────────────────────
create schema if not exists mcp;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tabla de tokens de acceso.
--    La escribe un admin (service_role / postgres, que bypassean RLS).
--    El server solo la lee, con el rol mcp_readonly (policy explícita en §6).
-- ─────────────────────────────────────────────────────────────────────────────
create table mcp.access_tokens (
    id           uuid primary key default gen_random_uuid(),
    token_hash   text        not null unique,        -- sha256(token) en hex
    profile_id   uuid        not null references public.profiles (id) on delete cascade,
    label        text        not null,               -- p. ej. "Claude Desktop de Máximo"
    created_at   timestamptz not null default now(),
    expires_at   timestamptz,                        -- null = sin expiración
    revoked_at   timestamptz                         -- no null = revocado
);

comment on table mcp.access_tokens is
    'Tokens de acceso al MCP server. token_hash = sha256(token) hex. El server valida '
    'contra esta tabla y exige profiles.role = ''coach''.';

alter table mcp.access_tokens enable row level security;
-- Sin policy para anon/authenticated => default-deny. Solo la ven los roles con
-- BYPASSRLS (admin) y mcp_readonly (policy explícita abajo).

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Rol de solo lectura. Sin password (ver cabecera).
-- ─────────────────────────────────────────────────────────────────────────────
create role mcp_readonly with login
    nosuperuser nocreatedb nocreaterole noinherit nobypassrls;

alter role mcp_readonly set default_transaction_read_only = on;          -- cualquier write falla
alter role mcp_readonly set statement_timeout = '15s';                   -- corta queries colgadas
alter role mcp_readonly set idle_in_transaction_session_timeout = '30s';
alter role mcp_readonly set search_path = public, extensions;            -- para unaccent() sin calificar
alter role mcp_readonly connection limit 5;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Grants: USAGE en schemas + SELECT en EXACTAMENTE 7 tablas de public + la de
--    tokens. Nada de student_profiles (PII), funciones, ni otras tablas.
-- ─────────────────────────────────────────────────────────────────────────────
grant usage on schema mcp, public, extensions to mcp_readonly;

grant select on
    public.profiles,
    public.training_plans,
    public.training_plan_days,
    public.training_plan_exercises,
    public.training_plan_assignments,
    public.workout_completions,
    public.exercise_weight_logs,
    mcp.access_tokens
  to mcp_readonly;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Policies RLS explícitas para mcp_readonly.
--    SIN esto, RLS default-deny => el rol ve 0 filas aunque tenga GRANT SELECT.
--    USING (true) porque el modelo acordado es "todos los coaches ven todo".
-- ─────────────────────────────────────────────────────────────────────────────
create policy mcp_ro_read on public.profiles                  for select to mcp_readonly using (true);
create policy mcp_ro_read on public.training_plans            for select to mcp_readonly using (true);
create policy mcp_ro_read on public.training_plan_days        for select to mcp_readonly using (true);
create policy mcp_ro_read on public.training_plan_exercises   for select to mcp_readonly using (true);
create policy mcp_ro_read on public.training_plan_assignments for select to mcp_readonly using (true);
create policy mcp_ro_read on public.workout_completions       for select to mcp_readonly using (true);
create policy mcp_ro_read on public.exercise_weight_logs      for select to mcp_readonly using (true);
create policy mcp_ro_read on mcp.access_tokens                for select to mcp_readonly using (true);
