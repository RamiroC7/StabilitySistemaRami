/**
 * Helper compartido para errores de dominio de los tools ("el alumno no
 * existe", "el rango de fechas es invalido", etc). design.md > Interfaces:
 * "Los errores de dominio... se devuelven como isError: true con un texto
 * que nombra el problema y sugiere el arreglo — nunca se filtra el mensaje
 * crudo de Postgres." (Los errores de conexion/SQL ya vienen sanitizados
 * desde `db.ts`, pero igual nunca se los expone tal cual desde un tool: cada
 * tool los deja propagar como excepcion, no como isError, para no
 * confundirlos con un error de validacion de negocio.)
 */
import type { CallToolResult } from "@modelcontextprotocol/server";

export function toolError(text: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text }],
  };
}
