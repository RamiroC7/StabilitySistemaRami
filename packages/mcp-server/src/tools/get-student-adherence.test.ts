import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("../db.js", () => ({
  query: queryMock,
}));

const { getStudentAdherenceHandler } = await import("./get-student-adherence.js");

describe("getStudentAdherenceHandler", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("from > to: isError, sin consultar la base", async () => {
    const result = await getStudentAdherenceHandler({
      student_id: "11111111-1111-1111-1111-111111111111",
      from: "2026-02-01",
      to: "2026-01-01",
    });

    expect(result.isError).toBe(true);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("student_id que no existe: isError legible", async () => {
    queryMock.mockResolvedValueOnce([]); // STUDENT_SQL: sin filas

    const result = await getStudentAdherenceHandler({
      student_id: "22222222-2222-2222-2222-222222222222",
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("22222222-2222-2222-2222-222222222222");
    expect(queryMock).toHaveBeenCalledTimes(1); // no llega a pedir assignments/completions
  });

  it("student_id que existe pero es coach: isError (no es un alumno)", async () => {
    queryMock.mockResolvedValueOnce([{ id: "coach-1", role: "coach" }]);

    const result = await getStudentAdherenceHandler({
      student_id: "coach-1",
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(result.isError).toBe(true);
  });

  it("caso feliz: arma la respuesta con el shape correcto", async () => {
    queryMock
      .mockResolvedValueOnce([{ id: "student-1", role: "student" }]) // STUDENT_SQL
      .mockResolvedValueOnce([
        {
          assignment_id: "a1",
          start_date: "2026-01-01",
          end_date: "2026-01-31",
          status: "active",
          plan_title: "Plan Full Body",
          days_per_week: 3,
        },
      ]) // ASSIGNMENTS_SQL
      .mockResolvedValueOnce([
        { day_number: 1, completed_at: "2026-01-08T15:00:00.000Z", rpe: 7 },
      ]); // COMPLETIONS_SQL

    const result = await getStudentAdherenceHandler({
      student_id: "student-1",
      from: "2026-01-08",
      to: "2026-01-14",
    });

    expect(result.isError).toBeUndefined();
    const body = result.structuredContent as Record<string, unknown>;
    expect(body.student_id).toBe("student-1");
    expect(body.has_assignment_in_range).toBe(true);
    expect(body.adherence_pct).toBe(33); // round(1 completado / 3 esperados * 100)
    expect(Array.isArray(body.assignments)).toBe(true);
    expect(Array.isArray(body.completions)).toBe(true);
    expect(typeof body.note).toBe("string");
    expect(queryMock).toHaveBeenCalledTimes(3);
  });
});
