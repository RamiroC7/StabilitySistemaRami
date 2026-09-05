/**
 * Tool `get_plan` — US-6 (design.md §Interfaces).
 *
 * Detalle completo de un plan: dias y, por cada dia, sus ejercicios en el
 * orden definido (`display_order`).
 */
import type { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { query } from "../db.js";
import { toolError } from "./errors.js";

const inputSchema = z.object({
  plan_id: z.string().uuid().describe("uuid de training_plans.id."),
});

interface PlanRow {
  id: string;
  title: string;
  description: string | null;
}

interface DayRow {
  id: string;
  day_number: number;
  day_name: string;
  display_order: number;
}

interface ExerciseRow {
  day_id: string;
  stage_name: string | null;
  exercise_name: string;
  series: number;
  reps: string;
  carga: string;
  pause: string;
  notes: string | null;
  display_order: number;
}

const PLAN_SQL = `
  select id, title, description
  from public.training_plans
  where id = $1
`;

const DAYS_SQL = `
  select id, day_number, day_name, display_order
  from public.training_plan_days
  where plan_id = $1
  order by display_order asc
`;

const EXERCISES_SQL = `
  select day_id, stage_name, exercise_name, series, reps, carga, pause, notes, display_order
  from public.training_plan_exercises
  where day_id = any($1::uuid[])
  order by display_order asc
`;

export async function getPlanHandler(args: { plan_id: string }): Promise<CallToolResult> {
  const { plan_id } = args;

  const plans = await query<PlanRow>(PLAN_SQL, [plan_id]);
  const plan = plans[0];
  if (!plan) {
    return toolError(`No hay ningun plan con id ${plan_id}.`);
  }

  const days = await query<DayRow>(DAYS_SQL, [plan_id]);
  const dayIds = days.map((d) => d.id);
  const exercises = dayIds.length > 0 ? await query<ExerciseRow>(EXERCISES_SQL, [dayIds]) : [];

  const exercisesByDay = new Map<string, ExerciseRow[]>();
  for (const ex of exercises) {
    const list = exercisesByDay.get(ex.day_id);
    if (list) {
      list.push(ex);
    } else {
      exercisesByDay.set(ex.day_id, [ex]);
    }
  }

  const responseBody = {
    plan_id: plan.id,
    title: plan.title,
    description: plan.description,
    days: days.map((d) => ({
      day_number: d.day_number,
      day_name: d.day_name,
      exercises: (exercisesByDay.get(d.id) ?? []).map((ex) => ({
        order: ex.display_order,
        stage_name: ex.stage_name,
        exercise_name: ex.exercise_name,
        series: ex.series,
        reps: ex.reps,
        carga: ex.carga,
        pause: ex.pause,
        notes: ex.notes,
      })),
    })),
  };

  return {
    content: [{ type: "text", text: JSON.stringify(responseBody, null, 2) }],
    structuredContent: responseBody,
  };
}

export function registerGetPlan(server: McpServer): void {
  server.registerTool(
    "get_plan",
    {
      title: "Detalle de un plan de entrenamiento",
      description:
        "Devuelve el contenido completo de un plan: sus dias y, por cada dia, los ejercicios " +
        "con etapa, series, repeticiones, carga y pausa, en el orden definido.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    getPlanHandler,
  );
}
