import { describe, expect, it } from "vitest";
import { avatarSrc, DEFAULT_AVATAR } from "./avatar";

const original =
  "https://abc.supabase.co/storage/v1/object/public/profile-images/u1/avatar-1.jpeg";

describe("avatarSrc (R7/R9)", () => {
  it("pide la imagen transformada al doble del tamano CSS", () => {
    const url = avatarSrc(original, 56);
    expect(url).toContain("/storage/v1/render/image/public/profile-images/u1/avatar-1.jpeg");
    expect(url).toContain("width=112&height=112&resize=cover");
    expect(url).not.toContain("/object/public/");
  });

  it("deja pasar URLs ajenas y usa la predeterminada si no hay foto", () => {
    expect(avatarSrc("https://ui-avatars.com/api/?name=A", 56)).toBe(
      "https://ui-avatars.com/api/?name=A",
    );
    expect(avatarSrc(null, 56)).toBe(DEFAULT_AVATAR);
    expect(avatarSrc(undefined, 56)).toBe(DEFAULT_AVATAR);
    expect(avatarSrc("", 56)).toBe(DEFAULT_AVATAR);
  });
});
