# Snapshot del esquema Supabase

Esta carpeta versiona el estado del esquema `public` del proyecto Supabase
**`hcvytsitbsandaphsxyn`**, tal como estaba el **2026-08-30**.

Implementa la decisión **D-4** de `specs/mcp-server/requirements.md`: tener el
esquema y las RLS policies en el repo para poder diseñar y revisar el MCP server
sin consultar la base en vivo.

## Qué NO son estos archivos

- **No son migraciones ejecutables.** No están ordenadas por dependencias, no
  incluyen `IF NOT EXISTS`, y algunas tablas tienen huecos de `ordinal_position`
  por columnas eliminadas en el pasado (documentados con comentarios). Correr
  `tables.sql` contra una base vacía probablemente falle.
- **No son la fuente de verdad.** La fuente de verdad es la base remota. Estos
  archivos son un *snapshot de lectura* para consulta y code review.
- No incluyen los esquemas `auth`, `storage`, `realtime` ni las Edge Functions.

## Contenido

| Archivo | Qué contiene |
|---|---|
| `tables.sql` | DDL reconstruido de las 18 tablas de `public`: columnas (tipo, nullability, default), PK, FK, UNIQUE, CHECK, `ENABLE ROW LEVEL SECURITY` y los triggers no internos. Cada tabla lleva su cantidad de filas al momento del snapshot. |
| `policies.sql` | Las 71 RLS policies de `public`, con comando, roles, `USING` y `WITH CHECK` textuales. |
| `functions.sql` | Las 6 funciones de `public` con su `SECURITY DEFINER/INVOKER` y GRANTs. |
| `indexes.sql` | Índices de `public` (los de PK/UNIQUE quedan comentados) más notas sobre índices ausentes relevantes. |

## Cómo se regenera

Todo se obtuvo en **solo lectura**, sin aplicar DDL, vía el MCP server de
Supabase (`execute_sql`). El CLI de Supabase no está instalado en la máquina de
desarrollo, así que `supabase db pull` no fue una opción.

Consultas usadas, una por archivo:

```sql
-- tables.sql — columnas
SELECT table_name, column_name, ordinal_position, data_type, udt_name,
       character_maximum_length, numeric_precision, numeric_scale,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- tables.sql — constraints
SELECT c.conrelid::regclass::text AS tbl, c.conname, c.contype,
       pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_class t     ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
ORDER BY 1, c.contype, c.conname;

-- tables.sql — triggers y RLS
SELECT c.relname AS tbl, t.tgname, pg_get_triggerdef(t.oid) AS def
FROM pg_trigger t
JOIN pg_class c     ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal;

SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, c.reltuples::bigint
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

-- policies.sql
SELECT schemaname, tablename, policyname, permissive, roles::text, cmd,
       qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- functions.sql
SELECT p.proname, pg_get_functiondef(p.oid) AS def, p.prosecdef, p.proacl::text
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- indexes.sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

Para actualizar el snapshot: correr las consultas de nuevo, reescribir los
archivos, y cambiar la fecha en este README y en los encabezados de cada `.sql`.

Si en algún momento se instala el CLI y se linkea el proyecto, la alternativa
preferible es `supabase db pull`, que genera migraciones reales en
`supabase/migrations/`. Esta carpeta seguiría siendo útil como vista legible.

## Notas relevantes para el MCP server

- **Determinación del rol.** Ninguna policy usa JWT claims ni una función
  helper: todas resuelven coach/alumno con el subquery
  `EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'coach')`.
  Con 45 filas en `profiles` es barato, pero el subquery se evalúa por fila
  (no está envuelto en `(SELECT ...)`), así que no escala bien.
- **Policies con `TO public`.** Varias policies (en `training_plans`,
  `training_plan_assignments`, `workout_completions`, `exercise_weight_logs`)
  están declaradas para el rol `public`, no para `authenticated`. Cualquier rol
  nuevo las hereda. El rol read-only de D-2 debe controlarse con GRANTs
  explícitos, no confiando en que las policies lo excluyan.
- **`training_plans: coaches can delete any`** tiene un bug: su `USING` es
  `EXISTS (SELECT 1 FROM profiles WHERE profiles.role = 'coach')`, sin
  `profiles.id = auth.uid()`. Basta con que exista algún coach en la tabla.
  No lo toca el MCP server (es solo lectura), pero conviene registrarlo.
