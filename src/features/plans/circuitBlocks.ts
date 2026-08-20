// Extraido de NewPlan.tsx para poder testearlo aparte, sin arrastrar todo
// el import del componente (react-router, hooks de datos, etc.) al test.
import type { PlanExercise } from "@/lib/types";

export type PlannerBlock =
  | { type: "single"; id: string; exercise: PlanExercise }
  | { type: "circuit"; id: string; circuitGroup: string; exercises: PlanExercise[] };

/**
 * Agrupa los ejercicios de un dia en bloques: ejercicios sueltos ("single")
 * y circuitos ("circuit" — varios ejercicios consecutivos con el mismo
 * circuit_group). Requiere que los ejercicios del mismo circuito esten
 * SEGUIDOS (por order); si dos tandas del mismo grupo estan separadas por
 * un ejercicio suelto u otro grupo en el medio, se tratan como DOS
 * circuitos distintos, no se mezclan.
 *
 * `circuit_group` null y "" (cadena vacia) se tratan igual: "sin circuito".
 */
export function getBlocksForActiveDay(dayExs: PlanExercise[]): PlannerBlock[] {
  const blocks: PlannerBlock[] = [];
  let currentCircuit: string | null = null;
  let currentCircuitExercises: PlanExercise[] = [];

  const sortedDayExs = [...dayExs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const ex of sortedDayExs) {
    if (ex.circuit_group) {
      if (ex.circuit_group === currentCircuit) {
        currentCircuitExercises.push(ex);
      } else {
        if (currentCircuit !== null && currentCircuitExercises.length > 0) {
          blocks.push({
            type: "circuit",
            id: `circuit-${currentCircuit}-${currentCircuitExercises[0].id}`,
            circuitGroup: currentCircuit,
            exercises: currentCircuitExercises,
          });
        }
        currentCircuit = ex.circuit_group;
        currentCircuitExercises = [ex];
      }
    } else {
      if (currentCircuit !== null && currentCircuitExercises.length > 0) {
        blocks.push({
          type: "circuit",
          id: `circuit-${currentCircuit}-${currentCircuitExercises[0].id}`,
          circuitGroup: currentCircuit,
          exercises: currentCircuitExercises,
        });
        currentCircuit = null;
        currentCircuitExercises = [];
      }
      blocks.push({
        type: "single",
        id: ex.id,
        exercise: ex,
      });
    }
  }

  if (currentCircuit !== null && currentCircuitExercises.length > 0) {
    blocks.push({
      type: "circuit",
      id: `circuit-${currentCircuit}-${currentCircuitExercises[0].id}`,
      circuitGroup: currentCircuit,
      exercises: currentCircuitExercises,
    });
  }

  return blocks;
}
