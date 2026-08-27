import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, BarChart2, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useTrainingStore } from "@/features/training/store/trainingStore";
import {
  NOSOTROS_VISITS_KEY,
  shouldShowVisitBadge,
} from "@/features/training/news/newsStorageKeys";

const tabs: { label: string; icon: LucideIcon; path: string; showDot?: boolean }[] = [
  { label: "Inicio", icon: Home, path: "/entrenamiento" },
  { label: "Progreso", icon: BarChart2, path: "/entrenamiento/progreso" },
  { label: "Comunidad", icon: Users, path: "/entrenamiento/comunidad", showDot: true },
  { label: "Perfil", icon: User, path: "/entrenamiento/perfil" },
];

export default function TrainingLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const previewDayId = useTrainingStore((s) => s.previewDayId);
  // TrainingLayout se desmonta al entrar a sub-paginas de Comunidad (rutas
  // fuera de este layout) y se remonta al volver al bottom nav — mismo
  // approach que TrainingCommunity para reflejar visitas frescas. Usa el
  // mismo contador que el puntito de "Nosotros" para que desaparezcan juntos.
  const [showComunidadDot] = useState<boolean>(() =>
    shouldShowVisitBadge(NOSOTROS_VISITS_KEY),
  );

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
      {/* Skip Link for keyboard navigation */}
      <a
        href="#student-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:font-semibold focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-transform"
      >
        Saltar al contenido principal
      </a>

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
      <main id="student-main-content" tabIndex={-1} className="flex-1 overflow-y-auto overscroll-contain pb-28 focus:outline-none">
        <Outlet />
      </main>

      {/* Bottom navigation — only shown on screens that aren't in the active workout flow */}
      <nav
        className={cn(
          "absolute left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 w-[calc(100%-2rem)] md:w-full md:max-w-md",
          "rounded-[28px] z-50 transition-all duration-500",
          "bg-blue-50/30 dark:bg-blue-950/28",
          previewDayId && "translate-y-[150%] opacity-0 pointer-events-none"
        )}
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
          backdropFilter: "blur(48px) saturate(2) brightness(1.08)",
          WebkitBackdropFilter: "blur(48px) saturate(2) brightness(1.08)",
          boxShadow: [
            "0 12px 40px rgba(30,64,175,0.13)",
            "0 3px 10px rgba(0,0,0,0.07)",
            "inset 0 1.5px 0 rgba(255,255,255,0.72)",
            "inset 0 -1px 0 rgba(255,255,255,0.14)",
            "inset 1px 0 0 rgba(255,255,255,0.30)",
            "inset -1px 0 0 rgba(255,255,255,0.30)",
          ].join(", "),
          border: "1px solid rgba(255,255,255,0.38)",
        }}
      >
        <div className="flex items-center h-[64px] px-2">
          {tabs.map((tab, i) => {
            const isActive = activeTab === i;
            const Icon = tab.icon;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-all duration-300 min-h-[44px] relative",
                  isActive
                    ? "text-blue-700 dark:text-blue-200"
                    : "text-blue-950/38 dark:text-blue-200/35 hover:text-blue-900 dark:hover:text-blue-100",
                )}
              >
                {/* Active glass pill */}
                {isActive && (
                  <span
                    className="absolute inset-x-1 inset-y-1.5 rounded-[18px] transition-all duration-300"
                    style={{
                      background: "rgba(59,130,246,0.11)",
                      backdropFilter: "blur(8px) saturate(1.6)",
                      WebkitBackdropFilter: "blur(8px) saturate(1.6)",
                      boxShadow: [
                        "inset 0 1px 0 rgba(255,255,255,0.55)",
                        "inset 0 -1px 0 rgba(255,255,255,0.10)",
                        "0 1px 6px rgba(59,130,246,0.10)",
                      ].join(", "),
                      border: "1px solid rgba(255,255,255,0.30)",
                    }}
                  />
                )}
                <span className="relative z-10 inline-flex">
                  <Icon
                    size={20}
                    className={cn(
                      "transition-all duration-300",
                      isActive && "scale-110 drop-shadow-[0_1px_4px_rgba(59,130,246,0.25)]"
                    )}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                  {/* Puntito de "no visto" — desaparece a partir de la 3ra visita */}
                  {tab.showDot && showComunidadDot && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-blue-50/30 dark:ring-blue-950/28" />
                  )}
                </span>
                <span
                  className={cn(
                    "text-[10px] tracking-wide transition-all duration-300 relative z-10",
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
