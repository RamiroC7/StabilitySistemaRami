import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useDataCacheStore } from "@/store/dataCacheStore";

export interface RankingEntry {
  student_id: string;
  first_name: string;
  last_name: string;
  profile_image: string | null;
  attendance_count: number;
  rank: number;
}

interface UseMonthlyRankingReturn {
  ranking: RankingEntry[];
  loading: boolean;
  error: string | null;
}

/** Returns the first day of the month as "YYYY-MM-DD" */
export function getMonthStart(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/**
 * Fetches the monthly attendance ranking via a SECURITY DEFINER RPC function.
 * Results are cached in dataCacheStore keyed by monthStart ("YYYY-MM-01").
 * Re-entering the tab never triggers a second fetch for an already-loaded month.
 *
 * Using RPC instead of a direct table/view query is required because
 * workout_completions has RLS policies that restrict students to their own rows.
 * The server-side function executes with owner privileges and only exposes
 * aggregated attendance counts — no raw workout details.
 */
export function useMonthlyRanking(monthStart: string): UseMonthlyRankingReturn {
  const cached = useDataCacheStore((s) => s.monthlyRankings[monthStart]);
  const isLoaded = useDataCacheStore(
    (s) => s.loadedMonthlyRankings[monthStart] ?? false,
  );
  const setMonthlyRankingData = useDataCacheStore((s) => s.setMonthlyRankingData);

  const [loading, setLoading] = useState(!isLoaded);
  const [error, setError] = useState<string | null>(null);

  // Reset loading state if monthStart changes
  const [prevMonthStart, setPrevMonthStart] = useState(monthStart);
  if (monthStart !== prevMonthStart) {
    setPrevMonthStart(monthStart);
    setLoading(!isLoaded);
  }

  useEffect(() => {
    let cancelled = false;

    const fetchRanking = async (showLoading = true) => {
      if (showLoading && !isLoaded) setLoading(true);
      setError(null);

      const { data, error: err } = await supabase.rpc("get_monthly_ranking", {
        p_month_start: monthStart,
      });

      if (cancelled) return;
      
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const withRank: RankingEntry[] = (data ?? []).map(
        (
          row: {
            student_id: string;
            first_name: string;
            last_name: string;
            profile_image: string | null;
            attendance_count: number;
          },
          i: number,
        ) => ({
          student_id: row.student_id,
          first_name: row.first_name,
          last_name: row.last_name,
          profile_image: row.profile_image,
          attendance_count: Number(row.attendance_count),
          rank: i + 1,
        }),
      );
      
      setMonthlyRankingData(monthStart, withRank);
      setLoading(false);
    };

    // Initial fetch if not in cache
    if (!isLoaded) {
      fetchRanking();
    } else {
      // Even if cached, fetch quietly to ensure we have the latest data
      fetchRanking(false);
    }

    // Set up Realtime subscription for live updates
    const channel = supabase
      .channel("public:workout_completions:ranking")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_completions" },
        () => {
          // When any workout completion changes, quietly refetch the ranking
          fetchRanking(false);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [monthStart, isLoaded, setMonthlyRankingData]);

  return { ranking: cached ?? [], loading, error };
}
