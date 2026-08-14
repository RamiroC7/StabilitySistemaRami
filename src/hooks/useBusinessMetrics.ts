import { useEffect } from "react";
import { create } from "zustand";
import { supabase } from "../lib/supabase";

// --- Types ---

export interface GoalEntry {
  key: string;
  label: string;
  count: number;
  color: string;
}

export interface GenderEntry {
  label: string;
  count: number;
  percent: number;
  color: string; // tailwind class for legend dot
  stroke: string; // hex for SVG stroke
  dashArray: string;
  dashOffset: string;
}

export interface MonthlyRegistration {
  month: string;
  count: number;
}

export interface HistoricalMonthData {
  monthKey: string; // "YYYY-MM"
  label: string;    // "Jun"
  activeStudents: number;
  newStudents: number;
  gender: {
    male: number;
    female: number;
    other: number;
  };
}

export interface RawStudent {
  id: string;
  created_at: string;
  student_profiles: {
    birth_date: string | null;
    gender: string | null;
    primary_goal: string | null;
    is_archived: boolean;
    archived_at: string | null;
    training_experience: string | null;
    sports: string | null;
  } | {
    birth_date: string | null;
    gender: string | null;
    primary_goal: string | null;
    is_archived: boolean;
    archived_at: string | null;
    training_experience: string | null;
    sports: string | null;
  }[];
}

export interface RawCompletion {
  id: string;
  student_id: string;
  assignment_id: string | null;
  completed_at: string;
  initial_mood: string | null;
  mood: string | null;
  rpe: number | null;
}

export interface RawAssignment {
  id: string;
  student_id: string;
  assigned_at: string;
  start_date: string;
  end_date: string;
  status: string;
  training_plans: {
    days_per_week: number;
  } | {
    days_per_week: number;
  }[] | null;
}

export interface BusinessMetrics {
  // Cards
  activeStudents: number;
  newThisMonth: number;
  growthPercent: number | null;
  averageAge: number | null;
  retentionPercent: number | null;
  // Goal distribution
  goalDistribution: GoalEntry[];
  maxGoalCount: number;
  // Gender distribution
  genderDistribution: GenderEntry[];
  totalStudentsForGender: number;

  // New Metrics
  trainingFrequency: {
    real: number;        // promedio real semanal de entrenamientos completados por alumno activo
    planned: number;     // promedio planificado semanal de entrenamientos asignados por alumno activo
  };
  peakActivity: {
    days: Record<string, number>;  // Lun -> 15, Mar -> 20...
    hours: {
      morning: number;   // 6:00 - 11:59
      afternoon: number; // 12:00 - 17:59
      evening: number;   // 18:00 - 23:59
      night: number;     // 0:00 - 5:59
    };
  };
  emotionalImpact: {
    improved: number;    // cantidad de sesiones con mejora anímica
    stable: number;      // cantidad de sesiones estables
    fatigued: number;    // cantidad de sesiones finalizadas con cansancio/dolor
    total: number;
  };
  rpeDistribution: {
    counts: Record<number, number>; // 1 -> 0, ... 10 -> 0
    average: number | null;
  };
  experienceDistribution: {
    key: string;
    label: string;
    count: number;
  }[];
  sportsDistribution: {
    name: string;
    count: number;
  }[];
}

// --- Constants ---

const GOAL_MAP: Record<string, { label: string; color: string }> = {
  aesthetic: { label: "Estética / Hipertrofia", color: "#2563EB" },
  sports: { label: "Rendimiento Deportivo", color: "#10B981" },
  health: { label: "Salud General", color: "#06B6D4" },
  readaptation: { label: "Readaptación", color: "#8B5CF6" },
};

const GENDER_MAP: Record<
  string,
  { label: string; color: string; stroke: string }
> = {
  male: { label: "Hombres", color: "bg-secondary", stroke: "#3B82F6" },
  female: { label: "Mujeres", color: "bg-primary", stroke: "#60A5FA" },
  other: { label: "Otro / N/E", color: "bg-gray-400", stroke: "#9CA3AF" },
};

const CIRCUMFERENCE = 2 * Math.PI * 40; // r=40

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

// --- Helpers ---

function getAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate()))
    age--;
  return age;
}

