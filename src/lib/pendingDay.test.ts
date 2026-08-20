import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { selectPendingDay, type CompletionForPendingDay } from "./pendingDay";

// Recordatorio de dias de la semana usados en los tests (2026, TZ Argentina):
//   2026-03-01 = domingo
//   2026-03-02 = lunes
//   2026-03-03 = martes
//   2026-03-04 = miercoles
//   2026-03-05 = jueves

describe("selectPendingDay", () => {
  // El reloj se congela en cada test con vi.setSystemTime, para que la
  // funcion (que usa `new Date()` como default de "now") de siempre el
  // mismo resultado sin importar en que maquina/dia corra el test.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("un entrenamiento a las 22:26 hora Argentina, que en UTC cae al dia siguiente, se atribuye al dia LOCAL correcto", () => {
    // "Hoy" es jueves 5/3. El plan empieza justo hoy -> la cota de
    // "start_date - 1 dia" (4/3) es mas nueva que el lunes de esta
    // semana (2/3), asi que manda la cota de inicio del plan.
    vi.setSystemTime(new Date("2026-03-05T12:00:00Z"));

    const days = [{ day_number: 1 }, { day_number: 2 }];
    // 22:26 del martes 3/3 en Argentina (UTC-3) = 01:26 UTC del miercoles 4/3.
    // Si la funcion usara la fecha UTC cruda por error, esto contaria como
    // "4/3" (>= a la cota) y el dia 1 aparecería completado por error.
    // Usando la fecha LOCAL correcta, es "3/3" (< a la cota 4/3) y el dia
    // 1 sigue pendiente.
    const completions: CompletionForPendingDay[] = [
      { assignment_id: "a1", day_number: 1, completed_at: "2026-03-04T01:26:00Z" },
    ];

    const result = selectPendingDay(days, completions, "a1", "2026-03-05");

    expect(result?.day_number).toBe(1); // sigue pendiente, no se colo por el bug de UTC
  });

  it("el corte del lunes reinicia el ciclo: una sesion de la semana pasada no cuenta como completada esta semana", () => {
    // "Hoy" es jueves 5/3 -> el lunes de esta semana es 2/3.
    vi.setSystemTime(new Date("2026-03-05T12:00:00Z"));

    const days = [{ day_number: 1 }, { day_number: 2 }, { day_number: 3 }];
    // El plan arranco hace varias semanas (bien antes del lunes actual),
    // asi que la cota que manda es el lunes de esta semana (2/3).
    const startDate = "2026-02-02";
    // El dia 1 se completo el miercoles de la semana PASADA (25/2) —
    // anterior al lunes de esta semana.
    const completions: CompletionForPendingDay[] = [
      { assignment_id: "a1", day_number: 1, completed_at: "2026-02-25T15:00:00Z" },
    ];

    const result = selectPendingDay(days, completions, "a1", startDate);

    // El ciclo se reinicio: el dia 1 vuelve a estar pendiente, la sesion
    // vieja no cuenta para esta semana.
    expect(result?.day_number).toBe(1);
  });

  it("si ya se completaron todos los dias del plan, devuelve el ultimo", () => {
    vi.setSystemTime(new Date("2026-03-05T12:00:00Z"));

    const days = [{ day_number: 1 }, { day_number: 2 }, { day_number: 3 }];
    const startDate = "2026-03-02"; // lunes de esta semana -> misma cota que el corte semanal
    // Los 3 dias completados el martes 3/3 (dentro de la ventana valida)
    const completions: CompletionForPendingDay[] = [
      { assignment_id: "a1", day_number: 1, completed_at: "2026-03-03T12:00:00Z" },
      { assignment_id: "a1", day_number: 2, completed_at: "2026-03-03T13:00:00Z" },
      { assignment_id: "a1", day_number: 3, completed_at: "2026-03-03T14:00:00Z" },
    ];

    const result = selectPendingDay(days, completions, "a1", startDate);

    expect(result?.day_number).toBe(3); // el ultimo, no null ni el primero
  });

  it("el limite start_date - 1 dia es inclusivo: una sesion justo en esa fecha SI cuenta como completada", () => {
    // Misma configuracion que el primer test (cota efectiva = 4/3, por
    // start_date - 1), pero ahora la sesion cae EXACTO en esa fecha limite
    // en vez de un dia antes.
    vi.setSystemTime(new Date("2026-03-05T12:00:00Z"));

    const days = [{ day_number: 1 }, { day_number: 2 }];
    // Mediodia local del 4/3 = 15:00 UTC del 4/3 -> fecha local "2026-03-04",
    // exactamente igual a la cota (start_date - 1 = 5/3 - 1 = 4/3).
    const completions: CompletionForPendingDay[] = [
      { assignment_id: "a1", day_number: 1, completed_at: "2026-03-04T15:00:00Z" },
    ];

    const result = selectPendingDay(days, completions, "a1", "2026-03-05");

    expect(result?.day_number).toBe(2); // el dia 1 SI cuenta como completado, pasa al 2
  });

  it("devuelve null cuando el plan no tiene ningun dia", () => {
    vi.setSystemTime(new Date("2026-03-05T12:00:00Z"));
    const result = selectPendingDay([], [], "a1", "2026-03-01");
    expect(result).toBeNull();
  });

  it("ignora completaciones de otra asignacion (otro plan del mismo alumno)", () => {
    vi.setSystemTime(new Date("2026-03-05T12:00:00Z"));
    const days = [{ day_number: 1 }, { day_number: 2 }];
    const completions: CompletionForPendingDay[] = [
      // completado, pero pertenece a OTRA asignacion (plan viejo/otro)
      { assignment_id: "otra-asignacion", day_number: 1, completed_at: "2026-03-04T15:00:00Z" },
    ];

    const result = selectPendingDay(days, completions, "a1", "2026-03-01");

    expect(result?.day_number).toBe(1); // no se contamino con el dato de otra asignacion
  });
});
