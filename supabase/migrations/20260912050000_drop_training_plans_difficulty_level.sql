-- DROP de training_plans.difficulty_level (sesión 2026-09-12). 189/189
-- filas en NULL, sin CHECK constraint de valores permitidos (a diferencia
-- de primary_goal/training_experience en student_profiles). Se hardcodea
-- `difficulty_level: null` al crear un plan (src/hooks/useTrainingPlans.ts)
-- y ningún componente la muestra ni la setea. Único consumidor real:
-- api/ai-chat.js (tool buscar_plan_de_alumno) la leía para armar "nivel",
-- que por lo tanto siempre salía undefined — se limpió junto con la
-- columna. Mismo patrón que las columnas anteriores de esta sesión.
alter table public.training_plans drop column if exists difficulty_level;
