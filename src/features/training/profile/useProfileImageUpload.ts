import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { uploadProfileImage } from "@/lib/supabase-storage";
import { useAuthStore } from "@/features/auth/store/authStore";

const MAX_SIZE_MB = 5;

/** Sube la foto de perfil del alumno y refleja el cambio en el auth store. */
export function useProfileImageUpload() {
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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

    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen (JPG, PNG, WebP, etc.)");
      return;
    }

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

  return { isUploadingImage, fileInputRef, handleImageClick, handleImageChange };
}
