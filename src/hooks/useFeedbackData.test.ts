import { describe, it, expect } from "vitest";
import {
  computeFeedbackData,
  getFeedbackAvailability,
  type FeedbackPlanInput,
  type FeedbackCompletionInput,
  type FeedbackExerciseGroupInput,
} from "./useFeedbackData";

// Argentina es UTC-3 fijo (sin horario de verano desde 2009). Este helper
// arma el instante UTC real a partir de una fecha/hora "de pared" en ART,
// para que los fixtures se lean como fechas humanas en vez de tener que
// sumar 3hs a mano en cada caso. Es una reimplementación independiente y
// deliberadamente simple (no importa artWallClockToUtc del módulo bajo
// test) para no validar la lógica contra sí misma.
function art(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) + 3 * 60 * 60 * 1000);
}

// Referencia de calendario usada en todo el archivo (verificado con
// `node -e`): domingo 25/1/2026, lunes 26/1/2026, ... próximo domingo
// 1/2/2026 (que también es día 1 del mes).

describe("getFeedbackAvailability — semanal", () => {
  it("no disponible el domingo antes de las 10:00 ART", () => {
    const a = getFeedbackAvailability("week", art(2026, 1, 25, 9, 59));
    expect(a.available).toBe(false);
  });

  it("disponible el domingo desde las 10:00 ART, reporta la semana lunes-domingo que termina hoy", () => {
    const a = getFeedbackAvailability("week", art(2026, 1, 25, 10, 0));
    expect(a.available).toBe(true);
    expect(a.rangeStart).toEqual(art(2026, 1, 19, 0, 0));
    expect(a.rangeEnd.getTime()).toBe(art(2026, 1, 26, 0, 0).getTime() - 1);
  });

  it("sigue disponible el lunes siguiente antes de las 20:00 ART, sin sumar ese lunes a la semana", () => {
    const a = getFeedbackAvailability("week", art(2026, 1, 26, 19, 59));
    expect(a.available).toBe(true);
    expect(a.rangeEnd.getTime()).toBe(art(2026, 1, 26, 0, 0).getTime() - 1);
  });

  it("deja de estar disponible el lunes a las 20:00 ART en punto (fin exclusivo)", () => {
    expect(getFeedbackAvailability("week", art(2026, 1, 26, 20, 0)).available).toBe(false);
    expect(getFeedbackAvailability("week", art(2026, 1, 26, 20, 1)).available).toBe(false);
  });

  it("no disponible de martes a sábado", () => {
    for (const day of [27, 28, 29, 30, 31]) {
      expect(getFeedbackAvailability("week", art(2026, 1, day, 12, 0)).available).toBe(false);
    }
  });

  it("nextAvailableAt siempre apunta al próximo domingo 10:00 ART", () => {
    const nextSunday10 = art(2026, 2, 1, 10, 0);
    for (const day of [27, 28, 29, 30, 31]) {
      expect(getFeedbackAvailability("week", art(2026, 1, day, 12, 0)).nextAvailableAt).toEqual(
        nextSunday10,
      );
    }
    expect(getFeedbackAvailability("week", art(2026, 1, 26, 20, 1)).nextAvailableAt).toEqual(
      nextSunday10,
    );
    // Domingo antes de habilitarse: apunta a hoy mismo a las 10.
    expect(getFeedbackAvailability("week", art(2026, 1, 25, 5, 0)).nextAvailableAt).toEqual(
      art(2026, 1, 25, 10, 0),
    );
  });
});

