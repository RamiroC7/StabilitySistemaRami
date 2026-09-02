# T2 — Compatibilidad de Vercel con el workspace root

> Relevamiento de solo lectura + razonamiento. No se cambió nada de la config de Vercel.
> Repo real `RamiroC7/StabilitySistemaRami`, rama `mcp-server/setup`.

## Config de Vercel que hay hoy

### `vercel.json` (raíz)

```json
{
  "headers": [
    { "source": "/team-(agus|juan).webp",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=604800, stale-while-revalidate=86400" }] }
  ],
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- `rewrites`: fallback SPA — todo lo que **no** empiece con `api/` se sirve `index.html` (client-side routing de `react-router-dom`).
- `headers`: cache larga para dos imágenes del equipo.
- **No** define `buildCommand`, `outputDirectory`, `installCommand` ni `framework`. Vercel los infiere: detecta Vite → `outputDirectory = dist`, `buildCommand = npm run build`, `installCommand = npm install`.

### Dashboard

No accesible desde acá. Se asume config por defecto (framework preset "Vite", root directory = raíz del repo). Las env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POSTHOG_*`) viven en el dashboard.

### `api/`

`api/posthog-query.js` — una función serverless (Node) que Vercel toma automáticamente de la carpeta `api/`. El `rewrite` la excluye del fallback SPA.

## Por qué NO debería necesitar cambios

1. **La app no se movió.** Sigue siendo el `package.json` de la raíz, con los mismos `scripts` (`build` = `tsc -b && vite build`), el mismo `outputDirectory` (`dist`), el mismo `index.html` y `vite.config.ts` en la raíz. La detección de framework de Vercel no cambia.
2. **`api/` intacta.** Misma ubicación, mismo `rewrite` de exclusión.
3. **El único cambio en `package.json` es `"workspaces": ["packages/*"]`.** Con `npm install` desde la raíz, npm instala las deps del paquete raíz (la app) igual que antes y además linkea `packages/*`. Las deps de la app no cambiaron ni de versión (lock: solo +3 líneas, el propio campo `workspaces`).
4. **`packages/domain` y `packages/mcp-server` no aportan nada al bundle.** No se importan desde `src/`. Vite nunca los resuelve. No están en el `include` de `tsconfig.app.json`.
5. `vercel.json` sin tocar.

## Riesgo residual (a mirar en el primer preview real)

El preview real solo se puede verificar cuando la rama esté en el repo de Ramiro (requiere ser colaborador de Vercel). `vercel` CLI no está instalado en la máquina y no hay red para bajarlo, así que `npx vercel build` local no se pudo correr. Checklist para el primer preview:

- [ ] **`npm install` de Vercel no falla por el campo `workspaces`.** Si `packages/*` tuviera un `package.json` inválido, `npm install` aborta y el build ni arranca. Mitigado: los `package.json` de `packages/*` son mínimos y válidos (ver T3), y `npm install` local desde la raíz pasa limpio.
- [ ] **`dist/` sale igual.** Comparar el listado de `dist/assets/*.js` del preview contra producción — debe ser la misma cantidad de chunks (58 en la corrida local) salvo hashes.
- [ ] **`/api/posthog-query` responde.** Un POST simple; debe seguir siendo detectada como función serverless (no la tapó el `rewrite`).
- [ ] **Ruta profunda + refresh.** Entrar directo a p.ej. `/coach/alumnos/<id>` y apretar F5 → debe cargar la SPA, no 404 (verifica que el `rewrite` sigue vigente).
- [ ] **Vercel no cambió su heurística de install por detectar `workspaces`.** Si el build log muestra que corrió `npm ci` en vez de `npm install`, o que intentó buildear `packages/*`, revisar Root Directory / Install Command en el dashboard. No debería pasar: sin `outputDirectory` de un subpaquete, Vercel buildea la raíz.
