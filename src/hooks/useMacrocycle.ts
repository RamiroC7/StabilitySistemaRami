import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────

export interface MacrocycleObjective {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

export interface MacrocycleWeek {
  id: string;
  month_id: string;
  week_number: 1 | 2 | 3 | 4;
  notes: string;
}

export interface MacrocycleMonth {
  id: string;
  macrocycle_id: string;
  month_index: number; // 0-5
  objective_id: string | null;
  objective: MacrocycleObjective | null;
  weeks: MacrocycleWeek[];
}

export interface Macrocycle {
  id: string;
  student_id: string;
  start_date: string; // ISO date "YYYY-MM-DD"
  months: MacrocycleMonth[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns the first day of the month for the given date string (handles both date and full ISO timestamps). */
function toMonthStart(dateStr: string): string {
  // Strip time part if present, then parse as local date
  const datePart = dateStr.split("T")[0];
  const [year, month] = datePart.split("-");
  return `${year}-${month}-01`;
}

/** Returns YYYY-MM-DD of the first day of the current month. */
export function currentMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Given a macrocycle start_date and month_index, returns a Date for that month. */
export function macrocycleMonthDate(startDate: string, index: number): Date {
  const d = new Date(startDate + "T00:00:00");
  d.setMonth(d.getMonth() + index);
  return d;
}

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function monthName(date: Date): string {
  return MONTH_NAMES_ES[date.getMonth()];
}

// ── Ensure rows exist (upsert skeleton) ────────────────────────────────────

async function ensureMacrocycleRows(
  macrocycleId: string,
  monthIds: Record<number, string>,
) {
  // ensure 4 weeks per month
  const weekRows = Object.entries(monthIds)
    .flatMap(([idx, monthId]) =>
      [1, 2, 3, 4].map((week_number) => ({
        month_id: monthId,
        week_number,
        notes: "",
        // dummy idx just to silence unused warning
        _idx: idx,
      })),
    )
    .map(({ month_id, week_number, notes }) => ({
      month_id,
      week_number,
      notes,
    }));

  if (weekRows.length > 0) {
    await supabase.from("macrocycle_weeks").upsert(weekRows, {
      onConflict: "month_id,week_number",
      ignoreDuplicates: true,
    });
  }
  void macrocycleId;
}

// ── Hook: objectives CRUD ──────────────────────────────────────────────────

export function useMacrocycleObjectives() {
  const [objectives, setObjectives] = useState<MacrocycleObjective[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchObjectives = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("macrocycle_objectives")
      .select("id, name, color, display_order")
      .order("display_order");
    setObjectives(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchObjectives();
  }, [fetchObjectives]);

  const createObjective = useCallback(
    async (name: string, color: string) => {
      const maxOrder =
        objectives.length > 0
          ? Math.max(...objectives.map((o) => o.display_order))
          : -1;
      const { error } = await supabase.from("macrocycle_objectives").insert({
        name: name.trim(),
        color,
        display_order: maxOrder + 1,
      });
      if (!error) await fetchObjectives();
      return error;
    },
    [objectives, fetchObjectives],
  );

  const updateObjective = useCallback(
    async (id: string, patch: { name?: string; color?: string }) => {
      const { error } = await supabase
        .from("macrocycle_objectives")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (!error) await fetchObjectives();
      return error;
    },
    [fetchObjectives],
  );

  const deleteObjective = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("macrocycle_objectives")
        .delete()
        .eq("id", id);
      if (!error) await fetchObjectives();
      return error;
    },
    [fetchObjectives],
  );

