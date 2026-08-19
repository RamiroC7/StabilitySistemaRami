// Cola de escritura offline para el guardado de entrenamientos.
//
// Problema que resuelve: la app ya lee offline (cache en memoria + precache
// del service worker), pero no escribia offline — si el alumno terminaba la
// rutina sin señal, el INSERT en workout_completions (y el de
// exercise_weight_logs) fallaba y se perdia la sesion entera.
//
// Esta cola persiste en localStorage el payload completo (completion +
// exercise logs juntos, para que no queden inconsistentes entre si) y lo
// reintenta cuando vuelve la conexion. La escritura es idempotente: cada
// fila lleva un id generado en el cliente y se hace upsert por ese id, asi
// un reintento duplicado nunca crea dos sesiones.
import { supabase } from "@/lib/supabase";
import { useDataCacheStore } from "@/store/dataCacheStore";
import { recomputeAssignmentProgress } from "@/lib/assignmentProgress";
import type { SeriesLog } from "@/features/training/types";
import type { SetDetail } from "@/hooks/useExerciseWeightLogs";

export interface QueuedExerciseLog {
  id: string; // generado en el cliente — idempotencia via upsert
  exerciseId: string;
  exerciseName: string;
  planDayNumber: number;
  planDayName: string;
  series: number;
  setsDetail: SetDetail[];
}

export interface QueuedWorkoutCompletion {
  localId: string; // = id de workout_completions — idempotencia via upsert
  studentId: string;
  assignmentId: string;
  dayNumber: number;
  queuedAt: string; // ISO — para el vencimiento de la cola
  rpe: number | null;
  initialMood: string | null;
  mood: string | null; // ya mapeado al valor valido del constraint de BD
  moodComment: string | null;
  totalSetsDone: number;
  durationMinutes: number | null;
  seriesLog: SeriesLog;
  exerciseLogs: QueuedExerciseLog[];
}

const QUEUE_KEY = "pending-completions";
const MAX_QUEUE_AGE_DAYS = 7;

// Evita que dos flushes corran en simultaneo (listener 'online' + retry al
// montar la app pueden dispararse casi a la vez).
let isFlushing = false;

export function readQueue(): QueuedWorkoutCompletion[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedWorkoutCompletion[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // localStorage lleno o no disponible — no hay mucho mas para hacer aca,
    // pero no queremos que esto tire la app abajo.
  }
}

export function enqueueCompletion(item: QueuedWorkoutCompletion) {
  const items = readQueue();
  items.push(item);
  writeQueue(items);
}

function isExpired(item: QueuedWorkoutCompletion): boolean {
  const ageMs = Date.now() - new Date(item.queuedAt).getTime();
  return ageMs > MAX_QUEUE_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/** true si el error parece de conectividad (y por lo tanto conviene encolar en vez de mostrar un error real). */
export function isLikelyNetworkError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof TypeError) return true; // fetch tira TypeError en fallo de red
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: unknown }).message ?? "")
      : String(err ?? "");
  return /failed to fetch|network|fetch failed|load failed/i.test(message);
}

/**
 * Ejecuta la escritura real (completion + assignment recompute + exercise
 * logs) contra Supabase. La usan tanto el guardado en vivo como el reintento
 * de la cola — misma logica, un solo lugar.
 */
export async function performCompletionSync(
  item: QueuedWorkoutCompletion,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1 — upsert de la fila de completion (idempotente por id)
    const { error: insertErr } = await supabase
      .from("workout_completions")
      .upsert(
        {
          id: item.localId,
          student_id: item.studentId,
          assignment_id: item.assignmentId,
          day_number: item.dayNumber,
          rpe: item.rpe,
          initial_mood: item.initialMood,
          mood: item.mood,
          mood_comment: item.moodComment,
          total_sets_done: item.totalSetsDone,
          duration_minutes: item.durationMinutes,
          series_log: item.seriesLog as Record<string, unknown>,
        },
        { onConflict: "id" },
      );

    if (insertErr) return { success: false, error: insertErr.message };

    // Step 2 y 3 — recalcular completed_days/status de la asignacion a
    // partir del estado real en workout_completions (misma logica que usa
    // el borrado, factorizada en assignmentProgress.ts).
    const progressResult = await recomputeAssignmentProgress(
      item.studentId,
      item.assignmentId,
      item.dayNumber,
    );
    if (!progressResult.success) return progressResult;

    // Step 4 — upsert de exercise_weight_logs (idempotente por id, junto
    // con la completion — si uno de los dos falla, se reintenta el item
    // completo la proxima vez, nunca queda uno sin el otro)
    if (item.exerciseLogs.length > 0) {
      const { error: logsError } = await supabase
        .from("exercise_weight_logs")
        .upsert(
          item.exerciseLogs.map((log) => ({
            id: log.id,
            student_id: item.studentId,
            assignment_id: item.assignmentId,
            exercise_id: log.exerciseId,
            exercise_name: log.exerciseName,
            plan_day_number: log.planDayNumber,
            plan_day_name: log.planDayName,
            series: log.series,
            sets_detail: log.setsDetail,
          })),
          { onConflict: "id" },
        );

      if (logsError) return { success: false, error: logsError.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error inesperado",
    };
  }
}

/**
 * Vacía la cola: descarta entradas vencidas (> MAX_QUEUE_AGE_DAYS) y
 * reintenta el resto. Las que sigan fallando quedan en la cola para el
 * proximo intento (listener 'online' o el retry al montar la app).
 */
export async function flushPendingCompletions(): Promise<void> {
  if (isFlushing) return;
  if (!navigator.onLine) return;

  const items = readQueue();
  if (items.length === 0) return;

  isFlushing = true;
  try {
    const remaining: QueuedWorkoutCompletion[] = [];
    const affectedStudentIds = new Set<string>();

    for (const item of items) {
      if (isExpired(item)) continue; // se descarta, no se reintenta ni se guarda

      const result = await performCompletionSync(item);
      if (result.success) {
        affectedStudentIds.add(item.studentId);
      } else {
        remaining.push(item);
      }
    }

    writeQueue(remaining);

    // Invalida cachés de los alumnos cuyas sesiones recien se sincronizaron,
    // para que las pantallas de progreso/constancia reflejen los datos reales.
    const store = useDataCacheStore.getState();
    for (const studentId of affectedStudentIds) {
      store.invalidateWorkoutCompletions(studentId);
      store.invalidateActiveAssignment(studentId);
      store.invalidateStudentConstancia(studentId);
      store.invalidateExerciseWeightLogs(studentId);
    }
  } finally {
    isFlushing = false;
  }
}

// Se registra una sola vez por carga de la app (los modulos de ES se
// evaluan una sola vez), no por cada componente que use el hook.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void flushPendingCompletions();
  });
}
