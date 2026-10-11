import { describe, expect, it } from "vitest";
import {
  isSectionComplete,
  translateActivityLevel,
  translateExperience,
  translateGender,
  translateGoal,
  type StudentProfileData,
} from "./profileData";

const full: StudentProfileData = {
  phone: "1155550000",
  birth_date: "1995-04-02",
  gender: "female",
  activity_level: "active",
  primary_goal: "health",
  training_experience: "beginner",
  sports: "natación",
  height_cm: 170,
  weight_kg: 65,
};

describe("profileData", () => {
  it("traduce los valores conocidos y deja pasar los desconocidos", () => {
    expect(translateGender("female")).toBe("Femenino");
    expect(translateActivityLevel("very_active")).toBe("Muy Activo");
    expect(translateGoal("readaptation")).toBe("Readaptación");
    expect(translateExperience("none")).toBe("Ninguna");
    expect(translateGoal("otro")).toBe("otro");
  });

  it("detecta secciones completas e incompletas", () => {
    expect(isSectionComplete(full, "personal")).toBe(true);
    expect(isSectionComplete(full, "training")).toBe(true);
    expect(isSectionComplete(full, "medical")).toBe(false);
    expect(
      isSectionComplete({ ...full, previous_injuries: "rodilla" }, "medical"),
    ).toBe(true);
    expect(isSectionComplete({ ...full, height_cm: undefined }, "personal")).toBe(
      false,
    );
    expect(isSectionComplete(null, "personal")).toBe(false);
    expect(isSectionComplete(full, null)).toBe(false);
  });
});
