# RENDIMIENTO.md — Auditoría y estándar de rendimiento de Stability

> **Estado: IMPLEMENTADO** — 26 de 27 hallazgos resueltos, 1 parcial (`D-04`) y oportunidades abiertas en la sección 7. Lo resuelto está tachado (~~así~~) en las secciones 2 a 5. Reglas vigentes y cómo se verifican: `.claude/skills/rendimiento-stability/SKILL.md`.
> Este documento tiene dos partes:
> 1. **Hallazgos** (secciones 2 a 5): todo lo que hay que corregir, con ubicación, problema, arreglo propuesto e impacto.
> 2. **Estándar** (sección 6): las reglas que todo cambio futuro debe cumplir. Cada regla nace de un hallazgo; pasa a ser **obligatoria** cuando el hallazgo correspondiente se marca como resuelto en la sección 7.
>
> Fecha de la auditoría: 2026-10-10. Rama: `main` (commit `3c45a31`).
> Alcance: frontend (Vite + React 19 + Zustand + Supabase), PWA/Service Worker, assets, y base de datos Supabase (proyecto `hcvytsitbsandaphsxyn`).
>
> **Importante sobre la confianza de los datos:** lo medido (build, advisors de Supabase, lectura de código) está marcado como tal. Lo que es hipótesis o falta medir está marcado **[A VERIFICAR]**. No se midió el rendimiento en runtime (Lighthouse / DevTools / EXPLAIN ANALYZE); eso es parte de la implementación (sección 7, Fase 0).

---

## 1. Línea base medida

Medido con `npx vite build` (build de producción, 1m 2s) y con los advisors de rendimiento de Supabase.

### 1.1 Bundle (tamaño sin gzip, salvo donde se indica)

| Chunk | Tamaño | Se carga | Comentario |
|---|---|---|---|
| `vendor-charts` (recharts) | 393 kB (114 kB gz) | Async, solo dashboard | Hoy se **prefetchea para todos** (ver P1-02) |
| `jspdf.es.min` | 386 kB (126 kB gz) | Async, solo exportar PDF | |
| `html2canvas.esm` | 200 kB (47 kB gz) | Async, solo exportar PDF | |
| `vendor-react` | 195 kB | Crítico (entry) | Inevitable |
| `vendor-supabase` | 168 kB | Crítico (entry) | |
| `index.es` | 159 kB | Async (dependencia de jspdf) | |
| `vendor-forms` (RHF + zod) | 92 kB | Login / registro | |
| `vendor-router` | 86 kB | Crítico (entry) | |
| `vendor-ui` (lucide, radix, sonner, zustand…) | 83 kB | Crítico (entry) | |
| `StudentProfile` | 81 kB | Ruta | |
| `NewPlan` | 73 kB | Ruta | |
| `BusinessMetrics` | 67 kB | Ruta | |
| `vendor-dnd` | 50 kB | Planificador | |
| `index` (entry app) | 34 kB | Crítico | |
| CSS (`index-*.css`) | 117 kB | Crítico | Un solo archivo Tailwind |

- **Ruta crítica de JS** (entry + react + router + ui + supabase): ≈ 566 kB sin gzip. Está razonablemente bien partida; el code-splitting por ruta ya existe y funciona.
- **Precache del Service Worker:** 87 entradas, **4.288 kB** (se descarga al instalar la PWA).
- **`public/`:** 6,1 MB. **`dist/`:** 17 MB.

### 1.2 Base de datos (advisors de Supabase, tipo `performance`)

| Lint | Cantidad |
|---|---|
| `auth_rls_initplan` (WARN) | **54** policies |
| `multiple_permissive_policies` (WARN) | **19** |
| `unindexed_foreign_keys` (INFO) | **8** |
| `unused_index` (INFO) | **4** |

### 1.3 Conteos de código relevantes

| Métrica | Valor |
|---|---|
| Archivos `.ts/.tsx` en `src` | 125 (≈ 32.700 líneas) |
| `React.memo` | **0** |
| `useMemo` / `useCallback` | 13 / 63 |
| `useState` / `useEffect` | 302 / 124 |
| `<img>` sin `loading=` | 36 de 36 (algunos ya lo tienen inline en otra línea; ver P1-05) |
| `.select("*")` | 8 |
| `.limit()` / `.range()` | 3 en total |
| Llamadas `.from(` a Supabase | 127 |
| Componentes > 1.000 líneas | `StudentProfile` (1.643), `NewPlan` (1.392), `TrainingProfile` (1.041), `MacrocycleTab` (1.004) |

---

## 2. Hallazgos P0 — Corrección + rendimiento (resolver primero)

Estos afectan **resultados incorrectos** o **fallas** a medida que crecen los datos, además de velocidad.

### ~~P0-01 — Consultas sin límite: truncamiento silencioso a 1.000 filas~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): `StudentsList` usa la RPC `get_students_alerts`; `useBusinessMetrics` lee `profiles`/`workout_completions`/`training_plan_assignments` con `fetchAllRows` (paginado, en paralelo); `useWorkoutCompletions` también pagina. Test: `supabasePagination.test.ts` + e2e `students-list`.

**Dónde:**
- `src/hooks/useBusinessMetrics.ts:629-670` — baja **toda** la tabla `workout_completions`, **toda** `training_plan_assignments` y todos los `profiles` de alumnos, y calcula las métricas en el navegador.
- `src/features/students/StudentsList.tsx:~96` — pide **todos** los `workout_completions` de **todos** los alumnos, ordenados por fecha, solo para quedarse con los últimos 3 `rpe` por alumno.
- `src/hooks/useWorkoutCompletions.ts:107` — todas las completions de un alumno, sin límite.

**Problema:** PostgREST/Supabase aplica un tope de filas por request (por defecto 1.000 **[A VERIFICAR** el `max_rows` del proyecto]). Al superarlo, el resultado se **corta sin error**: el dashboard y las alertas RPE pasarían a mostrar números incorrectos sin que nadie lo note. Además, el costo de red/memoria/CPU crece linealmente con el historial.

**Arreglo propuesto:** mover la agregación a la base con RPC/vistas (ver D-06): métricas del dashboard por mes, "últimos 3 RPE por alumno" (`row_number() over (partition by student_id order by completed_at desc)`), conteos de asistencia. Para listas por alumno, paginar o limitar por ventana de fechas.
**Impacto:** alto (correctitud + payload + tiempo de carga del dashboard e inicio).

### ~~P0-02 — `.in("…", studentIds)` con cientos de UUID rompe por largo de URL~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): `fetchStudents` usa la RPC `get_students_overview` (1 request, sin ids en la URL). Test e2e: ninguna request trae `in.(` ni baja `workout_completions`.

