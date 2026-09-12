/**
 * Factory del server MCP remoto para coaches (US-9, design.md > Interfaces).
 *
 * A diferencia de `packages/mcp-server/src/create-server.ts` (transport stdio,
 * sin identidad por request), este server corre en Vercel y en T15 va a
 * resolver la identidad real del coach por request (Bearer token → middleware
 * de auth). Hasta entonces `identity` es un parametro obligatorio que quien
 * construya el server hoy pasa hardcodeado — ver el comentario en `types.ts`
 * sobre `CoachIdentity`.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import type { CoachIdentity } from "./types.js";
import { registerQueryGymData } from "./tools/query-gym-data.js";

export type { CoachIdentity } from "./types.js";

// packages/gym-owner-mcp/resources/brand-brief.md — hermano de src/ (dev, via
// tsx) y de build/ (prod, tras `tsc`), asi que la ruta relativa es la misma en
// los dos casos. Mismo patron que `load-env.ts` para ubicar el .env.
const BRAND_BRIEF_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "resources",
  "brand-brief.md",
);

const INSTRUCTIONS = `
Este es el server MCP de Stability, un gimnasio/sistema de entrenamiento: los
coaches lo usan para consultar en lenguaje natural datos de sus alumnos y
programas de entrenamiento.

Los datos disponibles cubren las 18 tablas de \`public\` (alumnos, planes de
entrenamiento, asignaciones, adherencia, RPE, progresión de cargas, etc.),
incluida \`student_profiles\` con datos personales de los alumnos — tratá esos
datos con cuidado en las respuestas (no los repitas de más ni los expongas
fuera de lo que el coach pidió).

Todas las consultas quedan auditadas (pregunta + SQL ejecutado) antes de
correrse contra la base.
`.trim();

/**
 * Construye el server MCP para UN coach.
 *
 * @param identity Identidad del coach que va a usar este server. Ver el
 *   comentario en `types.ts` (`CoachIdentity`): hoy es un placeholder de
 *   desarrollo hasta que T15 conecte el middleware de auth real.
 */
export function createServer(identity: CoachIdentity): McpServer {
  const server = new McpServer(
    { name: "gym-owner-mcp", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );

  registerResumenSemanalPrompt(server);
  registerBrandBriefResource(server);
  registerQueryGymData(server, identity);

  return server;
}

function registerResumenSemanalPrompt(server: McpServer): void {
  server.registerPrompt(
    "resumen_semanal",
    {
      title: "Resumen semanal del gimnasio",
      description:
        "Guía para armar un resumen semanal de Stability: asistencia, alumnos en " +
        "riesgo de baja y alertas de RPE, usando la tool query_gym_data.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Armá un resumen semanal del gimnasio para el coach. Usá la tool " +
              "`query_gym_data` (parafraseando en `question` cada pregunta que le hagas a " +
              "la base) para cubrir, como mínimo:\n" +
              "1. Asistencia de la semana (asignaciones activas y completions recientes).\n" +
              "2. Alumnos en riesgo de baja (poca o nula actividad reciente, planes por vencer).\n" +
              "3. Alertas de RPE (cargas/RPE fuera de rango que ameriten seguimiento del coach).\n" +
              "Presentá el resumen en lenguaje claro, agrupado por sección, sin exponer datos " +
              "personales de los alumnos más allá de lo necesario para que el coach actúe.",
          },
        },
      ],
    }),
  );
}

function registerBrandBriefResource(server: McpServer): void {
  server.registerResource(
    "brand-brief",
    "gym-owner-mcp://brand-brief",
    {
      title: "Brand Brief de Stability",
      description:
        "Tono, paleta y terminología de marca de Stability. Se actualiza a mano " +
        "(sin sincronización automática con Plane en esta iteración — US-9).",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const text = await readFile(BRAND_BRIEF_PATH, "utf8");
      return {
        contents: [{ uri: uri.toString(), mimeType: "text/markdown", text }],
      };
    },
  );
}
