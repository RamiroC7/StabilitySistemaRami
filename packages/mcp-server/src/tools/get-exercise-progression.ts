/**
 * Tool `get_exercise_progression` — US-3 (design.md §Interfaces).
 *
 * Matching aproximado de nombre de ejercicio via `unaccent(lower(...)) LIKE
 * unaccent(lower('%'||$2||'%'))` — la migracion (`20260902000000_mcp_server_setup.sql`)
 * habilita la extension `unaccent` en el schema `extensions` y la agrega al
 * `search_path` de `mcp_readonly`, asi que se puede llamar sin calificar.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { query } from "../db.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const inputSchema = z.object({
  student_id: z.string().uuid().describe("uuid de profiles.id."),
  exercise: z
    .string()
    .min(1)
    .describe("Nombre (o parte del nombre) del ejercicio. Match aproximado, sin distinguir mayusculas ni acentos."),
  from: z.string().regex(DATE_RE, "Formato esperado: YYYY-MM-DD").optional(),
  to: z.string().regex(DATE_RE, "Formato esperado: YYYY-MM-DD").optional(),
});

interface ExerciseLogRow {
  exercise_name: string;
  plan_day_name: string;
  series: number;
  sets_detail: Array<{
    set_number: number;
    target_reps: string;
    actual_reps: string | null;
    kg: number | null;
  }>;
  logged_at: string;
}

// $1 = student_id, $2 = fragmento de busqueda, $3/$4 = from/to (o null = sin limite).
const SQL = `
  select exercise_name, plan_day_name, series, sets_detail, logged_at
  from public.exercise_weight_logs
  where student_id = $1
    and unaccent(lower(exercise_name)) like unaccent(lower('%' || $2 || '%'))
    and ($3::date is null or logged_at >= $3::date)
    and ($4::date is null or logged_at < ($4::date + interval '1 day'))
  order by logged_at asc
`;

export async function getExerciseProgressionHandler(args: {
  student_id: string;
  exercise: string;
  from?: string;
  to?: string;
}): Promise<CallToolResult> {
  const { student_id, exercise, from, to } = args;

  const rows = await query<ExerciseLogRow>(SQL, [student_id, exercise, from ?? null, to ?? null]);

  const matchedExerciseNames = [...new Set(rows.map((r) => r.exercise_name))];

  const responseBody = {
    student_id,
    exercise_query: exercise,
    matched_exercise_names: matchedExerciseNames,
    sets: rows.map((r) => ({
      logged_at: r.logged_at,
      plan_day_name: r.plan_day_name,
      series: r.series,
      sets_detail: r.sets_detail,
    })),
    message: rows.length === 0 ? `Sin registros de carga para "${exercise}" en el rango pedido.` : null,
  };

  return {
    content: [{ type: "text", text: JSON.stringify(responseBody, null, 2) }],
    structuredContent: responseBody,
  };
}

export function registerGetExerciseProgression(server: McpServer): void {
  server.registerTool(
    "get_exercise_progression",
    {
      title: "Progresion de cargas de un ejercicio",
      description:
        "Muestra la evolucion cronologica de un alumno en un ejercicio (series, reps y kg " +
        "registrados). El nombre del ejercicio hace match aproximado (sin exigir mayusculas ni " +
        "acentos exactos). Si no hay registros devuelve una lista vacia, no un error.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    getExerciseProgressionHandler,
  );
}
