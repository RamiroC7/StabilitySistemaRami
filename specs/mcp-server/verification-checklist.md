# Checklist de verificación manual end-to-end — MCP Server (STAB-33)

**Para usar cuando:** el server esté configurado en Claude Desktop (T15), contra la base de
producción real, con un token de un coach válido.

**Qué es esto:** los tests unitarios (`npx vitest run`) verifican cada tool con datos
mockeados — confirman que la lógica interna es correcta, no que las queries reales devuelven
lo que el coach espera ver. Esta checklist es la verificación que sí necesita la base real:
una pregunta en lenguaje natural por user story, con qué se espera ver y cómo confirmarlo a
ojo contra la app o el SQL editor de Supabase. **No es automatizable** (depende de datos reales
y de leer la respuesta de Claude), así que queda como documento para correr a mano — no hay
forma de que Claude (yo) la ejecute sin acceso a la máquina donde corre Claude Desktop.

Marcar cada fila a medida que se prueba. Si algo no coincide con lo esperado, anotar qué pasó
en la columna de la derecha antes de seguir — no just marcarlo como "andaba distinto" y seguir.

## Antes de empezar

- [ ] `stability-db` aparece conectado en Claude Desktop (ícono de MCP, sin "failed").
- [ ] `%APPDATA%\Claude\logs\mcp-server-stability-db.log` (o el log que corresponda) existe y
      no tiene ruido raro en el arranque.
- [ ] Preguntar "`¿qué tools tenés disponibles del servidor stability-db?`" y confirmar que
      Claude lista los 7: `list_students`, `get_student_adherence`,
      `get_exercise_progression`, `get_expiring_plans`, `get_rpe_alerts`, `list_plans`,
      `get_plan`.

## US-1 — Listado de alumnos

| Prompt de ejemplo | Se espera | OK? | Notas |
|---|---|---|---|
| "Dame la lista de mis alumnos activos" | Nombre, si está archivado, si tiene asignación activa (y de qué plan) — solo `is_archived = false` | ☐ | |
| "¿Y los archivados?" | Misma forma, solo archivados | ☐ | |
| "Dame todos, activos y archivados" | Union de los dos anteriores | ☐ | |
| Comparar el conteo contra `StudentsList` de la app (o `select count(*) from profiles where role='student' and is_archived=false`) | El número coincide | ☐ | |

## US-2 — Adherencia de un alumno

| Prompt de ejemplo | Se espera | OK? | Notas |
|---|---|---|---|
| "¿Cómo viene [alumno] de adherencia en las últimas 4 semanas?" | `expected_workouts`, `completed_workouts`, `adherence_pct`, y las `assignments`/`completions` crudas que lo sustentan | ☐ | |
| Verificar a mano: contar los `workout_completions` reales del alumno en ese rango (SQL editor) y comparar con `completed_workouts` | Coincide | ☐ | |
| Probar con un alumno **sin ninguna asignación** en el rango pedido | `adherence_pct: null` (no `0`), con nota explicando por qué | ☐ | |
| Probar con un `student_id` que no existe (pedirle a Claude "probá con el id 00000000-0000-0000-0000-000000000000") | Error legible, menciona el id, no un stacktrace de Postgres | ☐ | |
| Probar `from` posterior a `to` | Error de validación claro | ☐ | |
| Leer el campo `note` de la respuesta | Aclara que es un cálculo propio del MCP, no de ninguna pantalla de la app | ☐ | |

## US-3 — Progresión de cargas

| Prompt de ejemplo | Se espera | OK? | Notas |
|---|---|---|---|
| "¿Cómo progresó [alumno] en sentadilla?" | Serie cronológica con fecha, reps objetivo/reales y kg | ☐ | |
| Repetir el mismo pedido con el nombre **mal escrito o sin tildes** (ej. "sentadilla" vs "Sentadilla libre", o "press banca" sin acento si el original lo tiene) | Igual encuentra los registros (match aproximado con `unaccent`) | ☐ | |
| Pedir la progresión de un ejercicio que el alumno nunca hizo | Lista vacía + mensaje, **no** un error | ☐ | |

## US-4 — Planes por vencer

| Prompt de ejemplo | Se espera | OK? | Notas |
|---|---|---|---|
| "¿A quién se le vence el plan esta semana?" | Asignaciones activas con `end_date` dentro de los próximos 7 días, ordenadas por fecha ascendente | ☐ | |
| "¿Y en los próximos 30 días?" | `within_days: 30`, más resultados que el anterior (superset) | ☐ | |
| Verificar que aparece alguna asignación **ya vencida** (si hay datos para eso) | Aparece con `is_overdue: true`, no queda afuera | ☐ | |

## US-5 — Alertas de RPE

| Prompt de ejemplo | Se espera | OK? | Notas |
|---|---|---|---|
| "¿Algún alumno viene con RPE alto o bajo últimamente?" | Solo alumnos en alerta (3 RPE seguidos ≥8 o ≤3), con los valores que la dispararon | ☐ | |
| Comparar contra lo que muestra `StudentsList`/el indicador de RPE de la app para esos mismos alumnos hoy | Coincide (misma regla, `detectRpeAlert`) | ☐ | |

## US-6 — Planes

| Prompt de ejemplo | Se espera | OK? | Notas |
|---|---|---|---|
| "Dame la lista de planes" | Título, cantidad de días, días/semana, cuántos alumnos asignados — sin plantillas | ☐ | |
| "¿Y con las plantillas?" | Suma las plantillas (`include_templates: true`) | ☐ | |
| "Mostrame el contenido del plan [título]" | Días con sus ejercicios en orden, con etapa/series/reps/carga/pausa | ☐ | |
| Pedir el detalle de un plan con un id inventado | Error legible ("no existe"), no vacío silencioso | ☐ | |

## US-7 — Autenticación

| Prueba | Se espera | OK? | Notas |
|---|---|---|---|
| Sacar/invalidar `MCP_ACCESS_TOKEN` en la config y reiniciar Claude Desktop | El server queda "failed" al arrancar, no arranca sin auth | ☐ | |
| Revocar el token actual en la base (`UPDATE mcp.access_tokens SET revoked_at = now() ...`) y volver a preguntar algo sin reiniciar | La siguiente tool call falla con "No autorizado" (cada llamada re-valida, no solo al arrancar) | ☐ | |
| Restaurar el token (nuevo `revoked_at = null` o token nuevo) | Vuelve a andar | ☐ | |

## US-8 — Solo lectura

| Prueba | Se espera | OK? | Notas |
|---|---|---|---|
| Pedirle a Claude algo que implique escribir (ej. "marcá como completado el entrenamiento de hoy de [alumno]") | Claude no tiene ninguna tool de escritura para hacerlo — explica que no puede, no inventa una | ☐ | |
| (Opcional, en el SQL editor con el rol `mcp_readonly`) intentar un `UPDATE`/`INSERT` cualquiera | Falla a nivel de base (`permission denied` / read-only transaction), no solo por falta de tool | ☐ | |

## Después de probar todo

- [ ] Revisar el archivo de log: cada tool call de esta sesión aparece como una línea JSON
      (`ts, profile_id, coach_name, tool, args, duration_ms, row_count`), sin ruido de
      `console.log` mezclado.
- [ ] Anotar en este documento (o en un doc aparte) cualquier discrepancia encontrada, con el
      prompt exacto usado y la respuesta recibida, para poder reproducirla.
