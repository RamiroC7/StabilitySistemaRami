-- Schema `mcp` — artefactos del MCP server de solo lectura.
-- Creado por supabase/migrations/20260902000000_mcp_server_setup.sql (aplicado 2026-09-02).
-- Snapshot, no ejecutable. Ver el archivo de migración para el DDL real.

-- ─── Schema ──────────────────────────────────────────────────────────────────
create schema mcp;

-- ─── Tabla de tokens de acceso ───────────────────────────────────────────────
create table mcp.access_tokens (
    id           uuid primary key default gen_random_uuid(),
    token_hash   text        not null unique,   -- sha256(token) hex
    profile_id   uuid        not null references public.profiles(id) on delete cascade,
    label        text        not null,
    created_at   timestamptz not null default now(),
    expires_at   timestamptz,
    revoked_at   timestamptz
);
-- RLS activa, sin policy para anon/authenticated (default-deny).
alter table mcp.access_tokens enable row level security;

-- ─── Rol de solo lectura ─────────────────────────────────────────────────────
-- create role mcp_readonly with login password '<no versionado>'
--     nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
-- alter role mcp_readonly set default_transaction_read_only = on;
-- alter role mcp_readonly set statement_timeout = '15s';
-- alter role mcp_readonly set idle_in_transaction_session_timeout = '30s';
-- alter role mcp_readonly set search_path = public, extensions;
-- alter role mcp_readonly connection limit 5;

-- ─── Grants ──────────────────────────────────────────────────────────────────
-- grant usage on schema mcp, public, extensions to mcp_readonly;
-- grant select on
--     public.profiles, public.training_plans, public.training_plan_days,
--     public.training_plan_exercises, public.training_plan_assignments,
--     public.workout_completions, public.exercise_weight_logs,
--     mcp.access_tokens
--   to mcp_readonly;

-- ─── Policies para mcp_readonly (una por tabla, SELECT, USING (true)) ─────────
-- create policy mcp_ro_read on public.profiles                  for select to mcp_readonly using (true);
-- create policy mcp_ro_read on public.training_plans            for select to mcp_readonly using (true);
-- create policy mcp_ro_read on public.training_plan_days        for select to mcp_readonly using (true);
-- create policy mcp_ro_read on public.training_plan_exercises   for select to mcp_readonly using (true);
-- create policy mcp_ro_read on public.training_plan_assignments for select to mcp_readonly using (true);
-- create policy mcp_ro_read on public.workout_completions       for select to mcp_readonly using (true);
-- create policy mcp_ro_read on public.exercise_weight_logs      for select to mcp_readonly using (true);
-- create policy mcp_ro_read on mcp.access_tokens                for select to mcp_readonly using (true);
