import { describe, expect, it } from "vitest";
import { getExpirationStatus } from "./expiration.js";

// "now" fijo para que los tests no dependan de la fecha real de ejecucion.
// Mediodia UTC del 2026-01-15 = 2026-01-15 09:00 en Buenos Aires (UTC-3):
// bien lejos de cualquier limite de medianoche, para que el test no sea
// fragil frente a la conversion de TZ.
const NOW = new Date("2026-01-15T12:00:00.000Z");

describe("getExpirationStatus", () => {
  it("vencido: end_date en el pasado -> negativo, isOverdue true", () => {
    const result = getExpirationStatus("2026-01-10", NOW);
    expect(result.daysUntilExpiry).toBe(-5);
    expect(result.isOverdue).toBe(true);
  });

  it("vence hoy: end_date === hoy -> 0, isOverdue false", () => {
    const result = getExpirationStatus("2026-01-15", NOW);
    expect(result.daysUntilExpiry).toBe(0);
    expect(result.isOverdue).toBe(false);
  });

  it("vence en los proximos dias: end_date cercano en el futuro -> positivo chico", () => {
    const result = getExpirationStatus("2026-01-18", NOW);
    expect(result.daysUntilExpiry).toBe(3);
    expect(result.isOverdue).toBe(false);
  });

  it("lejos: end_date bien en el futuro -> positivo grande", () => {
    const result = getExpirationStatus("2026-03-01", NOW);
    expect(result.daysUntilExpiry).toBe(45);
    expect(result.isOverdue).toBe(false);
  });

  it("usa la TZ fija de Buenos Aires para decidir 'hoy', no la del runtime", () => {
    // 2026-01-16T01:30:00.000Z = 2026-01-15 22:30 en Buenos Aires (UTC-3):
    // en UTC ya es "otro dia", pero en AR todavia es el 15.
    const lateUtc = new Date("2026-01-16T01:30:00.000Z");
    const result = getExpirationStatus("2026-01-15", lateUtc);
    expect(result.daysUntilExpiry).toBe(0); // "vence hoy", no "vencio ayer"
    expect(result.isOverdue).toBe(false);
  });
});