**Dónde:** `src/store/dataCacheStore.ts:~340-360` (`fetchStudents`) y `StudentsList.tsx` (alertas): se arma un `.in("id", [...todos los ids])` y `.in("student_id", [...])`.

**Problema:** cada UUID ocupa ~36 caracteres en la query string. Con unos pocos cientos de alumnos la URL supera el límite típico (~8 kB en proxies/CDN) y el request falla (**[A VERIFICAR]** el umbral exacto en este stack). Hoy puede no verse por pocos alumnos.

**Arreglo propuesto:** un único query con join embebido (`profiles` → `student_profiles` + `training_plan_assignments`) o una RPC `get_students_overview()` que devuelva todo ya combinado, sin listas de ids en la URL.
**Impacto:** alto (evita falla futura) + reduce 3 round-trips a 1.

---

## 3. Hallazgos P1 — Frontend: carga inicial y red

### ~~P1-01 — Material Symbols completo (fuente variable con ejes FILL y wght)~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): Medido: la fuente completa pesaba **1.138 kB**; recortada a los íconos usados y a los ejes fijos (FILL 0, wght 400) pesa **12 kB** (−99 %). Hallazgo extra: `icon_names` **no** puede mezclarse con Inter/Lexend en el mismo request (Google recorta también sus glifos), por eso son dos requests. Verificado en navegador (`e2e/fonts.e2e.ts`, con negativo comprobado) y `npm run check:icons` en CI.

**Dónde:** `index.html:319-330` carga `Material+Symbols+Outlined:wght,FILL@100..700,0..1` completo. Se usa en **263** lugares (`material-symbols-outlined`), con nombres tanto estáticos como dinámicos (`BusinessMetrics.tsx:443` `{item.icon}`, arrays de `icon:` en `StudentProfile.tsx`, etc.).

**Problema:** se descarga la fuente de **todos** los íconos (miles) con dos ejes variables, para usar ~70. Es muy probablemente el asset de mayor peso de la ruta crítica visual **[A VERIFICAR el tamaño real en Network]**. Además hay dos sistemas de íconos a la vez (también se usa `lucide-react` en 42 imports).

**Arreglo propuesto (elegir uno, medir antes/después):**
1. Subset con `&icon_names=a,b,c…` en la URL de Google Fonts (ordenado alfabéticamente), generando la lista con un script que recorra `src/` (incluyendo nombres dinámicos), y fijando los ejes que realmente se usen (probablemente solo `FILL` 0/1 y un `wght`).
2. Self-host del subset (`woff2`) con `<link rel="preload" as="font" crossorigin>`.
3. Migrar a `lucide-react` (ya es dependencia) y eliminar la fuente. Es el más limpio pero el más largo.

**Riesgo:** nombres de ícono dinámicos que no estén en la lista dejarían texto plano (ej. "light_mode") en pantalla. Hay que cubrirlo con un test/script que falle si aparece un nombre no incluido.
**Impacto:** alto en first paint/LCP.

### ~~P1-02 — Prefetch de rutas no distingue rol y baja recharts para todos~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): Prefetch por rol, en idle y respetando `saveData`/2g; `BusinessMetrics` no se precarga. Test e2e `prefetch por rol` (verificado que falla con el código viejo).

**Dónde:** `src/App.tsx:23-34` — a los 1,5 s hace `import()` de **todas** las rutas de coach y de alumno, incluida `BusinessMetrics` (arrastra `vendor-charts`, 393 kB).

**Problema:** un alumno en el celular baja el dashboard del coach y todas las pantallas de coach que nunca va a abrir (y viceversa). Compite por ancho de banda justo después del arranque, no respeta ahorro de datos y no espera a que el navegador esté ocioso.

**Arreglo propuesto:** prefetch **por rol** (leer `professor.role`), con `requestIdleCallback` (fallback a `setTimeout`), omitido si `navigator.connection.saveData` o red 2g; **quitar `BusinessMetrics`** del prefetch automático (cargarlo al hover/focus del ítem del menú).
**Impacto:** medio-alto (≈ 0,4–1 MB menos de transferencia temprana según el rol; **[A VERIFICAR]** en Network).

### ~~P1-03 — Precache del Service Worker incluye chunks pesados de uso puntual~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): `workbox.globIgnores` para jspdf/html2canvas/vendor-charts/index.es/purify. Precache: 4.288 → **2.067 kB**. `check:perf`.

**Dónde:** `vite.config.ts:76` (`globPatterns` incluye todo `js`).

**Problema:** instalar la PWA descarga **4,29 MB**, incluyendo `jspdf` (386 kB), `html2canvas` (200 kB), `vendor-charts` (393 kB), `index.es` (159 kB) y `purify.es` (22 kB): ≈ 1,16 MB que solo se usan al exportar un PDF o abrir el dashboard.

**Arreglo propuesto:** `workbox.globIgnores` para esos chunks. Ya existe un `runtimeCaching` de JS con `StaleWhileRevalidate`, así que se cachean la primera vez que se usan. **Trade-off a documentar:** la exportación a PDF/dashboard no funcionaría offline hasta la primera vez que se usaron.
**Impacto:** medio (primera instalación y cada actualización del SW).

### ~~P1-04 — `updateActivity` escribe en localStorage en cada scroll/touch~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): Throttle de 1/min en `updateActivity`. Tests: unit `authStore.test.ts` + e2e (600 eventos → ≤ 1 escritura; antes 600).

**Dónde:** `src/features/auth/store/authStore.ts:~170` registra listeners globales de `mousedown`, `keypress`, `scroll`, `touchstart` que llaman a `updateActivity()` → `set({ lastActivity })`, y `lastActivity` está en `partialize` del `persist` (`authStore.ts:~653`).

**Problema:** cada evento (el `scroll` y `touchstart` disparan decenas por segundo) produce un `set()` ⇒ **escritura síncrona a `localStorage`** (serializa `professor` completo) + notificación a todos los suscriptores del store. Es trabajo en el hilo principal durante el scroll, justo cuando más importa la fluidez. Y la funcionalidad que lo justificaba (auto-logout por inactividad) está **deshabilitada** (comentado en el propio código).

**Arreglo propuesto:** throttle a 1 vez por minuto como mínimo; idealmente eliminar los listeners y `lastActivity` del `persist` mientras el auto-logout siga deshabilitado.
**Impacto:** medio, notable en celulares de gama media/baja durante scroll.

### ~~P1-05 — Imágenes sin `loading="lazy"` / `decoding="async"` / dimensiones~~ ✅ RESUELTO (reformulado)

