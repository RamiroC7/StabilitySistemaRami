import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, BarChart2, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useTrainingStore } from "@/features/training/store/trainingStore";

const tabs: { label: string; icon: LucideIcon; path: string }[] = [
  { label: "Inicio", icon: Home, path: "/entrenamiento" },
  { label: "Progreso", icon: BarChart2, path: "/entrenamiento/progreso" },
  { label: "Comunidad", icon: Users, path: "/entrenamiento/comunidad" },
  { label: "Perfil", icon: User, path: "/entrenamiento/perfil" },
];

export default function TrainingLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const previewDayId = useTrainingStore((s) => s.previewDayId);

  const activeTab = tabs.findIndex((t) => {
    if (t.path === "/entrenamiento") {
      return (
        location.pathname === "/entrenamiento" ||
        location.pathname === "/entrenamiento/"
      );
    }
    return location.pathname.startsWith(t.path);
  });

  const normalizedPath = location.pathname.replace(/\/$/, "");
  let headerTitle = "";
  if (normalizedPath === "/entrenamiento/progreso") {
    headerTitle = "Tu Evolución";
  } else if (normalizedPath === "/entrenamiento/comunidad") {
    headerTitle = "Comunidad";
  } else if (normalizedPath === "/entrenamiento/perfil") {
    headerTitle = "Perfil";
  }

  return (
    <div className="relative flex flex-col h-[100dvh] overflow-hidden bg-[#f7f9fc] dark:bg-slate-950">
      {/* Fixed Top Header */}
      {headerTitle && (
        <header className="flex items-center justify-between px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] bg-background-light dark:bg-background-dark border-b border-gray-100 dark:border-gray-800 shrink-0 z-50">
          <div className="w-8"></div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {headerTitle}
          </h2>
          <div className="w-8"></div>
        </header>
      )}

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto overscroll-contain pb-28">
        <Outlet />
      </main>

      {/* Bottom navigation — only shown on screens that aren't in the active workout flow */}
      <nav
        className={cn(
          "absolute left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 w-[calc(100%-2rem)] md:w-full md:max-w-md bg-blue-100/90 dark:bg-blue-950/90 backdrop-blur-lg border border-blue-200/80 dark:border-blue-900/60 rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 transition-all duration-300",
          previewDayId && "translate-y-[150%] opacity-0 pointer-events-none"
        )}
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center h-[64px] px-3">
          {tabs.map((tab, i) => {
            const isActive = activeTab === i;
            const Icon = tab.icon;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 h-full rounded-2xl transition-all duration-300 min-h-[44px]",
                  isActive
                    ? "text-blue-800 dark:text-blue-200 scale-105"
                    : "text-blue-950/50 dark:text-blue-200/40 hover:text-blue-900 dark:hover:text-blue-100",
                )}
              >
                <Icon
                  size={20}
                  className={cn("transition-all duration-300", isActive && "scale-110")}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span
                  className={cn(
                    "text-[10px] tracking-wide transition-all duration-300",
                    isActive ? "font-bold" : "font-semibold"
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
