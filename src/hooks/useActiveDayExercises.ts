import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useDataCacheStore } from "@/store/dataCacheStore";
import { useTrainingStore } from "@/features/training/store/trainingStore";
import type {
  WorkoutDay,
  Exercise,
  ExerciseSet,
} from "@/features/training/types";

interface UseActiveDayExercisesReturn {
  workoutDay: WorkoutDay | null;
  loading: boolean;
  error: string | null;
}

/** Parse a pause string like "60s", "90s", "2min", "1.5min" into seconds. */
function parsePauseToSeconds(pause: string | null | undefined): number {
  if (!pause) return 0;
  const lower = pause.toLowerCase().trim();
  if (lower === "sin descanso" || lower === "0" || lower === "0s" || lower === "0min") return 0;
  const minMatch = lower.match(/^(\d+(?:\.\d+)?)\s*min/);
  if (minMatch) return Math.round(parseFloat(minMatch[1]) * 60);
  const secMatch = lower.match(/^(\d+)\s*s/);
  if (secMatch) return parseInt(secMatch[1], 10);
  const plainNum = parseFloat(lower);
  if (!isNaN(plainNum)) return plainNum > 10 ? plainNum : plainNum * 60;
  return 0;
}

export function useActiveDayExercises(
  dayId: string | null,
): UseActiveDayExercisesReturn {
  const dayExercises = useDataCacheStore((s) => s.dayExercises);
  const loadedDayExercises = useDataCacheStore((s) => s.loadedDayExercises);
  const setDayExercisesData = useDataCacheStore((s) => s.setDayExercisesData);
  // Access the global exercise library (already loaded in memory) to resolve
  // the most up-to-date video_url for each exercise by name.
  const globalExercises = useTrainingStore((s) => s.globalExercises);

  // Track in-flight requests to avoid duplicate fetches for the same dayId
  const fetchingRef = useRef<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchDay = useCallback(
    async (id: string) => {
      // Build a lookup map: lowercase exercise name → live video_url from library
      const libraryVideoMap = new Map<string, string | null>();
      for (const libEx of globalExercises) {
        libraryVideoMap.set(libEx.name.toLowerCase(), libEx.video_url ?? null);
      }
      // Dedup: skip if already fetching this dayId
      if (fetchingRef.current.has(id)) return;
      fetchingRef.current.add(id);
      setError(null);

      try {
        const [{ data: dayData, error: dayErr }, { data: exercises, error: exErr }] =
          await Promise.all([
            supabase
              .from("training_plan_days")
              .select("id, day_number, day_name")
              .eq("id", id)
              .single(),
            supabase
              .from("training_plan_exercises")
              .select(
                "id, exercise_name, series, reps, pause, stage_name, notes, coach_instructions, video_url, display_order, write_weight, carga, cardio_duration_min, circuit_group",
              )
              .eq("day_id", id)
              .order("display_order", { ascending: true }),
          ]);

        if (dayErr || !dayData) {
          setError(dayErr?.message ?? "Día no encontrado");
          return;
        }
        if (exErr) {
          setError(exErr.message);
          return;
        }

        const mappedExercises: Exercise[] = (exercises ?? []).map(
          (ex: {
            id: string;
            exercise_name: string;
            series: number;
            reps: string;
            pause: string;
            stage_name: string | null;
            notes: string | null;
            coach_instructions: string | null;
            video_url: string | null;
            display_order: number;
            write_weight?: boolean;
            carga?: string;
            cardio_duration_min?: number | null;
            circuit_group?: string | null;
          }) => {
            const sets: ExerciseSet[] = Array.from(
              { length: Math.max(ex.series || 1, 1) },
              (_, i) => ({
                setNumber: i + 1,
                targetReps: ex.reps || "",
                targetWeight: 0,
              }),
            );

            const instructionParts: string[] = [];
            if (ex.notes) instructionParts.push(ex.notes);
            if (ex.coach_instructions)
              instructionParts.push(ex.coach_instructions);

            return {
              id: ex.id,
              name: ex.exercise_name,
              category: ex.stage_name ?? "",
              sets,
              restSeconds: parsePauseToSeconds(ex.pause),
              // Prefer the URL saved in the plan (what the coach explicitly set).
              // Falls back to the library URL only if the plan exercise has none.
              videoUrl: (
                ex.video_url
                  ? ex.video_url
                  : libraryVideoMap.get(ex.exercise_name.toLowerCase())
              ) ?? undefined,
              instructions: instructionParts.join(" — ") || undefined,
              writeWeight: ex.write_weight ?? false,
              carga: ex.carga ?? undefined,
              cardioDurationMin: ex.cardio_duration_min ?? undefined,
              circuit_group: ex.circuit_group ?? null,
            };
          },
        );

        setDayExercisesData(id, {
          id: dayData.day_number,
          name: dayData.day_name,
          exercises: mappedExercises,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        fetchingRef.current.delete(id);
      }
    },
    [setDayExercisesData, globalExercises],
  );

  useEffect(() => {
    if (!dayId) return;

    const isLoaded = !!loadedDayExercises[dayId];

    if (isLoaded) {
      // SWR: cache hit → return immediately, revalidate silently in background
      fetchDay(dayId);
    } else {
      // Cache miss → fetch (will show loading skeleton)
      fetchDay(dayId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId]);

  if (!dayId) return { workoutDay: null, loading: false, error: null };

  const isLoaded = !!loadedDayExercises[dayId];
  const isFetching = fetchingRef.current.has(dayId);
  const workoutDay = dayExercises[dayId] ?? null;

  // Only show skeleton on first load (no cached data yet)
  const loading = !isLoaded && isFetching;

  return { workoutDay, loading, error };
}