> ✅ **RESUELTO (reformulado)** (2026-10-10): Al revisar las 36 `<img>`, casi todas ya tenían tamaño por clases CSS (no generan CLS): lo de `width`/`height` estaba sobreestimado. Lo real: las listas/modales sin `lazy` (arreglado) y **la foto de Unsplash (170 kB) del panel `hidden lg:flex` de login/recuperar/actualizar contraseña, que los celulares descargaban sin mostrarla**. Ahora `loading="lazy"`; e2e en las 3 pantallas (falla sin el fix).

**Dónde:** 36 `<img>` en `src/` (listas: `AssignedStudentsModal`, `AssignPlanModal`, `PlanExpirations`, `NewsRanking`, `NewsVideos`, `NewsAboutUs`, avatares).

**Problema:** las imágenes fuera de pantalla compiten por red con las críticas y no hay `width/height`, lo que causa **layout shift (CLS)**. (Algunos ya tienen `loading="lazy"` en una línea posterior, como `StudentsList.tsx:31`/`NewsAboutUs.tsx:132`; revisar uno por uno antes de aplicar para no duplicar props.)
**Arreglo propuesto:** `loading="lazy" decoding="async"` + `width`/`height` (o `aspect-ratio`) en todas las que no estén en el primer viewport. **Excluir** `PlanPDFTemplate` (la usa `html2canvas`; lazy rompería el PDF).
**Impacto:** medio.

### ~~P1-06 — Assets sin uso en `public/` (y en el precache)~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): Borrados 7 PNG + `login.webp` sin referencias. `check:perf` detecta assets huérfanos nuevos.

**Dónde (sin ninguna referencia en `src/`, `index.html`, `api/`, `vite.config.ts`):** `login.png`, `1er-puesto.png`, `2do-puesto.png`, `3er-puesto.png`, `logo-viejo-confondo.png`, `logo-viejo-sf.png`, `logo-viejo-sinfondo.png`. El código usa las versiones `.webp`.

**Problema:** ≈ **1,7 MB** de fuente (≈ 548 kB tras el optimizador) que se publican y entran al precache (`png` está en `globPatterns`).
**Arreglo propuesto:** borrarlos de `public/` (siguen en el historial de git).
**Impacto:** bajo-medio, cero riesgo.

### ~~P1-07 — Imágenes de estado de ánimo demasiado pesadas~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): Imágenes de ánimo 790 → 214 kB. Tope de 150 kB por imagen en `check:perf`.

**Dónde:** `contento.webp` (≈ 252 kB), `neutro.webp` (≈ 269 kB), `triste.webp` (≈ 235 kB) tras optimizar; usadas en `MoodCheckScreen` y `WorkoutCalendar` en tamaños chicos (`w-*`/`h-*` de tarjeta).
**Arreglo propuesto:** redimensionar a ~2× del tamaño de render máximo, recomprimir (webp q≈75 / avif), o pasarlas a SVG si son ilustraciones planas.
**Impacto:** medio en la pantalla de check-in del alumno (≈ 750 kB entre las tres).

### ~~P1-08 — Headers de caché solo para 2 imágenes~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): Headers en `vercel.json` (`/assets/*` immutable). Test `scripts/perfConfig.test.ts`. **[A VERIFICAR]** con `curl -I` tras el próximo deploy.

**Dónde:** `vercel.json` define `Cache-Control` solo para `team-(agus|juan).webp`.
**Problema:** los assets con hash (`/assets/*`) deberían servirse `immutable` por 1 año; las imágenes de `public/` con caché larga. **[A VERIFICAR]** con `curl -I` en producción qué headers reciben hoy (Vercel tiene defaults, pero no son `immutable`).
**Arreglo propuesto:** `/assets/(.*)` → `public, max-age=31536000, immutable`; imágenes/íconos estáticos → `max-age` largo + SWR; `sw.js` y `index.html` → `no-cache`.
**Impacto:** medio en visitas repetidas.

### ~~P1-09 — Fuentes: 10 pesos cargados~~ ✅ CERRADO (sin acción)

> ✅ **CERRADO (sin acción)** (2026-10-10): Medido: Inter y Lexend son fuentes variables; los 5 pesos comparten archivos (10 archivos / ≈ 300 kB sumando todos los subsets unicode-range; el navegador baja solo los que usa). No era un problema.

**Dónde:** `index.html:319` — Inter `300;400;500;600;700` y Lexend `300;400;500;600;700`.
**Problema:** cada peso es un archivo. **[A VERIFICAR]** qué pesos usa realmente el CSS/Tailwind (`font-light`, `font-semibold`, etc.) y cuántos se descargan en la práctica.
**Arreglo propuesto:** dejar solo los pesos usados; considerar fuente variable o self-host con `preload` del peso principal.
**Impacto:** bajo-medio.

### ~~P1-10 — Sentry se inicializa de forma síncrona en el entry~~ ✅ CERRADO (medido, sin acción)

> ✅ **CERRADO (medido, sin acción)** (2026-10-10): Con `rollup-plugin-visualizer`: Sentry en el entry es solo `@sentry/core` (≈ 35 kB sin minificar dentro de un entry de 35 kB minificado, ≈ 10 kB gz). Diferirlo no compensa. Hallazgo nuevo: `realtime-js` es 18 % de `vendor-supabase` y ya no se usa, pero `supabase-js` lo incluye siempre (no se puede quitar sin cambiar de cliente).

**Dónde:** `src/App.tsx:12` (`initSentry()` a nivel de módulo) + `import * as Sentry from "@sentry/react"` en `src/lib/sentry.ts`.
**Problema:** `@sentry/react` es una dependencia grande en el camino crítico **[A VERIFICAR cuánto pesa dentro del entry/vendor con `rollup-plugin-visualizer`]**.
**Arreglo propuesto:** evaluar carga diferida (`import()` en idle, con cola de errores tempranos) o `@sentry/browser` con integraciones mínimas. **No** sacrificar captura de errores de arranque sin decidirlo explícitamente.
**Impacto:** a medir.

---

## 4. Hallazgos P2 — Frontend: render y estado

### ~~P2-01 — Cero `React.memo`; listas sin memoización ni virtualización~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): `StudentCard` memoizado + `useMemo` + `useDeferredValue`. e2e `students-list`. La virtualización queda para cuando haya > 100 alumnos (hoy 39).

