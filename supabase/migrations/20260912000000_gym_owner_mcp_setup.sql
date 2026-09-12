-- Gym Owner MCP (acceso read-only de coaches vía MCP remoto en Vercel) — Fase A.
--
-- Aditivo: crea un rol de solo lectura sobre `public` (`gym_owner_readonly`),
-- un schema nuevo (`gym_mcp`) con 5 tablas de contabilidad propia del server
-- (clientes OAuth, grants, tokens, refresh tokens, audit log), y un rol de
-- servicio (`gym_mcp_service`) dueño de ese schema. NO modifica ninguna
-- tabla, policy, función o rol existente. NO toca `mcp_readonly`,
-- `packages/mcp-server`, la app principal, ni RLS de ninguna tabla de
-- `public` (ver design.md §Data model y §Architecture, "No toca").
--
-- Los passwords de ambos roles NO están acá: se setean aparte, una sola vez
-- cada uno, con
--   alter role gym_owner_readonly password '<generado>';
--   alter role gym_mcp_service   password '<generado, distinto>';
-- y viven solo como env vars de Vercel — mismo criterio que se usó para
-- `mcp_readonly` en 20260902000000_mcp_server_setup.sql.
--
-- Esta migración NO se aplica a producción en este paso (T1 de
-- specs/gym-owner-mcp-vercel/tasks.md). Aplicarla es T2, que requiere
-- aprobación explícita del usuario con este SQL a la vista.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rol de datos: gym_owner_readonly.
--    BYPASSRLS + solo SELECT sobre TODAS las tablas de public (US-3, US-4).
--    Sin password acá (ver cabecera). Sin USAGE sobre "mcp" ni ningún grant
--    sobre packages/mcp-server (US-8).
-- ─────────────────────────────────────────────────────────────────────────────
create role gym_owner_readonly with
    login
    nosuperuser nocreatedb nocreaterole noinherit noreplication
    bypassrls
    connection limit 10;   -- serverless: varias invocaciones concurrentes

alter role gym_owner_readonly set default_transaction_read_only = on;
alter role gym_owner_readonly set statement_timeout = '30s';
alter role gym_owner_readonly set idle_in_transaction_session_timeout = '15s';

grant usage on schema public to gym_owner_readonly;
grant select on all tables in schema public to gym_owner_readonly;
alter default privileges for role postgres in schema public
    grant select on tables to gym_owner_readonly;
-- Sin INSERT/UPDATE/DELETE/DDL en ningún caso. BYPASSRLS es la razón por la
-- que no hace falta una policy por tabla (ni mantenerla cuando se agreguen
-- tablas nuevas) — a diferencia de mcp_readonly.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Schema propio del server: gym_mcp.
--    NO se agrega a los schemas expuestos por PostgREST.
-- ─────────────────────────────────────────────────────────────────────────────
create schema if not exists gym_mcp;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Rol de servicio: gym_mcp_service.
--    Solo para la contabilidad propia del server — nunca toca public.
--    Sin password acá (ver cabecera).
-- ─────────────────────────────────────────────────────────────────────────────
create role gym_mcp_service with
    login
    nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls
    connection limit 10;

alter role gym_mcp_service set statement_timeout = '10s';

grant usage, create on schema gym_mcp to gym_mcp_service;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tablas de gym_mcp.
--    Enfoque elegido: ALTER TABLE ... OWNER TO gym_mcp_service en vez de un
--    GRANT ALL explícito por tabla — más simple (el owner tiene automáticamente
--    todos los privilegios, incluidos los que se agreguen a futuro con ALTER
--    TABLE) y no requiere mantener una lista de grants en paralelo a la lista
--    de tablas. Sin RLS: son de uso interno del server, no expuestas a
--    gym_owner_readonly ni a PostgREST (ver comentario final).
-- ─────────────────────────────────────────────────────────────────────────────

create table gym_mcp.oauth_clients (
    client_id     text primary key,       -- generado random (DCR)
    redirect_uris text[] not null,
    client_name   text,
    created_at    timestamptz not null default now()
);
-- Clientes públicos (sin secreto): el MCP client de Claude usa PKCE.
alter table gym_mcp.oauth_clients owner to gym_mcp_service;

create table gym_mcp.access_grants (              -- authorization codes, TTL corto
    code_hash        text primary key,             -- sha256(code) hex
    client_id        text not null references gym_mcp.oauth_clients (client_id),
    coach_profile_id uuid not null,                -- = public.profiles.id, sin FK cross-DB-role
    redirect_uri     text not null,
    code_challenge   text not null,                -- PKCE S256
    expires_at       timestamptz not null,          -- now() + 5 min
    used_at          timestamptz
);
alter table gym_mcp.access_grants owner to gym_mcp_service;

create table gym_mcp.access_tokens (
    token_hash       text primary key,             -- sha256(token) hex
    client_id        text not null references gym_mcp.oauth_clients (client_id),
    coach_profile_id uuid not null,
    coach_label      text not null,                -- nombre para mostrar en logs/UI
    created_at       timestamptz not null default now(),
    expires_at       timestamptz not null,          -- ej. now() + 1h
    revoked_at       timestamptz
);
alter table gym_mcp.access_tokens owner to gym_mcp_service;

create table gym_mcp.refresh_tokens (
    token_hash       text primary key,
    client_id        text not null references gym_mcp.oauth_clients (client_id),
    coach_profile_id uuid not null,
    created_at       timestamptz not null default now(),
    expires_at       timestamptz not null,          -- ej. now() + 30 días
    revoked_at       timestamptz
);
alter table gym_mcp.refresh_tokens owner to gym_mcp_service;

create table gym_mcp.query_audit_log (
    id               uuid primary key default gen_random_uuid(),
    ts               timestamptz not null default now(),
    coach_profile_id uuid not null,
    question         text not null,
    sql              text not null,
    row_count        integer,           -- null hasta que la query termine
    duration_ms      integer,
    error            text
);
alter table gym_mcp.query_audit_log owner to gym_mcp_service;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Aislamiento entre roles (léase junto con design.md §Data model):
--    * gym_mcp_service NO tiene USAGE sobre public — no puede tocar ninguna
--      tabla de la app.
--    * gym_owner_readonly NO tiene ningún acceso a gym_mcp — no ve tokens ni
--      el audit log de coaches.
-- ─────────────────────────────────────────────────────────────────────────────
