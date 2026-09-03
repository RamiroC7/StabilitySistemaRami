# Deploy, Entornos y Operación

## Deploy

El proyecto se despliega en [Vercel](https://vercel.com/), con detección automática del framework Vite (`npm run build` genera `dist/`, servido según las reglas de `vercel.json`).

- **Producción:** deploy automático al mergear a `main`.
- **Previews:** cada Pull Request obtiene un deploy de preview propio.
- El endpoint `/api/*` corre como serverless function (ver `api/`); en desarrollo local lo simula `api-dev-proxy.js`.

## Entornos

Variables de entorno, tomando `.env.example` como base:

| Variable | Dónde se usa | Dónde se configura |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Cliente Supabase (auth, DB, storage) | `.env` local / Vercel (Project Settings → Environment Variables) |
| `VITE_POSTHOG_*` | Analítica de producto | Vercel |
| `VITE_SENTRY_DSN` | Captura de errores en el cliente (ver Monitoreo abajo) | Vercel — pública, va en el bundle, no es secreta |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | Solo durante el build, para subir source maps a Sentry | Vercel — **secretas**, nunca en `.env` commiteado |

Las variables `VITE_*` quedan embebidas en el bundle del cliente (son públicas por diseño de Vite). Las de Sentry para subir source maps (`SENTRY_AUTH_TOKEN` y compañía) corren solo en build time en el servidor de Vercel y no llegan al navegador.

## Operación

### Monitoreo

Captura de errores en producción con [Sentry](https://sentry.io/) (`@sentry/react`).

**Qué se reporta:**
- Cualquier error no capturado en runtime (via las integraciones default de Sentry).
- Los errores de ruta capturados por el `errorElement` del router (`src/components/GlobalError.tsx`).
- Fallos al guardar un entrenamiento (`saveCompletion()` en `src/hooks/useWorkoutCompletions.ts`) — excluyendo errores de red, que ya se resuelven solos vía la cola offline.
- Fallos de rehidratación de sesión al iniciar la app (`initializeAuth()` en `src/features/auth/store/authStore.ts`), incluyendo el caso de timeout (típico en iOS).

**Dónde se ve:** en el dashboard del proyecto en sentry.io (Issues). Cada evento incluye stack trace legible gracias a los source maps subidos en el build (ver abajo), y tags/extra con contexto no sensible (`assignmentId`, `dayNumber`, `studentId`).

**Qué NO se envía (scrubbing, `src/lib/sentry.ts`):**
- Datos de salud del alumno: `previous_injuries` / `medical_conditions` (y sus variantes en camelCase), en cualquier parte del evento (extra, contexts, breadcrumbs).
- Tokens, sesión, cookies, headers de autorización — se eliminan del objeto `request` y de cualquier breadcrumb.
- `sendDefaultPii` está deshabilitado explícitamente.

**Source maps:** el build en Vercel sube los `.map` a Sentry vía `@sentry/vite-plugin` (configurado en `vite.config.ts`) y los borra del output público después — solo corre si `SENTRY_AUTH_TOKEN` está seteado, así que un build local o un fork sin ese secreto sigue funcionando igual, sin subir nada.

**Pendiente de configurar manualmente** (fuera del alcance del código):
1. Crear el proyecto en Sentry (plan gratuito) y cargar `VITE_SENTRY_DSN` en Vercel.
2. Generar un Auth Token de Sentry y cargar `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` en Vercel para que se suban los source maps.
