import { describe, it, expect } from "vitest";
import {
  calculateMetricsForMonth,
  type RawStudent,
  type RawCompletion,
  type RawAssignment,
} from "./useBusinessMetrics";

// --- Helpers para armar fixtures minimos y legibles ---

function student(overrides: {
  id: string;
  created_at: string;
  is_archived?: boolean;
  archived_at?: string | null;
}): RawStudent {
  return {
    id: overrides.id,
    created_at: overrides.created_at,
    student_profiles: {
      birth_date: null,
      gender: null,
      primary_goal: null,
      is_archived: overrides.is_archived ?? false,
      archived_at: overrides.archived_at ?? null,
      training_experience: null,
      sports: null,
    },
  };
}

function completion(overrides: {
  student_id: string;
  completed_at: string;
  initial_mood?: string | null;
  mood?: string | null;
}): RawCompletion {
  return {
    id: `c-${overrides.student_id}-${overrides.completed_at}`,
    student_id: overrides.student_id,
    assignment_id: null,
    completed_at: overrides.completed_at,
    initial_mood: overrides.initial_mood ?? null,
    mood: overrides.mood ?? null,
    rpe: null,
  };
}

const NO_ASSIGNMENTS: RawAssignment[] = [];

describe("calculateMetricsForMonth", () => {
  it("retencion con S=0 (ningun alumno existia antes del mes): da 100%, no explota", () => {
    // Marzo 2026 (monthIndex=2). El unico alumno se creo DENTRO del mes,
    // asi que no habia nadie al arrancar el mes (S=0).
    const students = [
      student({ id: "s1", created_at: "2026-03-10T00:00:00Z" }),
    ];

    const metrics = calculateMetricsForMonth(2026, 2, students, [], NO_ASSIGNMENTS);

    expect(metrics.retentionPercent).toBe(100);
  });

  it("retencion con S=0 y E=0 (no habia nadie antes ni durante): da null, no divide por cero", () => {
    const metrics = calculateMetricsForMonth(2026, 2, [], [], NO_ASSIGNMENTS);
    expect(metrics.retentionPercent).toBeNull();
  });

  it("crecimiento con el mes anterior en 0 altas: da null, no infinito", () => {
    // Febrero 2026 (mes anterior) sin ninguna alta; Marzo 2026 con 1 alta.
    const students = [
      student({ id: "s1", created_at: "2026-03-10T00:00:00Z" }),
    ];

    const metrics = calculateMetricsForMonth(2026, 2, students, [], NO_ASSIGNMENTS);

    expect(metrics.growthPercent).toBeNull();
  });

  it("crecimiento con 0 altas este mes y 0 el mes anterior: da 0, no null", () => {
    const metrics = calculateMetricsForMonth(2026, 2, [], [], NO_ASSIGNMENTS);
    expect(metrics.growthPercent).toBe(0);
  });

  it("alumno archivado a mitad de mes sigue contando como activo ese mes", () => {
    const students = [
      // Creado antes del mes, archivado el 15/3 (mitad del mes) -> activo para Marzo
      student({
        id: "s1",
        created_at: "2026-01-05T00:00:00Z",
        is_archived: true,
        archived_at: "2026-03-15T00:00:00Z",
      }),
      // Creado antes del mes, archivado el 1/2 (antes de que arranque Marzo) -> NO activo para Marzo
      student({
        id: "s2",
        created_at: "2026-01-05T00:00:00Z",
        is_archived: true,
        archived_at: "2026-02-01T00:00:00Z",
      }),
    ];

    const metrics = calculateMetricsForMonth(2026, 2, students, [], NO_ASSIGNMENTS);

    expect(metrics.activeStudents).toBe(1); // solo s1
  });

  it("clasifica el impacto emocional segun animo inicial vs final", () => {
    const students = [
      student({ id: "s1", created_at: "2026-01-01T00:00:00Z" }),
    ];
    const completions = [
      // final "pain" -> fatigued, sin importar el inicial
      completion({ student_id: "s1", completed_at: "2026-03-05T12:00:00Z", initial_mood: "happy", mood: "pain" }),
      // final "tired" -> fatigued
      completion({ student_id: "s1", completed_at: "2026-03-06T12:00:00Z", initial_mood: "happy", mood: "tired" }),
      // sad -> excellent: mejora
      completion({ student_id: "s1", completed_at: "2026-03-07T12:00:00Z", initial_mood: "sad", mood: "excellent" }),
      // neutral -> excellent: mejora
      completion({ student_id: "s1", completed_at: "2026-03-08T12:00:00Z", initial_mood: "neutral", mood: "excellent" }),
      // happy -> normal: estable (no es ninguna de las combinaciones de mejora)
      completion({ student_id: "s1", completed_at: "2026-03-09T12:00:00Z", initial_mood: "happy", mood: "normal" }),
      // sin animo inicial o final: se ignora, no suma al total
      completion({ student_id: "s1", completed_at: "2026-03-10T12:00:00Z", initial_mood: null, mood: "excellent" }),
    ];

    const metrics = calculateMetricsForMonth(2026, 2, students, completions, NO_ASSIGNMENTS);

    expect(metrics.emotionalImpact.fatigued).toBe(2);
    expect(metrics.emotionalImpact.improved).toBe(2);
    expect(metrics.emotionalImpact.stable).toBe(1);
    expect(metrics.emotionalImpact.total).toBe(5); // el de mood nulo no cuenta
  });
});
