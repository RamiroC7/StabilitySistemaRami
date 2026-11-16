import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  STATIC_NEWS_VERSIONS,
  currentNewsVersion,
  hasAnyUnseenNews,
  hasUnseenNews,
  markNewsSeen,
} from "./communityNews";

// Mini localStorage en memoria (el entorno de tests es node).
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: Pick<Storage, "getItem" | "setItem"> }).localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
  };
});

const original = { ...STATIC_NEWS_VERSIONS };
afterEach(() => Object.assign(STATIC_NEWS_VERSIONS, original));

const nov = new Date(2026, 10, 15);
const dic = new Date(2026, 11, 2);

describe("communityNews", () => {
  it("ranking: hay novedad hasta que se entra, y vuelve a aparecer el mes siguiente", () => {
    expect(currentNewsVersion("ranking", nov)).toBe("2026-11");
    expect(hasUnseenNews("ranking", nov)).toBe(true);
    markNewsSeen("ranking", nov);
    expect(hasUnseenNews("ranking", nov)).toBe(false);
    expect(hasUnseenNews("ranking", dic)).toBe(true);
  });

  it("videos/bonificaciones sin versión: nunca muestran puntito", () => {
    expect(hasUnseenNews("videos", nov)).toBe(false);
    expect(hasUnseenNews("bonificaciones", nov)).toBe(false);
  });

  it("al cambiar la versión de una sección aparece el puntito, y se va al entrar", () => {
    STATIC_NEWS_VERSIONS.videos = "2026-11-20";
    expect(hasUnseenNews("videos", nov)).toBe(true);
    markNewsSeen("videos", nov);
    expect(hasUnseenNews("videos", nov)).toBe(false);
    STATIC_NEWS_VERSIONS.videos = "2026-12-05";
    expect(hasUnseenNews("videos", nov)).toBe(true);
  });

  it("hasAnyUnseenNews refleja cualquier sección con novedad", () => {
    expect(hasAnyUnseenNews(nov)).toBe(true);
    markNewsSeen("ranking", nov);
    expect(hasAnyUnseenNews(nov)).toBe(false);
  });

  it("si localStorage falla no rompe (muestra el puntito)", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(hasUnseenNews("ranking", nov)).toBe(true);
    expect(() => markNewsSeen("ranking", nov)).not.toThrow();
  });
});
