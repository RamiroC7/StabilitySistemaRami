import { describe, expect, it } from "vitest";
import { computeAdherence } from "./adherence.js";
import type { AdherenceAssignmentInput, AdherenceCompletionInput } from "./adherence.js";

function assignment(overrides: Partial<AdherenceAssignmentInput> = {}): AdherenceAssignmentInput {
  return {
    id: "assignment-1",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
    status: "active",
    daysPerWeek: 3,
    ...overrides,
  };
}

function completion(overrides: Partial<AdherenceCompletionInput> = {}): AdherenceCompletionInput {
  return {
    dayNumber: 1,
    completedAt: "2026-01-08T15:00:00.000Z",
    ...overrides,
  };
}

describe("computeAdherence", () => {
  it("rango dentro de una sola asignacion: 1 semana, 3/3 completados = 100%", () => {
    const result = computeAdherence({
      from: "2026-01-08",
      to: "2026-01-14",
      assignments: [assignment({ daysPerWeek: 3 })],
      completions: [
        completion({ dayNumber: 1, completedAt: "2026-01-08T15:00:00.000Z" }),
        completion({ dayNumber: 2, completedAt: "2026-01-10T15:00:00.000Z" }),
        completion({ dayNumber: 3, completedAt: "2026-01-12T15:00:00.000Z" }),
      ],
    });

    expect(result.hasAssignmentInRange).toBe(true);
    expect(result.expectedWorkouts).toBeCloseTo(3, 6);
    expect(result.completedWorkouts).toBe(3);
    expect(result.adherencePct).toBe(100);
  });

  it("rango que cruza 2 asignaciones: suma el solape de cada una", () => {
    const result = computeAdherence({
      from: "2026-01-08",
      to: "2026-01-22",
      assignments: [
        assignment({ id: "a1", startDate: "2026-01-01", endDate: "2026-01-15", daysPerWeek: 3 }),
        assignment({ id: "a2", startDate: "2026-01-16", endDate: "2026-01-31", daysPerWeek: 4 }),
      ],
      completions: [],
    });

    // a1: solape [01-08, 01-15] = 8 dias -> overlapWeeks = 8/7, expected = 3 * 8/7 = 24/7
    // a2: solape [01-16, 01-22] = 7 dias -> overlapWeeks = 1,   expected = 4 * 1  = 4
    expect(result.hasAssignmentInRange).toBe(true);
    expect(result.expectedWorkouts).toBeCloseTo(24 / 7 + 4, 6);
    expect(result.perAssignment).toHaveLength(2);
    expect(result.perAssignment[0]).toMatchObject({ id: "a1" });
    expect(result.perAssignment[0].expected).toBeCloseTo(24 / 7, 6);
    expect(result.perAssignment[1]).toMatchObject({ id: "a2", expected: 4 });
  });

  it("asignacion cancelada: se ignora por completo (no cuenta ni aparece en perAssignment)", () => {
    const result = computeAdherence({
      from: "2026-01-08",
      to: "2026-01-14",
      assignments: [assignment({ status: "cancelled", daysPerWeek: 5 })],
      completions: [completion({ completedAt: "2026-01-09T15:00:00.000Z" })],
    });

    expect(result.hasAssignmentInRange).toBe(false);
    expect(result.expectedWorkouts).toBe(0);
    expect(result.adherencePct).toBeNull();
    expect(result.perAssignment).toHaveLength(0);
  });

  it("completions duplicadas el mismo dia (mismo dayNumber, misma fecha local): dedup a 1", () => {
    const result = computeAdherence({
      from: "2026-01-08",
      to: "2026-01-14",
      assignments: [assignment({ daysPerWeek: 3 })],
      completions: [
        completion({ dayNumber: 1, completedAt: "2026-01-08T14:00:00.000Z" }),
        completion({ dayNumber: 1, completedAt: "2026-01-08T18:00:00.000Z" }),
      ],
    });

    expect(result.completedWorkouts).toBe(1);
    expect(result.adherencePct).toBe(33); // round(1/3 * 100)
  });

  it("borde de TZ: completion a las 23:00 Buenos Aires (02:00 UTC del dia siguiente) cuenta en el dia AR, no en el dia UTC", () => {
    // 2026-01-10T02:00:00.000Z = 2026-01-09 23:00 hora Argentina (UTC-3).
    const result = computeAdherence({
      from: "2026-01-09",
      to: "2026-01-09", // un solo dia: si se usara la fecha UTC, esta completion caeria AFUERA del rango
      assignments: [assignment({ daysPerWeek: 7 })],
      completions: [completion({ dayNumber: 1, completedAt: "2026-01-10T02:00:00.000Z" })],
    });

    expect(result.completedWorkouts).toBe(1);
  });

  it("sin ninguna asignacion no-cancelada que solape el rango: adherencePct null, NUNCA 0 (US-2)", () => {
    const result = computeAdherence({
      from: "2026-01-08",
      to: "2026-01-14",
      assignments: [],
      // Las completions "crudas" igual se cuentan aunque no haya plan que las explique —
      // el dato queda disponible, pero el % (que necesita un denominador) es null.
      completions: [completion({ completedAt: "2026-01-08T15:00:00.000Z" })],
    });

    expect(result.hasAssignmentInRange).toBe(false);
    expect(result.expectedWorkouts).toBe(0);
    expect(result.completedWorkouts).toBe(1);
    expect(result.adherencePct).toBeNull();
  });

  it("no hay tope superior: el porcentaje puede pasar 100 (design.md: 'sin cap')", () => {
    const result = computeAdherence({
      from: "2026-01-08",
      to: "2026-01-08", // 1 dia -> overlapWeeks = 1/7
      assignments: [assignment({ daysPerWeek: 1 })], // expected = 1/7
      completions: [
        completion({ dayNumber: 1, completedAt: "2026-01-08T13:00:00.000Z" }),
        completion({ dayNumber: 2, completedAt: "2026-01-08T14:00:00.000Z" }),
        completion({ dayNumber: 3, completedAt: "2026-01-08T15:00:00.000Z" }),
        completion({ dayNumber: 4, completedAt: "2026-01-08T16:00:00.000Z" }),
        completion({ dayNumber: 5, completedAt: "2026-01-08T17:00:00.000Z" }),
      ],
    });

    expect(result.completedWorkouts).toBe(5);
    expect(result.adherencePct).toBeGreaterThan(100);
  });
});
