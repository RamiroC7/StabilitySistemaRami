import { describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("../db.js", () => ({ query: queryMock }));

const { getRpeAlertsHandler } = await import("./get-rpe-alerts.js");

describe("getRpeAlertsHandler", () => {
  it("sin ningun alumno en alerta devuelve alerts: []", async () => {
    queryMock.mockResolvedValueOnce([
      { student_id: "s1", first_name: "Ana", last_name: "Diaz", rpe: 5, completed_at: "2026-01-03T00:00:00.000Z" },
      { student_id: "s1", first_name: "Ana", last_name: "Diaz", rpe: 6, completed_at: "2026-01-02T00:00:00.000Z" },
      { student_id: "s1", first_name: "Ana", last_name: "Diaz", rpe: 7, completed_at: "2026-01-01T00:00:00.000Z" },
    ]);

    const result = await getRpeAlertsHandler();

    expect(result.isError).toBeUndefined();
    expect((result.structuredContent as { alerts: unknown[] }).alerts).toEqual([]);
  });

  it("3 RPE altos seguidos dispara alerta 'high' con los valores", async () => {
    queryMock.mockResolvedValueOnce([
      { student_id: "s1", first_name: "Ana", last_name: "Diaz", rpe: 9, completed_at: "2026-01-03T00:00:00.000Z" },
      { student_id: "s1", first_name: "Ana", last_name: "Diaz", rpe: 8, completed_at: "2026-01-02T00:00:00.000Z" },
      { student_id: "s1", first_name: "Ana", last_name: "Diaz", rpe: 10, completed_at: "2026-01-01T00:00:00.000Z" },
    ]);

    const result = await getRpeAlertsHandler();

    const body = result.structuredContent as {
      alerts: Array<{ student_id: string; student_name: string; recent_rpe: number[]; alert: true }>;
    };
    expect(body.alerts).toEqual([
      { student_id: "s1", student_name: "Ana Diaz", recent_rpe: [9, 8, 10], alert: true },
    ]);
  });

  it("menos de 3 completions no dispara alerta", async () => {
    queryMock.mockResolvedValueOnce([
      { student_id: "s1", first_name: "Ana", last_name: "Diaz", rpe: 9, completed_at: "2026-01-02T00:00:00.000Z" },
      { student_id: "s1", first_name: "Ana", last_name: "Diaz", rpe: 9, completed_at: "2026-01-01T00:00:00.000Z" },
    ]);

    const result = await getRpeAlertsHandler();

    expect((result.structuredContent as { alerts: unknown[] }).alerts).toEqual([]);
  });

  it("solo incluye a los alumnos en alerta, no a todos", async () => {
    queryMock.mockResolvedValueOnce([
      { student_id: "s1", first_name: "Ana", last_name: "Diaz", rpe: 9, completed_at: "2026-01-03T00:00:00.000Z" },
      { student_id: "s1", first_name: "Ana", last_name: "Diaz", rpe: 8, completed_at: "2026-01-02T00:00:00.000Z" },
      { student_id: "s1", first_name: "Ana", last_name: "Diaz", rpe: 8, completed_at: "2026-01-01T00:00:00.000Z" },
      { student_id: "s2", first_name: "Luis", last_name: "Gomez", rpe: 5, completed_at: "2026-01-03T00:00:00.000Z" },
      { student_id: "s2", first_name: "Luis", last_name: "Gomez", rpe: 5, completed_at: "2026-01-02T00:00:00.000Z" },
      { student_id: "s2", first_name: "Luis", last_name: "Gomez", rpe: 5, completed_at: "2026-01-01T00:00:00.000Z" },
    ]);

    const result = await getRpeAlertsHandler();

    const body = result.structuredContent as { alerts: Array<{ student_id: string }> };
    expect(body.alerts).toHaveLength(1);
    expect(body.alerts[0]?.student_id).toBe("s1");
  });
});
