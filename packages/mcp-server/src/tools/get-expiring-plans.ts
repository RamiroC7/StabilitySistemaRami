/**
 * Tool `get_expiring_plans` — US-4 (design.md §Interfaces).
 *
 * `days_until_expiry` / `is_overdue` se calculan con
 * `@stability/domain/expiration.getExpirationStatus` (misma logica que
 * `get_student_adherence` reutiliza de `timezone.ts`), no en SQL, para
 * mantener el calculo de "hoy" en una unica TZ fija.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getExpirationStatus } from "@stability/domain";
import { query } from "../db.js";

const inputSchema = z.object({
  within_days: z
    .number()
    .int()
    .min(1)
    .max(90)
    .optional()
    .default(7)
    .describe("Ventana en dias hacia adelante. Tambien incluye asignaciones ya vencidas. Default: 7."),
});

interface ExpiringAssignmentRow {
  assignment_id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  plan_title: string;
  end_date: string;
}

// $1 = within_days. Incluye vencidas: no hay cota inferior, solo
// `end_date <= hoy + within_days`.
const SQL = `
  select
    ta.id       as assignment_id,
    ta.student_id,
    p.first_name,
    p.last_name,
    tp.title    as plan_title,
    ta.end_date
  from public.training_plan_assignments ta
  join public.profiles p on p.id = ta.student_id
  join public.training_plans tp on tp.id = ta.plan_id
  where ta.status = 'active'
    and ta.end_date <= (current_date + $1::int)
  order by ta.end_date asc
`;

export async function getExpiringPlansHandler(args: { within_days: number }): Promise<CallToolResult> {
  const rows = await query<ExpiringAssignmentRow>(SQL, [args.within_days]);

  const plans = rows.map((r) => {
    const { daysUntilExpiry, isOverdue } = getExpirationStatus(r.end_date);
    return {
      assignment_id: r.assignment_id,
      student_id: r.student_id,
      student_name: `${r.first_name} ${r.last_name}`,
      plan_title: r.plan_title,
      end_date: r.end_date,
      days_until_expiry: daysUntilExpiry,
      is_overdue: isOverdue,
    };
  });

  return {
    content: [{ type: "text", text: JSON.stringify(plans, null, 2) }],
    structuredContent: { plans },
  };
}

export function registerGetExpiringPlans(server: McpServer): void {
  server.registerTool(
    "get_expiring_plans",
    {
      title: "Planes por vencer",
      description:
        "Lista las asignaciones activas cuyo plan vence dentro de la ventana pedida (en dias), " +
        "incluyendo las que ya vencieron. Ordenado por fecha de vencimiento ascendente.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    getExpiringPlansHandler,
  );
}
