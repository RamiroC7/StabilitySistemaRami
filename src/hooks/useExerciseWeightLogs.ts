import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useDataCacheStore } from "@/store/dataCacheStore";

export interface SetDetail {
  set_number: number;
  target_reps: string;
  actual_reps: string | null;
  kg: number | null;
}

export interface ExerciseWeightLog {
  id: string;
  exercise_name: string;
  plan_day_number: number;
  plan_day_name: string;
  series: number;
  sets_detail: SetDetail[];
  logged_at: string;
  calculated_rm?: number | null;
}

export interface ExerciseGroup {
  exercise_name: string;
  logs: ExerciseWeightLog[];
}

export function useExerciseWeightLogs(studentId: string | undefined) {
  const [isFetching, setIsFetching] = useState(false);

  const exerciseWeightLogs = useDataCacheStore((s) => s.exerciseWeightLogs);
  const loadedExerciseWeightLogs = useDataCacheStore(
    (s) => s.loadedExerciseWeightLogs,
  );
  const setExerciseWeightLogsData = useDataCacheStore(
    (s) => s.setExerciseWeightLogsData,
  );
  const invalidateExerciseWeightLogs = useDataCacheStore(
    (s) => s.invalidateExerciseWeightLogs,
  );
  const removeExerciseWeightLog = useDataCacheStore(
    (s) => s.removeExerciseWeightLog,
  );

  const isLoaded = studentId ? !!loadedExerciseWeightLogs[studentId] : false;

  const load = useCallback(
    async () => {
      if (!studentId) {
        setIsFetching(false);
        return;
      }

      // If offline and data is already cached, skip the fetch entirely
      const currentIsLoaded = !!useDataCacheStore.getState().loadedExerciseWeightLogs[studentId];
      if (!navigator.onLine && currentIsLoaded) return;

      setIsFetching(true);

      try {
        const { data, error } = await supabase
          .from("exercise_weight_logs")
          .select(
            `
          id,
          exercise_name,
          plan_day_number,
          plan_day_name,
          series,
          sets_detail,
          logged_at
        `,
          )
          .eq("student_id", studentId)
          .order("logged_at", { ascending: false });

        if (error || !data) {
          console.error("Error loading exercise weight logs:", error);
          return;
        }

        // Función para calcular el RM usando la fórmula de Epley: 1RM = Peso × (1 + Reps/30)
        // Calcula el RM basándose EXCLUSIVAMENTE en la primera serie (set_number === 1)
        const calculateRm = (setsDetail: SetDetail[]): number | null => {
          // Buscar la serie con set_number === 1
          let firstSet = setsDetail.find((s) => s.set_number === 1);

          // Si no existe set_number === 1, usar la primera serie del arreglo
          if (!firstSet && setsDetail.length > 0) {
            firstSet = setsDetail[0];
          }

          // Validar que la serie tenga datos válidos
          if (
            !firstSet ||
            firstSet.kg == null ||
            firstSet.actual_reps == null ||
            firstSet.kg <= 0
          ) {
            return null;
          }

          const reps = parseFloat(firstSet.actual_reps);
          const weight = firstSet.kg;
          const oneRm = weight * (1 + reps / 30);

          return Math.round(oneRm * 100) / 100; // Redondear a 2 decimales
        };

        // Agrupar por nombre de ejercicio
        const groupMap = new Map<string, ExerciseWeightLog[]>();
        for (const row of data) {
          const setsDetail = row.sets_detail as SetDetail[];

          const log: ExerciseWeightLog = {
            id: row.id,
            exercise_name: row.exercise_name,
            plan_day_number: row.plan_day_number,
            plan_day_name: row.plan_day_name,
            series: row.series,
            sets_detail: setsDetail,
            logged_at: row.logged_at,
            calculated_rm: calculateRm(setsDetail),
          };
          if (!groupMap.has(row.exercise_name)) {
            groupMap.set(row.exercise_name, []);
          }
          groupMap.get(row.exercise_name)!.push(log);
        }

        // Ordenar los logs dentro de cada grupo por fecha ascendente (más antiguos primero)
        const sortedGroups = Array.from(groupMap.entries())
          .map(([name, logs]) => ({
            exercise_name: name,
            logs: logs.sort(
              (a, b) =>
                new Date(a.logged_at).getTime() -
                new Date(b.logged_at).getTime(),
            ),
          }))
          .sort((a, b) => a.exercise_name.localeCompare(b.exercise_name));

        setExerciseWeightLogsData(studentId, sortedGroups);
      } catch (err) {
        console.error("Error in useExerciseWeightLogs:", err);
      } finally {
        setIsFetching(false);
      }
    },
    [studentId, setExerciseWeightLogsData],
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Realtime subscription para sincronizar cambios entre coach y alumno
  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(`exercise_weight_logs:${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "exercise_weight_logs",
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          // Cuando hay cualquier cambio (INSERT, UPDATE, DELETE), recargar
          invalidateExerciseWeightLogs(studentId);
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, invalidateExerciseWeightLogs, load]);

  const groups = studentId ? exerciseWeightLogs[studentId] || [] : [];
  const loading = isFetching && !isLoaded;

  const deleteWeightLog = async (logId: string) => {
    if (!studentId) return;
    const { error } = await supabase
      .from("exercise_weight_logs")
      .delete()
      .eq("id", logId);
    if (error) throw error;
    removeExerciseWeightLog(studentId, logId);
  };

  return {
    groups,
    loading,
    deleteWeightLog,
    refetch: () => {
      if (studentId) invalidateExerciseWeightLogs(studentId);
      load();
    },
  };
}
