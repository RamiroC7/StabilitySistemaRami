import { avatarSrc } from "@/lib/avatar";
import type { ChangeEvent, RefObject } from "react";
import { Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileHeaderProps {
  firstName?: string;
  lastName?: string;
  profileImage?: string | null;
  isUploadingImage: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImageClick: () => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export default function ProfileHeader({
  firstName,
  lastName,
  profileImage,
  isUploadingImage,
  fileInputRef,
  onImageClick,
  onImageChange,
}: ProfileHeaderProps) {
  return (
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
            backgroundImage: `url("${avatarSrc(profileImage, 112)}")`,
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
          onClick={onImageClick}
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
          onChange={onImageChange}
        />
      </div>

      <div className="mt-5 text-center">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {firstName} {lastName}
        </h1>
        <div className="flex items-center justify-center gap-2 mt-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.1em]">
            Alumno Stability
          </p>
        </div>
      </div>
    </div>
  );
}
