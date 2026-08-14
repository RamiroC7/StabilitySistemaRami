import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Student } from "@/hooks/useStudents";
import type { TrainingPlanSummary } from "@/hooks/useTrainingPlans";
import type { StudentProfile, AssignedPlan } from "@/hooks/useStudentProfile";
import type { ActiveAssignment } from "@/hooks/useActiveAssignment";
import type { PlanConstancia } from "@/hooks/useStudentConstancia";
import type { WorkoutCompletion } from "@/hooks/useWorkoutCompletions";
import type { ExerciseGroup } from "@/hooks/useExerciseWeightLogs";
import type { WorkoutDay } from "@/features/training/types";
import type { RankingEntry } from "@/hooks/useMonthlyRanking";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ExerciseCategory {
    id: string;
    name: string;
    color: string;
}

interface DataCacheState {
    // ── Global Students ───────────────────────────────────────────────────────
    students: Student[];
    isStudentsLoaded: boolean;
    isStudentsLoading: boolean;

    // ── Plans ─────────────────────────────────────────────────────────────────
    plans: TrainingPlanSummary[];
    isPlansLoaded: boolean;
    isPlansLoading: boolean;

    // ── Categories ────────────────────────────────────────────────────────────
    categories: ExerciseCategory[];
    isCategoriesLoaded: boolean;
    isCategoriesLoading: boolean;

    // ── Parameterized Caches (por ID) ─────────────────────────────────────────

    // Perfiles y planes asignados vistos por el profesor
    studentProfiles: Record<string, StudentProfile>;
    studentAssignedPlans: Record<string, AssignedPlan[]>;
    loadedStudentProfiles: Record<string, boolean>;

    // Entrenamiento activo del estudiante (visto por él mismo, su ID)
    activeAssignments: Record<string, ActiveAssignment | null>;
    loadedActiveAssignments: Record<string, boolean>;

    // Constancia y Completions del estudiante (visto por él mismo, su ID)
    studentConstancias: Record<string, PlanConstancia[]>;
    loadedStudentConstancias: Record<string, boolean>;

    workoutCompletions: Record<string, WorkoutCompletion[]>;
    loadedWorkoutCompletions: Record<string, boolean>;

    exerciseWeightLogs: Record<string, ExerciseGroup[]>;
    loadedExerciseWeightLogs: Record<string, boolean>;

    // Ejercicios por día (clave: dayId de training_plan_days)
    dayExercises: Record<string, WorkoutDay>;
    loadedDayExercises: Record<string, boolean>;

    // Ranking mensual de asistencias (clave: "YYYY-MM-01")
    monthlyRankings: Record<string, RankingEntry[]>;
    loadedMonthlyRankings: Record<string, boolean>;

    // ── Actions ───────────────────────────────────────────────────────────────
    setStudents: (students: Student[]) => void;
    markStudentsLoaded: () => void;
    setStudentsLoading: (loading: boolean) => void;
    reloadStudents: () => void; // invalida la caché → el próximo hook call re-fetcha

    setPlans: (plans: TrainingPlanSummary[]) => void;
    markPlansLoaded: () => void;
    setPlansLoading: (loading: boolean) => void;
    reloadPlans: () => void;

    setCategories: (categories: ExerciseCategory[]) => void;
    markCategoriesLoaded: () => void;
    setCategoriesLoading: (loading: boolean) => void;
    reloadCategories: () => void;

    // Mutaciones para cachés por ID
    setStudentProfileData: (id: string, profile: StudentProfile, plans: AssignedPlan[]) => void;
    invalidateStudentProfile: (id: string) => void;

    setActiveAssignmentData: (id: string, assignment: ActiveAssignment | null) => void;
    invalidateActiveAssignment: (id: string) => void;

    setStudentConstanciaData: (id: string, constancias: PlanConstancia[]) => void;
    invalidateStudentConstancia: (id: string) => void;

    setWorkoutCompletionsData: (id: string, completions: WorkoutCompletion[]) => void;
    invalidateWorkoutCompletions: (id: string) => void;

    setExerciseWeightLogsData: (id: string, groups: ExerciseGroup[]) => void;
    invalidateExerciseWeightLogs: (id: string) => void;
    removeExerciseWeightLog: (studentId: string, logId: string) => void;

    setDayExercisesData: (dayId: string, workoutDay: WorkoutDay) => void;
    invalidateDayExercises: (dayId: string) => void;

    setMonthlyRankingData: (monthStart: string, ranking: RankingEntry[]) => void;
    invalidateMonthlyRanking: (monthStart: string) => void;
    prefetchMonthlyRanking: (monthStart: string) => Promise<void>;

    // Limpia todo (e.g., al hacer logout)
    clearAll: () => void;