function buildGenderDistribution(
  genderCounts: Record<string, number>,
  total: number,
): GenderEntry[] {
  const result: GenderEntry[] = [];
  let cumulative = 0;

  const keys = Object.keys(genderCounts).sort((a, b) => {
    const order = ["male", "female", "other"];
    return order.indexOf(a) - order.indexOf(b);
  });

  for (const key of keys) {
    const count = genderCounts[key] || 0;
    const percent = total > 0 ? (count / total) * 100 : 0;
    const segmentLength = (percent / 100) * CIRCUMFERENCE;
    const info = GENDER_MAP[key] ?? {
      label: "Otro / N/E",
      color: "bg-gray-400",
      stroke: "#9CA3AF",
    };
    result.push({
      label: info.label,
      count,
      percent: Math.round(percent),
      color: info.color,
      stroke: info.stroke,
      dashArray: `${segmentLength.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`,
      dashOffset: `${-cumulative.toFixed(2)}`,
    });
    cumulative += segmentLength;
  }

  return result;
}

function calculateMetricsForMonth(
  year: number,
  monthIndex: number,
  students: RawStudent[],
  completions: RawCompletion[],
  assignments: RawAssignment[]
): BusinessMetrics {
  const mStart = new Date(year, monthIndex, 1);
  const mEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const weeksInMonth = daysInMonth / 7;

  // 1. Active students list in this month
  const activeStudentsList = students.filter((p) => {
    const createdAt = new Date(p.created_at);
    if (createdAt > mEnd) return false;
    
    const sp = Array.isArray(p.student_profiles) ? p.student_profiles[0] : p.student_profiles;
    const isArchived = sp?.is_archived ?? false;
    const archivedAt = sp?.archived_at ? new Date(sp.archived_at) : null;
    
    if (!isArchived) return true;
    if (archivedAt && archivedAt > mStart) return true;
    return false;
  });
  
  const activeStudentsCount = activeStudentsList.length;
  
  // 2. New students list in this month
  const newThisMonthList = students.filter((p) => {
    const createdAt = new Date(p.created_at);
    return createdAt >= mStart && createdAt <= mEnd;
  });
  const newThisMonth = newThisMonthList.length;

  // 3. Growth Percent
  const lastMonthStart = new Date(year, monthIndex - 1, 1);
  const lastMonthEnd = new Date(year, monthIndex, 0, 23, 59, 59, 999);
  const newLastMonthList = students.filter((p) => {
    const createdAt = new Date(p.created_at);
    return createdAt >= lastMonthStart && createdAt <= lastMonthEnd;
  });
  const newLastMonthTotal = newLastMonthList.length;

  let growthPercent: number | null = null;
  if (newLastMonthTotal > 0) {
    growthPercent = Math.round(((newThisMonth - newLastMonthTotal) / newLastMonthTotal) * 1000) / 10;
  } else if (newThisMonth > 0) {
    growthPercent = null;
  } else {
    growthPercent = 0;
  }

  // 4. Average Age
  const ages: number[] = [];
  activeStudentsList.forEach((p) => {
    const sp = Array.isArray(p.student_profiles) ? p.student_profiles[0] : p.student_profiles;
    if (sp?.birth_date) {
      ages.push(getAge(sp.birth_date));
    }
  });
  const averageAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;

  // 5. Retention Rate
  let studentsAtStartOfMonth = 0;
  students.forEach((p) => {
    const createdAt = new Date(p.created_at);
    if (createdAt >= mStart) return;

    const sp = Array.isArray(p.student_profiles) ? p.student_profiles[0] : p.student_profiles;
    const isArchived = sp?.is_archived ?? false;
    const archivedAt = sp?.archived_at ? new Date(sp.archived_at) : null;

    const wasActiveAtStart = !isArchived || (archivedAt !== null && archivedAt >= mStart);
    if (wasActiveAtStart) {
      studentsAtStartOfMonth++;
    }
  });

  const E = activeStudentsCount;
  const N = newThisMonth;
  const S = studentsAtStartOfMonth;

  let retentionPercent: number | null = null;
  if (S > 0) {
    retentionPercent = Math.max(0, Math.min(100, Math.round(((E - N) / S) * 100)));
  } else if (E > 0) {
    retentionPercent = 100;
  }

  // 6. Goal Distribution
  const goalCounts: Record<string, number> = {};
  activeStudentsList.forEach((p) => {
    const sp = Array.isArray(p.student_profiles) ? p.student_profiles[0] : p.student_profiles;
    const goal = sp?.primary_goal || "unknown";
    goalCounts[goal] = (goalCounts[goal] ?? 0) + 1;
  });

  const goalOrder = ["aesthetic", "sports", "health", "readaptation", "unknown"];
  const goalDistribution = goalOrder
    .filter((k) => (goalCounts[k] || 0) > 0)
    .map((k) => ({
      key: k,
      label: k === "unknown" ? "Sin objetivo" : (GOAL_MAP[k]?.label ?? k),
      count: goalCounts[k],
      color: k === "unknown" ? "#94A3B8" : (GOAL_MAP[k]?.color ?? "#64748B"),
    }));

  const maxGoalCount = goalDistribution.reduce((max, g) => Math.max(max, g.count), 1);

  // 7. Gender Distribution
  const genderCounts: Record<string, number> = { male: 0, female: 0, other: 0 };
  activeStudentsList.forEach((p) => {
    const sp = Array.isArray(p.student_profiles) ? p.student_profiles[0] : p.student_profiles;
    const gender = sp?.gender || "other";
    genderCounts[gender] = (genderCounts[gender] ?? 0) + 1;
  });
  const genderDistribution = buildGenderDistribution(genderCounts, activeStudentsCount);

  // 8. Experience Distribution
  const expCounts: Record<string, number> = {
    none: 0,
    beginner: 0,
    intermediate: 0,
    advanced: 0,
    unknown: 0,
  };
  activeStudentsList.forEach((p) => {
    const sp = Array.isArray(p.student_profiles) ? p.student_profiles[0] : p.student_profiles;
    const exp = sp?.training_experience || "unknown";
    expCounts[exp] = (expCounts[exp] ?? 0) + 1;
  });
  
  const EXP_MAP: Record<string, string> = {
    none: "Sin experiencia",
    beginner: "Principiante",
    intermediate: "Intermedio",
    advanced: "Avanzado",
    unknown: "No especificado",
  };
  
  const experienceDistribution = Object.keys(expCounts)
    .filter(k => expCounts[k] > 0)
    .map(k => ({
      key: k,
      label: EXP_MAP[k] || k,
      count: expCounts[k],
    }))
    .sort((a, b) => b.count - a.count);

  // 9. Sports Distribution
  const sportsCounts: Record<string, number> = {};
  activeStudentsList.forEach((p) => {
    const sp = Array.isArray(p.student_profiles) ? p.student_profiles[0] : p.student_profiles;
    if (sp?.sports) {
      const parts = sp.sports.split(/[,,;]/).map((s: string) => s.trim()).filter(Boolean);
      parts.forEach((sport: string) => {
        const capitalized = sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();
        sportsCounts[capitalized] = (sportsCounts[capitalized] ?? 0) + 1;
      });
    }
  });
  const sportsDistribution = Object.entries(sportsCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 10. Completions filtered in this month and active students
  const activeStudentIds = new Set(activeStudentsList.map((p) => p.id));
  const completionsInMonth = completions.filter((c) => {
    const compDate = new Date(c.completed_at);
    return compDate >= mStart && compDate <= mEnd && activeStudentIds.has(c.student_id);
  });

  // 11. Training Frequency Real vs Planificada
  const activeAssignments = assignments.filter((a) => {
    if (!activeStudentIds.has(a.student_id)) return false;
    const aStart = new Date(a.start_date + "T00:00:00");
    const aEnd = new Date(a.end_date + "T00:00:00");
    return aStart <= mEnd && aEnd >= mStart;
  });

  let totalPlannedDaysPerWeek = 0;
  activeAssignments.forEach((a) => {
    const tp = Array.isArray(a.training_plans) ? a.training_plans[0] : a.training_plans;
    const daysPerWeek = tp?.days_per_week ?? 3;
    totalPlannedDaysPerWeek += daysPerWeek;
  });

  const plannedFrequency = activeAssignments.length > 0 
    ? Math.round((totalPlannedDaysPerWeek / activeAssignments.length) * 10) / 10
    : 0;

  const realFrequency = activeStudentsCount > 0
    ? Math.round((completionsInMonth.length / activeStudentsCount / weeksInMonth) * 10) / 10
    : 0;

  // 12. Peak Activity Days & Hours
  const dayCounts: Record<string, number> = {
    "Lun": 0, "Mar": 0, "Mié": 0, "Jue": 0, "Vie": 0, "Sáb": 0, "Dom": 0
  };
  const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  
  const hourCounts = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0
  };

  completionsInMonth.forEach((c) => {
    const date = new Date(c.completed_at);
    // Day of week
    const dayName = DAY_LABELS[date.getDay()];
    dayCounts[dayName] = (dayCounts[dayName] ?? 0) + 1;
    
    // Hour
    const hour = date.getHours();
    if (hour >= 6 && hour < 12) {
      hourCounts.morning++;
    } else if (hour >= 12 && hour < 18) {
      hourCounts.afternoon++;
    } else if (hour >= 18 && hour < 24) {
      hourCounts.evening++;
    } else {
      hourCounts.night++;
    }
  });

  // 13. Emotional Impact
  let improved = 0;
  let stable = 0;
  let fatigued = 0;
  let emotionalTotal = 0;

  completionsInMonth.forEach((c) => {
    if (!c.initial_mood || !c.mood) return;
    emotionalTotal++;
    const initial = c.initial_mood;
    const final = c.mood; // excellent, normal, tired, pain
    
    if (final === "pain" || final === "tired") {
      fatigued++;
    } else if (
      (initial === "sad" && (final === "normal" || final === "excellent")) ||
      (initial === "neutral" && final === "excellent") ||
      (initial === "happy" && final === "excellent")
    ) {
      improved++;
    } else {
      stable++;
    }
  });

  // 14. RPE Distribution
  const rpeCounts: Record<number, number> = {};
  for (let i = 1; i <= 10; i++) rpeCounts[i] = 0;
  
  let rpeSum = 0;
  let rpeCount = 0;

  completionsInMonth.forEach((c) => {
    if (c.rpe != null && c.rpe >= 1 && c.rpe <= 10) {
      rpeCounts[c.rpe]++;
      rpeSum += c.rpe;
      rpeCount++;
    }
  });

  const rpeAverage = rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : null;

  return {
    activeStudents: activeStudentsCount,
    newThisMonth,
    growthPercent,
    averageAge,
    retentionPercent,
    goalDistribution,
    maxGoalCount,
    genderDistribution,
    totalStudentsForGender: activeStudentsCount,

    // New metrics fields
    trainingFrequency: {
      real: realFrequency,
      planned: plannedFrequency,
    },
    peakActivity: {
      days: dayCounts,
      hours: hourCounts,
    },
    emotionalImpact: {
      improved,
      stable,
      fatigued,
      total: emotionalTotal,
    },
    rpeDistribution: {
      counts: rpeCounts,
      average: rpeAverage,
    },
    experienceDistribution,
    sportsDistribution,
  };
}

