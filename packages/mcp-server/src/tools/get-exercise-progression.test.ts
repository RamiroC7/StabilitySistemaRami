import { describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("../db.js", () => ({ query: queryMock }));

const { getExerciseProgressionHandler } = await import("./get-exercise-progression.js");

describe("getExerciseProgressionHandler", () => {
  it("sin registros devuelve sets: [] con mensaje, no un error", async () => {
    queryMock.mockResolvedValueOnce([]);

    const result = await getExerciseProgressionHandler({
      student_id: "11111111-1111-1111-1111-111111111111",
      exercise: "sentadilla",
    });

    expect(result.isError).toBeUndefined();
    const body = result.structuredContent as { sets: unknown[]; message: string | null };
    expect(body.sets).toEqual([]);
    expect(body.message).toMatch(/sin registros/i);
  });

  it("pasa el fragmento de busqueda y el student_id como parametros", async () => {
    queryMock.mockResolvedValueOnce([]);

    await getExerciseProgressionHandler({
      student_id: "11111111-1111-1111-1111-111111111111",
      exercise: "Sentadilla",
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(queryMock).toHaveBeenCalledWith(expect.any(String), [
      "11111111-1111-1111-1111-111111111111",
      "Sentadilla",
      "2026-01-01",
      "2026-01-31",
    ]);
  });

  it("devuelve las series ordenadas y los nombres de ejercicio matcheados sin duplicar", async () => {
    queryMock.mockResolvedValueOnce([
      {
        exercise_name: "Sentadilla libre",
        plan_day_name: "Dia 1",
        series: 4,
        sets_detail: [{ set_number: 1, target_reps: "10", actual_reps: "10", kg: 60 }],
        logged_at: "2026-01-05T14:00:00.000Z",
      },
      {
        exercise_name: "Sentadilla libre",
        plan_day_name: "Dia 3",
        series: 4,
        sets_detail: [{ set_number: 1, target_reps: "10", actual_reps: "8", kg: 65 }],
        logged_at: "2026-01-12T14:00:00.000Z",
      },
    ]);

    const result = await getExerciseProgressionHandler({
      student_id: "11111111-1111-1111-1111-111111111111",
      exercise: "sentadilla",
    });

    const body = result.structuredContent as {
      matched_exercise_names: string[];
      sets: Array<{ logged_at: string }>;
      message: string | null;
    };
    expect(body.matched_exercise_names).toEqual(["Sentadilla libre"]);
    expect(body.sets).toHaveLength(2);
    expect(body.message).toBeNull();
  });
});
