import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/features/auth/store/authStore";
import { supabase } from "@/lib/supabase";
import { uploadProfileImage } from "@/lib/supabase-storage";
import {
  Pencil,
  Loader2,
  User,
  Phone,
  AtSign,
  Cake,
  Users,
  ChevronDown,
  LogOut,
  Edit,
  Trophy,
  AlertTriangle,
  HeartPulse,
  Zap,
  Crosshair,
  Award,
  Cross,
  Target,
  CheckCircle2,
  Ruler,
  Weight,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDateLocal } from "@/lib/utils";
import LogoutBottomSheet from "@/components/LogoutBottomSheet";

interface StudentProfileData {
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

type Section = "personal" | "medical" | "training" | null;

const SESSION_KEY = "training_profile_data";

/** Read cached profile from sessionStorage (survives same-tab navigation). */
function readCachedProfile(): StudentProfileData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StudentProfileData) : null;
  } catch {
    return null;
  }
}

/** Persist profile to sessionStorage after a successful fetch. */
function writeCachedProfile(data: StudentProfileData) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

export default function TrainingProfile() {
  const { logout, professor } = useAuthStore();

  // Pre-populate from sessionStorage so there's NEVER a blocking spinner on return visits
  const [profileData, setProfileData] = useState<StudentProfileData | null>(
    () => readCachedProfile(),
  );
  // Only show the full-page spinner when we have no cached data at all
  const [loading, setLoading] = useState<boolean>(() => !readCachedProfile());
  const [expandedSection, setExpandedSection] = useState<Section>(null);
  const [editingSection, setEditingSection] = useState<Section>(null);
  const [formData, setFormData] = useState<Partial<StudentProfileData>>({});
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showLogoutSheet, setShowLogoutSheet] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => {
    if (isUploadingImage) return;
    fileInputRef.current?.click();
  };

  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
    event.target.value = "";
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen (JPG, PNG, WebP, etc.)");
      return;
    }

    // Validar tamaño máximo: 5MB
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`La imagen no puede superar los ${MAX_SIZE_MB}MB`);
      return;
    }

    setIsUploadingImage(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // 1. Subir al bucket "profile-images" con nombre único
      const publicUrl = await uploadProfileImage(user.id, file);
      if (!publicUrl) throw new Error("No se pudo obtener la URL pública");

      // 2. Actualizar la tabla student_profiles
      const { error: dbError } = await supabase
        .from("student_profiles")
        .update({ profile_image_url: publicUrl })
        .eq("id", user.id);

      if (dbError) throw dbError;

      // 3. Actualizar el estado local de Zustand para reflejo inmediato
      useAuthStore.setState((state) => ({
        professor: state.professor
          ? { ...state.professor, profileImage: publicUrl }
          : null,
      }));

      toast.success("¡Foto de perfil actualizada!");
    } catch (error) {
      console.error("[handleImageChange] Error al subir imagen:", error);
      const message =
        error instanceof Error ? error.message : "Error al subir la imagen";
      toast.error(message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("student_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data) {
        writeCachedProfile(data as StudentProfileData);
        setProfileData(data as StudentProfileData);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Error al cargar el perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (section: Section) => {
    setEditingSection(section);
    setFormData(profileData || {});
  };

  const handleCancel = () => {
    setEditingSection(null);
    setFormData({});
  };

  const handleSave = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Excluir columnas generadas por la DB (ej: bmi) que no se pueden actualizar manualmente
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { bmi, ...updateData } = formData as Record<string, unknown>;

      const { error } = await supabase
        .from("student_profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;

      setProfileData({ ...profileData, ...updateData } as StudentProfileData);
      setEditingSection(null);
      toast.success("Perfil actualizado correctamente");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error al actualizar el perfil");
    }
  };

  const toggleSection = (section: Section) => {
    if (editingSection) return; // No permitir cambiar de sección mientras se edita
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutSheet(false);
    }
  };

  const translateGender = (gender: string) => {
    const translations = {
      male: "Masculino",
      female: "Femenino",
      other: "Otro",
    };
    return translations[gender as keyof typeof translations] || gender;
  };

  const translateActivityLevel = (level: string) => {
    const translations = {
      sedentary: "Sedentario",
      light: "Ligero",
      moderate: "Moderado",
      active: "Activo",
      very_active: "Muy Activo",
    };
    return translations[level as keyof typeof translations] || level;
  };

  const translateGoal = (goal: string) => {
    const translations = {
      aesthetic: "Estética",
      sports: "Deportivo",
      health: "Salud",
      readaptation: "Readaptación",
    };
    return translations[goal as keyof typeof translations] || goal;
  };

  const translateExperience = (exp: string) => {
    const translations = {
      none: "Ninguna",
      beginner: "Principiante",
      intermediate: "Intermedio",
      advanced: "Avanzado",
    };
    return translations[exp as keyof typeof translations] || exp;
  };

  // Helper para verificar si una sección está completa
  const isSectionComplete = (section: Section): boolean => {
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
        return !!(
          profileData.previous_injuries || profileData.medical_conditions
        );
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
  };

  // Only block the UI on the very first render (no data yet)
  if (loading && !profileData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={36} className="text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-[#1F2937] dark:text-gray-100 flex flex-col">
      <div className="pb-24">
        {/* Profile Header */}
        <div className="relative pt-10 pb-8 px-4 flex flex-col items-center overflow-hidden">
          {/* Decorative Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/5 dark:bg-primary/10 blur-[100px] -z-10 rounded-full" />

          <div className="relative group isolate">
            {/* Avatar */}
            <div
              className={cn(
                "w-28 h-28 rounded-full shadow-2xl border-4 border-white dark:border-slate-800 relative z-10 overflow-hidden ring-4 ring-primary/5 transition-all duration-500",
                !isUploadingImage && "group-hover:scale-[1.02]",
                isUploadingImage && "opacity-50",
              )}
              style={{
                backgroundImage: professor?.profileImage
                  ? `url("${professor.profileImage}")`
                  : `url("https://ui-avatars.com/api/?name=${professor?.firstName}+${professor?.lastName}&size=256&background=0056B2&color=fff&bold=true")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />

            {/* Spinner overlay mientras se sube la imagen */}
            {isUploadingImage && (
              <div className="absolute inset-0 z-30 flex items-center justify-center rounded-full">
                <Loader2 size={28} className="text-primary animate-spin" />
              </div>
            )}

            {/* Pulsing ring effect (solo cuando no carga) */}
            {!isUploadingImage && (
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping opacity-20" />
            )}

            <button
              onClick={handleImageClick}
              disabled={isUploadingImage}
              className={cn(
                "absolute bottom-0 left-0 z-20 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-md shadow-primary/20 transition-all outline-none border-2 border-background-light dark:border-background-dark",
                !isUploadingImage
                  ? "hover:bg-primary-hover hover:scale-105 active:scale-95"
                  : "opacity-50 cursor-not-allowed",
              )}
              aria-label="Cambiar foto de perfil"
            >
              <Pencil size={14} />
            </button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageChange}
            />
          </div>

          <div className="mt-5 text-center">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              {professor?.firstName} {professor?.lastName}
            </h1>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.1em]">
                Alumno Stability
              </p>
            </div>
          </div>
        </div>

        {/* Collapsible Sections */}
        <div className="px-4 space-y-3">
          {/* Información Personal */}
          <div className="bg-white dark:bg-surface-dark/50 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
            <button
              onClick={() => toggleSection("personal")}
              className="w-full flex items-center p-4 hover:bg-gray-50 dark:hover:bg-surface-dark transition-all duration-200"
              disabled={editingSection !== null}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mr-4 shrink-0 transition-transform duration-200 group-hover:scale-105">
                <User size={24} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-base font-semibold text-[#101418] dark:text-white">
                  Información Personal
                </h3>
                <p className="text-sm text-gray-500">
                  Datos de contacto y personales
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isSectionComplete("personal") && (
                  <CheckCircle2
                    size={18}
                    className="text-green-500 animate-in fade-in duration-300"
                  />
                )}
                <ChevronDown
                  size={20}
                  className={cn(
                    "text-gray-400 transition-transform duration-300",
                    expandedSection === "personal" && "rotate-180",
                  )}
                />
              </div>
            </button>

            {expandedSection === "personal" && (
              <div className="px-5 pb-6 pt-2 border-t border-slate-50 dark:border-slate-800/50 animate-in slide-in-from-top-2 fade-in duration-300">
                {editingSection === "personal" ? (
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          value={formData.phone || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          className="block w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                          Instagram
                        </label>
                        <input
                          type="text"
                          value={formData.instagram || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              instagram: e.target.value,
                            })
                          }
                          className="block w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                          placeholder="@usuario"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                          Fecha de Nacimiento
                        </label>
                        <input
                          type="date"
                          value={formData.birth_date || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              birth_date: e.target.value,
                            })
                          }
                          className="block w-full min-w-full appearance-none px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                          Género
                        </label>
                        <select
                          value={formData.gender || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              gender: e.target.value as
                                | "male"
                                | "female"
                                | "other",
                            })
                          }
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none"
                        >
                          <option value="male">Masculino</option>
                          <option value="female">Femenino</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                          Altura (cm)
                        </label>
                        <input
                          type="number"
                          value={formData.height_cm ?? ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              height_cm: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                          className="block w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                          placeholder="175"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                          Peso (kg)
                        </label>
                        <input
                          type="number"
                          value={formData.weight_kg ?? ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              weight_kg: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                          className="block w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                          placeholder="72"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleSave()}
                        className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all"
                      >
                        Actualizar Datos
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-4">
                      {/* Phone */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Phone size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Teléfono
                          </p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                            {profileData?.phone || "—"}
                          </p>
                        </div>
                      </div>

                      {/* Instagram */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <AtSign size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Instagram
                          </p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                            {profileData?.instagram || "—"}
                          </p>
                        </div>
                      </div>

                      {/* Birthday */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Cake size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Nacimiento
                          </p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                            {formatDateLocal(profileData?.birth_date)}
                          </p>
                        </div>
                      </div>

                      {/* Gender */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Users size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Género
                          </p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                            {profileData?.gender
                              ? translateGender(profileData.gender)
                              : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Height */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Ruler size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Altura
                          </p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                            {profileData?.height_cm
                              ? `${profileData.height_cm} cm`
                              : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Weight */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Weight size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Peso
                          </p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                            {profileData?.weight_kg
                              ? `${profileData.weight_kg} kg`
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleEdit("personal")}
                      className="w-full mt-8 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-bold text-primary hover:bg-primary/5 active:scale-[0.98] transition-all"
                    >
                      <Edit size={18} />
                      EDITAR INFORMACIÓN
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Información Médica */}
          <div className="bg-white dark:bg-surface-dark/50 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
            <button
              onClick={() => toggleSection("medical")}
              className="w-full flex items-center p-4 hover:bg-gray-50 dark:hover:bg-surface-dark transition-all duration-200"
              disabled={editingSection !== null}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mr-4 shrink-0 transition-transform duration-200 group-hover:scale-105">
                <Cross size={24} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-base font-semibold text-[#101418] dark:text-white">
                  Información Médica
                </h3>
                <p className="text-sm text-gray-500">
                  Lesiones y condiciones médicas
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isSectionComplete("medical") && (
                  <CheckCircle2
                    size={18}
                    className="text-green-500 animate-in fade-in duration-300"
                  />
                )}
                <ChevronDown
                  size={20}
                  className={cn(
                    "text-gray-400 transition-transform duration-300",
                    expandedSection === "medical" && "rotate-180",
                  )}
                />
              </div>
            </button>

            {expandedSection === "medical" && (
              <div className="px-5 pb-6 pt-2 border-t border-slate-50 dark:border-slate-800/50 animate-in slide-in-from-top-2 fade-in duration-300">
                {editingSection === "medical" ? (
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                        Lesiones Previas
                      </label>
                      <textarea
                        value={formData.previous_injuries || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            previous_injuries: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                        rows={3}
                        placeholder="Describe lesiones previas..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                        Condiciones Médicas
                      </label>
                      <textarea
                        value={formData.medical_conditions || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            medical_conditions: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                        rows={3}
                        placeholder="Condiciones médicas relevantes..."
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleSave()}
                        className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all"
                      >
                        Actualizar Datos
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 space-y-4">
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-slate-100 dark:border-slate-800/30">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={18} className="text-primary" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Lesiones Previas
                        </p>
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {profileData?.previous_injuries ||
                          "No se han registrado lesiones."}
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-slate-100 dark:border-slate-800/30">
                      <div className="flex items-center gap-2 mb-2">
                        <HeartPulse size={18} className="text-primary" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Condiciones Médicas
                        </p>
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {profileData?.medical_conditions ||
                          "Sin condiciones médicas reportadas."}
                      </p>
                    </div>

                    <button
                      onClick={() => handleEdit("medical")}
                      className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-bold text-primary hover:bg-primary/5 active:scale-[0.98] transition-all"
                    >
                      <Edit size={18} />
                      EDITAR INFORMACIÓN MÉDICA
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Entrenamiento y Objetivos */}
          <div className="bg-white dark:bg-surface-dark/50 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
            <button
              onClick={() => toggleSection("training")}
              className="w-full flex items-center p-4 hover:bg-gray-50 dark:hover:bg-surface-dark transition-all duration-200"
              disabled={editingSection !== null}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mr-4 shrink-0 transition-transform duration-200 group-hover:scale-105">
                <Target size={24} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-base font-semibold text-[#101418] dark:text-white">
                  Entrenamiento y Objetivos
                </h3>
                <p className="text-sm text-gray-500">
                  Experiencia y metas deportivas
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isSectionComplete("training") && (
                  <CheckCircle2
                    size={18}
                    className="text-green-500 animate-in fade-in duration-300"
                  />
                )}
                <ChevronDown
                  size={20}
                  className={cn(
                    "text-gray-400 transition-transform duration-300",
                    expandedSection === "training" && "rotate-180",
                  )}
                />
              </div>
            </button>

            {expandedSection === "training" && (
              <div className="px-5 pb-6 pt-2 border-t border-slate-50 dark:border-slate-800/50 animate-in slide-in-from-top-2 fade-in duration-300">
                {editingSection === "training" ? (
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                          Nivel de Actividad
                        </label>
                        <select
                          value={formData.activity_level || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              activity_level: e.target
                                .value as StudentProfileData["activity_level"],
                            })
                          }
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none"
                        >
                          <option value="sedentary">Sedentario</option>
                          <option value="light">Ligero</option>
                          <option value="moderate">Moderado</option>
                          <option value="active">Activo</option>
                          <option value="very_active">Muy Activo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                          Objetivo Principal
                        </label>
                        <select
                          value={formData.primary_goal || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              primary_goal: e.target
                                .value as StudentProfileData["primary_goal"],
                            })
                          }
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none"
                        >
                          <option value="aesthetic">Estética</option>
                          <option value="sports">Deportivo</option>
                          <option value="health">Salud</option>
                          <option value="readaptation">Readaptación</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                          Experiencia en Entrenamiento
                        </label>
                        <select
                          value={formData.training_experience || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              training_experience: e.target
                                .value as StudentProfileData["training_experience"],
                            })
                          }
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none"
                        >
                          <option value="none">Ninguna</option>
                          <option value="beginner">Principiante</option>
                          <option value="intermediate">Intermedio</option>
                          <option value="advanced">Avanzado</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                          Deportes Practicados
                        </label>
                        <input
                          type="text"
                          value={formData.sports || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, sports: e.target.value })
                          }
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                          placeholder="Ej: Fútbol, natación..."
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleSave()}
                        className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all"
                      >
                        Actualizar Datos
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <div className="grid grid-cols-1 gap-4 pt-2">
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Zap size={20} className="text-primary" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                              Nivel Actividad
                            </p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {profileData?.activity_level
                                ? translateActivityLevel(
                                    profileData.activity_level,
                                  )
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Crosshair size={20} className="text-primary" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                              Objetivo
                            </p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {profileData?.primary_goal
                                ? translateGoal(profileData.primary_goal)
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Award size={20} className="text-primary" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                              Experiencia
                            </p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {profileData?.training_experience
                                ? translateExperience(
                                    profileData.training_experience,
                                  )
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy size={18} className="text-primary" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Deportes Practicados
                          </p>
                        </div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {profileData?.sports ||
                            "No se especificaron deportes."}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleEdit("training")}
                      className="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-bold text-primary hover:bg-primary/5 active:scale-[0.98] transition-all"
                    >
                      <Edit size={18} />
                      EDITAR ENTRENAMIENTO
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Logout Button */}
          <div className="pt-4">
            <div
              onClick={() => setShowLogoutSheet(true)}
              className="flex items-center p-3 rounded-xl cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-transparent text-red-500 mr-4 shrink-0">
                <LogOut size={24} className="text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-medium text-red-600 dark:text-red-400">
                  Cerrar Sesión
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Bottom Sheet */}
      <LogoutBottomSheet
        isOpen={showLogoutSheet}
        onClose={() => setShowLogoutSheet(false)}
        onConfirm={handleLogout}
        isLoading={isLoggingOut}
      />
    </div>
  );
}
