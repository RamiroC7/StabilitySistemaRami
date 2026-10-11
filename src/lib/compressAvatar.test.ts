import { describe, expect, it } from "vitest";
import { AVATAR_MAX_PX, fitWithin } from "./compressAvatar";

describe("fitWithin (R35)", () => {
  it("achica una foto de celular al maximo, manteniendo la proporcion", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: AVATAR_MAX_PX, height: 240 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 240, height: AVATAR_MAX_PX });
  });

  it("no agranda las imagenes chicas", () => {
    expect(fitWithin(200, 100)).toEqual({ width: 200, height: 100 });
  });

  it("nunca devuelve 0 px", () => {
    expect(fitWithin(10000, 1).height).toBeGreaterThanOrEqual(1);
  });
});
