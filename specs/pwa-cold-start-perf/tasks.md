# Tasks: PWA cold-start performance — fase 1 (JS crítico + fuentes)

**Status:** Done
**Last updated:** 2026-09-06
**Design:** [design.md](./design.md)

Aprobación: requirements ✅, design ✅, tasks-gate saltado por pedido explícito del
usuario. Implementado en orden.

- [x] **T1 — `useExportPlanPDF.ts`: import dinámico de jspdf + html2canvas**
  Satisface: US-1
  Hecho: quitados los imports estáticos; `generatePdfFromElement` ahora hace
  `await Promise.all([import("jspdf"), import("html2canvas")])` al inicio. No hay
  type annotations a nivel módulo → sin cambios de tipos.

- [x] **T2 — `MacrocycleTab.tsx`: import dinámico de jspdf**
  Satisface: US-1
  Hecho: quitado `import jsPDF from "jspdf"`; `exportMacrocyclePDF` arranca con
  `const { default: jsPDF } = await import("jspdf")`.

- [x] **T3 — `vite.config.ts`: eliminar rama `vendor-pdf` de `manualChunks`**
  Satisface: US-1
  Hecho: bloque reemplazado por comentario explicando por qué NO se agrupan.

- [x] **T4 — `index.html`: fuentes en 1 request no bloqueante, sin Playfair**
  Satisface: US-2
  Hecho: 3 `<link>` bloqueantes → `preload as=style` + `link media="print" onload`
  + `noscript`, URL combinada Inter+Lexend+Material Symbols. `preconnect` y
  `preload` del logo intactos.

- [x] **T5 — `src/index.css`: quitar los 3 `@import url()` externos**
  Satisface: US-2
  Hecho: borradas; `@tailwind base;` es la primera regla. `.material-symbols-outlined`
  sin tocar.

- [x] **T6 — `tailwind.config.cjs`: quitar key `serif` muerta**
  Satisface: US-2
  Hecho.

- [x] **T7 — Verificar manejo de error de `import()` en export**
  Satisface: US-1
  Resultado: `exportPDF` (RoutineList) ya estaba cubierto — `try/finally` interno
  + `toast.promise` consume el rechazo. `MacrocycleTab.handleExportPDF` **NO**
  estaba cubierto: `.finally()` no consume el rechazo → habría quedado una
  unhandled rejection si `import("jspdf")` fallara offline. Se agregó un
  `.catch(err => console.error(...))` antes del `.finally()` (mismo estilo que el
  resto del archivo). `setExportingPDF(false)` corre igual.

- [x] **T8 — Build + verificación de bundle**
  Satisface: US-1, US-2
  Resultado (`npm run build`, `dist/`):
  1. `dist/index.html` `modulepreload` = sólo vendor-react/router/ui/supabase. **Sin vendor-pdf.** ✓
  2. Entry (`index-*.js`) no importa estáticamente jspdf/html2canvas/index.es. ✓
  3. Chunks async separados: `jspdf.es.min` (124 KB gz), `html2canvas.esm`
     (46 KB gz), `index.es` (52 KB gz) — sólo se bajan al exportar. ✓
  4. `dist/index.html`: 1 sola request de fuentes, sin `Playfair`. ✓
  5. `dist/assets/*.css` no arranca con `@import url("https://fonts`. ✓
  6. **Payload bloqueante JS+CSS gzip: ~360 KB → ~185 KB (−49%).**

- [x] **T9 — Typecheck + tests**
  `npx tsc -b --noEmit` → 0 errores. `npm run test` → 17 files / 72 tests pass.
  `eslint` sobre los archivos tocados → 0 warnings.

- [x] **T10 — Smoke test en el preview server**
  Dev server reiniciado (cambio de `vite.config.ts` + `index.html`). App carga,
  redirige a `/login`, render OK, **0 errores de consola**. `document.fonts`:
  sólo Inter, Lexend, Material Symbols Outlined registradas; Playfair NO se pide;
  1 sola request a `fonts.googleapis.com/css2`; el `<link media="print">` pasó a
  `media="all"` (el `onload` swap funcionó).
  Nota: las páginas de coach (que usan `.material-symbols-outlined` y
  `font-display`/Lexend) requieren login y no se probaron en runtime; el riesgo es
  bajo — el `@font-face` de Material Symbols viene de la misma URL con el eje
  idéntico y la clase CSS quedó intacta.

## Resultado

| Métrica | Antes | Después |
|---|---|---|
| JS+CSS bloqueante (gzip) | ~360 KB | ~185 KB |
| `html2canvas` en critical path | Sí (171 KB gz) | No |
| Requests de fuentes | 6 (3 `<link>` + 3 `@import`), bloqueantes | 1, no bloqueante |
| Playfair Display | Se descargaba | Eliminada |

## Seguimiento (fuera de scope, para otra spec)

- Adelgazar el precache del SW (sigue en 87 entradas / 4.2 MB).
- Podar pesos de Inter/Lexend con auditoría visual (hoy 300–700 de ambas).
- Evaluar self-hostear las fuentes.
- Migrar `.material-symbols-outlined` a lucide (ya empezado, quedó a medias).
- Render optimista desde el estado persistido en `RequireAuth`.