describe("getFeedbackAvailability — mensual", () => {
  it("disponible todo el día 1 del mes, muestra el mes calendario anterior completo", () => {
    const early = getFeedbackAvailability("month", art(2026, 1, 1, 0, 0));
    expect(early.available).toBe(true);
    expect(early.rangeStart).toEqual(art(2025, 12, 1, 0, 0));
    expect(early.rangeEnd.getTime()).toBe(art(2026, 1, 1, 0, 0).getTime() - 1);

    const late = getFeedbackAvailability("month", art(2026, 1, 1, 23, 59));
    expect(late.available).toBe(true);
  });

  it("no disponible del día 2 en adelante; nextAvailableAt es el 1 del mes siguiente", () => {
    const a = getFeedbackAvailability("month", art(2026, 1, 15, 12, 0));
    expect(a.available).toBe(false);
    expect(a.nextAvailableAt).toEqual(art(2026, 2, 1, 0, 0));
  });

  it("respeta años bisiestos: el 1 de marzo reporta un febrero de 29 días", () => {
    const a = getFeedbackAvailability("month", art(2024, 3, 1, 12, 0));
    expect(a.rangeStart).toEqual(art(2024, 2, 1, 0, 0));
    expect(a.rangeEnd.getTime()).toBe(art(2024, 3, 1, 0, 0).getTime() - 1);
  });

  it("cruce de año: el 1 de enero reporta diciembre del año anterior", () => {
    const a = getFeedbackAvailability("month", art(2026, 1, 1, 12, 0));
    expect(a.rangeStart).toEqual(art(2025, 12, 1, 0, 0));
  });
});

describe("computeFeedbackData — fuera de ventana", () => {
  it("semanal: devuelve available:false con nextAvailableAt en vez de datos", () => {
    const result = computeFeedbackData("week", [], [], [], art(2026, 1, 28, 12, 0));
    expect(result.available).toBe(false);
    if (result.available) throw new Error("expected not available");
    expect(result.nextAvailableAt).toEqual(art(2026, 2, 1, 10, 0));
  });

  it("mensual: devuelve available:false con nextAvailableAt en vez de datos", () => {
    const result = computeFeedbackData("month", [], [], [], art(2026, 1, 15, 12, 0));
    expect(result.available).toBe(false);
    if (result.available) throw new Error("expected not available");
    expect(result.nextAvailableAt).toEqual(art(2026, 2, 1, 0, 0));
  });
});

