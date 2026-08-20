import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useDataCacheStore } from "@/store/dataCacheStore";
import { selectPendingDay } from "@/lib/pendingDay";

export interface AvailableDay {
  id: string;
  dayNumber: number;
  dayName: string;
  exerciseCount: number;
}

export interface ActiveAssignment {
  assignmentId: string;
  planId: string;
  planTitle: string;
  currentDayNumber: number;
  currentDayId: string;
  currentDayName: string;
  totalDays: number;
  completedDays: number;
  startDate: string;
  endDate: string;
  status: "active" | "completed" | "paused" | "cancelled";
  exerciseCount: number;
  daysPerWeek: number;
  availableDays: AvailableDay[];
}

interface UseActiveAssignmentReturn {
  assignment: ActiveAssignment | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useActiveAssignment(): UseActiveAssignmentReturn {
  const professor = useAuthStore((s) => s.professor);

  const activeAssignments = useDataCacheStore((s) => s.activeAssignments);
  const loadedActiveAssignments = useDataCacheStore(
    (s) => s.loadedActiveAssignments,
  );
  const setActiveAssignmentData = useDataCacheStore(
    (s) => s.setActiveAssignmentData,
  );
  const invalidateActiveAssignment = useDataCacheStore(
    (s) => s.invalidateActiveAssignment,
  );

  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentId = professor?.id;
  const isLoaded = studentId ? !!loadedActiveAssignments[studentId] : false;

  const fetch = useCallback(
    async (forceFetch = false) => {
      if (!studentId) {
        setIsFetching(false);
        return;
      }

      // Leer isLoaded directamente del store para evitar dependencia reactiva
      void useDataCacheStore.getState().loadedActiveAssignments[studentId];

      // If offline and data is already cached, skip the fetch entirely.
      // This prevents a network error from overwriting valid cached data.
      const currentIsLoaded = !!useDataCacheStore.getState().loadedActiveAssignments[studentId];
      if (!navigator.onLine && currentIsLoaded) return;

      // SWR: always fetch. On cache hit (!forceFetch && currentIsLoaded), we run
      // the request in background — loading stays false (no skeleton shown).
      // Only show the blocking spinner when there is NO cached data yet.
      setIsFetching(true);
      setError(null);
      void forceFetch; // parameter kept for the public refetch() API

      try {
        // ── Today's date in local timezone (YYYY-MM-DD) for end_date filter ──
        const d = new Date();
        const todayISO =
          d.getFullYear() +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0");

        // ── Fire BOTH queries in parallel ─────────────────────────
        const [assignmentResult, completionsResult] = await Promise.all([
          // Q1: Assignment + plan + days + exercise counts (single joined query)
          //     Only return assignments whose end_date >= today (not expired)
          supabase
            .from("training_plan_assignments")
            .select(
              `id, plan_id, student_id, start_date, end_date, status, current_day_number, completed_days,
             training_plans(title, total_days, days_per_week,
               training_plan_days(id, day_number, day_name,
                 training_plan_exercises(id)
               )
             )`,
            )
            .eq("student_id", studentId)
            .eq("status", "active")
            .gte("end_date", todayISO)
            .order("assigned_at", { ascending: false })
            .limit(1)
            .single(),

          // Q2: All completions for this student (independent)
          supabase
            .from("workout_completions")
            .select("day_number, assignment_id, completed_at")
            .eq("student_id", studentId),
        ]);

        const { data: assignmentData, error: assignmentErr } = assignmentResult;
        const { data: completionsData } = completionsResult;

        if (assignmentErr || !assignmentData) {
          // No active assignment — not an error
          setActiveAssignmentData(studentId, null);
          setIsFetching(false);
          return;
        }

        // ── Frontend guard: double-check end_date hasn't expired ──────────
        // (Handles edge cases with timezone offsets or cached data)
        if (assignmentData.end_date) {
          const endDate = new Date(assignmentData.end_date + "T23:59:59");
          const now = new Date();
          if (endDate < now) {
            setActiveAssignmentData(studentId, null);
            setIsFetching(false);
            return;
          }
        }

        // ── Parse plan info ───────────────────────────────────────
        const planInfo = (
          Array.isArray(assignmentData.training_plans)
            ? assignmentData.training_plans[0]
            : assignmentData.training_plans
        ) as {
          title: string;
          total_days: number;
          days_per_week: number;
          training_plan_days: Array<{
            id: string;
            day_number: number;
            day_name: string;
            training_plan_exercises: Array<{ id: string }>;
          }>;
        } | null;

        const planTitle = planInfo?.title ?? "Plan sin título";
        const totalDays = planInfo?.total_days ?? 0;
        const daysPerWeek =
          planInfo?.days_per_week ?? planInfo?.total_days ?? 0;

        // ── Parse days + exercise counts ──────────────────────────
        const rawDays = planInfo?.training_plan_days ?? [];
        const sortedDays = [...rawDays].sort(
          (a, b) => a.day_number - b.day_number,
        );

        const availableDays: AvailableDay[] = sortedDays.map((day) => {
          const exerciseCount = day.training_plan_exercises?.length ?? 0;
          return {
            id: day.id,
            dayNumber: day.day_number,
            dayName: day.day_name,
            exerciseCount,
          };
        });

        // ── Find next pending day ──────────────────────────────────────
        // Logica extraida a selectPendingDay (src/lib/pendingDay.ts) para
        // poder testearla sola, sin depender de Supabase ni de este hook.
        const dayData = selectPendingDay(
          sortedDays,
          completionsData ?? [],
          assignmentData.id,
          assignmentData.start_date,
        );

        if (!dayData) {
          setActiveAssignmentData(studentId, null);
          setIsFetching(false);
          return;
        }

        const exerciseCount = dayData.training_plan_exercises?.length ?? 0;

        setActiveAssignmentData(studentId, {
          assignmentId: assignmentData.id,
          planId: assignmentData.plan_id,
          planTitle,
          currentDayNumber: dayData.day_number,
          currentDayId: dayData.id,
          currentDayName: dayData.day_name,
          totalDays,
          completedDays: assignmentData.completed_days ?? 0,
          startDate: assignmentData.start_date,
          endDate: assignmentData.end_date,
          status: assignmentData.status,
          exerciseCount,
          daysPerWeek,
          availableDays,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado");
        console.error("[useActiveAssignment]", err);
      } finally {
        setIsFetching(false);
      }
    },
    [studentId, setActiveAssignmentData],
  );

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const assignment = studentId ? activeAssignments[studentId] || null : null;
  const loading = isFetching && !isLoaded;

  return {
    assignment,
    loading,
    error,
    refetch: () => {
      if (studentId) invalidateActiveAssignment(studentId);
      fetch(true);
    },
  };
}
