import { useEffect } from "react";
import { useAuthStore } from "../features/auth/store/authStore";
import { useDataCacheStore } from "../store/dataCacheStore";

interface ActiveAssignment {
  plan_id: string;
  plan_title: string;
  start_date: string;
  end_date: string;
  status: string;
  days_per_week: number;
}

export interface Student {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  trainingLevel: string;
  primaryGoal: string;
  activityLevel: string;
  phone?: string;
  instagram?: string;
  activeAssignments?: ActiveAssignment[];
  rpeAlert?: "high" | "low" | null;
  isArchived: boolean;
}

// Alias for components that need the extended type
export type StudentWithAssignments = Student;

interface AuthState {
  professor: { id: string } | null;
}

export function useStudents() {
  const professor = useAuthStore((state: AuthState) => state.professor);

  // Selectors — each is an atomic primitive to avoid unnecessary re-renders
  const students = useDataCacheStore((s) => s.students);
  const isLoaded = useDataCacheStore((s) => s.isStudentsLoaded);
  const isLoading = useDataCacheStore((s) => s.isStudentsLoading);
  const fetchStudents = useDataCacheStore((s) => s.fetchStudents);
  const reloadStudents = useDataCacheStore((s) => s.reloadStudents);

  useEffect(() => {
    if (!professor) return;
    // fetchStudents guards internally against double-fetching
    fetchStudents(professor.id);
  }, [professor, fetchStudents, isLoaded]);

  /**
   * reload() invalida la caché y fuerza un re-fetch inmediato.
   * Usar tras crear / editar / eliminar un estudiante.
   */
  const reload = () => {
    if (!professor) return;
    reloadStudents();
    // El useEffect se disparará en el siguiente tick porque isLoaded cambió
    fetchStudents(professor.id);
  };

  return {
    students,
    loading: isLoading && !isLoaded,
    error: null,
    reload,
  };
}

// Helper function to map training experience level to display text
export const getTrainingLevelDisplay = (level: string): string => {
  const levels: Record<string, string> = {
    none: "Sin experiencia",
    beginner: "Principiante",
    intermediate: "Intermedio",
    advanced: "Avanzado",
  };
  return levels[level] || "Sin especificar";
};

// Helper function to map primary goal to display text
export const getPrimaryGoalDisplay = (goal: string): string => {
  const goals: Record<string, string> = {
    aesthetic: "Estética",
    sports: "Deporte",
    health: "Salud",
    readaptation: "Readaptación",
  };
  return goals[goal] || "Sin especificar";
};

// Helper function to map activity level to display text
export const getActivityLevelDisplay = (level: string): string => {
  const levels: Record<string, string> = {
    sedentary: "Sedentario",
    light: "Ligero",
    moderate: "Moderado",
    active: "Activo",
    very_active: "Muy activo",
  };
  return levels[level] || "Sin especificar";
};

// Get a meaningful tag combining level + goal
export const getStudentTag = (
  trainingLevel: string,
  primaryGoal: string,
): string => {
  const levelShort =
    getTrainingLevelDisplay(trainingLevel)?.split(" ")[0] || "Nivel";
  const goalDisplay = getPrimaryGoalDisplay(primaryGoal) || "Objetivo";
  return `${levelShort} • ${goalDisplay}`;
};
