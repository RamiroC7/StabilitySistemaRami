import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Trophy, PlayCircle, Gift, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useDataCacheStore } from "@/store/dataCacheStore";
import { getMonthStart } from "@/hooks/useMonthlyRanking";

// ── Section cards configuration ──
const sections: {
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  color: string;
}[] = [
  {
    title: "¿Quiénes somos?",
    description: "Conoce más sobre nuestra plataforma y equipo",
    icon: Users,
    path: "/entrenamiento/comunidad/quienes-somos",
    color: "text-blue-500",
  },
  {
    title: "Ranking de Posiciones",
    description: "Consulta los ganadores de cada mes.",
    icon: Trophy,
    path: "/entrenamiento/comunidad/ranking",
    color: "text-blue-500",
  },
  {
    title: "Biblioteca de Videos",
    description: "Accede a nuestra colección de videos de entrenamiento",
    icon: PlayCircle,
    path: "/entrenamiento/comunidad/videos",
    color: "text-blue-500",
  },
  {
    title: "Bonificaciones",
    description: "Consulta tus beneficios y recompensas",
    icon: Gift,
    path: "/entrenamiento/comunidad/bonificaciones",
    color: "text-blue-500",
  },
];

export default function TrainingCommunity() {
  const navigate = useNavigate();
  const prefetchMonthlyRanking = useDataCacheStore((s) => s.prefetchMonthlyRanking);

  // Prefetch del ranking del mes actual en cuanto el usuario ve el menú de Comunidad,
  // así cuando navega al ranking los datos ya están en caché → carga instantánea.
  useEffect(() => {
    const now = new Date();
    const monthStart = getMonthStart(now.getFullYear(), now.getMonth());
    void prefetchMonthlyRanking(monthStart);
  }, [prefetchMonthlyRanking]);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-[#1F2937] dark:text-gray-100 flex flex-col min-h-full">
      {/* ── Sections Grid ── */}
      <div className="px-4 pt-6 pb-24 space-y-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.path}
              onClick={() => navigate(section.path)}
              className={cn(
                "w-full bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800",
                "flex items-center gap-4 text-left transition-all active:scale-[0.98]",
                "hover:shadow-md hover:border-primary/30",
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  "bg-slate-50 dark:bg-slate-800",
                )}
              >
                <Icon className={cn("w-6 h-6", section.color)} strokeWidth={2} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-0.5">
                  {section.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                  {section.description}
                </p>
              </div>

              {/* Arrow */}
              <ChevronRight
                className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0"
                strokeWidth={2}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
