import * as Sentry from "@sentry/react";

// Claves que nunca deben llegar a Sentry, sin importar en qué parte del
// evento aparezcan (extra, contexts, breadcrumbs). Cubre datos de salud
// del alumno — previous_injuries / medical_conditions llegan en snake_case
// desde Supabase y en camelCase desde el JS (previousInjuries /
// medicalConditions) — y credenciales de sesión.
const SENSITIVE_KEY_FRAGMENTS = [
  "previous_injuries",
  "previousinjuries",
  "medical_conditions",
  "medicalconditions",
  "token",
  "access_token",
  "refresh_token",
  "session",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "password",
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
}

// Recorre recursivamente cualquier objeto/array del evento y redacta los
// valores de las claves sensibles, sin tocar la forma general del evento
// (así Sentry sigue agrupando y mostrando el resto de la información).
function scrub<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, seen)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? "[Filtered]" : scrub(val, seen);
  }
  return result as T;
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  // Sin DSN (dev local, o un preview de Vercel sin la env var seteada) no
  // inicializamos nada — mejor no reportar que reportar a un DSN vacío.
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Solo captura de errores por ahora — sin tracing de performance, para
    // no gastar la cuota de spans del plan gratuito con algo que no pidió
    // el ticket. Se puede sumar después con tracesSampleRate > 0.
    tracesSampleRate: 0,
    // Nunca mandar PII por default (IP, cookies, headers). El scrubbing de
    // abajo es la segunda capa de defensa.
    sendDefaultPii: false,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = scrub(breadcrumb.data);
      }
      return breadcrumb;
    },
    beforeSend(event) {
      if (event.extra) event.extra = scrub(event.extra);
      if (event.contexts) event.contexts = scrub(event.contexts);
      if (event.request) {
        // Nunca mandar headers/cookies/query string: pueden traer el token
        // de sesión de Supabase.
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.query_string;
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
          ...breadcrumb,
          data: breadcrumb.data ? scrub(breadcrumb.data) : breadcrumb.data,
        }));
      }
      return event;
    },
  });
}