  return {
    objectives,
    loading,
    createObjective,
    updateObjective,
    deleteObjective,
    refetch: fetchObjectives,
  };
}

// ── Hook: macrocycle for a student ────────────────────────────────────────

export function useMacrocycle(studentId: string, studentCreatedAt: string) {
  const [macrocycles, setMacrocycles] = useState<Macrocycle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Internal fetch — does NOT touch `loading` so the caller controls it
  const fetchMacrocyclesData = useCallback(async (): Promise<Macrocycle[]> => {
    if (!studentId) return [];

    // Step 1: fetch macrocycles
    const { data: mcData, error: mcError } = await supabase
      .from("macrocycles")
      .select("id, student_id, start_date")
      .eq("student_id", studentId)
      .order("start_date");

    if (mcError) {
      console.error("[useMacrocycle] macrocycles fetch error:", mcError);
      return [];
    }
    if (!mcData || mcData.length === 0) return [];

    // Step 2: fetch months + weeks + objectives for all those macrocycle IDs
    const mcIds = mcData.map((m) => m.id);
    const { data: monthData, error: monthError } = await supabase
      .from("macrocycle_months")
      .select(
        `id, macrocycle_id, month_index, objective_id,
         macrocycle_objectives ( id, name, color, display_order ),
         macrocycle_weeks ( id, month_id, week_number, notes )`,
      )
      .in("macrocycle_id", mcIds)
      .order("month_index");

    if (monthError) {
      console.error("[useMacrocycle] months fetch error:", monthError);
      return [];
    }

    const months = monthData ?? [];

    return mcData.map((mc) => ({
      id: mc.id,
      student_id: mc.student_id,
      start_date: mc.start_date,
      months: (months as unknown as MacrocycleMonthRaw[])
        .filter((m) => m.macrocycle_id === mc.id)
        .sort((a, b) => a.month_index - b.month_index)
        .map((m) => ({
          id: m.id,
          macrocycle_id: m.macrocycle_id,
          month_index: m.month_index,
          objective_id: m.objective_id,
          objective: m.macrocycle_objectives ?? null,
          weeks: (m.macrocycle_weeks ?? []).sort(
            (a, b) => a.week_number - b.week_number,
          ),
        })),
    }));
  }, [studentId]);

  // Public refetch — controls loading spinner
  const fetchMacrocycles = useCallback(async () => {
    setLoading(true);
    const parsed = await fetchMacrocyclesData();
    setMacrocycles(parsed);
    setCurrentIndex(parsed.length > 0 ? parsed.length - 1 : 0);
    setLoading(false);
  }, [fetchMacrocyclesData]);

  // Auto-create the first macrocycle if none exist — keeps loading=true throughout
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        let parsed = await fetchMacrocyclesData();

        if (parsed.length === 0) {
          const startDate = toMonthStart(studentCreatedAt);
          console.log(
            "[useMacrocycle] creating first macrocycle, startDate:",
            startDate,
          );
          await createMacrocycleForDate(startDate);
          parsed = await fetchMacrocyclesData();
          console.log("[useMacrocycle] after creation, parsed:", parsed.length);
        }

        setMacrocycles(parsed);
        setCurrentIndex(parsed.length > 0 ? parsed.length - 1 : 0);
      } catch (err) {
        console.error("[useMacrocycle] init error:", err);
      } finally {
        setLoading(false);
      }
    }
    if (studentId) init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function createMacrocycleForDate(startDate: string) {
    // 1. Create macrocycle
    const { data: mc, error } = await supabase
      .from("macrocycles")
      .insert({ student_id: studentId, start_date: startDate })
      .select("id")
      .single();
    if (error) {
      console.error("[useMacrocycle] macrocycle insert error:", error);
      return;
    }
    if (!mc) return;

    // 2. Create 6 months
    const monthRows = Array.from({ length: 6 }, (_, i) => ({
      macrocycle_id: mc.id,
      month_index: i,
    }));
    const { data: months } = await supabase
      .from("macrocycle_months")
      .insert(monthRows)
      .select("id, month_index");

    if (!months) return;

    // 3. Create 4 weeks per month
    const monthIdMap: Record<number, string> = {};
    months.forEach((m) => {
      monthIdMap[m.month_index] = m.id;
    });
    await ensureMacrocycleRows(mc.id, monthIdMap);
  }

  const deleteMacrocycle = useCallback(
    async (macrocycleId: string) => {
      // FK ON DELETE CASCADE handles months + weeks automatically
      await supabase.from("macrocycles").delete().eq("id", macrocycleId);
      const updated = await fetchMacrocyclesData();
      setMacrocycles(updated);
      setCurrentIndex(Math.max(0, updated.length - 1));
    },
    [fetchMacrocyclesData],
  );

  const addNextMacrocycle = useCallback(async () => {
    if (macrocycles.length === 0) return;
    const last = macrocycles[macrocycles.length - 1];
    const lastStart = new Date(last.start_date + "T00:00:00");
    lastStart.setMonth(lastStart.getMonth() + 6);
    const nextStart = `${lastStart.getFullYear()}-${String(lastStart.getMonth() + 1).padStart(2, "0")}-01`;
    await createMacrocycleForDate(nextStart);
    await fetchMacrocycles();
    setCurrentIndex(macrocycles.length); // will be the new last
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [macrocycles]);

  const updateMonthObjective = useCallback(
    async (monthId: string, objectiveId: string | null) => {
      setSaving(true);
      await supabase
        .from("macrocycle_months")
        .update({
          objective_id: objectiveId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", monthId);
      // Use internal fetch to avoid resetting currentIndex to last cycle
      const parsed = await fetchMacrocyclesData();
      setMacrocycles(parsed);
      setSaving(false);
    },
    [fetchMacrocyclesData],
  );

  const updateWeekNotes = useCallback(async (weekId: string, notes: string) => {
    await supabase
      .from("macrocycle_weeks")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", weekId);
    // Optimistic local update
    setMacrocycles((prev) =>
      prev.map((mc) => ({
        ...mc,
        months: mc.months.map((m) => ({
          ...m,
          weeks: m.weeks.map((w) => (w.id === weekId ? { ...w, notes } : w)),
        })),
      })),
    );
  }, []);

  const activeMacrocycle = macrocycles[currentIndex] ?? null;

  return {
    macrocycles,
    activeMacrocycle,
    currentIndex,
    setCurrentIndex,
    loading,
    saving,
    addNextMacrocycle,
    deleteMacrocycle,
    updateMonthObjective,
    updateWeekNotes,
    refetch: fetchMacrocycles,
  };
}

// ── Internal raw types (Supabase join result) ──────────────────────────────

interface MacrocycleMonthRaw {
  id: string;
  macrocycle_id: string;
  month_index: number;
  objective_id: string | null;
  macrocycle_objectives: MacrocycleObjective | null;
  macrocycle_weeks: MacrocycleWeek[];
}