**Dónde:** toda la app (`React.memo`: 0 usos). Caso claro: `StudentsList.tsx` (~líneas 63-75 y 267+) recalcula `filter` + copia + `sort` en **cada render** (sin `useMemo`), filtra en cada tecla del buscador (sin debounce / `useDeferredValue`) y renderiza todas las tarjetas inline (sin componente `StudentCard` memoizado) en una grilla sin virtualización.
**Problema:** cualquier `setState` del padre (llegan los `rpeAlerts`, `attendanceAlerts`, el buscador) re-renderiza **todas** las tarjetas. Escala mal con la cantidad de alumnos.
**Arreglo propuesto:** extraer `StudentCard` con `React.memo`; `useMemo` para filtrado/orden; `useDeferredValue` en el buscador; considerar virtualización si la lista supera ~100 ítems. Regla general en la sección 6.
**Impacto:** medio-alto con listas grandes.

### ~~P2-02 — Componentes monolíticos con mucho estado local~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): `StudentProfile` ya separaba cada pestaña en su componente con estado propio (no era “todo se re-renderiza”): el costo era que todo se descargaba junto. `MacrocycleTab`, `FeedbackModal` y `PlanPreview` ahora son `lazy()`: chunk **81 → 47 kB** (−42 %). `NewPlan` se descarta a propósito: sus modales están siempre montados con `isOpen`; diferirlos exige un patrón extra con riesgo de comportamiento para ahorrar ≈ 25 kB sin minificar. `TrainingProfile` se dividió: **1.041 → 190 líneas** + 7 módulos en `features/training/profile/` (cada uno ≤ 209 líneas: `ProfileCard`, `PersonalSection`, `MedicalSection`, `TrainingSection`, `ProfileHeader`, hook `useProfileImageUpload`, `profileData` con tipos/traducciones/cache), con test unitario de la lógica extraída (`profileData.test.ts`).

**Dónde:** `StudentProfile.tsx` (1.643 líneas), `NewPlan.tsx` (1.392), `TrainingProfile.tsx` (1.041), `MacrocycleTab.tsx` (1.004).
**Problema:** con tanto `useState` en un solo componente, cada cambio re-renderiza el árbol completo de la pantalla; además son difíciles de optimizar. En `NewPlan` hay listeners de `mousemove`/`mouseup` (`NewPlan.tsx:732`) que actualizan estado durante el arrastre.
**Arreglo propuesto:** dividir por secciones/pestañas (cada una con su estado), mover estado de formularios al componente hoja, y para el drag usar refs/`requestAnimationFrame` en vez de estado por `mousemove`. Cargar pestañas pesadas (`MacrocycleTab`, historial) con `lazy()`.
**Impacto:** medio-alto en esas pantallas.

### ~~P2-03 — Suscripciones realtime amplias que disparan refetch en cascada~~ ✅ RESUELTO (por eliminación)

> ✅ **RESUELTO (por eliminación)** (2026-10-10): La publicación `supabase_realtime` **no tiene ninguna tabla**, así que las 4 suscripciones nunca recibían eventos. Se quitaron de `useMonthlyRanking`, `usePlanFolders` y `useExerciseWeightLogs` (menos websockets/canales, mismo comportamiento real). Si se quiere realtime de verdad: agregar la tabla a la publicación **y** volver a suscribir con `filter` + debounce (regla R24).

**Dónde:**
- `src/hooks/useMonthlyRanking.ts:105` — escucha `event: "*"` de **toda** la tabla `workout_completions` (sin filtro) y, ante **cada** cambio de **cualquier** alumno, hace refetch del ranking en **todos** los clientes con la pantalla abierta (efecto "thundering herd"). Además hace un refetch "silencioso" al montar aunque ya esté cacheado.
- `src/hooks/usePlanFolders.ts:49` — `event: "*"` sobre `plan_folders` hace `fetchFolders()` completo ante cada cambio; y escucha `UPDATE` de **todos** los `training_plans` de la plataforma.
**Arreglo propuesto:** para el ranking, invalidar con *debounce* (p. ej. 2–5 s) o recalcular en servidor y refrescar por intervalo/`stale-while-revalidate`; para carpetas, aplicar el cambio del payload al estado local en vez de refetch completo; filtrar por `coach_id`/`id` donde se pueda.
**Impacto:** medio (carga en DB y red proporcional a usuarios × actividad).

### ~~P2-04 — Auto-refresh de Landing Analytics cada 15 s~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): Auto-refresh pausado con la pestaña oculta y refresco al volver.

**Dónde:** `src/hooks/useLandingAnalytics.ts:~500` (`setInterval` 15.000 ms).
**Problema:** **[A VERIFICAR]** si se pausa cuando la pestaña no está visible (`document.visibilityState`) y si hace *backoff* ante errores. Si no, consume red y DB en segundo plano.
**Arreglo propuesto:** pausar en `visibilitychange`, y subir el intervalo o usar realtime puntual.
**Impacto:** bajo-medio.

### ~~P2-05 — Caché de datos sin vencimiento ni deduplicación fuerte~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): TTL (5 min alumnos/planes, 30 min categorías) + stale-while-revalidate: invalidar ya no vacía la lista y los hooks solo muestran “loading” si no hay nada para mostrar. Test unit `dataCacheStore.test.ts` (TTL, dedupe, no vaciar).

**Dónde:** `src/store/dataCacheStore.ts` (515 líneas) y los hooks `use*`.
**Problemas:**
- No hay TTL: el dato "cargado" lo está para siempre hasta que alguien invalida a mano (riesgo de datos viejos y, por eso, varios hooks hacen refetch "silencioso" igual).
- `reloadStudents/Plans/Categories` vacían la lista (`students: []`) antes del nuevo fetch ⇒ parpadeo a "vacío".
- La deduplicación de requests depende de flags `isXLoading` por entidad; no hay clave por request.
- Cada `set` copia el mapa completo (`{...s.studentProfiles, [id]: …}`); aceptable hoy, pero crece con el uso.
**Arreglo propuesto:** evaluar migrar a TanStack Query (caché con `staleTime`, dedupe, reintentos, `keepPreviousData`) o, como mínimo, agregar `fetchedAt` + TTL y no vaciar el estado al invalidar (SWR real).
**Impacto:** medio (datos más frescos con menos requests).

### ~~P2-06 — `.select("*")` en 8 consultas~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): Cero `select("*")` en `src/` (profiles, plan_folders, training_plans, student_profiles ×2, exercise_stages, exercises).

**Dónde:** `CreateExerciseModal.tsx:100`, `authStore.ts:81,113` (`profiles`), `TrainingHome.tsx:65` y `TrainingProfile.tsx:164` (`student_profiles`), `useExerciseStages.ts:21`, `usePlanFolders.ts:33`, `dataCacheStore.ts:466` (`training_plans`, con `count` embebido).
**Problema:** trae columnas que no se usan (en `profiles`/`student_profiles` incluye datos personales y de salud que viajan sin necesidad) y rompe si se agregan columnas pesadas.
**Arreglo propuesto:** listar columnas explícitas. En los dos de `student_profiles` (`TrainingHome`/`TrainingProfile`) el objeto completo se cachea en `sessionStorage`; definir la lista exacta según el tipo `StudentProfileData`.
**Impacto:** bajo-medio (payload y superficie de datos).

