// Puntito rojo de "novedad" por sección de Comunidad. Se muestra en la tarjeta
// de la sección y en el tab "Comunidad" del bottom nav, y desaparece cuando el
// alumno entra a esa sección (queda guardado en localStorage).
//
// - Ranking: automático, hay novedad una vez por mes (ganadores del mes nuevo).
// - Videos / Bonificaciones: para avisar contenido nuevo, cambiar su valor en
//   STATIC_NEWS_VERSIONS (ej. la fecha "2026-12-01"). "" = sin novedad.

export type NewsSection = "ranking" | "videos" | "bonificaciones";

export const STATIC_NEWS_VERSIONS: Record<Exclude<NewsSection, "ranking">, string> = {
  videos: "",
  bonificaciones: "",
};

export const NEWS_SECTIONS: NewsSection[] = ["ranking", "videos", "bonificaciones"];

const storageKey = (section: NewsSection) => `community_news_seen_${section}`;

export function currentNewsVersion(section: NewsSection, now: Date = new Date()): string {
  if (section === "ranking") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  return STATIC_NEWS_VERSIONS[section];
}

function readSeen(section: NewsSection): string | null {
  try {
    return localStorage.getItem(storageKey(section));
  } catch {
    return null;
  }
}

/** true si la sección tiene una novedad que el alumno todavía no vio. */
export function hasUnseenNews(section: NewsSection, now: Date = new Date()): boolean {
  const current = currentNewsVersion(section, now);
  if (!current) return false;
  return readSeen(section) !== current;
}

/** true si alguna sección de Comunidad tiene novedades sin ver. */
export function hasAnyUnseenNews(now: Date = new Date()): boolean {
  return NEWS_SECTIONS.some((section) => hasUnseenNews(section, now));
}

/** Marca la novedad actual de la sección como vista. Llamar al entrar a la sección. */
export function markNewsSeen(section: NewsSection, now: Date = new Date()): void {
  const current = currentNewsVersion(section, now);
  if (!current) return;
  try {
    localStorage.setItem(storageKey(section), current);
  } catch {
    // Sin localStorage (modo privado, etc.): el puntito simplemente vuelve a aparecer.
  }
}
