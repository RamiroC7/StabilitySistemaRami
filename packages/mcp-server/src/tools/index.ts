/**
 * Registro central de tools. `create-server.ts` llama a `registerAllTools`.
 *
 * La auth y la auditoria (US-7, D-3) NO viven aca — `create-server.ts`
 * envuelve `server.registerTool` (funcion `guardToolDispatch`) ANTES de
 * llamar a `registerAllTools`, asi que cada tool registrado abajo queda
 * protegido automaticamente. Ningun archivo de `tools/` necesita saber que
 * la auth existe.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { registerListPlans } from "./list-plans.js";
import { registerListStudents } from "./list-students.js";
import { registerGetStudentAdherence } from "./get-student-adherence.js";
import { registerGetExerciseProgression } from "./get-exercise-progression.js";
import { registerGetExpiringPlans } from "./get-expiring-plans.js";
import { registerGetRpeAlerts } from "./get-rpe-alerts.js";
import { registerGetPlan } from "./get-plan.js";

/** Monta los 7 tools en el server (Fase 5, T12-T14 — completo). */
export function registerAllTools(server: McpServer): void {
  registerListStudents(server);
  registerGetStudentAdherence(server);
  registerGetExerciseProgression(server);
  registerGetExpiringPlans(server);
  registerGetRpeAlerts(server);
  registerListPlans(server);
  registerGetPlan(server);
}
