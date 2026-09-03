/**
 * Registro central de tools. `create-server.ts` llama a `registerAllTools`.
 *
 * La auth y la auditoria (US-7, D-3) NO viven aca — `create-server.ts`
 * envuelve `server.registerTool` (funcion `guardToolDispatch`) ANTES de
 * llamar a `registerAllTools`, asi que cada tool registrado abajo queda
 * protegido automaticamente. Ni este archivo ni `tools/list-plans.ts` (ni
 * los que se agreguen en Fase 5) necesitan saber que la auth existe.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { registerListPlans } from "./list-plans.js";

/** Monta todos los tools en el server. Hoy: 1 de 8 (list_plans). */
export function registerAllTools(server: McpServer): void {
  registerListPlans(server);
  // TODO(Fase 5): get_student_adherence, get_exercise_progression, get_expiring_plans,
  //               get_rpe_alerts, list_students, get_plan  (T12–T14)
}