### ~~P2-07 — `drop: ["console"]` en producción elimina también `console.error/warn`~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): `esbuild.pure` para `console.log/debug/info`; `error`/`warn` se conservan.

**Dónde:** `vite.config.ts:~190` (`esbuild.drop`).
**Problema:** no es de rendimiento sino de observabilidad: los `console.error` que no pasan por Sentry se pierden. Mejor `pure: ["console.log","console.debug"]` conservando `error`/`warn`.
**Impacto:** bajo (mejora diagnóstico de problemas de rendimiento reales).

### ~~P2-08 — Higiene de build~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): `dev-dist/` fuera del índice de git; `ANALYZE=1 npx vite build` genera `stats.html`/`stats.json` (treemap con `rollup-plugin-visualizer`).

- `dev-dist/` está versionado y cambia cada vez que corre el dev server (`dev-dist/sw.js`, `workbox-*.js` aparecen modificados en `git status`). Agregar a `.gitignore`.
- No hay análisis de bundle automatizado. Agregar `rollup-plugin-visualizer` (modo `ANALYZE=1`) y un chequeo de presupuesto en CI (ver sección 6).

---

## 5. Hallazgos de base de datos (Supabase)

> **Requiere aprobación explícita antes de aplicarse:** son migraciones sobre la base de **producción** (`hcvytsitbsandaphsxyn`) que cambian policies/índices. Se aplican como archivos en `supabase/migrations/` (con rollback documentado), probadas primero en una **branch** de Supabase.

### ~~D-01 — 54 policies RLS re-evalúan `auth.uid()` por fila (`auth_rls_initplan`)~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): Migración `20261010010000_perf_rls_policies`. Advisor `auth_rls_initplan`: 54 → **0**.

**Tablas afectadas:** `exercises`, `exercise_categories`, `exercise_stages`, `exercise_weight_logs`, `plan_folders`, `profiles`, `student_profiles`, `training_plans`, `training_plan_days`, `training_plan_exercises`, `training_plan_assignments`, `workout_completions`, `macrocycles`, `macrocycle_objectives`, `macrocycle_months`, `macrocycle_weeks`.
**Arreglo:** reemplazar `auth.uid()` / `auth.<fn>()` por `(select auth.uid())` en cada policy (el planner lo evalúa una sola vez por query en vez de por fila). Es un cambio mecánico y semánticamente equivalente.
**Impacto:** alto a medida que crecen `workout_completions` y `exercise_weight_logs`.

### ~~D-02 — 19 casos de `multiple_permissive_policies`~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): Mismo archivo. Advisor `multiple_permissive_policies`: 19 → **0**; acceso idéntico verificado por rol en 11 tablas. Incluye el fix de seguridad de `training_plans: coaches can delete any`.

**Ejemplos:** `exercise_weight_logs` (DELETE con **3** policies superpuestas, SELECT con 2), `profiles` (SELECT: `authenticated can view all` + `users can view own` — la segunda es redundante), `training_plan_assignments`, `training_plans`, `training_plan_days`, `training_plan_exercises`, `workout_completions`, `student_profiles` (UPDATE). Algunas también aplican al rol `mcp_readonly`.
**Problema:** Postgres evalúa **todas** las policies permisivas con OR para cada fila.
**Arreglo:** consolidar en una sola policy por (tabla, acción, rol) con `OR` explícito; eliminar las redundantes (p. ej. `students_delete_own_exercise_weight_logs` duplica `Students can delete own exercise weight logs`).
**Riesgo:** tocar policies es sensible para seguridad. Verificar con tests de acceso por rol (coach/alumno/anon) antes y después.

### ~~D-03 — 8 claves foráneas sin índice (4 en `public`)~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): Migración `20261010000000_perf_indexes`. Advisor `unindexed_foreign_keys`: 8 → **0**.

`public.exercise_weight_logs(assignment_id)`, `public.macrocycle_months(objective_id)`, `public.plan_folders(parent_id)`, `public.training_plan_exercises(stage_id)`; y `gym_mcp.access_grants/access_tokens/refresh_tokens(client_id)`, `mcp.access_tokens(profile_id)`.
**Nota:** `useWorkoutCompletions.ts` borra `exercise_weight_logs` filtrando por `student_id + assignment_id + plan_day_number` y `plan_folders` se recorre por `parent_id`; el índice ayuda también a los `ON DELETE`.

### ~~D-04 — Índices compuestos que faltan (los propios archivos lo anotan)~~ 🟡 APLICADO, sin validar con EXPLAIN

> 🟡 **APLICADO, sin validar con EXPLAIN** (2026-10-10): Índices compuestos creados; con ~1.200 filas el planner siempre usa seq scan, así que no se puede demostrar el beneficio todavía. Revalidar con > 10.000 completions.

`supabase/schema/indexes.sql` ya lo documenta:
- `training_plan_assignments (student_id, status, end_date)` — usado por `fetchStudents` y la vista de vencimientos.
- `workout_completions (student_id, completed_at DESC)` — usado en historial, ranking y alertas.
- `exercise_weight_logs (student_id, assignment_id, plan_day_number)` — borrado/lectura por sesión.
- `training_plan_assignments (status, end_date)` si la vista de vencimientos filtra sin `student_id`.
**Verificar cada uno con `EXPLAIN (ANALYZE, BUFFERS)`** sobre la query real antes de crearlo.

### ~~D-05 — Índices sobrantes~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): Eliminados `idx_profiles_email` (duplicaba el UNIQUE) y 4 índices de `student_profiles` (0 scans desde 2025-12-08).

- `idx_profiles_email` es **redundante** con `profiles_email_key` (UNIQUE ya crea un índice sobre `email`): se puede eliminar.
- Sin uso según el advisor: `idx_student_profiles_phone`, `_goal`, `_birth_date`, `_is_archived`. **No eliminar a ciegas:** con pocos datos el advisor puede marcarlos igual; confirmar con `pg_stat_user_indexes` en un período representativo. (`is_archived` es de baja cardinalidad: poco útil como índice simple.)
Cada índice de más cuesta en cada INSERT/UPDATE.

### ~~D-06 — Agregaciones en el servidor (RPC / vistas) en lugar de en el navegador~~ ✅ RESUELTO

