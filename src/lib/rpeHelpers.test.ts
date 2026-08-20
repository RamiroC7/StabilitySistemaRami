import { describe, it, expect } from "vitest";
import { detectRpeAlert } from "./rpeHelpers";

describe("detectRpeAlert", () => {
  it("devuelve 'high' cuando los 3 ultimos RPE son >= 8", () => {
    expect(detectRpeAlert([8, 9, 10])).toBe("high");
  });

  it("devuelve 'low' cuando los 3 ultimos RPE son <= 3", () => {
    expect(detectRpeAlert([1, 2, 3])).toBe("low");
  });

  it("devuelve null cuando hay menos de 3 valores no nulos", () => {
    expect(detectRpeAlert([8, 9, null])).toBeNull();
    expect(detectRpeAlert([null, null, null])).toBeNull();
    expect(detectRpeAlert([])).toBeNull();
  });

  it("devuelve null cuando los 3 valores son una mezcla (ni todos altos ni todos bajos)", () => {
    expect(detectRpeAlert([9, 2, 5])).toBeNull();
    expect(detectRpeAlert([8, 8, 3])).toBeNull(); // 2 altos + 1 bajo: no cumple "los 3"
  });
});
