---
name: rendimiento-stability
description: Reglas de rendimiento INVIOLABLES del proyecto Stability (frontend Vite/React, Supabase, PWA, assets, CI). Usala SIEMPRE antes de escribir, modificar o revisar codigo, queries, migraciones SQL, policies RLS, imagenes/fuentes/iconos, dependencias, realtime, listas o componentes de este repo, y antes de dar por terminado cualquier cambio. Tambien cuando el usuario hable de performance, velocidad, bundle, peso, lentitud, optimizar, Lighthouse, cache o "se siente lento".
---

# rendimiento-stability

Estandar de rendimiento de Stability. **Estas reglas no se rompen.** Si un cambio
necesita romper una, se justifica por escrito en el PR y se actualiza esta skill
y `RENDIMIENTO.md` en el mismo cambio. Nunca se salta un chequeo automatico
"para despues".

- Auditoria completa, hallazgos y estado: `RENDIMIENTO.md` (raiz del repo).
- Este archivo: reglas que se aplican a cada cambio + como se verifican.

## Como trabajar con esta skill

1. **Antes de codear:** leer las reglas de la categoria que toca tu cambio.
2. **Mientras codeas:** si una regla choca con lo que necesitas, parar y decidir
   (no improvisar).
3. **Antes de dar el cambio por hecho**, correr (en este orden):
   ```bash
   npx tsc -b && npm run lint && npx vitest run
   VITE_SUPABASE_URL=https://ci-placeholder.supabase.co VITE_SUPABASE_ANON_KEY=ci-placeholder-anon-key npx vite build
   npm run check:perf        # presupuestos (bundle, precache, imagenes, assets huerfanos)
   npm run check:migrations  # migraciones SQL nuevas: auth.uid() envuelto, revoke a anon, FKs con indice
   npm run check:icons       # iconos de Material Symbols cubiertos por la fuente recortada
   npm run test:e2e          # Playwright contra el build (Chrome local; Chromium en CI)
   ```
   Si tocaste la base: correr los advisors de Supabase (`performance` y
   `security`) y no introducir lints nuevos.
4. **Cuando mejores algo de rendimiento**, dejalo registrado:
   - agregar/ajustar la regla aca (con su R-numero y como se verifica),
   - marcar el hallazgo como resuelto en `RENDIMIENTO.md` (seccion 7) y completar
     la tabla de resultados (seccion 8),
   - agregar un test que falle si alguien lo rompe (unit en `src/**/*.test.ts`,
     e2e en `e2e/*.e2e.ts`, o chequeo en `scripts/check-perf-budget.mjs`).
   Una mejora sin test que la proteja no cuenta como estandarizada.

Leyenda de verificacion: 🤖 = lo hace CI solo · 👀 = revision manual del PR.

---

## A. Bundle y carga

**R1. Toda pantalla nueva va con `lazy()` + `Suspense`** en `src/router/index.tsx`.
Nunca importar una pagina de forma estatica en el router. Lo mismo para pestanas y
modales pesados que solo se ven al abrirlos (ej. `MacrocycleTab`, `FeedbackModal`,
`PlanPreview` en `StudentProfile`: chunk 81 → 47 kB). Cuidado con modales que viven
siempre montados con `isOpen`: diferirlos exige montarlos al primer uso. 👀

**R2. Librerias pesadas solo con `import()` dinamico**: `jspdf`, `html2canvas`,
`recharts`, y cualquier dependencia nueva > ~50 kB gzip. Prohibido importarlas
estaticamente desde codigo alcanzable desde el entry. 🤖 e2e
(`login: no baja chunks pesados`) + `check:perf`.

**R3. Presupuestos duros** (en `scripts/check-perf-budget.mjs`, fuente de verdad):
JS critico <= 580 kB (170 kB gzip hoy), chunk de ruta <= 100 kB, CSS <= 125 kB,
precache del SW <= 2.300 kB, imagen servida <= 150 kB. Subir un limite exige
justificar en el PR y editar el script + esta skill. 🤖 `npm run check:perf`.

**R4. El prefetch de rutas es por rol, en idle y respeta `saveData`/2g**
(`src/App.tsx`). Un alumno nunca baja chunks de coach ni al reves.
`BusinessMetrics`/recharts **no se prefetchean**. 🤖 e2e (`prefetch por rol`).

