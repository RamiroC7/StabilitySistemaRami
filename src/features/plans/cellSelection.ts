// Seleccion tipo planilla de calculo para las 4 columnas de datos del
// planificador (Series, Reps/Min, Carga, Pausa): click para seleccionar una
// celda, shift+click para extender el rango a un rectangulo, y con 2+ celdas
// seleccionadas: Delete/Backspace borra todo el rango de una, Ctrl+C copia,
// Ctrl+V pega. Circuitos quedan afuera (tienen una UI/dato distinto, a nivel
// de grupo) — la seleccion solo aplica a filas de ejercicio individuales.
import type { PlanExercise } from "@/lib/types";

export const SELECTABLE_FIELDS = ["series", "reps", "carga", "pause"] as const;
export type SelectableField = (typeof SELECTABLE_FIELDS)[number];

export interface CellSelectionState {
  anchorRow: number;
  anchorCol: number;
  focusRow: number;
  focusCol: number;
}

export function getSelectionBounds(sel: CellSelectionState) {
  return {
    minRow: Math.min(sel.anchorRow, sel.focusRow),
    maxRow: Math.max(sel.anchorRow, sel.focusRow),
    minCol: Math.min(sel.anchorCol, sel.focusCol),
    maxCol: Math.max(sel.anchorCol, sel.focusCol),
  };
}

export function isMultiCellSelection(sel: CellSelectionState): boolean {
  const { minRow, maxRow, minCol, maxCol } = getSelectionBounds(sel);
  return minRow !== maxRow || minCol !== maxCol;
}

/**
 * A que campo real de PlanExercise apunta una columna "abstracta" para esta
 * fila puntual — o null si esa celda esta bloqueada/no aplica (series de un
 * ejercicio dentro de un circuito, carga en un ejercicio de cardio).
 */
export function resolveWritableField(
  ex: PlanExercise,
  field: SelectableField,
): "series" | "reps" | "carga" | "pause" | "cardio_duration_min" | null {
  const isCardio = ex.stage_name?.toLowerCase() === "cardio";

  if (field === "series") {
    return ex.circuit_group ? null : "series";
  }
  if (field === "reps") {
    return isCardio ? "cardio_duration_min" : "reps";
  }
  if (field === "carga") {
    return isCardio ? null : "carga";
  }
  // "pause" siempre tiene un campo real en filas de ejercicio individual
  // (el bloqueo de "ultima pausa de circuito" solo aplica dentro de
  // CircuitCard, que ya queda afuera de esta seleccion)
  return "pause";
}

export function readFieldValue(ex: PlanExercise, field: SelectableField): string {
  const key = resolveWritableField(ex, field);
  if (!key) return "";
  const raw = ex[key];
  return raw === undefined || raw === null ? "" : String(raw);
}

/** Como escribir un valor pegado/borrado en esa celda, respetando el mismo
 * parseo que ya usa cada input (series/duracion cardio son numericas). */
export function computeFieldUpdate(
  ex: PlanExercise,
  field: SelectableField,
  rawValue: string,
): Partial<PlanExercise> | null {
  const key = resolveWritableField(ex, field);
  if (!key) return null;
  if (key === "series" || key === "cardio_duration_min") {
    return { [key]: rawValue === "" ? "" : parseInt(rawValue) || 0 };
  }
  return { [key]: rawValue };
}
