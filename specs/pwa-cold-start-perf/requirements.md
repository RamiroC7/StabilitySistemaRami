# Requirements: PWA cold-start performance — fase 1 (JS crítico + fuentes)

**Status:** Approved
**Last updated:** 2026-09-06

## Summary

Reducir el tiempo que tarda la PWA en volverse usable en un cold start en mobile,
atacando las dos causas de mayor impacto detectadas en el análisis del bundle de
producción: (1) `html2canvas` + `jspdf` se descargan en el critical path aunque
sólo se usan para exportar PDF, y (2) las fuentes web bloquean el render y se
piden duplicadas.

## Contexto / hallazgos que motivan esto

- Payload bloqueante actual (JS + CSS, gzip) en cold start ≈ **360 KB**.
- De eso, **`vendor-pdf` (html2canvas) ≈ 171 KB gzip (~47%)** entra por un bug de
  `manualChunks` en `vite.config.ts`: el helper interno `__vitePreload` (usado por
  cada `import()` de ruta lazy) quedó dentro del chunk `vendor-pdf`, así que el
  entry pasa a depender estáticamente de él y `dist/index.html` lo mete en
  `<link rel="modulepreload">`.
- `jspdf` sólo se importa desde `src/hooks/useExportPlanPDF.ts` y
  `src/components/MacrocycleTab.tsx`; `html2canvas` sólo desde
  `useExportPlanPDF.ts`. Ambos módulos son alcanzables únicamente por rutas lazy
  de coach (planificador, biblioteca, perfil de alumno).
- Fuentes:
  - `index.html` carga 3 `<link rel="stylesheet">` render-blocking: Lexend
    (300–700), Inter (300–700), Playfair Display (700).
  - `src/index.css` **además** hace 3 `@import url()` externos: Inter (400–700),
    Lexend (300–700), Material Symbols Outlined (eje variable completo).
    `@import` en CSS es bloqueante y en cascada (descarga index.css → descubre el
    import → recién ahí pide la fuente).
  - Lexend e Inter se piden **dos veces**.
  - **Playfair Display no se usa** en ningún lado (`font-serif` / la clave
    `serif` de Tailwind nunca se referencian; los únicos usos serif son stacks del
    sistema en ForgotPassword/ResetPassword).
  - Material Symbols Outlined **sí se usa** (decenas de componentes vía
    `.material-symbols-outlined`), pese al comentario en `index.html` que dice que
    se migró a lucide. No se elimina en esta fase.

## Goals

- Sacar `jspdf` y `html2canvas` del bundle que se descarga en el arranque; que
  sólo se bajen cuando el usuario dispara una exportación a PDF.
- Que `dist/index.html` deje de precargar (`modulepreload`) el chunk de PDF.
- Que las fuentes no bloqueen el primer render.
- Eliminar la doble carga de fuentes y la fuente no usada (Playfair).
- No romper ninguna funcionalidad existente: exportar plan a PDF, exportar
  macrociclo a PDF, y el render tipográfico de la app (headings Lexend, body
  Inter, íconos Material Symbols) siguen funcionando igual.

## Non-goals

- Migrar Material Symbols a lucide o self-hostear fuentes (fase posterior).
- Podar pesos individuales de Lexend/Inter sin una auditoría visual (se puede
  hacer después; esta fase sólo deduplica y quita lo que ya está muerto).
- Adelgazar el precache del Service Worker (era el punto #3 del análisis, queda
  para otra spec).
- Cambios en el flujo de auth / splash (punto #4).
- Optimizar `recharts` / otros vendors (ya están correctamente en lazy chunks).
- Meter un budget de bundle en CI o herramienta de análisis permanente.

## User stories

### US-1: PDF fuera del critical path

Como usuario que abre la PWA en el celular, quiero que la app cargue sin
descargar la librería de PDF, para que esté lista para usar más rápido.

**Acceptance criteria (EARS):**

- WHEN se hace el build de producción THE SYSTEM SHALL generar `dist/index.html`
  sin ningún `<link rel="modulepreload">` que apunte al chunk que contiene
  `html2canvas` o `jspdf`.
- WHEN se hace el build de producción THE SYSTEM SHALL emitir `html2canvas` y
  `jspdf` en chunks que ningún módulo del critical path (entry ni sus imports
  estáticos) importe de forma estática.
- WHEN el usuario carga cualquier ruta que no sea de exportación (login, home de
  alumno, home de coach) THE SYSTEM SHALL no solicitar los chunks de `html2canvas`
  ni de `jspdf`.
- WHEN el usuario dispara "exportar plan a PDF" desde la biblioteca THE SYSTEM
  SHALL cargar dinámicamente `jspdf` + `html2canvas` y generar el PDF con el mismo
  resultado que hoy (mismo contenido, mismo nombre de archivo `<titulo>.pdf`).
- WHEN el usuario dispara "exportar macrociclo a PDF" desde el perfil de alumno
  THE SYSTEM SHALL cargar dinámicamente `jspdf` y generar el PDF igual que hoy.
- IF la carga dinámica de `jspdf`/`html2canvas` falla (red caída) THEN THE SYSTEM
  SHALL dejar de mostrar el estado "exportando" y no dejar la UI colgada.
- THE SYSTEM SHALL mantener el estado `isExporting` correcto (true mientras
  genera, false al terminar o al fallar) para que el botón no quede deshabilitado.

### US-2: Fuentes que no bloquean el render

Como usuario que abre la PWA, quiero ver la interfaz apenas carga el HTML, sin
esperar a que bajen las fuentes, para que la app se sienta instantánea.

**Acceptance criteria (EARS):**

- THE SYSTEM SHALL solicitar cada familia de fuente (Lexend, Inter, Material
  Symbols Outlined) una sola vez.
- THE SYSTEM SHALL NOT solicitar Playfair Display.
- WHEN el navegador parsea el `<head>` THE SYSTEM SHALL no bloquear el primer
  render esperando la descarga de las hojas de estilo de fuentes (carga
  asíncrona / no bloqueante).
- THE SYSTEM SHALL NOT usar `@import url()` a hosts externos dentro de
  `src/index.css`.
- WHILE las fuentes web todavía no cargaron THE SYSTEM SHALL renderizar el texto
  con la fuente de fallback del sistema (`font-display: swap` o equivalente), sin
  texto invisible.
- WHEN las fuentes web terminan de cargar THE SYSTEM SHALL aplicar Lexend a los
  headings (`font-display`), Inter al body (`font-sans`) y Material Symbols a los
  íconos, igual que hoy.
- WHERE el navegador no ejecuta JS THE SYSTEM SHALL igualmente cargar las fuentes
  (fallback `<noscript>`).

## Constraints

- No requiere migración de base de datos.
- Mantener compatibilidad con el Service Worker / `vite-plugin-pwa` existente
  (Workbox cachea `woff2` y las stylesheets de Google Fonts vía `runtimeCaching`
  ya configurado — no romper esos patrones).
- Mantener los `preconnect` a `fonts.googleapis.com` / `fonts.gstatic.com`.
- El build (`npm run build`) y los tests (`npm run test`) deben seguir pasando.
- Cambios mínimos y localizados: `vite.config.ts`, `index.html`,
  `src/index.css`, `src/hooks/useExportPlanPDF.ts`,
  `src/components/MacrocycleTab.tsx`, `tailwind.config.js` (quitar `serif`).

## Open questions

- Ninguna que bloquee el diseño. (El pruning de pesos de fuente y el reemplazo de
  Material Symbols quedan explícitamente fuera de scope.)
