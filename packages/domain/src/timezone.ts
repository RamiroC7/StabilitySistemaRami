/**
 * Helpers de conversion instante UTC <-> fecha/hora "de pared" en una zona
 * horaria fija, sin dependencias nuevas (`date-fns-tz` no hace falta: Node
 * trae ICU completo, `Intl` alcanza). Usados por `adherence.ts` y
 * `expiration.ts` para no repetir la logica de TZ dos veces.
 */

/** Zona horaria fija del MCP server (design.md: toda fecha se evalua aca). */
export const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * Offset (ms) de `timeZone` respecto de UTC en el instante dado, como
 * `localWallClock - instant`. Para Buenos Aires es fijo (-3h, sin horario de
 * verano desde 2009), pero se calcula dinamicamente via `Intl` en vez de
 * hardcodearlo.
 */
function timeZoneOffsetMs(instantMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(instantMs))) {
    parts[part.type] = part.value;
  }

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asIfUtc - instantMs;
}

/**
 * Convierte una fecha+hora "de pared" (`YYYY-MM-DD`, `HH:mm:ss.SSS`) en
 * `timeZone` al instante UTC (ms epoch) correspondiente.
 */
export function zonedDateTimeToInstant(dateStr: string, timeStr: string, timeZone: string): number {
  const naiveInstant = Date.parse(`${dateStr}T${timeStr}Z`);
  const offset = timeZoneOffsetMs(naiveInstant, timeZone);
  return naiveInstant - offset;
}

/** Instante (ms epoch o ISO string) -> `"YYYY-MM-DD"` en `timeZone`. */
export function instantToLocalDateStr(instant: number | string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(instant));
}

/** Instante (ms epoch o ISO string) -> `"YYYY-MM-DD HH:mm:ss"` en `timeZone`. */
export function instantToLocalDateTimeStr(instant: number | string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return formatter.format(new Date(instant));
}
