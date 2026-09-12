-- Gym Owner MCP (acceso read-only de coaches vía MCP remoto en Vercel) — Fase A.
--
-- Aditivo: crea un schema nuevo (`gym_mcp`) con 5 tablas de contabilidad
-- propia del server (clientes OAuth, grants, tokens, refresh tokens, audit
-- log), un rol de servicio (`gym_mcp_service`) para administrarlas, y ajusta
-- el rol de solo lectura `gym_owner_readonly` para que quede alineado con
-- specs/gym-owner-mcp-vercel/design.md. NO modifica ninguna tabla, policy,
-- función o rol existente fuera de lo listado. NO toca `mcp_readonly`,
-- `packages/mcp-server`, la app principal, ni RLS de ninguna tabla de
-- `public`.
--
-- ⚠️ Nota real de esta corrida (2026-09-12, aplicada vía `apply_migration`
-- contra `hcvytsitbsandaphsxyn`): el rol `gym_owner_readonly` **ya existía**
-- en producción al momento de aplicar esta migración — creado por fuera de
-- esta sesión/herramienta, con `CONNECTION LIMIT 5`,
-- `idle_in_transaction_session_timeout = 60s` y `search_path = public,
-- extensions` (valores de un borrador anterior a `design.md`, no del diseño
-- aprobado), con password ya seteado pero **sin ningún `GRANT SELECT`**
-- (quedó a mitad de camino). Confirmado con el usuario antes de tocarlo: se
-- ajustó con `ALTER ROLE` a los valores del diseño aprobado (connection
-- limit 10, idle timeout 15s, sin el `search_path` forzado) y se agregaron
-- los grants que faltaban, **conservando el password existente** — no se
-- recreó el rol. Por eso este archivo usa `ALTER ROLE`, no `CREATE ROLE`,
-- para `gym_owner_readonly`.
--
-- También se descartó `ALTER TABLE ... OWNER TO gym_mcp_service` (como
-- proponía la primera versión de esta migración): el rol que ejecuta
-- `apply_migration` no es superuser ni miembro de `gym_mcp_service`, así que
-- Postgres lo rechaza (`must be able to SET ROLE`). Se usa `GRANT` explícito
-- sobre cada tabla en su lugar, más `ALTER DEFAULT PRIVILEGES` para que
-- cubra tablas que se sumen después a `gym_mcp`.
--
-- El password de `gym_mcp_service` (rol nuevo, sin este problema) se setea
-- aparte, una sola vez, con
--   alter role gym_mcp_service password '<generado>';
-- y vive solo como env var de Vercel — mismo criterio que `mcp_readonly` en
-- 20260902000000_mcp_server_setup.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rol de datos: gym_owner_readonly (ya existía — ver nota arriba).
--    BYPASSRLS + solo SELECT sobre TODAS las tablas de public (US-3, US-4).
-- ─────────────────────────────────────────────────────────────────────────────
alter role gym_owner_readonly connection limit 10;
alter role gym_owner_readonly set idle_in_transaction_session_timeout = '15s';
alter role gym_owner_readonly reset search_path;
-- default_transaction_read_only (on), statement_timeout (30s) y bypassrls
-- (true) ya estaban correctos desde la creación previa — sin cambios.

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
-- 3. Rol de servicio: gym_mcp_service (nuevo, sin el problema de arriba).
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
-- 4. Tablas de gym_mcp + grants explícitos a gym_mcp_service.
-- ─────────────────────────────────────────────────────────────────────────────

create table gym_mcp.oauth_clients (
    client_id     text primary key,       -- generado random (DCR)
    redirect_uris text[] not null,
    client_name   text,
    created_at    timestamptz not null default now()
);
-- Clientes públicos (sin secreto): el MCP client de Claude usa PKCE.

create table gym_mcp.access_grants (              -- authorization codes, TTL corto
    code_hash        text primary key,             -- sha256(code) hex
    client_id        text not null references gym_mcp.oauth_clients (client_id),
    coach_profile_id uuid not null,                -- = public.profiles.id, sin FK cross-DB-role
    redirect_uri     text not null,
    code_challenge   text not null,                -- PKCE S256
    expires_at       timestamptz not null,          -- now() + 5 min
    used_at          timestamptz
);

create table gym_mcp.access_tokens (
    token_hash       text primary key,             -- sha256(token) hex
    client_id        text not null references gym_mcp.oauth_clients (client_id),
    coach_profile_id uuid not null,
    coach_label      text not null,                -- nombre para mostrar en logs/UI
    created_at       timestamptz not null default now(),
    expires_at       timestamptz not null,          -- ej. now() + 1h
    revoked_at       timestamptz
);

create table gym_mcp.refresh_tokens (
    token_hash       text primary key,
    client_id        text not null references gym_mcp.oauth_clients (client_id),
    coach_profile_id uuid not null,
    created_at       timestamptz not null default now(),
    expires_at       timestamptz not null,          -- ej. now() + 30 días
    revoked_at       timestamptz
);

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

-- gym_mcp_service es quien lee/escribe estas filas en runtime. GRANT
-- explícito en vez de ALTER TABLE ... OWNER TO: el rol que corre esta
-- migración no es superuser ni miembro de gym_mcp_service (ver nota de
-- cabecera), así que reasignar el owner falla con "must be able to SET
-- ROLE". Postgres es dueño de las tablas; gym_mcp_service solo tiene los
-- privilegios de fila que necesita.
grant select, insert, update, delete on
    gym_mcp.oauth_clients,
    gym_mcp.access_grants,
    gym_mcp.access_tokens,
    gym_mcp.refresh_tokens,
    gym_mcp.query_audit_log
  to gym_mcp_service;

-- Cubre también cualquier tabla que se sume después a gym_mcp creada por el
-- mismo rol (postgres) que corrió esta migración.
alter default privileges for role postgres in schema gym_mcp
    grant select, insert, update, delete on tables to gym_mcp_service;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Aislamiento entre roles (léase junto con design.md §Data model):
--    * gym_mcp_service NO tiene ningún GRANT de tabla (ni SELECT ni ningún
--      otro) sobre public — no puede leer ni escribir ninguna tabla de la
--      app. Nota: Postgres otorga USAGE sobre el schema public a PUBLIC por
--      default (todo rol lo hereda); eso no alcanza para leer datos sin un
--      grant de tabla, así que el error real al intentar
--      `select * from public.profiles` va a ser "permission denied for
--      table profiles", no "for schema public". No conviene revocarle USAGE
--      a PUBLIC para "cerrar" esto — es un cambio global que afectaría a
--      todos los roles del proyecto, no solo a este.
--    * gym_owner_readonly NO tiene ningún acceso a gym_mcp — no ve tokens ni
--      el audit log de coaches.
-- ─────────────────────────────────────────────────────────────────────────────
