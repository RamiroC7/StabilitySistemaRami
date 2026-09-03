import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("../db.js", () => ({ query: queryMock }));

const { getExpiringPlansHandler } = await import("./get-expiring-plans.js");

describe("getExpiringPlansHandler", () => {
  beforeEach(() => {
    // "Hoy" fijo en Buenos Aires: mediodia UTC = 09:00 AR, lejos de cualquier
    // limite de medianoche (mismo criterio que expiration.test.ts).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pasa within_days a la query y devuelve days_until_expiry / is_overdue calculados", async () => {
    queryMock.mockResolvedValueOnce([
      {
        assignment_id: "a1",
        student_id: "s1",
        first_name: "Ana",
        last_name: "Diaz",
        plan_title: "Full body",
        end_date: "2026-01-12",
      },
      {
        assignment_id: "a2",
        student_id: "s2",
        first_name: "Luis",
        last_name: "Gomez",
        plan_title: "Fuerza",
        end_date: "2026-01-05",
      },
    ]);

    const result = await getExpiringPlansHandler({ within_days: 7 });

    expect(queryMock).toHaveBeenCalledWith(expect.any(String), [7]);
    const body = result.structuredContent as {
      plans: Array<{
        assignment_id: string;
        student_name: string;
        days_until_expiry: number;
        is_overdue: boolean;
      }>;
    };
    expect(body.plans).toEqual([
      {
        assignment_id: "a1",
        student_id: "s1",
        student_name: "Ana Diaz",
        plan_title: "Full body",
        end_date: "2026-01-12",
        days_until_expiry: 2,
        is_overdue: false,
      },
      {
        assignment_id: "a2",
        student_id: "s2",
        student_name: "Luis Gomez",
        plan_title: "Fuerza",
        end_date: "2026-01-05",
        days_until_expiry: -5,
        is_overdue: true,
      },
    ]);
  });

  it("sin vencimientos en la ventana devuelve plans: []", async () => {
    queryMock.mockResolvedValueOnce([]);

    const result = await getExpiringPlansHandler({ within_days: 7 });

    expect(result.isError).toBeUndefined();
    expect((result.structuredContent as { plans: unknown[] }).plans).toEqual([]);
  });
});
