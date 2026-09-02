/**
 * Tool `list_plans` — US-6 (design.md §Interfaces).
 *
 * Lista los planes de entrenamiento no archivados con conteos. Por defecto
 * excluye las plantillas (`is_template = true`); `include_templates: true` las suma.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { query } from "../db.js";

const inputSchema = z.object({
  include_templates: z
    .boolean()
    .optional()
    .default(false)
    .describe("Incluir plantillas (is_template = true). Default: false."),
});

interface ListPlansRow {
  plan_id: string;
  title: string;
  total_days: number;
  days_per_week: number;
  assigned_count: number;
  is_template: boolean;
}

// Query fija y parametrizada. El modelo NO puede inyectar SQL: el unico input es
// el booleano `include_templates`, que entra como parametro $1.
const SQL = `
  select
    p.id            as plan_id,
    p.title         as title,
    p.total_days    as total_days,
    p.days_per_week as days_per_week,
    coalesce(a.cnt, 0)::int as assigned_count,
    p.is_template   as is_template
  from public.training_plans p
  left join (
    select plan_id, count(*)::int as cnt
    from public.training_plan_assignments
    group by plan_id
  ) a on a.plan_id = p.id
  where p.is_archived = false
    and ($1::boolean or p.is_template = false)
  order by p.title asc
`;

export function registerListPlans(server: McpServer): void {
  server.registerTool(
    "list_plans",
    {
      title: "Listar planes de entrenamiento",
      description:
        "Lista los planes de entrenamiento no archivados con su cantidad de días, " +
        "días por semana y cuántas veces fueron asignados. Por defecto no incluye plantillas.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ include_templates }) => {
      const rows = await query<ListPlansRow>(SQL, [include_templates]);
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
        structuredContent: { plans: rows },
      };
    },
  );
}