> ✅ **RESUELTO** (2026-10-10): RPCs `get_students_overview` y `get_students_alerts` (`20261010020000_perf_rpc_students`), validadas contra la lógica vieja (0 diferencias).

Reemplazan los P0-01 y P0-02:
1. `get_students_overview()` → alumnos + datos de perfil + asignaciones activas (un solo query, sin listas de ids).
2. `get_recent_rpe_by_student(p_limit := 3)` → últimos N `rpe` por alumno con `row_number()`.
3. `get_last_week_attendance()` → conteos de asistencia por alumno.
4. `get_business_metrics(p_month)` → métricas agregadas por mes (y serie histórica) para `BusinessMetrics`.
**Reglas:** `SECURITY INVOKER` o `DEFINER` con chequeo explícito de rol; `REVOKE EXECUTE … FROM anon` (el repo ya hizo esto en `517e8c1` y `20260913000000_tighten_new_function_grants.sql`; mantener el patrón).

### ~~D-07 — Realtime: publicar solo lo necesario~~ ✅ RESUELTO (por eliminación)

> ✅ **RESUELTO (por eliminación)** (2026-10-10): Ver P2-03: la publicación está vacía y se quitaron las suscripciones muertas. Decisión pendiente solo si se quiere realtime real.

Revisar qué tablas están en la publicación `supabase_realtime` y limitar a las que el frontend realmente escucha (`workout_completions`, `exercise_weight_logs`, `plan_folders`, `training_plans`). Más tablas publicadas = más trabajo del WAL.

---

### Hallazgos de seguridad detectados durante la implementación (resueltos)

- ~~`training_plans: coaches can delete any` permitía borrar planes a cualquier usuario autenticado~~ ✅ (migración `20261010010000`; ahora exige ser coach).
- ~~`get_monthly_ranking` (SECURITY DEFINER) ejecutable por `anon`: exponía nombres, apellidos y fotos de alumnos sin login~~ ✅, ~~`handle_new_user` ejecutable por API~~ ✅ y ~~5 funciones sin `search_path` fijo~~ ✅ (migración `20261010030000_harden_functions`). Advisor de seguridad: 11 → 3 avisos (2 intencionales + contraseñas filtradas, que es un toggle del dashboard de Auth que no se puede cambiar por MCP).

---

## 6. ESTÁNDAR DE RENDIMIENTO (reglas para todo cambio futuro)

> Estas reglas aplican a **todo PR / cambio**. Cada una indica de qué hallazgo proviene. Las marcadas ✅ ya se cumplen hoy en el código; las demás pasan a ser obligatorias cuando su hallazgo se resuelva (sección 7).
> Si un cambio necesita romper una regla, debe justificarse por escrito en la descripción del PR.

### 6.1 Presupuestos (propuestos a partir de la línea base; ajustar tras la Fase 0)
| Métrica | Presupuesto |
|---|---|
| JS de la ruta crítica (entry + vendors precargados) | ≤ 570 kB sin gzip (hoy ≈ 566 kB). **No puede crecer** sin justificación. |
| Chunk de una ruta (excl. vendors) | ≤ 90 kB sin gzip |
| Cualquier chunk nuevo > 100 kB | Debe ser `import()` dinámico, nunca en el entry |
| CSS | ≤ 120 kB sin gzip |
| Precache del SW | ≤ 3 MB |
| Imagen individual servida | ≤ 100 kB (≤ 250 kB si es hero/ilustración grande, con `width/height`) |
| Fuentes | Solo los pesos/íconos realmente usados |
| Web Vitals objetivo (móvil 4G) **[fijar tras medir]** | LCP ≤ 2,5 s · CLS ≤ 0,1 · INP ≤ 200 ms |

### 6.2 Bundle y carga
1. ✅ **Rutas siempre con `lazy()`** (`src/router/index.tsx`). Toda pantalla nueva se registra con `lazy` + `Suspense`.
2. ✅ **Librerías pesadas solo con `import()` dinámico** (jspdf, html2canvas, recharts). Está prohibido importarlas estáticamente desde código que está en el entry.
3. **No agregar dependencias** sin revisar su costo (`bundlephobia` / visualizer) y sin buscar alternativa nativa. Preferir imports por nombre (`import { X } from "lucide-react"`), nunca `import *`.
4. **El prefetch es por rol, en idle y respeta `saveData`** (P1-02). Nunca prefetchear `vendor-charts`.
5. **Todo chunk de uso puntual va a `globIgnores` del precache** (P1-03).

### 6.3 Assets
6. **Formato:** `webp`/`avif`/`svg`. No se commitean `png`/`jpg` grandes en `public/` (P1-06).
7. **Tamaño:** redimensionar a ≤ 2× el tamaño de render; pasar por el optimizador (`ViteImageOptimizer` ya corre en build).
8. **`<img>`:** con `width`/`height` (o clases de tamaño CSS) para no causar CLS, y `decoding="async"`; `loading="lazy"` en todo lo que no esté en el primer viewport **y en todo lo que esté dentro de un contenedor que se oculta por CSS** (`hidden lg:flex`): un `<img>` oculto se descarga igual si no es `lazy` (P1-05). **Solo el LCP** usa `fetchpriority="high"`. Excepción: imágenes que consume `html2canvas`.
9. **Fuentes e íconos:** Material Symbols va recortado con `icon_names` en un request **separado** de Inter/Lexend (mezclarlos recorta también el texto); al usar un ícono nuevo, regenerar con `node scripts/material-icons.mjs` (`npm run check:icons` lo exige en CI). Inter/Lexend son variables: no hace falta limitar pesos (P1-01, P1-09).
10. **Sin assets huérfanos:** un archivo de `public/` debe estar referenciado; revisar al borrar/reemplazar pantallas.

### 6.4 Render en React
11. **Componentes de lista = `React.memo`** con props estables; el callback del padre va en `useCallback` y los objetos/arrays derivados en `useMemo` (P2-01).
12. **Nada de `filter/sort/map` pesado en el cuerpo del render sin `useMemo`**, y los inputs de búsqueda usan `useDeferredValue` o debounce.
13. **Listas > ~100 ítems → virtualizar** o paginar.
14. **Estado lo más cerca posible de donde se usa**; un componente > ~400 líneas o con > 8 `useState` se divide (P2-02). Los selectores de Zustand son **granulares** (`useStore(s => s.campo)`), nunca `useStore()` completo.
15. **Eventos de alta frecuencia** (`scroll`, `mousemove`, `touchmove`, `resize`): `{ passive: true }`, throttle/rAF, y **nunca** actualizar estado ni escribir en `localStorage` por evento (P1-04).
16. **Timers/intervalos** se pausan con `document.visibilityState === "hidden"` y siempre se limpian en el `return` del efecto (P2-04).

