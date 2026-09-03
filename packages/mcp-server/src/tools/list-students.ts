/**
 * Tool `list_students` — US-1 (design.md §Interfaces).
 *
 * `profiles` (role = 'student') LEFT JOIN LATERAL sobre la asignacion activa
 * mas reciente + `training_plans` para el titulo. Filtra por
 * `profiles.is_archived` segun `status`.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { query } from "../db.js";

const inputSchema = z.object({
  status: z
    .enum(["active", "archived", "all"])
    .optional()
    .default("active")
    .describe("Filtra por profiles.is_archived. Default: 'active' (no archivados)."),
});

interface ListStudentsRow {
  student_id: string;
  first_name: string;
  last_name: string;
  is_archived: boolean;
  has_active_assignment: boolean;
  active_plan_title: string | null;
}

// $1 = status ('active' | 'archived' | 'all'). Sin filtro cuando es 'all';
// si no, compara is_archived contra (status === 'archived').
const SQL = `
  select
    p.id           as student_id,
    p.first_name   as first_name,
    p.last_name    as last_name,
    p.is_archived  as is_archived,
    (a.id is not null) as has_active_assignment,
    tp.title       as active_plan_title
  from public.profiles p
  left join lateral (
    select ta.id, ta.plan_id
    from public.training_plan_assignments ta
    where ta.student_id = p.id and ta.status = 'active'
    order by ta.start_date desc
    limit 1
  ) a on true
  left join public.training_plans tp on tp.id = a.plan_id
  where p.role = 'student'
    and ($1::text = 'all' or p.is_archived = ($1::text = 'archived'))
  order by p.first_name asc, p.last_name asc
`;

export async function listStudentsHandler(args: {
  status: "active" | "archived" | "all";
}): Promise<CallToolResult> {
  const rows = await query<ListStudentsRow>(SQL, [args.status]);
  return {
    content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
    structuredContent: { students: rows },
  };
}

export function registerListStudents(server: McpServer): void {
  server.registerTool(
    "list_students",
    {
      title: "Listar alumnos",
      description:
        "Lista los alumnos de la plataforma con su nombre, si estan archivados, y si tienen " +
        "una asignacion activa (y de que plan). Por defecto solo alumnos activos.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    listStudentsHandler,
  );
}
