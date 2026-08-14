import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";
import { Wrench, LogOut, Settings, GraduationCap, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import LogoutBottomSheet from "@/components/LogoutBottomSheet";
import { useState } from "react";

// ─── Simple Coming Soon placeholder ──────────────────────────────────────

function PlaceholderPage({
  Icon,
  title,
  description,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center gap-4">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
        <Icon size={36} className="text-primary" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
          {description}
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800">
        <Wrench size={13} />
        Próximamente
      </span>
    </div>
  );
}

export function TrainingProgress() {
  return (
    <PlaceholderPage
      Icon={Trophy}
      title="Tu Progreso"
      description="Aquí verás tus métricas, récords personales, historial de entrenamientos y evolución de peso a lo largo del tiempo."
    />
  );
}

export function TrainingProfile() {
  const navigate = useNavigate();
  const { professor, logout, isLoading } = useAuthStore();
  const [showLogoutSheet, setShowLogoutSheet] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      navigate("/login", { replace: true }); // Navegar igual aunque falle
    } finally {
      setIsLoggingOut(false);
      setShowLogoutSheet(false);
    }
  };

  if (!professor) {
    return null;
  }

  return (
    <div className="px-4 pt-6 pb-4 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Perfil
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Tu información personal
        </p>
      </div>

      {/* Profile card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Avatar header */}
        <div className="relative h-24 bg-gradient-to-br from-primary to-brand-blue">
          <div className="absolute -bottom-10 left-4">
            <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center overflow-hidden">
              {professor.profileImage ? (
                <img
                  src={professor.profileImage}
                  alt={professor.firstName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <GraduationCap size={32} className="text-slate-400" strokeWidth={1.5} />
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="pt-14 px-4 pb-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {professor.firstName} {professor.lastName}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {professor.email}
            </p>
          </div>

          {/* Role badge */}
          <div className="flex gap-2">
            <span className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800">
              <GraduationCap size={13} />
              {professor.role === "student" ? "Alumno" : "Coach"}
            </span>
          </div>
        </div>
      </div>

      {/* User options placeholder */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm p-4">
        <div className="flex items-center gap-3 py-2 opacity-40">
          <Settings size={20} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Configuración
          </span>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Próximamente
          </span>
        </div>
      </div>

      {/* Logout button */}
      <button
        onClick={() => setShowLogoutSheet(true)}
        disabled={isLoading || isLoggingOut}
        className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white font-bold text-sm py-4 rounded-2xl shadow-lg shadow-red-500/30 active:scale-[0.98] transition-all min-h-[52px]"
      >
        <LogOut size={18} />
        {isLoggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}
      </button>

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