describe("computeFeedbackData — semanal (rango fijo lunes 19/1 a domingo 25/1)", () => {
  const NOW = art(2026, 1, 25, 11, 0); // domingo, dentro de la ventana

  function completionOn(day: number, overrides: Partial<FeedbackCompletionInput> = {}): FeedbackCompletionInput {
    return {
      completedAt: art(2026, 1, day, 18, 0).toISOString(),
      durationMinutes: 60,
      rpe: null,
      ...overrides,
    };
  }

  it("un plan de 6 días/semana vigente toda la semana: floor(7*6/7)=6 esperadas exacto (sin arrastre de punto flotante)", () => {
    const plans: FeedbackPlanInput[] = [
      { startDate: "2025-01-01", endDate: "2026-12-31", daysPerWeek: 6 },
    ];
    const completions = [19, 20, 21, 22, 23, 24].map((d) => completionOn(d));

    const result = computeFeedbackData("week", plans, completions, [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.expectedSessions).toBe(6);
    expect(result.data.completedSessions).toBe(6);
    expect(result.data.attendanceLevel).toBe("complete");
  });

  it("un entrenamiento del lunes siguiente (día de repaso) NO se suma a la semana reportada", () => {
    const plans: FeedbackPlanInput[] = [
      { startDate: "2025-01-01", endDate: "2026-12-31", daysPerWeek: 6 },
    ];
    const completions = [completionOn(26)]; // lunes 26/1, ya es la semana siguiente
    // completedAt del 26 a las 18:00 ART cae fuera del rango (termina el 25 23:59:59.999).
    completions[0].completedAt = art(2026, 1, 26, 8, 0).toISOString();

    const result = computeFeedbackData("week", plans, completions, [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.completedSessions).toBe(0);
  });

  it("cambio de plan a mitad de semana: mezcla los dos daysPerWeek día por día", () => {
    // Plan viejo (3 días/semana) hasta el miércoles 21/1 inclusive.
    // Plan nuevo (6 días/semana) desde el jueves 22/1 en adelante.
    const oldPlan: FeedbackPlanInput = { startDate: "2020-01-01", endDate: "2026-01-21", daysPerWeek: 3 };
    const newPlan: FeedbackPlanInput = { startDate: "2026-01-22", endDate: "2026-12-31", daysPerWeek: 6 };
    const plans = [newPlan, oldPlan]; // orden real: start_date desc

    // 3 días bajo el plan viejo (lun-mié) + 3 bajo el nuevo (jue-sáb) = 6.
    const completions = [19, 20, 21, 22, 23, 24].map((d) => completionOn(d));

    const result = computeFeedbackData("week", plans, completions, [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    // (3 días * 3/semana + 4 días * 6/semana) / 7 = (9 + 24)/7 = 4.71 -> floor 4.
    // (lun-mié = 3 días con daysPerWeek 3; jue-dom = 4 días con daysPerWeek 6)
    expect(result.data.expectedSessions).toBe(4);
    expect(result.data.completedSessions).toBe(6);
    expect(result.data.attendanceLevel).toBe("complete");
  });

  it("sin ningún plan asignado: usa el fallback de 3 días/semana sobre los 7 días exactos de la semana", () => {
    const result = computeFeedbackData("week", [], [], [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    // floor(3 * 7 / 7) = 3, no 3*8/7 (regresión de rangeDays con un +1 de más).
    expect(result.data.expectedSessions).toBe(3);
  });

  it("useSegmentedAttendance es true en semanal", () => {
    const result = computeFeedbackData("week", [], [], [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.useSegmentedAttendance).toBe(true);
  });
});

describe("computeFeedbackData — mensual (mes calendario anterior completo)", () => {
  const NOW = art(2026, 1, 1, 9, 0); // día 1 de enero: reporta diciembre 2025 (31 días)

  it("cuenta entrenamientos de diciembre 2025 completo e ignora los de enero 2026", () => {
    const completions: FeedbackCompletionInput[] = [
      { completedAt: art(2025, 12, 1, 10, 0).toISOString(), durationMinutes: 50, rpe: 6 },
      { completedAt: art(2025, 12, 31, 22, 0).toISOString(), durationMinutes: 70, rpe: 8 },
      { completedAt: art(2026, 1, 1, 1, 0).toISOString(), durationMinutes: 999, rpe: 10 },
    ];
    const result = computeFeedbackData("month", [], completions, [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.completedSessions).toBe(2);
    expect(result.data.avgMinutesPerSession).toBe(60);
    expect(result.data.avgRpe).toBe(7);
  });

  it("sin ningún plan asignado, sobre un mes de 31 días exactos: floor(3*31/7)=13, no se corre por un día de más", () => {
    const result = computeFeedbackData("month", [], [], [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.expectedSessions).toBe(13);
  });

  it("un plan de 5 días/semana vigente todo diciembre: floor(31*5/7)=22", () => {
    const plans: FeedbackPlanInput[] = [
      { startDate: "2020-01-01", endDate: "2026-12-31", daysPerWeek: 5 },
    ];
    const result = computeFeedbackData("month", plans, [], [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.expectedSessions).toBe(22);
  });

  it("useSegmentedAttendance es false en mensual", () => {
    const result = computeFeedbackData("month", [], [], [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.useSegmentedAttendance).toBe(false);
  });

  it("rangeLabel muestra 'Mes Año' completo, no un rango día a día (evita ambigüedad al cruzar de año)", () => {
    const result = computeFeedbackData("month", [], [], [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.rangeLabel).toBe("Diciembre de 2025");
  });

  // Regresión: expectedSessions daba 0 aunque el alumno tuviera un plan
  // vigente y hubiera entrenado, porque el día usado para matchear cada
  // plan (toDateKey) se calculaba con d.getFullYear()/getMonth()/getDate()
  // — la fecha LOCAL del dispositivo que corre el código, no la fecha en
  // Argentina. Si el navegador del profesor está en una zona horaria más
  // atrasada que ART (ej. cualquier huso de EE.UU.), el primer día del
  // rango (medianoche ART = 03:00 UTC) se leía como el día anterior, y esa
  // misma desalineación se repetía los 31 días del mes -> ningún día
  // matcheaba el rango del plan -> expectedSessions = 0, mostrando algo
  // como "7/0 · 100%" con entrenamientos reales ya completados.
  it("no depende de la zona horaria local del dispositivo (regresión: plan vigente día por día todo el mes)", () => {
    const plans: FeedbackPlanInput[] = [
      { startDate: "2020-01-01", endDate: "2026-12-31", daysPerWeek: 5 },
    ];
    const completions: FeedbackCompletionInput[] = [3, 8, 15, 22, 29, 31, 12].map((d) => ({
      completedAt: art(2025, 12, d, 19, 0).toISOString(),
      durationMinutes: 60,
      rpe: 6,
    }));
    const result = computeFeedbackData("month", plans, completions, [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    // floor(31*5/7) = 22, NUNCA 0 — el plan cubre todo diciembre.
    expect(result.data.expectedSessions).toBe(22);
    expect(result.data.completedSessions).toBe(7);
  });
});

describe("computeFeedbackData — asistencia", () => {
  const NOW = art(2026, 1, 25, 11, 0);

  it("completar más sesiones de las esperadas cappea el porcentaje en 100, no lo pasa", () => {
    const plans: FeedbackPlanInput[] = [
      { startDate: "2020-01-01", endDate: "2026-12-31", daysPerWeek: 3 },
    ];
    const completions = [19, 20, 21, 22, 23, 24, 25].map((d) => ({
      completedAt: art(2026, 1, d, 12, 0).toISOString(),
      durationMinutes: 60,
      rpe: null,
    }));
    const result = computeFeedbackData("week", plans, completions, [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.expectedSessions).toBe(3);
    expect(result.data.completedSessions).toBe(7);
    expect(result.data.attendancePercentage).toBe(100);
    expect(result.data.attendanceLevel).toBe("complete");
  });

  it("sin entrenamientos ni plan que cubra la semana: no divide por cero y da 0%", () => {
    const plans: FeedbackPlanInput[] = [
      { startDate: "2020-01-01", endDate: "2020-12-31", daysPerWeek: 5 }, // no cubre 2026
    ];
    const result = computeFeedbackData("week", plans, [], [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.expectedSessions).toBe(0);
    expect(result.data.attendancePercentage).toBe(0);
    expect(result.data.attendanceLevel).toBe("partial");
  });
});

describe("computeFeedbackData — minutos y RPE", () => {
  const NOW = art(2026, 1, 25, 11, 0);

  it("promedia la duración solo entre sesiones con dato cargado, y el RPE solo de las de la semana reportada", () => {
    const completions: FeedbackCompletionInput[] = [
      { completedAt: art(2026, 1, 20, 12, 0).toISOString(), durationMinutes: 45, rpe: 6 },
      { completedAt: art(2026, 1, 21, 12, 0).toISOString(), durationMinutes: 30, rpe: 8 },
      // Sesión sin duración cargada: cuenta para completedSessions, pero no
      // debe "contaminar" el promedio como si hubiera durado 0 minutos.
      { completedAt: art(2026, 1, 22, 12, 0).toISOString(), durationMinutes: null, rpe: null },
      // Fuera de la semana (lunes siguiente): no debe sumar ni promediar.
      { completedAt: art(2026, 1, 26, 12, 0).toISOString(), durationMinutes: 999, rpe: 10 },
    ];
    const result = computeFeedbackData("week", [], completions, [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.completedSessions).toBe(3);
    // (45+30)/2 = 37.5 -> 38. Si se promediara contra las 3 sesiones
    // (tratando la sin dato como 0 min), daría 25 — el bug reportado.
    expect(result.data.avgMinutesPerSession).toBe(38);
    expect(result.data.avgRpe).toBe(7);
  });

  it("si NINGUNA sesión del período tiene duración cargada, avgMinutesPerSession es null, no 0", () => {
    const completions: FeedbackCompletionInput[] = [
      { completedAt: art(2026, 1, 20, 12, 0).toISOString(), durationMinutes: null, rpe: 6 },
      { completedAt: art(2026, 1, 21, 12, 0).toISOString(), durationMinutes: null, rpe: 8 },
    ];
    const result = computeFeedbackData("week", [], completions, [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.completedSessions).toBe(2);
    expect(result.data.avgMinutesPerSession).toBeNull();
  });

  it("avgRpe es null si ninguna sesión de la semana tiene RPE cargado", () => {
    const completions: FeedbackCompletionInput[] = [
      { completedAt: art(2026, 1, 20, 12, 0).toISOString(), durationMinutes: 40, rpe: null },
    ];
    const result = computeFeedbackData("week", [], completions, [], NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.avgRpe).toBeNull();
  });
});

describe("computeFeedbackData — progreso de fuerza", () => {
  const NOW = art(2026, 1, 25, 11, 0);

  function group(
    overrides: Partial<FeedbackExerciseGroupInput> & { exercise_name: string },
  ): FeedbackExerciseGroupInput {
    return { logs: [], ...overrides };
  }

  it("weightLogStatus es 'none' si no hay ningún log en la semana", () => {
    const groups = [group({ exercise_name: "Sentadilla", logs: [] })];
    const result = computeFeedbackData("week", [], [], groups, NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.weightLogStatus).toBe("none");
    expect(result.data.exerciseProgress).toHaveLength(0);
  });

  it("weightLogStatus es 'partial' si se registró peso en menos días de los entrenados", () => {
    const completions = [20, 21, 22].map((d) => ({
      completedAt: art(2026, 1, d, 12, 0).toISOString(),
      durationMinutes: 60,
      rpe: null,
    }));
    const groups = [
      group({
        exercise_name: "Sentadilla",
        logs: [
          {
            logged_at: art(2026, 1, 21, 12, 0).toISOString(),
            sets_detail: [{ set_number: 1, target_reps: "8", actual_reps: "8", kg: 80 }],
          },
        ],
      }),
    ];
    const result = computeFeedbackData("week", [], completions, groups, NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.weightLogDays).toBe(1);
    expect(result.data.weightLogStatus).toBe("partial");
  });

  it("isRecord: sube peso Y repeticiones -> record", () => {
    const groups = [
      group({
        exercise_name: "Press banca",
        logs: [
          {
            logged_at: art(2026, 1, 10, 12, 0).toISOString(), // antes de la semana
            sets_detail: [{ set_number: 1, target_reps: "8", actual_reps: "8", kg: 70 }],
            calculated_rm: 70 * (1 + 8 / 30),
          },
          {
            logged_at: art(2026, 1, 21, 12, 0).toISOString(), // dentro de la semana
            sets_detail: [{ set_number: 1, target_reps: "10", actual_reps: "10", kg: 75 }],
            calculated_rm: 75 * (1 + 10 / 30),
          },
        ],
      }),
    ];
    const result = computeFeedbackData("week", [], [], groups, NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.exerciseProgress[0]).toMatchObject({
      currentKg: 75,
      currentReps: 10,
      previousKg: 70,
      previousReps: 8,
      isRecord: true,
    });
  });

  it("isRecord: bajó el peso -> no es record", () => {
    const groups = [
      group({
        exercise_name: "Press banca",
        logs: [
          {
            logged_at: art(2026, 1, 10, 12, 0).toISOString(),
            sets_detail: [{ set_number: 1, target_reps: "8", actual_reps: "8", kg: 80 }],
            calculated_rm: 80 * (1 + 8 / 30),
          },
          {
            logged_at: art(2026, 1, 21, 12, 0).toISOString(),
            sets_detail: [{ set_number: 1, target_reps: "8", actual_reps: "8", kg: 75 }],
            calculated_rm: 75 * (1 + 8 / 30),
          },
        ],
      }),
    ];
    const result = computeFeedbackData("week", [], [], groups, NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.exerciseProgress[0].isRecord).toBe(false);
  });

  it("isRecord: sin log previo para comparar -> no es record", () => {
    const groups = [
      group({
        exercise_name: "Press banca",
        logs: [
          {
            logged_at: art(2026, 1, 21, 12, 0).toISOString(),
            sets_detail: [{ set_number: 1, target_reps: "8", actual_reps: "8", kg: 75 }],
            calculated_rm: 75 * (1 + 8 / 30),
          },
        ],
      }),
    ];
    const result = computeFeedbackData("week", [], [], groups, NOW);
    expect(result.available).toBe(true);
    if (!result.available) throw new Error("expected available");
    expect(result.data.exerciseProgress[0].isRecord).toBe(false);
    expect(result.data.exerciseProgress[0].previousKg).toBeNull();
  });
});
