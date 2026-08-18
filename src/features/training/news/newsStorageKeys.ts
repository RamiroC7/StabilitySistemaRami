// Claves y helpers de localStorage para los "puntitos rojos" de primera
// visita — mismo patron base que InstallPWABanner.tsx, generalizado para
// no duplicar la logica de contar/leer en cada lugar que lo necesite.
//
// Un puntito se muestra mientras el usuario tenga menos de
// VISITS_TO_DISMISS_BADGE visitas registradas para esa clave, y desaparece
// (para siempre, persistido) apenas las alcanza.

export const VISITS_TO_DISMISS_BADGE = 2;

// Cuenta visitas a la sub-pagina "Nosotros". Un solo contador maneja los DOS
// puntitos (el del tab "Comunidad" en el bottom nav y el de la fila
// "Nosotros" en el menu) para que desaparezcan juntos, a la vez.
export const NOSOTROS_VISITS_KEY = "nosotros_visits";

/** Suma una visita para la clave dada. Llamar al montar la pantalla correspondiente. */
export function registerVisit(key: string) {
  const current = Number(localStorage.getItem(key)) || 0;
  localStorage.setItem(key, String(current + 1));
}

/** true si todavia hay que mostrar el puntito para esa clave (no llego al umbral). */
export function shouldShowVisitBadge(key: string) {
  return (Number(localStorage.getItem(key)) || 0) < VISITS_TO_DISMISS_BADGE;
}
