import { beforeEach, describe, expect, it } from "vitest";
import {
  markPlanNoticeSeen,
  readSeenPlanNotices,
  shouldAnnounceNewPlan,
} from "./newPlanNotice";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: Pick<Storage, "getItem" | "setItem"> }).localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
  };
});

const today = new Date(2026, 10, 15); // 15/11/2026

describe("shouldAnnounceNewPlan", () => {
  it("avisa un plan recién asignado que no se avisó antes", () => {
    expect(shouldAnnounceNewPlan({ assignmentId: "a1", startDate: "2026-11-15" }, [], today)).toBe(true);
    expect(shouldAnnounceNewPlan({ assignmentId: "a1", startDate: "2026-11-20" }, [], today)).toBe(true);
    expect(shouldAnnounceNewPlan({ assignmentId: "a1", startDate: "2026-11-08" }, [], today)).toBe(true);
  });

  it("no avisa planes viejos (arrancaron hace más de 7 días)", () => {
    expect(shouldAnnounceNewPlan({ assignmentId: "a1", startDate: "2026-11-07" }, [], today)).toBe(false);
  });

  it("no avisa dos veces la misma asignación (editar el plan no lo repite)", () => {
    expect(shouldAnnounceNewPlan({ assignmentId: "a1", startDate: "2026-11-15" }, ["a1"], today)).toBe(false);
  });

  it("fecha inválida o sin id: no avisa", () => {
    expect(shouldAnnounceNewPlan({ assignmentId: "a1", startDate: "" }, [], today)).toBe(false);
    expect(shouldAnnounceNewPlan({ assignmentId: "", startDate: "2026-11-15" }, [], today)).toBe(false);
  });
});

describe("seen storage", () => {
  it("guarda y lee los avisos vistos, sin duplicados y con tope", () => {
    markPlanNoticeSeen("a1");
    markPlanNoticeSeen("a1");
    expect(readSeenPlanNotices()).toEqual(["a1"]);
    for (let i = 0; i < 30; i++) markPlanNoticeSeen(`x${i}`);
    const ids = readSeenPlanNotices();
    expect(ids).toHaveLength(20);
    expect(ids.at(-1)).toBe("x29");
  });

  it("si lo guardado está roto, devuelve vacío sin romper", () => {
    store.set("new_plan_notice_seen", "{no es json");
    expect(readSeenPlanNotices()).toEqual([]);
  });
});
