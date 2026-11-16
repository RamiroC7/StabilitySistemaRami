import { describe, it, expect } from "vitest";
import { getBlocksForActiveDay, syncCircuitSeries } from "./circuitBlocks";
import type { PlanExercise } from "@/lib/types";

function exercise(overrides: {
  id: string;
  order: number;
  circuit_group?: string | null;
}): PlanExercise {
  return {
    id: overrides.id,
    day_id: "day-1",
    stage_id: "stage-1",
    exercise_name: `Ejercicio ${overrides.id}`,
    series: 3,
    reps: "10",
    carga: "",
    pause: "60",
    notes: "",
    order: overrides.order,
    circuit_group: overrides.circuit_group ?? null,
  };
}

describe("getBlocksForActiveDay", () => {
  it("agrupa ejercicios consecutivos del mismo circuito en un solo bloque", () => {
    const days = [
      exercise({ id: "e1", order: 1, circuit_group: "A" }),
      exercise({ id: "e2", order: 2, circuit_group: "A" }),
      exercise({ id: "e3", order: 3, circuit_group: "A" }),
    ];

    const blocks = getBlocksForActiveDay(days);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("circuit");
    if (blocks[0].type === "circuit") {
      expect(blocks[0].circuitGroup).toBe("A");
      expect(blocks[0].exercises.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
    }
  });

  it("dos grupos 'A' separados por un ejercicio suelto NO se mezclan: quedan como dos circuitos distintos", () => {
    const days = [
      exercise({ id: "e1", order: 1, circuit_group: "A" }),
      exercise({ id: "e2", order: 2, circuit_group: "A" }),
      exercise({ id: "e3", order: 3, circuit_group: null }), // suelto, en el medio
      exercise({ id: "e4", order: 4, circuit_group: "A" }),
      exercise({ id: "e5", order: 5, circuit_group: "A" }),
    ];

    const blocks = getBlocksForActiveDay(days);

    expect(blocks.map((b) => b.type)).toEqual(["circuit", "single", "circuit"]);

    const [firstCircuit, single, secondCircuit] = blocks;
    if (firstCircuit.type === "circuit" && secondCircuit.type === "circuit") {
      // Mismo nombre de grupo ("A"), pero son bloques (instancias) distintas
      expect(firstCircuit.circuitGroup).toBe("A");
      expect(secondCircuit.circuitGroup).toBe("A");
      expect(firstCircuit.exercises.map((e) => e.id)).toEqual(["e1", "e2"]);
      expect(secondCircuit.exercises.map((e) => e.id)).toEqual(["e4", "e5"]);
      expect(firstCircuit.id).not.toBe(secondCircuit.id);
    }
    if (single.type === "single") {
      expect(single.exercise.id).toBe("e3");
    }
  });

  it("circuit_group NULL y cadena vacia se tratan igual: ambos son 'sin circuito'", () => {
    const days = [
      exercise({ id: "e1", order: 1, circuit_group: null }),
      exercise({ id: "e2", order: 2, circuit_group: "" }),
    ];

    const blocks = getBlocksForActiveDay(days);

    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.type === "single")).toBe(true);
  });
});

describe("syncCircuitSeries", () => {
  const ex = (id: string, order: number, series: number | string, circuit_group: string | null, day_id = "day-1") => ({
    ...exercise({ id, order, circuit_group }),
    series,
    day_id,
  });

  it("iguala las series del circuito a las del primer ejercicio (lo que muestra el encabezado)", () => {
    const result = syncCircuitSeries([ex("a", 1, 2, "A"), ex("b", 2, 3, "A"), ex("c", 3, 3, "A")]);
    expect(result.map((e) => e.series)).toEqual([2, 2, 2]);
  });

  it("si el primero no tiene series, usa la primera no vacía", () => {
    const result = syncCircuitSeries([ex("a", 1, "", "A"), ex("b", 2, 4, "A")]);
    expect(result.map((e) => e.series)).toEqual([4, 4]);
  });

  it("no toca ejercicios sueltos ni devuelve un array nuevo si no hay cambios", () => {
    const input = [ex("s", 1, 5, null), ex("a", 2, 3, "A"), ex("b", 3, 3, "A")];
    expect(syncCircuitSeries(input)).toBe(input);
  });

  it("con onlyExerciseId solo toca el circuito de ese ejercicio", () => {
    const input = [
      ex("a1", 1, 2, "A"),
      ex("a2", 2, 3, "A"),
      ex("b1", 3, 4, "B"),
      ex("b2", 4, 1, "B"),
      ex("c1", 1, 2, "A", "day-2"),
      ex("c2", 2, 5, "A", "day-2"),
    ];
    const result = syncCircuitSeries(input, "a2");
    expect(result.map((e) => e.series)).toEqual([2, 2, 4, 1, 2, 5]);
  });

  it("si el ejercicio quedó suelto (salió del circuito) no cambia nada", () => {
    const input = [ex("a", 1, 2, "A"), ex("b", 2, 3, "A"), ex("x", 3, 7, null)];
    expect(syncCircuitSeries(input, "x")).toBe(input);
  });
});