### 6.5 Datos y red (Supabase)
17. **Prohibido `.select("*")`**: columnas explícitas (P2-06).
18. **Toda lista tiene límite o paginación** (`.limit()` / `.range()`); está prohibido asumir "son pocas filas" (P0-01).
19. **Agregaciones y "top N por grupo" van en SQL (RPC/vista)**, no en el navegador (P0-01, D-06).
20. **Nunca pasar listas largas de ids por URL** (`.in(...)` con más de ~50 valores): usar join embebido o RPC (P0-02).
21. **Evitar waterfalls:** requests independientes en `Promise.all`; no encadenar fetch en `useEffect` sucesivos.
22. **Caché con vencimiento (`staleTime`) y stale-while-revalidate:** invalidar no vacía la UI; hay una sola fuente de caché (P2-05).
23. **Realtime:** antes de suscribirse, verificar que la tabla esté en la publicación `supabase_realtime` (hoy está vacía: una suscripción no recibe nada). Siempre con `filter`, nunca refetch completo ante cada evento (aplicar el payload o hacer debounce), y limpiar el canal en el `return` (P2-03).
24. **Escrituras en lote** (`upsert`/`insert` de arrays) en vez de loops con `await` por fila.

### 6.6 Base de datos
25. **Toda FK nueva lleva índice**, y toda query nueva frecuente se valida con `EXPLAIN (ANALYZE, BUFFERS)` antes de mergear (D-03, D-04).
26. **Policies RLS:** siempre `(select auth.uid())`, nunca `auth.uid()` directo; **una sola policy permisiva** por (tabla, acción, rol) (D-01, D-02).
27. **No crear índices "por las dudas"**: cada uno debe tener una query que lo use (D-05).
28. **Después de cada migración**, correr los advisors de Supabase (`security` y `performance`) y no introducir lints nuevos.
29. **Funciones nuevas:** `SECURITY INVOKER` salvo necesidad justificada, `set search_path = public`, `REVOKE EXECUTE … FROM public, anon, authenticated` y `GRANT` solo a `authenticated` (`npm run check:migrations` lo exige).

### 6.7 Caché y PWA
30. **Headers:** assets con hash `immutable`; `index.html` y `sw.js` sin caché larga (P1-08).
31. **Supabase siempre `NetworkOnly`** en el SW (ya cumple ✅); nunca cachear respuestas con datos de usuario.

### 6.8 Checklist de PR (copiar a la descripción)
- [ ] Corrí `npx vite build` y el JS crítico no creció (o lo justifico).
- [ ] Ningún chunk nuevo > 100 kB fuera de `import()` dinámico.
- [ ] Sin `select("*")`, sin queries sin límite, sin `.in()` con listas largas.
- [ ] Listas nuevas: `memo` + `useMemo`/`useCallback`; búsqueda con `useDeferredValue`.
- [ ] Imágenes optimizadas, con tamaño y `loading="lazy"`.
- [ ] Si toqué DB: índices en FKs, `(select auth.uid())`, `EXPLAIN` adjunto, advisors sin lints nuevos.
- [ ] Si agregué realtime/intervalos: con filtro, debounce, pausa en pestaña oculta y limpieza.

---

## 7. Plan de implementación

Estado: `[ ]` pendiente · `[~]` parcial · `[x]` resuelto. Cada `[x]` tiene un test o chequeo automático que lo protege (ver la skill).

