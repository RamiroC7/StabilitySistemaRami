import type { NavigateFunction } from "react-router-dom";
import { toast } from "sonner";
import type { Exercise, SeriesLog } from "@/features/training/types";

// ─── Key helpers ──────────────────────────────────────────────────────────────

/** Builds the seriesLog key for a given exercise + set index. */
export function buildSeriesKey(exerciseId: string | number, setIndex: number): string {
  return `${exerciseId}-${setIndex}`;
}

// ─── Carga formatting ─────────────────────────────────────────────────────────

/**
 * Normalises a raw `carga` string from the DB into a display string.
 * If carga is absent, "-", or empty, returns "—".
 * If it already contains "kg" (case-insensitive), returns it as-is.
 * Otherwise appends " kg".
 */
export function formatCarga(carga: string | undefined | null): string {
  if (!carga || carga === "-") return "—";
  return carga.toLowerCase().includes("kg") ? carga : `${carga} kg`;
}

// ─── Circuit bounds ───────────────────────────────────────────────────────────

export interface CircuitBounds {
  circuitStartIndex: number;
  circuitEndIndex: number;
  circuitExercises: Exercise[];
}

/**
 * Given the full exercise list and the current paramIndex, walks backwards and
 * forwards to find the contiguous slice that belongs to the same circuit_group.
 *
 * Returns null if the exercise at paramIndex has no circuit_group.
 */
export function getCircuitBounds(
  exercises: Exercise[],
  paramIndex: number
): CircuitBounds | null {
  const exercise = exercises[paramIndex];
  if (!exercise?.circuit_group) return null;

  const group = exercise.circuit_group;

  let start = paramIndex;
  while (start > 0 && exercises[start - 1]?.circuit_group === group) {
    start--;
  }

  let end = paramIndex;
  while (end < exercises.length - 1 && exercises[end + 1]?.circuit_group === group) {
    end++;
  }

  const circuitExercises = exercises.slice(start, end + 1);

  return {
    circuitStartIndex: start,
    circuitEndIndex: end,
    circuitExercises,
  };
}

// ─── Circuit set equalization ─────────────────────────────────────────────────

/**
 * En un circuito todos los ejercicios se hacen la misma cantidad de rondas,
 * pero en el plan pueden quedar con series distintas (ej. un ejercicio sumado
 * al circuito después de fijar las series). Si un ejercicio tiene menos series
 * que el resto, la ronda extra queda trabada mostrando la serie anterior.
 *
 * Completa los ejercicios de cada circuito (bloque contiguo con el mismo
 * circuit_group) hasta la mayor cantidad de series del bloque. Los ejercicios
 * fuera de circuito no se tocan.
 */
export function equalizeCircuitSets(exercises: Exercise[]): Exercise[] {
  const result = [...exercises];
  let start = 0;
  while (start < result.length) {
    const group = result[start].circuit_group;
    let end = start;
    while (group && end + 1 < result.length && result[end + 1].circuit_group === group) {
      end++;
    }
    if (group && end > start) {
      const maxSets = Math.max(...result.slice(start, end + 1).map((ex) => ex.sets.length));
      for (let i = start; i <= end; i++) {
        const ex = result[i];
        if (ex.sets.length < maxSets && ex.sets.length > 0) {
          const template = ex.sets[ex.sets.length - 1];
          const extra = Array.from({ length: maxSets - ex.sets.length }, (_, k) => ({
            ...template,
            setNumber: ex.sets.length + k + 1,
          }));
          result[i] = { ...ex, sets: [...ex.sets, ...extra] };
        }
      }
    }
    start = end + 1;
  }
  return result;
}

// ─── Circuit round state ──────────────────────────────────────────────────────

export interface CircuitRoundState {
  totalRounds: number;
  activeRoundIndex: number;
  activeRound: number;
}

/**
 * Derives the current round state for a circuit.
 *
 * - totalRounds: number of sets on the first circuit exercise.
 * - activeRoundIndex: first set index that hasn't been marked done yet on `exercise`.
 *   If all are done, stays at totalRounds - 1.
 * - activeRound: 1-based display value.
 */
export function getCircuitRoundState(
  circuitExercises: Exercise[],
  exercise: Exercise,
  seriesLog: SeriesLog
): CircuitRoundState {
  const totalRounds = circuitExercises[0]?.sets.length ?? 0;

  let activeRoundIndex = exercise.sets.findIndex(
    (_, sIdx) => !seriesLog[buildSeriesKey(exercise.id, sIdx)]?.done
  );
  if (activeRoundIndex === -1) {
    activeRoundIndex = totalRounds - 1;
  }

  return {
    totalRounds,
    activeRoundIndex,
    activeRound: activeRoundIndex + 1,
  };
}

// ─── isBetweenExercises ───────────────────────────────────────────────────────

/**
 * Returns true when, in the current round, at least one exercise in the circuit
 * is already marked done — meaning we're mid-circuit and about to move to the
 * next exercise (rest between exercises, not between rounds).
 */
export function isBetweenExercisesInCircuit(
  circuitExercises: Exercise[],
  activeRoundIndex: number,
  seriesLog: SeriesLog
): boolean {
  return circuitExercises.some(
    (cEx) => seriesLog[buildSeriesKey(cEx.id, activeRoundIndex)]?.done
  );
}

// ─── Inline handler builder (used by the ExerciseDetail orchestrator) ──────────

/**
 * Returns the `handleCompleteCircuitSet` callback.
 * Lives here (not in ExerciseDetailCircuit.tsx) so that component file only
 * exports a component — react-refresh/only-export-components.
 */
export function buildCompleteCircuitSetHandler({
  exerciseId,
  exerciseRestSeconds,
  activeRoundIndex,
  totalRounds,
  paramIndex,
  circuitEndIndex,
  circuitStartIndex,
  dayId,
  markSetDone,
  startRestTimer,
  stopRestTimer,
  navigate,
}: {
  exerciseId: string | number;
  exerciseRestSeconds: number;
  activeRoundIndex: number;
  totalRounds: number;
  paramIndex: number;
  circuitEndIndex: number;
  circuitStartIndex: number;
  dayId: string | undefined;
  markSetDone: (key: string) => void;
  startRestTimer: (seconds: number, setIndex: number, exerciseId?: string) => void;
  stopRestTimer: () => void;
  navigate: NavigateFunction;
}) {
  return () => {
    const key = buildSeriesKey(exerciseId, activeRoundIndex);
    markSetDone(key);

    const isLastExerciseInCircuit = paramIndex === circuitEndIndex;

    if (exerciseRestSeconds > 0) {
      startRestTimer(exerciseRestSeconds, activeRoundIndex, String(exerciseId));
    } else {
      stopRestTimer();
    }

    if (!isLastExerciseInCircuit) {
      navigate(`/entrenamiento/dia/${dayId}/ejercicio/${paramIndex + 2}`, {
        replace: true,
      });
    } else {
      if (activeRoundIndex + 1 < totalRounds) {
        navigate(`/entrenamiento/dia/${dayId}/ejercicio/${circuitStartIndex + 1}`, {
          replace: true,
        });
      } else {
        toast.success("¡Circuito completado!");
      }
    }
  };
}
