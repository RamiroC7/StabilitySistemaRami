import { useState, useEffect, useCallback } from "react";
import * as Sentry from "@sentry/react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useDataCacheStore } from "@/store/dataCacheStore";
import type { SeriesLog } from "@/features/training/types";
import type { SetDetail } from "@/hooks/useExerciseWeightLogs";
import {
  enqueueCompletion,
  flushPendingCompletions,
  isLikelyNetworkError,
  performCompletionSync,
  type QueuedWorkoutCompletion,
} from "@/lib/offlineWorkoutQueue";
import { recomputeAssignmentProgress } from "@/lib/assignmentProgress";

export interface WorkoutCompletion {
  id: string;
  assignmentId: string;
  dayNumber: number;
  completedAt: string;
  rpe: number | null;
  totalSetsDone: number | null;
  durationMinutes: number | null;
}

export interface ExerciseLogInput {
  exerciseId: string;
  exerciseName: string;
  planDayNumber: number;
  planDayName: string;
  series: number;
  setsDetail: SetDetail[];
}

export interface SaveCompletionParams {
  assignmentId: string;
  dayNumber: number;
  rpe: number | null;
  initialMood: string | null; // happy/neutral/sad — antes de entrenar
  mood: string | null; // excellent/normal/tired/pain — al finalizar
  moodComment?: string | null;
  totalSetsDone: number;
  seriesLog: SeriesLog;
  durationMinutes?: number | null;
  // Se guardan JUNTO con la completion (misma cola offline si hace falta),
  // para que nunca quede una fila sincronizada sin la otra.
  exerciseLogs?: ExerciseLogInput[];
}