### Fase 0 — Medir
- [x] `rollup-plugin-visualizer` agregado (`ANALYZE=1 npx vite build` → `stats.html`/`stats.json`); medido P1-01 (1.138 kB) y P1-10 (Sentry ≈ 10 kB gz).
- [x] Lighthouse móvil (simulación 4G lenta, CPU lenta) sobre `/login` del build local: **score 88, FCP 2,5 s, LCP 3,4 s, TBT 50 ms, CLS 0**. Es una sola corrida contra localhost y **no hay medición "antes"** (no se midió el código viejo). Falta medir `/inicio` y `/entrenamiento`: requieren sesión real. **Re-medición tras el trabajo de LCP (mediana de 5 corridas): score 90, FCP 2,3 s, LCP 3,1 s (antes 3,4 s), TBT 76 ms.**
- [x] Medidos tamaños reales de la fuente de íconos y de Inter/Lexend (P1-01, P1-09).
- [x] `max_rows`: no está seteado en la base (`pgrst.db_max_rows`); se asume el default de Supabase (1.000). `workout_completions` ya tenía 1.203 filas.
- [ ] `curl -I` de `/assets/*` **en producción** (requiere desplegar; P1-08).
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` de las queries principales: inútil hoy (≈ 1.200 filas ⇒ siempre seq scan). Repetir con > 10.000 completions.
- [x] ~~Crear una branch de Supabase~~ → descartado: nace sin datos y `supabase/migrations` no incluye las tablas base. Se validó con fotos de acceso por rol y comparación de RPCs contra la consulta vieja (ver la skill).

### Fase 1 — Frontend de bajo riesgo
- [x] P1-04 throttle de `updateActivity`
- [x] P1-02 prefetch por rol + idle + `saveData`
- [x] P1-03 `globIgnores` del precache (4.288 → 2.067 kB)
- [x] P1-06 assets huérfanos borrados
- [x] P1-05 `loading="lazy"` en listas/modales y en la foto oculta de auth (−170 kB en celular); `width`/`height` al logo SVG (CLS 0,061 → 0)
- [x] P1-07 imágenes de ánimo 790 → 214 kB
- [x] P1-08 headers de caché (**[A VERIFICAR]** en producción)
- [x] P2-07 `esbuild.pure` · [x] P2-08 `dev-dist/` fuera de git + visualizer

### Fase 2 — Fuentes e íconos
- [x] P1-01 Material Symbols 1.138 kB → 12 kB (con e2e y `check:icons`)
- [x] P1-09 cerrado: son fuentes variables, no había 10 archivos
- [x] P1-10 cerrado: medido, no vale la pena diferir Sentry

### Fase 3 — Render y estado
- [x] P2-01 `StudentCard` memoizado + `useMemo` + `useDeferredValue` · [ ] virtualización (cuando haya > 100 alumnos; hoy 39)
- [x] P2-02 `StudentProfile` 81 → 47 kB con `lazy()`; `TrainingProfile` 1.041 → 190 líneas (+7 módulos). `NewPlan` descartado a propósito (ver P2-02)
- [x] P2-03 realtime muerto eliminado (la publicación estaba vacía)
- [x] P2-04 auto-refresh pausado con pestaña oculta
- [x] P2-05 TTL + stale-while-revalidate en la caché de datos
- [x] P2-06 cero `select("*")` en `src/`

### Fase 4 — Base de datos (aplicado por MCP, directo en producción, por pasos)
- [x] D-03 índices en FKs (8 → 0 en el advisor) · [x] D-05 índices redundantes eliminados
- [~] D-04 compuestos creados, sin validar con `EXPLAIN` (tabla chica)
- [x] D-01 `(select auth.uid())` (54 → 0) · [x] D-02 policies fusionadas (19 → 0) · [x] fix de seguridad de borrado de planes
- [x] D-06 RPCs + P0-01 + P0-02 en el frontend (validadas: 0 diferencias)
- [x] D-07 realtime: publicación vacía → suscripciones eliminadas
- [x] Endurecimiento de funciones (`get_monthly_ranking`, `handle_new_user`, `search_path`): advisor de seguridad 11 → 3

### Fase 5 — Blindaje
- [x] CI: `check:migrations`, `check:icons`, `check:perf` (presupuestos), e2e Playwright (13 tests) y unit tests (145)
- [x] Plantilla de PR con el checklist (`.github/pull_request_template.md`)

### ✅ Fotos de alumnos (2026-10-10, pedido aparte)
- [x] Medido en `storage.objects`: 53 fotos, **1,6 MB en promedio (máx. 4,1 MB, 40 de 53 > 300 kB)**, 84 MB en total, `cache-control: max-age=3600`. El inicio bajaba ~48 MB de fotos para dibujar círculos de 56 px, sin `width`/`height`, sin manejo de error (un fallo dejaba el skeleton eterno) y con un fade que reaparecía aunque la foto estuviera en caché.
- [x] Miniaturas con la transformación de Supabase Storage (`avatarSrc`): **3.994 kB → 2,3 kB** en la foto de prueba; aplicado en lista, perfil, modales, sidebar y home del alumno.
- [x] `StudentAvatar`: sin fade si ya está en caché, `onError` (reintenta la original y después el icono), `width`/`height`.
- [x] Subidas nuevas: `compressAvatar` redimensiona a ≤ 320 px y recodifica a WebP (JPEG si no hay WebP) bajando la calidad hasta ~40 kB; caché de 1 año. e2e `avatar-upload`: una foto de 5,1 MB sale como **1,1 kB** hacia Storage (una foto real queda en ~10–30 kB). Tests `avatar.test.ts`, `compressAvatar.test.ts` y e2e `avatares`. Regla R35 en la skill.
- [~] Fotos ya subidas: `scripts/compress-avatars.mjs` (prueba en seco hecha: **61.157 kB → 284 kB, −99,5 %** en las 30 fotos en uso, revisadas a ojo; backup local de los originales en `backups/avatars/`, ignorado por git). **`--apply` ya corrido y verificado (30/30 WebP < 40 kB, 284 kB en total, originales intactos).** Borrado de originales y huérfanos: `scripts/delete-unused-avatars.mjs` (prueba en seco por defecto; `--delete --confirm=BORRAR` con la clave de servicio) — **corrido y verificado (2026-10-11): bucket de 83 objetos / 84 MB a 30 objetos / 284 kB, 0 URLs rotas, 0 archivos sin referencia.** (antes de eso: falta correr `--apply` (necesita la clave de servicio, que no está en el repo): sube archivos nuevos y cambia la URL en `student_profiles`; no borra los originales. Rollback con `--rollback`. Quedan además 23 objetos huérfanos en el bucket (fotos reemplazadas) que nadie referencia.

### Oportunidades abiertas (no resueltas)
- **LCP del login ≈ 3,1 s** (objetivo ≤ 2,5 s) en simulación 4G lenta; bajó desde 3,4 s con un `modulepreload` del chunk de Login + `vendor-forms` solo en `/login` (plugin `preloadLoginRoute` en `vite.config.ts`, con test) y el logo del splash sin fade y con `fetchpriority="high"`. Lo que queda es CPU de evaluar ≈ 640 kB de JS antes del primer render (React + router + supabase + forms): bajarlo más exige recortar JS del camino del login (p. ej. no importar supabase en `/login` hasta enviar el form) y es un cambio con riesgo en auth, por eso no se hizo. En tiempo real (sin simulación) el login queda listo en ≈ 0,8 s.
- **`realtime-js` ≈ 18 % de `vendor-supabase`** sin uso, pero `supabase-js` lo incluye siempre.
- **Contraseñas filtradas** (advisor de seguridad): **no disponible en el plan gratuito** de Supabase (2026-10-11: el panel responde "available on Pro Plans and up"). Alternativas gratuitas evaluadas: subir el mínimo a 8 + complejidad (panel + formularios), o chequeo k-anonymity con HaveIBeenPwned desde el cliente. Queda aceptado como aviso mientras no se pase a Pro.

---

## 8. Resultados

| Métrica | Antes | Después |
|---|---|---|
| JS crítico (sin gzip) | ≈ 566 kB | 556,8 kB (gzip 169,7 kB) |
| Precache del Service Worker | 4.288 kB | 2.067 kB |
| Peso de `public/` | 6,1 MB | ≈ 3,8 MB |
| Fuente de íconos (Material Symbols) | 1.138 kB | 12 kB |
| Foto de fondo oculta en login/recuperar/actualizar (celular) | 170 kB | 0 |
| Chunk `StudentProfile` | 81 kB | 47 kB |
| Escrituras a localStorage por 600 eventos de scroll/touch | 600 | ≤ 1 |
| `select("*")` en `src/` | 8 | 0 |
| Policies con initplan (advisor) | 54 | 0 |
| Policies permisivas duplicadas | 19 | 0 |
| FKs sin índice | 8 | 0 |
| Avisos del advisor de seguridad | 11 | 3 (2 intencionales + toggle de Auth) |
| Requests de `fetchStudents` (con `.in()` de ids en la URL) | 3 | 1 (RPC, sin ids) |
| Lecturas "de toda la tabla" que se truncaban en 1.000 filas | 4 | 0 (RPC o paginadas) |
| Lighthouse móvil `/login`: score / LCP / TBT / CLS | _sin medir_ | 90 / 3,1 s / 76 ms / **0** (CLS medido antes: 0,061; LCP 3,4 s antes del preload) |
| Requests al abrir `/inicio` (coach) | _sin medir_ | _sin medir_ |

Notas de honestidad: los números "después" de Lighthouse son de **una** corrida contra localhost; no hay Lighthouse "antes" de todo el trabajo. Los tamaños de bundle sí son comparables (mismo método de build).
