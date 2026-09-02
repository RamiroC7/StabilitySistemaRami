import { describe, expect, it } from "vitest";
import { DOMAIN_PACKAGE } from "./index.js";

describe("@stability/domain placeholder", () => {
  it("expone el nombre del paquete", () => {
    expect(DOMAIN_PACKAGE).toBe("@stability/domain");
  });
});