function buildHistoricalMetrics(
  now: Date,
  students: RawStudent[]
): HistoricalMonthData[] {
  const result: HistoricalMonthData[] = [];
  
  // Generar datos para los últimos 6 meses (restringido a partir de febrero de 2026)
  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = d.getFullYear();
    const monthIndex = d.getMonth();

    if (year < 2026 || (year === 2026 && monthIndex < 1)) {
      continue;
    }

    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    
    const mStart = new Date(year, monthIndex, 1);
    const mEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    
    // Alumnos activos en este mes histórico
    const activeList = students.filter((p) => {
      const createdAt = new Date(p.created_at);
      if (createdAt > mEnd) return false;
      const sp = Array.isArray(p.student_profiles) ? p.student_profiles[0] : p.student_profiles;
      const isArchived = sp?.is_archived ?? false;
      const archivedAt = sp?.archived_at ? new Date(sp.archived_at) : null;
      if (!isArchived) return true;
      if (archivedAt && archivedAt > mStart) return true;
      return false;
    });
    
    // Alumnos nuevos de este mes histórico
    const newList = students.filter((p) => {
      const createdAt = new Date(p.created_at);
      return createdAt >= mStart && createdAt <= mEnd;
    });
    
    // Distribución de género de activos en ese mes
    const genderCounts = { male: 0, female: 0, other: 0 };
    activeList.forEach((p) => {
      const sp = Array.isArray(p.student_profiles) ? p.student_profiles[0] : p.student_profiles;
      const gender = sp?.gender || "other";
      if (gender === "male") genderCounts.male++;
      else if (gender === "female") genderCounts.female++;
      else genderCounts.other++;
    });

    const monthLabel = MONTH_LABELS[monthIndex];
    
    result.push({
      monthKey,
      label: monthLabel,
      activeStudents: activeList.length,
      newStudents: newList.length,
      gender: genderCounts,
    });
  }
  
  return result;
}

