import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useDataCacheStore } from "../store/dataCacheStore";

// ── Types ──────────────────────────────────────────────────────────────────

interface TrainingPlanAssignmentRow {
  id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  status: string;
  assigned_at: string;
  training_plans: {
    title: string;
    plan_type: string | null;
    difficulty_level: string | null;
    total_days: number;
    days_per_week: number;
    total_weeks: number;
  } | {
    title: string;
    plan_type: string | null;
    difficulty_level: string | null;
    total_days: number;
    days_per_week: number;
    total_weeks: number;
  }[];
}

export interface StudentProfile {
  // From profiles
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  createdAt: string;
  profileImage: string | null;

  // From student_profiles (may be null if no entry)
  phone: string | null;
  instagram: string | null;
  profileImageUrl: string | null;
  birthDate: string | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  primaryGoal: string | null;
  trainingExperience: string | null;
  sports: string | null;
  previousInjuries: string | null;
  medicalConditions: string | null;
  isArchived: boolean;
}

export interface AssignedPlan {
  id: string;
  planId: string;
  planTitle: string;
  planType: string | null;
  difficultyLevel: string | null;
  totalDays: number;
  daysPerWeek: number;
  totalWeeks: number;
  startDate: string;
  endDate: string;
  status: string;
  assignedAt: string;
}

// ── Helper maps ────────────────────────────────────────────────────────────

export const GOAL_LABELS: Record<string, string> = {
  aesthetic: "Estética",
  sports: "Rendimiento Deportivo",
  health: "Salud General",
  readaptation: "Readaptación",
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  none: "Sin experiencia",
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentario",
  light: "Ligero",
  moderate: "Moderado",
  active: "Activo",
  very_active: "Muy activo",
};

export const GENDER_LABELS: Record<string, string> = {
  male: "Masculino",
  female: "Femenino",
  other: "Otro",
};

export const PLAN_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  completed: "Completado",
  paused: "Pausado",
  cancelled: "Cancelado",
};

// ── Helper: calculate age ──────────────────────────────────────────────────

export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useStudentProfile(studentId: string | undefined) {
  const profileCache = useDataCacheStore((s) => s.studentProfiles);
  const plansCache = useDataCacheStore((s) => s.studentAssignedPlans);
  const loadedCache = useDataCacheStore((s) => s.loadedStudentProfiles);
  const setStudentProfileData = useDataCacheStore(
    (s) => s.setStudentProfileData,
  );
  const invalidateStudentProfile = useDataCacheStore(
    (s) => s.invalidateStudentProfile,
  );

  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoaded = studentId ? !!loadedCache[studentId] : false;

  const load = useCallback(
    async (forceFetch = false) => {
      if (!studentId) return;

      // SWR: always revalidate. Blocking spinner only shows when cache is empty.
      setIsFetching(true);
      setError(null);
      void forceFetch;

      try {
        // Fetch profile + student_profiles in one query
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            `
          id,
          first_name,
          last_name,
          email,
          profile_image,
          created_at,
          student_profiles (
            phone,
            instagram,
            profile_image_url,
            birth_date,
            gender,
            height_cm,
            weight_kg,
            activity_level,
            primary_goal,
            training_experience,
            sports,
            previous_injuries,
            medical_conditions,
            is_archived
          )
        `,
          )
          .eq("id", studentId)
          .single();

        if (profileError) throw profileError;
        if (!profileData) throw new Error("Alumno no encontrado");

        // Extract student_profiles (supabase returns as array or object)
        const sp = Array.isArray(profileData.student_profiles)
          ? profileData.student_profiles[0]
          : (profileData.student_profiles as Record<string, unknown> | null);

        const studentProfile: StudentProfile = {
          id: profileData.id,
          firstName: profileData.first_name,
          lastName: profileData.last_name,
          fullName: `${profileData.first_name} ${profileData.last_name}`,
          email: profileData.email,
          createdAt: profileData.created_at,
          profileImage: profileData.profile_image,
          phone: (sp?.phone as string) ?? null,
          instagram: (sp?.instagram as string) ?? null,
          profileImageUrl: (sp?.profile_image_url as string) ?? null,
          birthDate: (sp?.birth_date as string) ?? null,
          gender: (sp?.gender as string) ?? null,
          heightCm: (sp?.height_cm as number) ?? null,
          weightKg: (sp?.weight_kg as number) ?? null,
          activityLevel: (sp?.activity_level as string) ?? null,
          primaryGoal: (sp?.primary_goal as string) ?? null,
          trainingExperience: (sp?.training_experience as string) ?? null,
          sports: (sp?.sports as string) ?? null,
          previousInjuries: (sp?.previous_injuries as string) ?? null,
          medicalConditions: (sp?.medical_conditions as string) ?? null,
          isArchived: (sp?.is_archived as boolean) ?? false,
        };

        // NO seteamos local state de "student", es responsabilidad del cacheStore:
        // Lo dejaremos flotar a través del hook return
        const finalProfile = studentProfile;

        // Fetch assigned plans
        const { data: assignmentsData, error: assignError } = await supabase
          .from("training_plan_assignments")
          .select(
            `
          id,
          plan_id,
          start_date,
          end_date,
          status,
          assigned_at,
          training_plans (
            title,
            plan_type,
            difficulty_level,
            total_days,
            days_per_week,
            total_weeks
          )
        `,
          )
          .eq("student_id", studentId)
          .order("assigned_at", { ascending: false });

        if (assignError) throw assignError;

        if (assignmentsData) {
          const mapped: AssignedPlan[] = assignmentsData.map((a: TrainingPlanAssignmentRow) => {
            const tpRaw = a.training_plans;
            const tp = Array.isArray(tpRaw) ? tpRaw[0] : tpRaw;
            const totalDays = tp?.total_days ?? 0;

            return {
              id: a.id as string,
              planId: a.plan_id as string,
              planTitle: (tp?.title as string) || "Plan sin nombre",
              planType: (tp?.plan_type as string) ?? null,
              difficultyLevel: (tp?.difficulty_level as string) ?? null,
              totalDays: totalDays,
              daysPerWeek: (tp?.days_per_week as number) ?? totalDays,
              totalWeeks: (tp?.total_weeks as number) ?? 0,
              startDate: a.start_date as string,
              endDate: a.end_date as string,
              status: (a.status as string) ?? "active",
              assignedAt: a.assigned_at as string,
            };
          });
          setStudentProfileData(studentId, finalProfile, mapped);
        } else {
          setStudentProfileData(studentId, finalProfile, []);
        }
      } catch (err) {
        console.error("[useStudentProfile] Error:", err);
        setError(err instanceof Error ? err.message : "Error al cargar perfil");
      } finally {
        setIsFetching(false);
      }
    },
    [studentId, setStudentProfileData],
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const student = studentId ? profileCache[studentId] || null : null;
  const plans = studentId ? plansCache[studentId] || [] : [];
  const isLoading = isFetching && !isLoaded;

  return {
    student,
    plans,
    isLoading,
    error,
    reload: () => {
      if (studentId) invalidateStudentProfile(studentId);
      load(true);
    },
  };
}
