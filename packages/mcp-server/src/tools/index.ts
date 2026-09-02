/**
 * Registro central de tools. `create-server.ts` llama a `registerAllTools`.
 *
 * ── Seam de auth (Fase 4 / T10) ────────────────────────────────────────────────
 * En Fase 4 el dispatch de cada tool se va a envolver para validar el token de
 * acceso ANTES de ejecutar la query y auditar DESPUÉS. Hay dos formas de hacerlo:
 *   a) envolver cada `async (args) => {...}` con un `withAuth(handler)` acá o en
 *      cada archivo de tool, o
 *   b) interceptar a nivel `McpServer` en `create-server.ts`.
 * La decisión y el punto exacto quedan para T10. Ver también:
 *   - create-server.ts  → `// TODO(Fase 4 / T10)`
 *   - stdio.ts          → `assertAuthFromEnv()` antes de `serveStdio`
 * ──────────────────────────────────────────────────────────────────────────────
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { registerListPlans } from "./list-plans.js";

/** Monta todos los tools en el server. Hoy: 1 de 8 (list_plans). */
export function registerAllTools(server: McpServer): void {
  registerListPlans(server);
  // TODO(Fase 5): get_student_adherence, get_exercise_progression, get_expiring_plans,
  //               get_rpe_alerts, list_students, get_plan  (T12–T14)
}
