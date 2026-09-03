/**
 * `getExpirationStatus` — extraida de `src/features/students/PlanExpirations.tsx`
 * (US-4). La app calcula ahi mismo, inline, si un plan esta vencido / vence
 * hoy / vence pronto, junto con el texto y los colores del badge (JSX). Esta
 * version es SOLO la parte pura y numerica que necesita el tool
 * `get_expiring_plans`: cuantos dias faltan y si ya vencio. El componente de
 * la app NO se toca ni se refactoriza para usar esto — sigue con su propia
 * logica inline, igual que `rpe.ts` (ver ese archivo para el mismo patron).
 *
 * Diferencia deliberada con la app: la app compara contra `new Date()` en la
 * zona horaria del NAVEGADOR del coach. Ese runtime no es fijo para el MCP
 * (Claude Desktop corre en la maquina del coach; el futuro deploy HTTP
 * podria correr en cualquier TZ de servidor), asi que "hoy" se calcula en la
 * misma TZ fija que el resto del server (`America/Argentina/Buenos_Aires`,
 * ver `timezone.ts`) en vez de la del proceso que corre el codigo.
 */
import { DEFAULT_TIME_ZONE, instantToLocalDateStr } from "./timezone.js";

export interface ExpirationStatus {
  /** Negativo = vencido, 0 = vence hoy, positivo = faltan N dias. */
  daysUntilExpiry: number;
  /** `true` solo si ya vencio (estrictamente antes de hoy — "hoy" no cuenta). */
  isOverdue: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Dias de calendario entre dos fechas "YYYY-MM-DD" (b - a). */
function daysBetweenDateStrings(a: string, b: string): number {
  const aMs = Date.parse(`${a}T00:00:00Z`);
  const bMs = Date.parse(`${b}T00:00:00Z`);
  return Math.round((bMs - aMs) / MS_PER_DAY);
}

/**
 * @param endDate "YYYY-MM-DD" — `training_plan_assignments.end_date`.
 * @param now Instante actual, inyectable para tests. Default `new Date()`.
 * @param timeZone TZ en la que se calcula "hoy". Default `DEFAULT_TIME_ZONE`.
 */
export function getExpirationStatus(
  endDate: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): ExpirationStatus {
  const today = instantToLocalDateStr(now.getTime(), timeZone);
  const daysUntilExpiry = daysBetweenDateStrings(today, endDate);

  return {
    daysUntilExpiry,
    isOverdue: daysUntilExpiry < 0,
  };
}
