import { describe, it, expect } from "vitest";
import { formatDateLocal } from "./utils";

describe("formatDateLocal", () => {
  it("formatea un timestamp completo (con 'T') en formato es-AR", () => {
    // 2026-03-15T10:00:00Z, con TZ fijada a Argentina (UTC-3) en vitest.setup.ts
    expect(formatDateLocal("2026-03-15T10:00:00Z")).toBe("15/3/2026");
  });

  it("formatea una fecha suelta YYYY-MM-DD parseandola manualmente (sin desfase de zona horaria)", () => {
    // Si esto se parseara con `new Date("2026-03-01")` a secas (UTC medianoche),
    // en Argentina (UTC-3) mostraria "28/2/2026" en vez de "1/3/2026" — por eso
    // formatDateLocal arma la fecha a mano en vez de usar el string directo.
    expect(formatDateLocal("2026-03-01")).toBe("1/3/2026");
  });

  it("devuelve un guion largo para entradas nulas o vacias", () => {
    expect(formatDateLocal(null)).toBe("—");
    expect(formatDateLocal(undefined)).toBe("—");
    expect(formatDateLocal("")).toBe("—");
  });

  it("devuelve el string original si la fecha suelta es invalida", () => {
    expect(formatDateLocal("no-es-una-fecha")).toBe("no-es-una-fecha");
  });
});
