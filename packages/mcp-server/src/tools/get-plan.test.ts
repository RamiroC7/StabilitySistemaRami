import { describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("../db.js", () => ({ query: queryMock }));

const { getPlanHandler } = await import("./get-plan.js");

describe("getPlanHandler", () => {
  it("plan_id inexistente devuelve isError sin consultar dias ni ejercicios", async () => {
    queryMock.mockResolvedValueOnce([]);

    const result = await getPlanHandler({ plan_id: "11111111-1111-1111-1111-111111111111" });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain("11111111-1111-1111-1111-111111111111");
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("arma los dias con sus ejercicios ordenados por display_order", async () => {
    queryMock
      .mockResolvedValueOnce([{ id: "p1", title: "Full body", description: "3x semana" }])
      .mockResolvedValueOnce([
        { id: "d1", day_number: 1, day_name: "Dia 1", display_order: 1 },
        { id: "d2", day_number: 2, day_name: "Dia 2", display_order: 2 },
      ])
      .mockResolvedValueOnce([
        {
          day_id: "d1",
          stage_name: "Entrada en calor",
          exercise_name: "Sentadilla",
          series: 4,
          reps: "10",
          carga: "moderada",
          pause: "60s",
          notes: null,
          display_order: 1,
        },
        {
          day_id: "d1",
          stage_name: "Principal",
          exercise_name: "Press banca",
          series: 4,
          reps: "8",
          carga: "alta",
          pause: "90s",
          notes: null,
          display_order: 2,
        },
      ]);

    const result = await getPlanHandler({ plan_id: "p1" });

    expect(result.isError).toBeUndefined();
    const body = result.structuredContent as {
      plan_id: string;
      title: string;
      days: Array<{ day_name: string; exercises: Array<{ exercise_name: string; order: number }> }>;
    };
    expect(body.plan_id).toBe("p1");
    expect(body.days).toHaveLength(2);
    expect(body.days[0]?.exercises.map((e) => e.exercise_name)).toEqual(["Sentadilla", "Press banca"]);
    expect(body.days[0]?.exercises.map((e) => e.order)).toEqual([1, 2]);
    expect(body.days[1]?.exercises).toEqual([]);
  });

  it("un plan sin dias no consulta ejercicios", async () => {
    queryMock
      .mockResolvedValueOnce([{ id: "p2", title: "Plantilla vacia", description: null }])
      .mockResolvedValueOnce([]);

    const result = await getPlanHandler({ plan_id: "p2" });

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect((result.structuredContent as { days: unknown[] }).days).toEqual([]);
  });
});