// --- Zustand Store ---

interface MetricsStore {
  metrics: BusinessMetrics | null;
  historicalData: HistoricalMonthData[];
  selectedMonth: string; // format: "YYYY-MM"
  rawStudents: RawStudent[];
  rawCompletions: RawCompletion[];
  rawAssignments: RawAssignment[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  fetchMetrics: () => Promise<void>;
  setSelectedMonth: (month: string) => void;
  reloadMetrics: () => void;
}

const useMetricsStore = create<MetricsStore>((set, get) => ({
  metrics: null,
  historicalData: [],
  selectedMonth: (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })(),
  rawStudents: [],
  rawCompletions: [],
  rawAssignments: [],
  isLoading: false,
  isLoaded: false,
  error: null,

  fetchMetrics: async () => {
    const state = get();
    if (state.isLoaded || state.isLoading) return;

    set({ isLoading: true, error: null });

    try {
      // 1. Obtener perfiles de estudiantes
      const { data: students, error: fetchError } = await supabase
        .from("profiles")
        .select(`
          id,
          created_at,
          student_profiles!inner (
            birth_date,
            gender,
            primary_goal,
            is_archived,
            archived_at,
            training_experience,
            sports
          )
        `)
        .eq("role", "student");

      if (fetchError) throw fetchError;

      // 2. Obtener finalizaciones de rutinas
      const { data: completions, error: completionsError } = await supabase
        .from("workout_completions")
        .select("id, student_id, assignment_id, completed_at, initial_mood, mood, rpe");

      if (completionsError) throw completionsError;

      // 3. Obtener asignaciones y sus días por semana
      const { data: assignments, error: assignmentsError } = await supabase
        .from("training_plan_assignments")
        .select(`
          id,
          student_id,
          assigned_at,
          start_date,
          end_date,
          status,
          training_plans (
            days_per_week
          )
        `);

      if (assignmentsError) throw assignmentsError;

      const rawStudents = students ?? [];
      const rawCompletions = completions ?? [];
      const rawAssignments = assignments ?? [];

      const now = new Date();
      const historicalData = buildHistoricalMetrics(now, rawStudents);

      // Calcular métricas para el mes seleccionado actual
      const selectedMonth = get().selectedMonth;
      const [yearStr, monthStr] = selectedMonth.split("-");
      const year = parseInt(yearStr);
      const monthIndex = parseInt(monthStr) - 1;

      const metrics = calculateMetricsForMonth(year, monthIndex, rawStudents, rawCompletions, rawAssignments);

      set({
        rawStudents,
        rawCompletions,
        rawAssignments,
        historicalData,
        metrics,
        isLoaded: true,
      });
    } catch (err) {
      console.error("[useBusinessMetrics] Error loading metrics:", err);
      set({
        error: err instanceof Error ? err.message : "Error al cargar métricas",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  setSelectedMonth: (month: string) => {
    set({ selectedMonth: month });
    const { rawStudents, rawCompletions, rawAssignments } = get();
    if (rawStudents.length > 0) {
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr);
      const monthIndex = parseInt(monthStr) - 1;

      const metrics = calculateMetricsForMonth(year, monthIndex, rawStudents, rawCompletions, rawAssignments);
      set({ metrics });
    }
  },

  reloadMetrics: () => set({ isLoaded: false, metrics: null, rawStudents: [], rawCompletions: [], rawAssignments: [] }),
}));

// --- Hook ---

export function useBusinessMetrics() {
  const metrics = useMetricsStore((s) => s.metrics);
  const historicalData = useMetricsStore((s) => s.historicalData);
  const selectedMonth = useMetricsStore((s) => s.selectedMonth);
  const setSelectedMonth = useMetricsStore((s) => s.setSelectedMonth);
  const isLoading = useMetricsStore((s) => s.isLoading);
  const isLoaded = useMetricsStore((s) => s.isLoaded);
  const error = useMetricsStore((s) => s.error);
  const fetchMetrics = useMetricsStore((s) => s.fetchMetrics);
  const reloadMetrics = useMetricsStore((s) => s.reloadMetrics);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics, isLoaded]);

  return {
    metrics,
    historicalData,
    selectedMonth,
    setSelectedMonth,
    isLoading: isLoading && !isLoaded,
    error,
    reload: () => {
      reloadMetrics();
      fetchMetrics();
    },
  };
}
