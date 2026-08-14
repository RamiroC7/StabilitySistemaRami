import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface AvailableDay {
  id: string; // UUID from training_plan_days
  dayNumber: number;
  dayName: string;
  exerciseCount: number;
}

interface UseAvailableDaysReturn {
  days: AvailableDay[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAvailableDays(
  planId: string | null,
): UseAvailableDaysReturn {
  const [days, setDays] = useState<AvailableDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!planId) {
      setLoading(false);
      setDays([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get all days for this plan
      const { data: daysData, error: daysErr } = await supabase
        .from("training_plan_days")
        .select("id, day_number, day_name")
        .eq("plan_id", planId)
        .order("day_number", { ascending: true });

      if (daysErr) {
        setError(daysErr.message);
        return;
      }

      if (!daysData || daysData.length === 0) {
        setDays([]);
        setLoading(false);
        return;
      }

      // For each day, count exercises
      const daysWithCounts = await Promise.all(
        daysData.map(async (day) => {
          const { count } = await supabase
            .from("training_plan_exercises")
            .select("id", { count: "exact", head: true })
            .eq("day_id", day.id);

          const exerciseCount = count ?? 0;

          return {
            id: day.id,
            dayNumber: day.day_number,
            dayName: day.day_name,
            exerciseCount,
          };
        }),
      );

      setDays(daysWithCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { days, loading, error, refetch: fetch };
}