**R5. Los chunks de uso puntual van en `workbox.globIgnores`** de `vite.config.ts`
para no inflar el precache del SW (hoy: jspdf, html2canvas, vendor-charts,
index.es, purify). Si agregas uno nuevo y pesado, agregalo ahi. 🤖 `check:perf`
(tope de precache).

**R6. No agregar dependencias sin medir su costo** (bundlephobia / visualizer) y
sin descartar una alternativa nativa o ya instalada. Imports por nombre, nunca
`import *`. 👀

## B. Assets (imagenes, fuentes, iconos)

**R7. Formatos y peso:** `webp`/`avif`/`svg`. Nada de `png`/`jpg` grandes en
`public/`. Redimensionar a <= 2x del tamano de render. Maximo 150 kB por imagen
(objetivo 100 kB). 🤖 `check:perf`.

**R8. Cero assets huerfanos:** todo archivo de `public/` debe estar referenciado
por nombre en `src/`, `index.html`, `vite.config.ts` o `api/`. Al reemplazar una
pantalla, borrar sus assets. 🤖 `check:perf`.

**R9. `<img>`:** con `width`/`height` (o clases de tamano CSS) para no causar CLS
(un logo SVG sin tamano daba 0,061 de CLS en el login movil); `decoding="async"`;
`loading="lazy"` en todo lo que no este en el primer viewport **y en todo lo que
estee dentro de un contenedor que se oculta por CSS** (`hidden lg:flex`): un `<img>`
oculto se descarga igual si no es `lazy` (la foto de Unsplash de login: 170 kB en
cada celular). Solo la imagen LCP usa `fetchpriority="high"`. Excepcion: imagenes que
consume `html2canvas` (`PlanPDFTemplate`) NO llevan `lazy`. 🤖 e2e `imágenes ocultas` +
`scripts/perfConfig.test.ts` (logo con width/height) + 👀 resto.

**R35. Fotos de usuarios (avatares):** nunca se muestra la foto original de `profile-images`
(~1,6 MB, hasta 4 MB, para dibujarla a 56 px). Al renderizar se usa `avatarSrc(url, cssPx)`
(`src/lib/avatar.ts`: transformacion de Supabase Storage, 4 MB → ~2 kB); en la base se guarda
la URL original (la usa `deleteProfileImage`). Toda subida pasa por `compressAvatar` (`src/lib/compressAvatar.ts`): lado largo <= 320 px,
WebP (JPEG donde no hay WebP), calidad bajando hasta ~40 kB, EXIF respetado; la subida
nunca se hace con el archivo crudo. Se suben solo y con `cacheControl` de 1 ano (el nombre trae timestamp). Quien no tiene foto
muestra `DEFAULT_AVATAR` (`public/avatar-default.webp`, 3 kB; `avatarSrc` ya la devuelve, no
crear iconos/iniciales propios). Todo
avatar maneja `onError` (reintenta con la original y despues cae a la imagen predeterminada) y no hace fade si la
imagen ya estaba en cache. 🤖 `avatar.test.ts` + `compressAvatar.test.ts` + e2e `avatares` y `avatar-upload` (sube 5 MB, exige < 60 kB WebP).

**R10. Fuentes e iconos:** Material Symbols va **recortado** (`icon_names`, ejes fijos
FILL 0 / wght 400): 12 kB en vez de 1.138 kB. Va en un request **separado** de
Inter/Lexend (mezclarlos hace que Google recorte tambien el texto). Al usar un icono
nuevo (incluidos los dinamicos tipo `icon: "light_mode"`), regenerar la lista con
`node scripts/material-icons.mjs` y pegar la URL en `index.html`. Inter y Lexend son
fuentes variables: no hace falta limitar pesos. Un solo sistema de iconos a futuro
(preferir `lucide-react`). 🤖 `npm run check:icons` + e2e `fonts` (renderiza los iconos
como glifo en un navegador real).

**R11. Headers de cache** (`vercel.json`): `/assets/*` immutable 1 ano;
`index.html`, `sw.js`, `manifest` y `registerSW.js` sin cache larga; imagenes
estaticas con max-age + stale-while-revalidate. No quitar esas reglas. 🤖
`scripts/perfConfig.test.ts`.

## C. Render en React

