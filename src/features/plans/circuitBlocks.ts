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

/**
 * Iguala las series de cada circuito. En el planificador las series de un
 * circuito se editan desde el encabezado (que muestra las del primer
 * ejercicio), pero cada fila guarda su propio valor: si un ejercicio se suma
 * al circuito con otras series, queda un valor oculto distinto y el alumno
 * termina con rondas desparejas.
 *
 * Toma las series del primer ejercicio del bloque (o la primera no vacía, si
 * esa está vacía) y se las pone a todos. Si se pasa `onlyExerciseId`, solo
 * toca el circuito que contiene a ese ejercicio. Devuelve el mismo objeto para
 * los ejercicios que no cambian.
 */
export function syncCircuitSeries(
  exercises: PlanExercise[],
  onlyExerciseId?: string,
): PlanExercise[] {
  const updates = new Map<string, PlanExercise["series"]>();
  const dayIds = new Set(exercises.map((ex) => ex.day_id));

  for (const dayId of dayIds) {
    const blocks = getBlocksForActiveDay(exercises.filter((ex) => ex.day_id === dayId));
    for (const block of blocks) {
      if (block.type !== "circuit") continue;
      if (onlyExerciseId && !block.exercises.some((ex) => ex.id === onlyExerciseId)) continue;
      const base = block.exercises.find((ex) => ex.series !== "" && ex.series != null)?.series;
      if (base === undefined) continue;
      for (const ex of block.exercises) {
        if (ex.series !== base) updates.set(ex.id, base);
      }
    }
  }

  if (updates.size === 0) return exercises;
  return exercises.map((ex) =>
    updates.has(ex.id) ? { ...ex, series: updates.get(ex.id)! } : ex,
  );
}
