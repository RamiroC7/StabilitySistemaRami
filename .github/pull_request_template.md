## Qué cambia

<!-- Resumen corto -->

## Checklist de rendimiento

Reglas completas: `.claude/skills/rendimiento-stability/SKILL.md` · auditoría: `RENDIMIENTO.md`

- [ ] Corrí `npx tsc -b`, `npm run lint`, `npx vitest run`.
- [ ] Corrí `npx vite build` y `npm run check:perf`: el JS crítico no creció (o lo justifico abajo).
- [ ] Ningún chunk nuevo > 100 kB fuera de `import()` dinámico.
- [ ] Sin `select("*")`, sin queries sin límite/paginación, sin `.in()` con listas largas de ids.
- [ ] Listas nuevas: `memo` + `useMemo`/`useCallback`; búsqueda con `useDeferredValue`.
- [ ] Imágenes optimizadas, con `width`/`height` y `loading="lazy"` si no están en el primer viewport (ni en contenedores ocultos).
- [ ] Íconos nuevos de Material Symbols: regeneré la URL (`node scripts/material-icons.mjs`) y pasa `npm run check:icons`.
- [ ] Si toqué la base: índices en FKs, `(select auth.uid())`, funciones con `revoke ... from anon`, `npm run check:migrations`, advisors sin lints nuevos, y adjunto el rollback.
- [ ] Si agregué realtime/intervalos: la tabla está en la publicación `supabase_realtime`, con filtro, debounce, pausa en pestaña oculta y limpieza.
- [ ] Corrí `npm run test:e2e`.

## Excepciones a las reglas (si las hay)

<!-- Qué regla rompés, por qué, y dónde actualizaste la skill y RENDIMIENTO.md -->