    // Fetches internos —  llamados desde los hooks
    fetchStudents: (professorId: string) => Promise<void>;
    fetchPlans: (professorId: string) => Promise<void>;
    fetchCategories: () => Promise<void>;
}

// ── Internal fetch for Students ─────────────────────────────────────────────

// Mantenemos la lógica de fetch aquí para tener un solo lugar donde se realiza.
// Pero los hooks siguen siendo la interfaz pública que los componentes usan.

export const useDataCacheStore = create<DataCacheState>()((set, get) => ({
    // ── Initial state ──────────────────────────────────────────────────────────
    // Global
    students: [],
    isStudentsLoaded: false,
    isStudentsLoading: false,

    plans: [],
    isPlansLoaded: false,
    isPlansLoading: false,

    categories: [],
    isCategoriesLoaded: false,
    isCategoriesLoading: false,

    // Por ID
    studentProfiles: {},
    studentAssignedPlans: {},
    loadedStudentProfiles: {},

    activeAssignments: {},
    loadedActiveAssignments: {},

    studentConstancias: {},
    loadedStudentConstancias: {},

    workoutCompletions: {},
    loadedWorkoutCompletions: {},

    exerciseWeightLogs: {},
    loadedExerciseWeightLogs: {},

    dayExercises: {},
    loadedDayExercises: {},

    monthlyRankings: {},
    loadedMonthlyRankings: {},

    // ── Students actions ───────────────────────────────────────────────────────
    setStudents: (students) => set({ students }),
    markStudentsLoaded: () => set({ isStudentsLoaded: true }),
    setStudentsLoading: (loading) => set({ isStudentsLoading: loading }),
    reloadStudents: () => set({ isStudentsLoaded: false, students: [] }),

    // ── Plans actions ──────────────────────────────────────────────────────────
    setPlans: (plans) => set({ plans }),
    markPlansLoaded: () => set({ isPlansLoaded: true }),
    setPlansLoading: (loading) => set({ isPlansLoading: loading }),
    reloadPlans: () => set({ isPlansLoaded: false, plans: [] }),

    // ── Categories actions ─────────────────────────────────────────────────────
    setCategories: (categories) => set({ categories }),
    markCategoriesLoaded: () => set({ isCategoriesLoaded: true }),
    setCategoriesLoading: (loading) => set({ isCategoriesLoading: loading }),
    reloadCategories: () => set({ isCategoriesLoaded: false, categories: [] }),

    // ── Actions por ID ─────────────────────────────────────────────────────────
    setStudentProfileData: (id, profile, plans) => set((s) => ({
        studentProfiles: { ...s.studentProfiles, [id]: profile },
        studentAssignedPlans: { ...s.studentAssignedPlans, [id]: plans },
        loadedStudentProfiles: { ...s.loadedStudentProfiles, [id]: true }
    })),
    invalidateStudentProfile: (id) => set((s) => ({
        loadedStudentProfiles: { ...s.loadedStudentProfiles, [id]: false }
    })),

    setActiveAssignmentData: (id, assignment) => set((s) => ({
        activeAssignments: { ...s.activeAssignments, [id]: assignment },
        loadedActiveAssignments: { ...s.loadedActiveAssignments, [id]: true }
    })),
    invalidateActiveAssignment: (id) => set((s) => ({
        loadedActiveAssignments: { ...s.loadedActiveAssignments, [id]: false }
    })),

    setStudentConstanciaData: (id, constancias) => set((s) => ({
        studentConstancias: { ...s.studentConstancias, [id]: constancias },
        loadedStudentConstancias: { ...s.loadedStudentConstancias, [id]: true }
    })),
    invalidateStudentConstancia: (id) => set((s) => ({
        loadedStudentConstancias: { ...s.loadedStudentConstancias, [id]: false }
    })),

    setWorkoutCompletionsData: (id, completions) => set((s) => ({
        workoutCompletions: { ...s.workoutCompletions, [id]: completions },
        loadedWorkoutCompletions: { ...s.loadedWorkoutCompletions, [id]: true }
    })),
    invalidateWorkoutCompletions: (id) => set((s) => ({
        loadedWorkoutCompletions: { ...s.loadedWorkoutCompletions, [id]: false }
    })),

    setExerciseWeightLogsData: (id, groups) => set((s) => ({
        exerciseWeightLogs: { ...s.exerciseWeightLogs, [id]: groups },
        loadedExerciseWeightLogs: { ...s.loadedExerciseWeightLogs, [id]: true }
    })),
    invalidateExerciseWeightLogs: (id) => set((s) => ({
        loadedExerciseWeightLogs: { ...s.loadedExerciseWeightLogs, [id]: false }
    })),
    removeExerciseWeightLog: (studentId, logId) => set((s) => {
        const current = s.exerciseWeightLogs[studentId] ?? [];
        const updated = current
            .map((group) => ({ ...group, logs: group.logs.filter((l) => l.id !== logId) }))
            .filter((group) => group.logs.length > 0);
        return { exerciseWeightLogs: { ...s.exerciseWeightLogs, [studentId]: updated } };
    }),

    setDayExercisesData: (dayId, workoutDay) => set((s) => ({
        dayExercises: { ...s.dayExercises, [dayId]: workoutDay },
        loadedDayExercises: { ...s.loadedDayExercises, [dayId]: true }
    })),
    invalidateDayExercises: (dayId) => set((s) => ({
        loadedDayExercises: { ...s.loadedDayExercises, [dayId]: false }
    })),

    setMonthlyRankingData: (monthStart, ranking) => set((s) => ({
        monthlyRankings: { ...s.monthlyRankings, [monthStart]: ranking },
        loadedMonthlyRankings: { ...s.loadedMonthlyRankings, [monthStart]: true },
    })),
    invalidateMonthlyRanking: (monthStart) => set((s) => ({
        loadedMonthlyRankings: { ...s.loadedMonthlyRankings, [monthStart]: false },
    })),

    prefetchMonthlyRanking: async (monthStart: string) => {
        const state = get();
        // Si ya está cargado, no hacer nada
        if (state.loadedMonthlyRankings[monthStart]) return;

        try {
            const { data, error } = await supabase.rpc("get_monthly_ranking", {
                p_month_start: monthStart,
            });

            if (error || !data) return;

            const withRank: RankingEntry[] = (data as {
                student_id: string;
                first_name: string;
                last_name: string;
                profile_image: string | null;
                attendance_count: number;
            }[]).map((row, i) => ({
                student_id: row.student_id,
                first_name: row.first_name,
                last_name: row.last_name,
                profile_image: row.profile_image,
                attendance_count: Number(row.attendance_count),
                rank: i + 1,
            }));

            set((s) => ({
                monthlyRankings: { ...s.monthlyRankings, [monthStart]: withRank },
                loadedMonthlyRankings: { ...s.loadedMonthlyRankings, [monthStart]: true },
            }));
        } catch {
            // Prefetch silencioso — si falla no interrumpimos nada
        }
    },

    // ── Clear all (logout) ─────────────────────────────────────────────────────
    clearAll: () =>
        set({
            students: [],
            isStudentsLoaded: false,
            isStudentsLoading: false,
            plans: [],
            isPlansLoaded: false,
            isPlansLoading: false,
            // Categorías no son por usuario → no las limpiamos al hacer logout
            studentProfiles: {},
            studentAssignedPlans: {},
            loadedStudentProfiles: {},
            activeAssignments: {},
            loadedActiveAssignments: {},
            studentConstancias: {},
            loadedStudentConstancias: {},
            workoutCompletions: {},
            loadedWorkoutCompletions: {},
            exerciseWeightLogs: {},
            loadedExerciseWeightLogs: {},
            dayExercises: {},
            loadedDayExercises: {},
            monthlyRankings: {},
            loadedMonthlyRankings: {},
        }),

    // ── Internal fetchers ──────────────────────────────────────────────────────

    fetchStudents: async (professorId: string) => {
        const state = get();
        // Guard: si ya está cargado o hay otro fetch en curso → no hacer nada
        if (state.isStudentsLoaded || state.isStudentsLoading) return;

        set({ isStudentsLoading: true });

        try {
            // Primer fetch: profiles con rol student
            const { data: profilesData, error: profilesError } = await supabase
                .from("profiles")
                .select("id, first_name, last_name")
                .eq("role", "student")
                .order("created_at", { ascending: false });

            if (profilesError) throw profilesError;
            if (!profilesData || profilesData.length === 0) {
                set({ students: [], isStudentsLoaded: true, isStudentsLoading: false });
                return;
            }

            const studentIds = profilesData.map((p) => p.id);
            const d = new Date();
            const todayISO =
                d.getFullYear() +
                "-" +
                String(d.getMonth() + 1).padStart(2, "0") +
                "-" +
                String(d.getDate()).padStart(2, "0");

            // Fetches 2 y 3 en paralelo
            const [
                { data: studentDetails, error: detailsError },
                { data: assignmentsData, error: assignmentsError },
            ] = await Promise.all([
                supabase
                    .from("student_profiles")
                    .select(
                        "id, profile_image_url, training_experience, primary_goal, activity_level, phone, instagram, is_archived",
                    )
                    .in("id", studentIds),
                supabase
                    .from("training_plan_assignments")
                    .select(
                        `student_id, plan_id, start_date, end_date, status,
             training_plans ( title, total_days, days_per_week )`,
                    )
                    .in("student_id", studentIds)
                    .in("status", ["active", "paused"])
                    .gte("end_date", todayISO),
            ]);

            if (detailsError) throw detailsError;
            if (assignmentsError) {
                console.warn("[dataCacheStore] assignments warn:", assignmentsError);
            }

            // Construir mapa de assignments
            const assignmentsMap = new Map<
                string,
                {
                    plan_id: string;
                    plan_title: string;
                    start_date: string;
                    end_date: string;
                    status: string;
                    days_per_week: number;
                }[]
            >();

            if (assignmentsData) {
                for (const row of assignmentsData as unknown as {
                    student_id: string;
                    plan_id: string;
                    start_date: string;
                    end_date: string;
                    status: string;
                    training_plans: { title: string; total_days: number; days_per_week: number } | null;
                }[]) {
                    if (row.end_date) {
                        const endDate = new Date(row.end_date + "T23:59:59");
                        if (endDate < new Date()) continue;
                    }
                    const existing = assignmentsMap.get(row.student_id) || [];
                    existing.push({
                        plan_id: row.plan_id,
                        plan_title: row.training_plans?.title || "Plan sin nombre",
                        start_date: row.start_date,
                        end_date: row.end_date,
                        status: row.status,
                        days_per_week:
                            row.training_plans?.total_days ?? row.training_plans?.days_per_week ?? 3,
                    });
                    assignmentsMap.set(row.student_id, existing);
                }
            }

            // Construir mapa de detalles
            const detailsMap = new Map(
                ((studentDetails as {
                    id: string;
                    profile_image_url: string | null;
                    training_experience: string;
                    primary_goal: string;
                    activity_level: string;
                    phone: string | null;
                    instagram: string | null;
                    is_archived: boolean;
                }[]) || []).map((d) => [d.id, d]),
            );

            // Combinar y transformar
            const transformed: Student[] = profilesData
                .filter((p) => detailsMap.has(p.id))
                .map((p) => {
                    const details = detailsMap.get(p.id)!;
                    return {
                        id: p.id,
                        fullName: `${p.first_name} ${p.last_name}`,
                        profileImageUrl: details.profile_image_url || null,
                        trainingLevel: details.training_experience || "beginner",
                        primaryGoal: details.primary_goal || "health",
                        activityLevel: details.activity_level || "moderate",
                        phone: details.phone || undefined,
                        instagram: details.instagram || undefined,
                        activeAssignments: assignmentsMap.get(p.id) || [],
                        isArchived: details.is_archived || false,
                    };
                });

            set({
                students: transformed,
                isStudentsLoaded: true,
                isStudentsLoading: false,
            });
        } catch (err) {
            console.error("[dataCacheStore] fetchStudents error:", err);
            set({ isStudentsLoading: false });
        }

        // professorId is intentionally unused in the query body (students are global),
        // but keeping it as a parameter avoids calling this without a logged-in user.
        void professorId;
    },

    fetchPlans: async (professorId: string) => {
        const state = get();
        if (state.isPlansLoaded || state.isPlansLoading) return;

        set({ isPlansLoading: true });

        try {
            interface PlanWithAssignments extends Omit<TrainingPlanSummary, "assignedCount"> {
                training_plan_assignments?: Array<{ count: number }>;
            }

            // Todos los coaches ven todos los planes de la plataforma.
            // Las mutaciones (editar, eliminar) siguen protegidas por coach_id en useTrainingPlans.
            const { data: plansData, error: fetchError } = await supabase
                .from("training_plans")
                .select(`*, training_plan_assignments(count)`)
                .eq("is_archived", false)
                .neq("training_plan_assignments.status", "cancelled")
                .order("created_at", { ascending: false });

            if (fetchError) throw fetchError;

            const transformed: TrainingPlanSummary[] = (plansData || []).map(
                (plan: PlanWithAssignments) => ({
                    ...plan,
                    assignedCount: plan.training_plan_assignments?.[0]?.count || 0,
                }),
            );

            set({ plans: transformed, isPlansLoaded: true, isPlansLoading: false });
        } catch (err) {
            console.error("[dataCacheStore] fetchPlans error:", err);
            set({ isPlansLoading: false });
        }

        // professorId no se usa en la query (planes son globales),
        // pero exigimos el parámetro para no llamar sin usuario autenticado.
        void professorId;
    },

    fetchCategories: async () => {
        const state = get();
        if (state.isCategoriesLoaded || state.isCategoriesLoading) return;

        set({ isCategoriesLoading: true });

        try {
            const { data, error } = await supabase
                .from("exercise_categories")
                .select("id, name, color")
                .order("name", { ascending: true });

            if (error) throw error;

            set({
                categories: (data as ExerciseCategory[]) || [],
                isCategoriesLoaded: true,
                isCategoriesLoading: false,
            });
        } catch (err) {
            console.error("[dataCacheStore] fetchCategories error:", err);
            set({ isCategoriesLoading: false });
        }
    },
}));
