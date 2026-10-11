import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regla R11 / R5 / R33 (rendimiento-stability): la config de cache y del SW es
// parte del estandar. Si alguien la toca sin querer, esto falla en CI.

const root = new URL("../", import.meta.url);
const read = (file: string): string => readFileSync(new URL(file, root), "utf8");

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

describe("vercel.json (R11)", () => {
  const { headers } = JSON.parse(read("vercel.json")) as { headers: HeaderRule[] };
  const cacheOf = (source: RegExp): string | undefined =>
    headers.find((h) => source.test(h.source))?.headers.find((x) => x.key === "Cache-Control")?.value;

  it("los assets con hash son immutable por 1 año", () => {
    const value = cacheOf(/^\/assets\//);
    expect(value).toContain("immutable");
    expect(value).toContain("max-age=31536000");
  });

  it("index.html y sw.js no tienen cache larga", () => {
    const value = cacheOf(/sw\\\.js/);
    expect(value).toContain("must-revalidate");
    expect(value).toContain("max-age=0");
  });

  it("las imágenes estáticas tienen cache con stale-while-revalidate", () => {
    expect(cacheOf(/webp/)).toContain("stale-while-revalidate");
  });

  it("la regla de imágenes no pisa a /assets/", () => {
    const imageRule = headers.find((h) => /webp/.test(h.source));
    expect(imageRule?.source).toContain("(?!assets/)");
  });
});

describe("vite.config.ts (R5, R33)", () => {
  const config = read("vite.config.ts");

  it("los chunks pesados quedan fuera del precache del SW", () => {
    for (const chunk of ["jspdf", "html2canvas", "vendor-charts"]) {
      expect(config).toMatch(new RegExp(`globIgnores[\\s\\S]*${chunk}`));
    }
  });

  it("el login precarga su chunk solo en /login (LCP)", () => {
    expect(config).toContain("preloadLoginRoute()");
    expect(config).toContain('location.pathname==="/login"');
  });

  it("console.error y console.warn se conservan en producción", () => {
    expect(config).not.toMatch(/drop:[^\n]*"console"/);
    expect(config).toContain('"console.log"');
  });
});

// R9 (rendimiento-stability): una <img> sin width/height reserva 0 px hasta que
// carga y empuja el contenido (CLS). Medido con Lighthouse: el logo del login
// movil sin tamano causaba 0,061 de CLS.
describe("imagenes con dimensiones (R9)", () => {
  it("todo <img src=\"/logo-nuevo-sinfondo.svg\"> declara width y height", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx$/.test(e.name) ? [path.join(dir, e.name)] : [],
      );
    const srcRoot = fileURLToPath(new URL("../src", import.meta.url));
    const offenders: string[] = [];
    for (const file of walk(srcRoot)) {
      const code = readFileSync(file, "utf8");
      for (const m of code.matchAll(/<img\b[^>]*?src="\/logo-nuevo-sinfondo\.svg"[\s\S]*?\/>/g)) {
        if (!/\bwidth=/.test(m[0]) || !/\bheight=/.test(m[0])) offenders.push(path.relative(srcRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
