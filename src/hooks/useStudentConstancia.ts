import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useDataCacheStore } from "@/store/dataCacheStore";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TrainingSession {
  id: string;
  dayNumber: number;
  completedAt: string;
  initialMood: string | null; // happy/neutral/sad — antes de entrenar
  mood: string | null; // excellent/normal/tired/pain — al finalizar
  moodComment: string | null; // comentario libre del alumno
  rpe: number | null;
  durationMinutes: number | null;
}

export interface PlanConstancia {
  assignmentId: string;
  planTitle: string;
  startDate: string;
  endDate: string;
  status: string;
  daysPerWeek: number;
  sessions: TrainingSession[];
}

// ── Label maps ─────────────────────────────────────────────────────────────

// Labels para el mood inicial (antes de entrenar)
export const INITIAL_MOOD_LABELS: Record<string, string> = {
  happy: "Feliz",
  neutral: "Neutro",
  sad: "Triste",
};

export const INITIAL_MOOD_EMOJIS: Record<string, string> = {
  happy: "😊",
  neutral: "😐",
  sad: "😢",
};

// Labels para el mood final (post-entrenamiento)
export const MOOD_LABELS: Record<string, string> = {
  excellent: "Excelente",
  normal: "Normal",
  tired: "Fatigado",
  pain: "Molestia",
  // legacy values (just in case)
  happy: "Feliz",
  neutral: "Neutro",
  sad: "Triste",
};

export const MOOD_EMOJIS: Record<string, string> = {
  excellent: "🔥",
  normal: "😊",
  tired: "😓",
  pain: "🤕",
  // legacy
  happy: "😊",
  neutral: "😐",
  sad: "😢",
};

// ── Hook ───────────────────────────────────────────────────────────────────

export function useStudentConstancia(studentId: string | undefined) {
  const studentConstancias = useDataCacheStore((s) => s.studentConstancias);
  const loadedStudentConstancias = useDataCacheStore(
    (s) => s.loadedStudentConstancias,
  );
  const setStudentConstanciaData = useDataCacheStore(
    (s) => s.setStudentConstanciaData,
  );
  const invalidateStudentConstancia = useDataCacheStore(
    (s) => s.invalidateStudentConstancia,
  );

  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoaded = studentId ? !!loadedStudentConstancias[studentId] : false;

  const load = useCallback(
    async (force = false) => {
      if (!studentId) {
        setIsFetching(false);
        return;
      }

      // If offline and data is already cached, skip the fetch entirely
      const currentIsLoaded = !!useDataCacheStore.getState().loadedStudentConstancias[studentId];
      if (!navigator.onLine && currentIsLoaded) {
        setIsFetching(false);
        return;
      }

      // SWR: always revalidate. Only show blocking spinner on first load.
      setIsFetching(true);
      setError(null);
      void force;

      try {
        // Fetch all assignments for this student with completions
        const { data: assignments, error: assignErr } = await supabase
          .from("training_plan_assignments")
          .select(
            `
          id,
          start_date,
          end_date,
          status,
          training_plans (
            title,
            days_per_week,
            total_days
          )
        `,
          )
          .eq("student_id", studentId)
          .order("start_date", { ascending: false });

        if (assignErr) throw assignErr;
        if (!assignments || assignments.length === 0) {
          setStudentConstanciaData(studentId, []);
          setIsFetching(false);
          return;
        }

        const assignmentIds = assignments.map((a) => a.id);

        // Fetch all completions for those assignments
        const { data: completions, error: completionErr } = await supabase
          .from("workout_completions")
          .select(
            "id, assignment_id, day_number, completed_at, initial_mood, mood, mood_comment, rpe, duration_minutes",
          )
          .in("assignment_id", assignmentIds)
          .order("completed_at", { ascending: false });

        if (completionErr) throw completionErr;

        // Group completions by assignment
        const completionsByAssignment: Record<string, TrainingSession[]> = {};
        for (const c of completions ?? []) {
          if (!completionsByAssignment[c.assignment_id]) {
            completionsByAssignment[c.assignment_id] = [];
          }
          completionsByAssignment[c.assignment_id].push({
            id: c.id,
            dayNumber: c.day_number,
            completedAt: c.completed_at,
            initialMood: c.initial_mood ?? null,
            mood: c.mood ?? null,
            moodComment: c.mood_comment ?? null,
            rpe: c.rpe ?? null,
            durationMinutes: c.duration_minutes ?? null,
          });
        }

        // Build the final structure
        const result: PlanConstancia[] = assignments.map((a) => {
          const tp = Array.isArray(a.training_plans)
            ? a.training_plans[0]
            : (a.training_plans as {
                title?: string;
                days_per_week?: number;
                total_days?: number;
              } | null);

          return {
            assignmentId: a.id,
            planTitle: tp?.title ?? "Plan sin nombre",
            startDate: a.start_date,
            endDate: a.end_date,
            status: a.status,
            daysPerWeek: tp?.total_days ?? tp?.days_per_week ?? 3,
            sessions: completionsByAssignment[a.id] ?? [],
          };
        });

        setStudentConstanciaData(studentId, result);
      } catch (err) {
        console.error("[useStudentConstancia]", err);
        setError(err instanceof Error ? err.message : "Error al cargar datos");
      } finally {
        setIsFetching(false);
      }
    },
    [studentId, setStudentConstanciaData],
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const plans = studentId ? studentConstancias[studentId] || [] : [];
  const isLoading = isFetching && !isLoaded;

  return {
    plans,
    isLoading,
    error,
    reload: () => {
      if (studentId) invalidateStudentConstancia(studentId);
      load(true);
    },
  };
}