**R12. Componentes de lista = `React.memo`**, con props estables: callbacks en
`useCallback`, objetos/arrays derivados en `useMemo`. Prohibido definir el item
de una lista inline dentro del `.map` del padre cuando la lista puede pasar de
~20 elementos. 👀

**R13. Nada de `filter`/`sort`/`reduce` pesado en el cuerpo del render sin
`useMemo`.** Los buscadores usan `useDeferredValue` o debounce. 👀

**R14. Listas > ~100 items se virtualizan o paginan.** 👀

**R15. Eventos de alta frecuencia** (`scroll`, `mousemove`, `touchmove`,
`touchstart`, `resize`, `keypress`): `{ passive: true }`, throttle o
`requestAnimationFrame`, y **jamas** `set()` de store / `setState` / escritura a
`localStorage` por evento. 🤖 unit (`authStore.test.ts`) + e2e
(`scroll/touch no escribe auth-storage`).

**R16. Estado cerca de donde se usa.** Componente > ~400 lineas o > 8 `useState`
se divide. Selectores de Zustand granulares: `useStore(s => s.campo)`, nunca
`useStore()` completo. 👀

**R17. Timers e intervalos** se pausan con `document.visibilityState === "hidden"`
y se limpian siempre en el `return` del efecto. 👀

## D. Datos y red (Supabase)

**R18. Prohibido `.select("*")` en codigo nuevo.** Columnas explicitas. 👀
(Deuda existente: `RENDIMIENTO.md` P2-06.)

**R19. Toda lista tiene `.limit()` o `.range()`.** Nunca asumir "son pocas filas":
PostgREST corta silenciosamente en `max_rows` (1.000 por defecto). 👀

**R20. Agregaciones y "top N por grupo" se hacen en SQL (RPC/vista)**, no
bajando tablas enteras al navegador. 👀

**R21. Nunca pasar listas largas de ids por URL** (`.in()` con mas de ~50
valores): join embebido o RPC. 👀

**R22. Sin waterfalls:** requests independientes en `Promise.all`; no encadenar
fetch en `useEffect` sucesivos.

**R23. Cache con vencimiento y stale-while-revalidate.** `dataCacheStore` vence por TTL
(`STALE_MS`: 5 min alumnos/planes, 30 min categorias); invalidar (`reloadX`) NO vacia
la lista, y los hooks solo muestran "loading" si no hay nada que mostrar. Una sola
fuente de cache por dato. 🤖 `dataCacheStore.test.ts`.

**R24. Realtime:** siempre con `filter`; nunca refetch completo ante cada evento
(aplicar el payload o debounce); limpiar el canal en el `return`. **Antes de
suscribirte a una tabla, verificar que este en la publicacion `supabase_realtime`**
(`select * from pg_publication_tables`): hoy esta vacia, asi que las suscripciones
existentes no reciben nada. 👀

**R25. Escrituras en lote** (`upsert`/`insert` de arrays), no loops con `await`
por fila. 👀

## E. Base de datos

**R26. Toda FK nueva lleva indice** (aunque el advisor `unused_index` lo marque como "sin usar" al principio: gana el de FK). 🤖 `npm run check:migrations`.
 Toda query frecuente nueva se valida con
`EXPLAIN (ANALYZE, BUFFERS)` antes de mergear. 👀