interface UseWorkoutCompletionsReturn {
  completions: WorkoutCompletion[];
  completedDates: Set<string>;
  loading: boolean;
  error: string | null;
  saveCompletion: (
    params: SaveCompletionParams,
  ) => Promise<{ success: boolean; error?: string; queued?: boolean }>;
  deleteCompletion: (
    completionId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  refetch: () => void;
}

export function useWorkoutCompletions(
  explicitStudentId?: string,
): UseWorkoutCompletionsReturn {
  const professor = useAuthStore((s) => s.professor);

  const workoutCompletions = useDataCacheStore((s) => s.workoutCompletions);
  const loadedWorkoutCompletions = useDataCacheStore(
    (s) => s.loadedWorkoutCompletions,
  );
  const setWorkoutCompletionsData = useDataCacheStore(
    (s) => s.setWorkoutCompletionsData,
  );
  const invalidateWorkoutCompletions = useDataCacheStore(
    (s) => s.invalidateWorkoutCompletions,
  );

  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use explicit studentId if provided, otherwise use logged-in user's ID
  const studentId = explicitStudentId || professor?.id;
  const isLoaded = studentId ? !!loadedWorkoutCompletions[studentId] : false;

  const fetch = useCallback(
    async (force = false) => {
      if (!studentId) {
        setIsFetching(false);
        return;
      }

      // Leer isLoaded directamente del store para evitar dependencia reactiva
      const currentIsLoaded = useDataCacheStore.getState().loadedWorkoutCompletions[studentId];
      
      if (currentIsLoaded && !force) {
        setIsFetching(true); // SWR: fetch in background
      } else {
        setIsFetching(true);
      }
      setError(null);

      try {
        const { data, error: fetchErr } = await supabase
          .from("workout_completions")
          .select(
            "id, assignment_id, day_number, completed_at, rpe, total_sets_done, duration_minutes",
          )
          .eq("student_id", studentId)
          .order("completed_at", { ascending: false });

        if (fetchErr) {
          setError(fetchErr.message);
          return;
        }

        setWorkoutCompletionsData(
          studentId,
          (data ?? []).map((row) => ({
            id: row.id,
            assignmentId: row.assignment_id,
            dayNumber: row.day_number,
            completedAt: row.completed_at,
            rpe: row.rpe,
            totalSetsDone: row.total_sets_done,
            durationMinutes: row.duration_minutes,
          })),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setIsFetching(false);
      }
    },
    [studentId, setWorkoutCompletionsData],
  );

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const saveCompletion = useCallback(
    async (
      params: SaveCompletionParams,
    ): Promise<{ success: boolean; error?: string; queued?: boolean }> => {
      if (!professor?.id)
        return { success: false, error: "No hay usuario autenticado" };

      // Validación de datos
      if (!params.assignmentId) {
        return { success: false, error: "Assignment ID requerido" };
      }

      if (!params.dayNumber || params.dayNumber < 1) {
        return { success: false, error: "Day number inválido" };
      }

      // Mapear mood a valores válidos del constraint de BD
      let moodValue: string | null = null;
      if (params.mood) {
        const moodMap: Record<string, string> = {
          excelente: "excellent",
          normal: "normal",
          fatigado: "tired",
          molestia: "pain",
        };
        moodValue = moodMap[params.mood] || null;
      }

      // id generado en el cliente — permite reintentar (upsert) sin
      // duplicar la sesión si la escritura se encola y se sincroniza despues.
      const completionId = crypto.randomUUID();
      const item: QueuedWorkoutCompletion = {
        localId: completionId,
        studentId: professor.id,
        assignmentId: params.assignmentId,
        dayNumber: params.dayNumber,
        queuedAt: new Date().toISOString(),
        rpe: params.rpe,
        initialMood: params.initialMood || null,
        mood: moodValue,
        moodComment: params.moodComment || null,
        totalSetsDone: params.totalSetsDone,
        durationMinutes: params.durationMinutes || null,
        seriesLog: params.seriesLog,
        exerciseLogs: (params.exerciseLogs ?? []).map((log) => ({
          id: crypto.randomUUID(),
          exerciseId: log.exerciseId,
          exerciseName: log.exerciseName,
          planDayNumber: log.planDayNumber,
          planDayName: log.planDayName,
          series: log.series,
          setsDetail: log.setsDetail,
        })),
      };

      const queueForLater = () => {
        enqueueCompletion(item);

        // Actualizacion optimista de la cache local: el alumno ya ve su
        // sesion reflejada (calendario, racha) sin esperar la sincronizacion.
        // completed_days del assignment se recalcula recien al sincronizar
        // (necesita el estado real del servidor), asi que no se toca aca.
        const current =
          useDataCacheStore.getState().workoutCompletions[professor.id] ?? [];
        setWorkoutCompletionsData(professor.id, [
          {
            id: item.localId,
            assignmentId: item.assignmentId,
            dayNumber: item.dayNumber,
            completedAt: item.queuedAt,
            rpe: item.rpe,
            totalSetsDone: item.totalSetsDone,
            durationMinutes: item.durationMinutes,
          },
          ...current,
        ]);

        return { success: true, queued: true };
      };

      // Sin conexión: ni siquiera intentamos la red, directo a la cola.
      if (!navigator.onLine) {
        return queueForLater();
      }

      try {
        const result = await performCompletionSync(item);

        if (!result.success) {
          if (isLikelyNetworkError(result.error)) {
            return queueForLater();
          }
          // Fallo real de escritura (no de red): es el caso mas caro para
          // el alumno — cree que termino el entrenamiento y no quedo
          // guardado. Sin esto era completamente silencioso.
          Sentry.captureException(new Error(result.error ?? "saveCompletion failed"), {
            tags: { feature: "saveCompletion" },
            extra: {
              assignmentId: params.assignmentId,
              dayNumber: params.dayNumber,
              studentId: professor.id,
            },
          });
          return { success: false, error: result.error };
        }

        // Invalidar caché general que dependa de esto: constancias, assignment, profiles (estadísticas)
        invalidateWorkoutCompletions(professor.id);

        const dataStore = useDataCacheStore.getState();
        dataStore.invalidateActiveAssignment(professor.id);
        dataStore.invalidateStudentConstancia(professor.id);
        dataStore.invalidateExerciseWeightLogs(professor.id);

        // Refresh local state (for completions)
        await fetch(true);

        return { success: true };
      } catch (err) {
        if (isLikelyNetworkError(err)) {
          return queueForLater();
        }
        Sentry.captureException(err, {
          tags: { feature: "saveCompletion" },
          extra: {
            assignmentId: params.assignmentId,
            dayNumber: params.dayNumber,
            studentId: professor.id,
          },
        });
        return {
          success: false,
          error: err instanceof Error ? err.message : "Error inesperado",
        };
      }
    },
    [professor?.id, fetch, invalidateWorkoutCompletions, setWorkoutCompletionsData],
  );

  // Reintento al montar: si quedaron sesiones pendientes de una salida sin
  // señal, se intentan sincronizar apenas la app vuelve a abrirse. El
  // listener de 'online' (registrado una sola vez a nivel de módulo en
  // offlineWorkoutQueue.ts) cubre el caso de recuperar señal a mitad de uso.
  useEffect(() => {
    void flushPendingCompletions();
  }, []);

  const deleteCompletion = useCallback(
    async (completionId: string): Promise<{ success: boolean; error?: string }> => {
      if (!studentId)
        return { success: false, error: "No hay usuario autenticado" };

      const target = (
        useDataCacheStore.getState().workoutCompletions[studentId] ?? []
      ).find((c) => c.id === completionId);
      if (!target)
        return { success: false, error: "Entrenamiento no encontrado" };

      try {
        const { error: deleteErr, count } = await supabase
          .from("workout_completions")
          .delete({ count: "exact" })
          .eq("id", completionId)
          .eq("student_id", studentId);

        if (deleteErr) return { success: false, error: deleteErr.message };

        // Si RLS bloquea el DELETE (falta la policy), Supabase no tira error
        // — simplemente no borra ninguna fila. Sin este chequeo, count sería
        // 0 y el llamador pensaría que se borró cuando en realidad no pasó
        // nada.
        if (!count) {
          return {
            success: false,
            error:
              "No se pudo eliminar (sin permiso). Verificá la policy de DELETE en workout_completions.",
          };
        }

        // Best-effort: borra tambien los registros de peso de esa misma
        // sesion. exercise_weight_logs no tiene un id de completion para
        // vincularlos exacto, asi que se identifican por assignment + dia
        // (coincide con como se guardaron juntos al completar la rutina).
        await supabase
          .from("exercise_weight_logs")
          .delete()
          .eq("student_id", studentId)
          .eq("assignment_id", target.assignmentId)
          .eq("plan_day_number", target.dayNumber);

        const progressResult = await recomputeAssignmentProgress(
          studentId,
          target.assignmentId,
        );
        if (!progressResult.success) {
          console.warn(
            "[useWorkoutCompletions] No se pudo recalcular el progreso tras borrar:",
            progressResult.error,
          );
        }

        invalidateWorkoutCompletions(studentId);
        const dataStore = useDataCacheStore.getState();
        dataStore.invalidateActiveAssignment(studentId);
        dataStore.invalidateStudentConstancia(studentId);
        dataStore.invalidateExerciseWeightLogs(studentId);

        await fetch(true);

        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Error inesperado",
        };
      }
    },
    [studentId, fetch, invalidateWorkoutCompletions],
  );

  // Completions cached state
  const completions = studentId ? workoutCompletions[studentId] || [] : [];
  const loading = isFetching && !isLoaded;

  // Build a Set of 'YYYY-MM-DD' strings for completed dates
  const completedDates: Set<string> = new Set(
    completions.map((c: WorkoutCompletion) => c.completedAt.slice(0, 10)),
  );

  const refetch = useCallback(() => {
    if (studentId) invalidateWorkoutCompletions(studentId);
    fetch(true);
  }, [studentId, invalidateWorkoutCompletions, fetch]);

  return {
    completions,
    completedDates,
    loading,
    error,
    saveCompletion,
    deleteCompletion,
    refetch,
  };
}
