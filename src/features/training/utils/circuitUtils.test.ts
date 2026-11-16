import { describe, expect, it } from "vitest";
import type { Exercise, SeriesLog } from "@/features/training/types";
import {
  buildSeriesKey,
  equalizeCircuitSets,
  getCircuitBounds,
  getCircuitRoundState,
} from "./circuitUtils";

function ex(id: string, series: number, circuit_group: string | null = null): Exercise {
  return {
    id,
    name: id,
    category: "",
    restSeconds: 0,
    circuit_group,
    sets: Array.from({ length: series }, (_, i) => ({
      setNumber: i + 1,
      targetReps: "10",
      targetWeight: 0,
    })),
  };
}

/** Marca como hechas las primeras `rounds` series de cada ejercicio, con kg distintos por ronda. */
function doneRounds(exercises: Exercise[], rounds: number): SeriesLog {
  const log: SeriesLog = {};
  for (const e of exercises) {
    for (let r = 0; r < rounds; r++) {
      log[buildSeriesKey(e.id, r)] = { kg: String(10 * (r + 1)), reps: "10", done: true };
    }
  }
  return log;
}

describe("equalizeCircuitSets", () => {
  it("completa las series de un circuito hasta la mayor del bloque", () => {
    const result = equalizeCircuitSets([ex("a", 2, "A"), ex("b", 3, "A"), ex("c", 3, "A")]);
    expect(result.map((e) => e.sets.length)).toEqual([3, 3, 3]);
    expect(result[0].sets.map((s) => s.setNumber)).toEqual([1, 2, 3]);
    expect(result[0].sets[2].targetReps).toBe("10");
  });

  it("no toca ejercicios fuera de circuito ni circuitos ya parejos", () => {
    const input = [ex("x", 2), ex("a", 3, "A"), ex("b", 3, "A"), ex("y", 4)];
    const result = equalizeCircuitSets(input);
    expect(result.map((e) => e.sets.length)).toEqual([2, 3, 3, 4]);
    expect(result[1]).toBe(input[1]);
  });

  it("trata cada circuito por separado", () => {
    const result = equalizeCircuitSets([
      ex("a1", 2, "A"),
      ex("a2", 4, "A"),
      ex("b1", 3, "B"),
      ex("b2", 1, "B"),
    ]);
    expect(result.map((e) => e.sets.length)).toEqual([4, 4, 3, 3]);
  });

  it("no modifica el array original", () => {
    const input = [ex("a", 2, "A"), ex("b", 3, "A")];
    equalizeCircuitSets(input);
    expect(input[0].sets.length).toBe(2);
  });
});

describe("bug 3ª serie en circuito (series 2, 3, 3)", () => {
  const plan = [ex("a", 2, "A"), ex("b", 3, "A"), ex("c", 3, "A")];

  it("sin emparejar: la 3ª ronda del primer ejercicio repite la 2ª", () => {
    const bounds = getCircuitBounds(plan, 0)!;
    const state = getCircuitRoundState(bounds.circuitExercises, plan[0], doneRounds(plan, 2));
    // Reproduce el reporte: queda en la ronda 2 (índice 1) con los datos ya cargados.
    expect(state.activeRoundIndex).toBe(1);
    expect(state.totalRounds).toBe(2);
  });

  it("emparejado: el primer ejercicio pasa a la 3ª ronda vacía", () => {
    const fixed = equalizeCircuitSets(plan);
    const bounds = getCircuitBounds(fixed, 0)!;
    const log = doneRounds(fixed, 2);
    const state = getCircuitRoundState(bounds.circuitExercises, fixed[0], log);
    expect(state.totalRounds).toBe(3);
    expect(state.activeRoundIndex).toBe(2);
    expect(log[buildSeriesKey("a", state.activeRoundIndex)]).toBeUndefined();
  });
});
