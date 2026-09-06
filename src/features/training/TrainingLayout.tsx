import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, BarChart2, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { LimelightNav, type NavItem } from "@/components/ui/limelight-nav";
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

  const navItems: NavItem[] = tabs.map((tab) => {
    const Icon = tab.icon;
    const showDot = Boolean(tab.showDot && showComunidadDot);
    return {
      id: tab.path,
      label: tab.label,
      onClick: () => navigate(tab.path),
      icon: showDot ? (
        <span className="relative block">
          <Icon className="h-6 w-6" />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-card" />
        </span>
      ) : (
        <Icon />
      ),
    };
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
      <main
        id="student-main-content"
        tabIndex={-1}
        className="flex-1 overflow-y-auto overscroll-contain pb-28 focus:outline-none"
      >
        <Outlet />
      </main>

      {/* Bottom navigation — only shown on screens that aren't in the active workout flow */}
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
          previewDayId && "translate-y-[150%] opacity-0 pointer-events-none",
        )}
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <LimelightNav
          items={navItems}
          activeIndex={activeTab}
          className="rounded-2xl border-white/40 bg-card/90 backdrop-blur-xl shadow-[0_12px_40px_rgba(30,64,175,0.18)] dark:border-white/10 dark:bg-card/80"
        />
      </div>
    </div>
  );
}
