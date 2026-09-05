/**
 * Tool `get_rpe_alerts` — US-5 (design.md §Interfaces).
 *
 * Misma regla que la app: `@stability/domain/rpe.detectRpeAlert` (copia exacta
 * de `src/lib/rpeHelpers.ts`, verificada por `diff` en CI). Se toman los
 * ultimos 3 `workout_completions` de cada alumno (por `completed_at` DESC) y
 * se evaluan; solo se devuelven los alumnos en alerta.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { detectRpeAlert } from "@stability/domain";
import { query } from "../db.js";

const inputSchema = z.object({});

interface RecentCompletionRow {
  student_id: string;
  first_name: string;
  last_name: string;
  rpe: number | null;
  completed_at: string;
}

// Los ultimos 3 completions de cada alumno (con role='student'), por completed_at DESC.
const SQL = `
  with ranked as (
    select
      student_id,
      rpe,
      completed_at,
      row_number() over (partition by student_id order by completed_at desc) as rn
    from public.workout_completions
  )
  select p.id as student_id, p.first_name, p.last_name, r.rpe, r.completed_at
  from ranked r
  join public.profiles p on p.id = r.student_id and p.role = 'student'
  where r.rn <= 3
  order by p.id asc, r.completed_at desc
`;

export async function getRpeAlertsHandler(): Promise<CallToolResult> {
  const rows = await query<RecentCompletionRow>(SQL, []);

  const byStudent = new Map<string, { name: string; rpes: (number | null)[] }>();
  for (const row of rows) {
    const entry = byStudent.get(row.student_id);
    if (entry) {
      entry.rpes.push(row.rpe);
    } else {
      byStudent.set(row.student_id, { name: `${row.first_name} ${row.last_name}`, rpes: [row.rpe] });
    }
  }

  const alerts: Array<{ student_id: string; student_name: string; recent_rpe: number[]; alert: true }> = [];
  for (const [studentId, { name, rpes }] of byStudent) {
    const alert = detectRpeAlert(rpes);
    if (alert !== null) {
      alerts.push({
        student_id: studentId,
        student_name: name,
        recent_rpe: rpes.filter((r): r is number => r !== null),
        alert: true,
      });
    }
  }

  const responseBody = { alerts };

  return {
    content: [{ type: "text", text: JSON.stringify(responseBody, null, 2) }],
    structuredContent: responseBody,
  };
}

export function registerGetRpeAlerts(server: McpServer): void {
  server.registerTool(
    "get_rpe_alerts",
    {
      title: "Alertas de RPE",
      description:
        "Evalua los ultimos entrenamientos de cada alumno con la misma regla que usa la app " +
        "(3 RPE seguidos muy altos o muy bajos) y devuelve solo los alumnos en alerta, con los " +
        "valores que la dispararon.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    getRpeAlertsHandler,
  );
}
