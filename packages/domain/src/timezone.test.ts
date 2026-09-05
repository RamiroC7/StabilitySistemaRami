import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIME_ZONE,
  instantToLocalDateStr,
  instantToLocalDateTimeStr,
  zonedDateTimeToInstant,
} from "./timezone.js";

describe("zonedDateTimeToInstant / instantToLocalDateStr (round-trip)", () => {
  it("00:00 Buenos Aires es 03:00 UTC (offset fijo -03:00)", () => {
    const instant = zonedDateTimeToInstant("2026-01-08", "00:00:00.000", DEFAULT_TIME_ZONE);
    expect(new Date(instant).toISOString()).toBe("2026-01-08T03:00:00.000Z");
  });

  it("23:59:59.999 Buenos Aires cae en el UTC del dia siguiente", () => {
    const instant = zonedDateTimeToInstant("2026-01-08", "23:59:59.999", DEFAULT_TIME_ZONE);
    expect(new Date(instant).toISOString()).toBe("2026-01-09T02:59:59.999Z");
  });

  it("instantToLocalDateStr revierte zonedDateTimeToInstant para la misma fecha", () => {
    const instant = zonedDateTimeToInstant("2026-06-15", "12:00:00.000", DEFAULT_TIME_ZONE);
    expect(instantToLocalDateStr(instant, DEFAULT_TIME_ZONE)).toBe("2026-06-15");
  });

  it("un instante UTC de madrugada pertenece al dia AR anterior", () => {
    // 2026-01-10T02:00:00.000Z = 2026-01-09 23:00 en Buenos Aires.
    expect(instantToLocalDateStr("2026-01-10T02:00:00.000Z", DEFAULT_TIME_ZONE)).toBe("2026-01-09");
  });
});

describe("instantToLocalDateTimeStr", () => {
  it("formatea fecha y hora local como 'YYYY-MM-DD HH:mm:ss'", () => {
    // 2026-01-08T15:30:00.000Z = 2026-01-08 12:30:00 en Buenos Aires.
    expect(instantToLocalDateTimeStr("2026-01-08T15:30:00.000Z", DEFAULT_TIME_ZONE)).toBe(
      "2026-01-08 12:30:00",
    );
  });
});