**R27. Policies RLS:** siempre `(select auth.uid())`, nunca `auth.uid()` pelado;
una sola policy permisiva por (tabla, accion, rol); toda policy de escritura
(`delete`/`update`) compara al usuario con `auth.uid()` (nunca solo "existe algun
coach"). Policies con `to authenticated`, no `to public`. 🤖 `npm run check:migrations`
(auth.uid pelado) + 👀 resto.

**R28. No crear indices "por las dudas":** cada uno necesita una query que lo
use. Un UNIQUE ya crea su indice (no duplicar). 👀

**R29. Despues de cada migracion** correr los advisors de Supabase y no
introducir lints nuevos. Las migraciones van en `supabase/migrations/` y se
prueban primero en una branch de Supabase. 👀

**R30. Funciones nuevas:** `SECURITY INVOKER` salvo necesidad justificada, `set search_path = public`,
`REVOKE EXECUTE ... FROM public, anon, authenticated` y `GRANT` solo a `authenticated`. 🤖
`npm run check:migrations`.

### Procedimiento obligatorio para cambios en la base (via MCP de Supabase)

1. **Leer antes de escribir:** `pg_policies`, `pg_indexes`/`pg_stat_user_indexes`, tamanos y advisors.
2. **Versionar:** la migracion va a `supabase/migrations/<timestamp>_<tema>.sql` (con su
   ROLLBACK en el encabezado) y, si toca policies, un respaldo exacto en
   `supabase/rollback/`. Se aplica con `apply_migration` con el MISMO SQL del archivo.
3. **Una migracion por tema** (indices / RLS / RPCs), cada una atomica.
4. **Probar acceso por rol, en solo lectura:** foto de lo que ve un coach, un alumno con
   plan, un alumno sin plan y anon (impersonando con `set_config('request.jwt.claims',…)`
   y `set local role`, terminando en `raise exception` para que nada se guarde) ANTES y
   DESPUES; tienen que ser identicas salvo el cambio buscado. Las RPCs nuevas se
   validan contra la consulta vieja (0 diferencias).
5. **Advisors** `performance` y `security` despues de cada migracion (R29).
6. **Nada de DML/DDL de prueba sobre produccion**, ni siquiera con rollback.
7. Una branch de Supabase NO sirve en este repo: nace sin datos y `supabase/migrations`
   no incluye las tablas base.

## F. Build, CI y PWA

**R31. `check:perf` y `test:e2e` son checks obligatorios del CI** (`.github/workflows/ci.yml`).
No se desactivan ni se marcan `continue-on-error`. 🤖

**R32. Supabase siempre `NetworkOnly` en el Service Worker**; nunca cachear
respuestas con datos de usuario. 👀

**R33. `console.error`/`console.warn` se conservan en produccion**; solo se
eliminan `log/debug/info` (`esbuild.pure`). No volver a `drop: ["console"]`. 👀

**R34. `dev-dist/` no se versiona** (esta en `.gitignore`).

---

## Estado de las reglas (actualizado 2026-10-10)

| Regla | Estado | Proteccion |
|---|---|---|
| R1 | ✅ cumplida (rutas + pestanas/modales de `StudentProfile`) | 👀 |
| R2, R3, R4, R5 | ✅ cumplidas (+ preload del chunk de Login solo en `/login`: LCP 3,4 → 3,1 s) | `check:perf` + e2e + `perfConfig.test.ts` |
| R7, R8 | ✅ cumplidas | `check:perf` |
| R9 | ✅ cumplida (lazy en ocultos/listas, logo con width/height) | e2e + `perfConfig.test.ts` |
| R35 | ✅ cumplida (miniaturas + compresion al subir + fallback) | `avatar.test.ts` + e2e |
| R10 | ✅ cumplida (1.138 → 12 kB) | `check:icons` + e2e `fonts` |
| R11 | ✅ cumplida (**verificar `curl -I` en produccion tras el deploy**) | `perfConfig.test.ts` |
| R12, R13 | ✅ en `StudentsList` (el resto de las listas es chico) | e2e `students-list` |
| R14 | ⏳ sin necesidad hoy (39 alumnos): virtualizar al pasar de ~100 | 👀 |
| R15 | ✅ cumplida | unit + e2e |
| R16 | ✅ cumplida (`TrainingProfile` dividido: 1.041 → 190 lineas + modulos) | 👀 + `profileData.test.ts` |
| R17 | ✅ cumplida | 👀 |
| R18 | ✅ cero `select("*")` en `src/` | 👀 |
| R19, R20, R21 | ✅ cumplidas (RPC `get_students_*` + `fetchAllRows`) | unit + e2e |
| R22 | ✅ `useBusinessMetrics` en paralelo | 👀 |
| R23 | ✅ TTL + SWR | `dataCacheStore.test.ts` |
| R24 | ✅ suscripciones muertas eliminadas; **la publicacion `supabase_realtime` esta vacia** | 👀 |
| R26, R27, R28, R29, R30 | ✅ cumplidas (advisors en 0 / 3 intencionales) | `check:migrations` |
| R31-R34 | ✅ cumplidas | CI |

Las reglas aplican a TODO codigo nuevo o modificado. Al tocar un archivo con deuda
(`NewPlan`, `StudentProfile`), preferir saldarla en el mismo cambio.
