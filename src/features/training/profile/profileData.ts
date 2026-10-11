export interface StudentProfileData {
  phone: string;
  instagram?: string;
  birth_date: string;
  gender: "male" | "female" | "other";
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active";
  primary_goal: "aesthetic" | "sports" | "health" | "readaptation";
  training_experience: "none" | "beginner" | "intermediate" | "advanced";
  sports: string;
  previous_injuries?: string;
  medical_conditions?: string;
  height_cm?: number;
  weight_kg?: number;
}

export type Section = "personal" | "medical" | "training" | null;

/** Props comunes de las tres secciones del perfil. */
export interface SectionProps {
  profileData: StudentProfileData | null;
  formData: Partial<StudentProfileData>;
  setFormData: (data: Partial<StudentProfileData>) => void;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const SESSION_KEY = "training_profile_data";

/** Read cached profile from sessionStorage (survives same-tab navigation). */
export function readCachedProfile(): StudentProfileData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StudentProfileData) : null;
  } catch {
    return null;
  }
}

/** Persist profile to sessionStorage after a successful fetch. */
export function writeCachedProfile(data: StudentProfileData) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

const GENDERS: Record<string, string> = {
  male: "Masculino",
  female: "Femenino",
  other: "Otro",
};
const ACTIVITY_LEVELS: Record<string, string> = {
  sedentary: "Sedentario",
  light: "Ligero",
  moderate: "Moderado",
  active: "Activo",
  very_active: "Muy Activo",
};
const GOALS: Record<string, string> = {
  aesthetic: "Estética",
  sports: "Deportivo",
  health: "Salud",
  readaptation: "Readaptación",
};
const EXPERIENCES: Record<string, string> = {
  none: "Ninguna",
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export const translateGender = (v: string) => GENDERS[v] || v;
export const translateActivityLevel = (v: string) => ACTIVITY_LEVELS[v] || v;
export const translateGoal = (v: string) => GOALS[v] || v;
export const translateExperience = (v: string) => EXPERIENCES[v] || v;

/** Una sección está completa cuando tiene los datos mínimos cargados. */
export function isSectionComplete(
  profileData: StudentProfileData | null,
  section: Section,
): boolean {
  if (!profileData || !section) return false;
  switch (section) {
    case "personal":
      return !!(
        profileData.phone &&
        profileData.birth_date &&
        profileData.gender &&
        profileData.height_cm &&
        profileData.weight_kg
      );
    case "medical":
      return !!(profileData.previous_injuries || profileData.medical_conditions);
    case "training":
      return !!(
        profileData.activity_level &&
        profileData.primary_goal &&
        profileData.training_experience &&
        profileData.sports
      );
    default:
      return false;
  }
}
