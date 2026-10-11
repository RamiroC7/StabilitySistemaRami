import { useEffect, useState } from "react";
import { useAuthStore } from "@/features/auth/store/authStore";
import { supabase } from "@/lib/supabase";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import LogoutBottomSheet from "@/components/LogoutBottomSheet";
import ProfileHeader from "./profile/ProfileHeader";
import PersonalSection from "./profile/PersonalSection";
import MedicalSection from "./profile/MedicalSection";
import TrainingSection from "./profile/TrainingSection";
import { useProfileImageUpload } from "./profile/useProfileImageUpload";
import {
  readCachedProfile,
  writeCachedProfile,
  type Section,
  type SectionProps,
  type StudentProfileData,
} from "./profile/profileData";

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
  const [showLogoutSheet, setShowLogoutSheet] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { isUploadingImage, fileInputRef, handleImageClick, handleImageChange } =
    useProfileImageUpload();

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
        .select("phone, instagram, birth_date, gender, activity_level, primary_goal, training_experience, sports, previous_injuries, medical_conditions, height_cm, weight_kg")
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

  // Only block the UI on the very first render (no data yet)
  if (loading && !profileData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={36} className="text-primary animate-spin" />
      </div>
    );
  }

  const sectionProps = (section: Exclude<Section, null>) => ({
    profileData,
    formData,
    setFormData,
    isEditing: editingSection === section,
    onEdit: () => handleEdit(section),
    onSave: handleSave,
    onCancel: handleCancel,
    isExpanded: expandedSection === section,
    disabled: editingSection !== null,
    onToggle: () => toggleSection(section),
  }) satisfies SectionProps & Record<string, unknown>;

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-[#1F2937] dark:text-gray-100 flex flex-col">
      <div className="pb-24">
        <ProfileHeader
          firstName={professor?.firstName}
          lastName={professor?.lastName}
          profileImage={professor?.profileImage}
          isUploadingImage={isUploadingImage}
          fileInputRef={fileInputRef}
          onImageClick={handleImageClick}
          onImageChange={handleImageChange}
        />

        {/* Collapsible Sections */}
        <div className="px-4 space-y-3">
          <PersonalSection {...sectionProps("personal")} />
          <MedicalSection {...sectionProps("medical")} />
          <TrainingSection {...sectionProps("training")} />

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
