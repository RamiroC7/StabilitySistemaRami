/**
 * Tool `get_student_adherence` — US-2 (design.md §Interfaces).
 *
 * Formula PROPIA y correcta (ver `@stability/domain/adherence.computeAdherence`
 * y `specs/mcp-server/notes-adherence.md`) — NO replica el calculo bugueado
 * de la app. La respuesta siempre incluye los datos crudos (`assignments`,
 * `completions`) para que el coach pueda verificar el numero.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { computeAdherence, instantToLocalDateTimeStr, DEFAULT_TIME_ZONE } from "@stability/domain";
import { query } from "../db.js";
import { toolError } from "./errors.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const inputSchema = z.object({
  student_id: z.string().uuid().describe("uuid de profiles.id (debe ser role='student')."),
  from: z.string().regex(DATE_RE, "Formato esperado: YYYY-MM-DD").describe("Inicio del rango, inclusive."),
  to: z.string().regex(DATE_RE, "Formato esperado: YYYY-MM-DD").describe("Fin del rango, inclusive."),
});

interface StudentRow {
  id: string;
  role: "student" | "coach";
}

interface AssignmentRow {
  assignment_id: string;
  start_date: string;
  end_date: string;
  status: string;
  plan_title: string;
  days_per_week: number;
}

interface CompletionRow {
  day_number: number;
  completed_at: string;
  rpe: number | null;
}

const STUDENT_SQL = `
  select id, role
  from public.profiles
  where id = $1
`;

// Solo las asignaciones que solapan [from, to] (fechas puras, sin hora — el
// solape exacto en TZ lo recalcula computeAdherence). Se traen SIN filtrar
// status: computeAdherence excluye 'cancelled' pero la respuesta muestra
// todas las que solapan, para que el coach vea por que una no cuenta.
const ASSIGNMENTS_SQL = `
  select
    ta.id             as assignment_id,
    ta.start_date     as start_date,
    ta.end_date       as end_date,
    ta.status         as status,
    tp.title          as plan_title,
    tp.days_per_week  as days_per_week
  from public.training_plan_assignments ta
  join public.training_plans tp on tp.id = ta.plan_id
  where ta.student_id = $1
    and ta.start_date <= $3::date
    and ta.end_date   >= $2::date
  order by ta.start_date asc
`;

// Margen de +-1/+2 dias en UTC alrededor de [from, to]: Buenos Aires es
// UTC-3, asi que el dia calendario AR no coincide con el dia calendario UTC
// (ver adherence.ts). Se trae de mas a proposito; computeAdherence hace el
// filtro exacto en TZ despues.
const COMPLETIONS_SQL = `
  select day_number, completed_at, rpe
  from public.workout_completions
  where student_id = $1
    and completed_at >= ($2::date - interval '1 day')
    and completed_at <  ($3::date + interval '2 days')
  order by completed_at asc
`;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getStudentAdherenceHandler(args: {
  student_id: string;
  from: string;
  to: string;
}): Promise<CallToolResult> {
  const { student_id, from, to } = args;

  if (from > to) {
    return toolError(
      `El rango de fechas es invalido: "from" (${from}) es posterior a "to" (${to}).`,
    );
  }

  const students = await query<StudentRow>(STUDENT_SQL, [student_id]);
  const student = students[0];
  if (!student || student.role !== "student") {
    return toolError(`No hay ningun alumno con id ${student_id}.`);
  }

  const [assignmentRows, completionRows] = await Promise.all([
    query<AssignmentRow>(ASSIGNMENTS_SQL, [student_id, from, to]),
    query<CompletionRow>(COMPLETIONS_SQL, [student_id, from, to]),
  ]);

  const result = computeAdherence({
    from,
    to,
    assignments: assignmentRows.map((a) => ({
      id: a.assignment_id,
      startDate: a.start_date,
      endDate: a.end_date,
      status: a.status,
      daysPerWeek: a.days_per_week,
    })),
    completions: completionRows.map((c) => ({
      dayNumber: c.day_number,
      completedAt: c.completed_at,
    })),
  });

  const overlapWeeksById = new Map(result.perAssignment.map((p) => [p.id, p.overlapWeeks]));

  const responseBody = {
    student_id,
    from,
    to,
    has_assignment_in_range: result.hasAssignmentInRange,
    expected_workouts: round2(result.expectedWorkouts),
    completed_workouts: result.completedWorkouts,
    adherence_pct: result.adherencePct,
    assignments: assignmentRows.map((a) => ({
      assignment_id: a.assignment_id,
      plan_title: a.plan_title,
      start_date: a.start_date,
      end_date: a.end_date,
      status: a.status,
      days_per_week: a.days_per_week,
      overlap_weeks: round2(overlapWeeksById.get(a.assignment_id) ?? 0),
    })),
    completions: completionRows.map((c) => ({
      completed_at_local: instantToLocalDateTimeStr(c.completed_at, DEFAULT_TIME_ZONE),
      day_number: c.day_number,
      rpe: c.rpe,
    })),
    note:
      "Calculo propio del MCP (dias_por_semana x semanas de solape, TZ America/Argentina/Buenos_Aires); " +
      "no corresponde a ninguna pantalla de la app. Las completions registradas offline pueden tener " +
      "completed_at desfasado respecto del momento real del entrenamiento (ver notes-adherence.md §9).",
  };

  return {
    content: [{ type: "text", text: JSON.stringify(responseBody, null, 2) }],
    structuredContent: responseBody,
  };
}

export function registerGetStudentAdherence(server: McpServer): void {
  server.registerTool(
    "get_student_adherence",
    {
      title: "Adherencia de un alumno en un rango de fechas",
      description:
        "Calcula cuanto entreno un alumno en un rango de fechas: entrenamientos completados, " +
        "esperados, y el porcentaje de cumplimiento. Formula propia del MCP (no coincide con " +
        "ninguna pantalla de la app) — ver el campo 'note' de la respuesta.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    getStudentAdherenceHandler,
  );
}
