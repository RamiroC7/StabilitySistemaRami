import { useAuthStore } from "@/features/auth/store/authStore";
import { cn } from "@/lib/utils";

// ─── Static placeholder data ───────────────────────────────────────────────
const todayWorkout = {
  name: "Fuerza — Tren Superior",
  duration: "55 min",
  exercises: 6,
  carga: "Media-Alta",
  done: false,
};

const weekStats = [
  {
    label: "Sesiones",
    value: "3",
    unit: "/ 5",
    icon: "fitness_center",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/30",
  },
  {
    label: "Racha",
    value: "8",
    unit: "días",
    icon: "local_fire_department",
    color: "text-orange-500 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/30",
  },
  {
    label: "Completado",
    value: "74",
    unit: "%",
    icon: "check_circle",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
  },
];

const recentActivity = [
  {
    label: "Entrenamiento completado",
    sub: "Tren Inferior — Ayer",
    icon: "fitness_center",
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  },
  {
    label: "Nueva rutina asignada",
    sub: "Plan semana 3 — Hace 2 días",
    icon: "assignment",
    color:
      "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
  },
  {
    label: "PR en sentadilla",
    sub: "100 kg × 5 reps — Hace 3 días",
    icon: "emoji_events",
    color:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  },
  {
    label: "Medidas actualizadas",
    sub: "Hace 5 días",
    icon: "monitor_weight",
    color:
      "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
  },
];

// ─── Day progress bar helper ───────────────────────────────────────────────
const weekDays = ["L", "M", "X", "J", "V", "S", "D"];
const weekProgress = [true, true, false, true, false, false, false]; // which days done (this week)

// ─── Component ─────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const { professor } = useAuthStore();
  const firstName = professor?.firstName ?? "Atleta";

  const today = new Date();
  const dateLabel = today.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-full bg-[#f7f9fc] dark:bg-slate-950 px-4 py-5 sm:px-6 md:px-8 xl:px-10 space-y-5 sm:space-y-6">
      {/* ── Greeting header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">
            {dateLabel}
          </p>
          <h1 className="mt-0.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Hola, {firstName} 👋
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0 mt-1">
          <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-full text-xs font-semibold">
            <span className="material-symbols-outlined text-[14px] filled">
              local_fire_department
            </span>
            8 días de racha
          </span>
        </div>
      </div>

      {/* ── Today's workout hero card ───────────────────────────── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl p-5 sm:p-6",
          "bg-gradient-to-br from-[#0056b2] to-[#1a1a5e]",
          "text-white shadow-lg",
        )}
      >
        {/* Decorative circle */}
        <div className="absolute -top-6 -right-6 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-8 -right-2 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">
              Entrenamiento de hoy
            </p>
            <h2 className="text-xl sm:text-2xl font-bold leading-tight">
              {todayWorkout.name}
            </h2>

            {/* Metadata pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { icon: "schedule", text: todayWorkout.duration },
                {
                  icon: "exercise",
                  text: `${todayWorkout.exercises} ejercicios`,
                },
                { icon: "speed", text: todayWorkout.carga },
              ].map((m) => (
                <span
                  key={m.text}
                  className="flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1 text-xs font-medium"
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {m.icon}
                  </span>
                  {m.text}
                </span>
              ))}
            </div>
          </div>

          <button className="flex items-center justify-center gap-2 shrink-0 bg-white text-primary font-semibold text-sm px-5 py-3 rounded-xl shadow-sm hover:bg-blue-50 transition-colors w-full sm:w-auto">
            <span className="material-symbols-outlined text-[18px]">
              play_arrow
            </span>
            Comenzar
          </button>
        </div>
      </div>

      {/* ── Weekly stats row ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {weekStats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 sm:p-4 shadow-sm"
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                stat.bg,
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined text-[18px] filled",
                  stat.color,
                )}
              >
                {stat.icon}
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-none">
                  {stat.value}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {stat.unit}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column area (lg+): week tracker + activity ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Week tracker */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Esta semana
          </h3>
          <div className="flex items-end gap-2">
            {weekDays.map((day, i) => (
              <div
                key={day}
                className="flex-1 flex flex-col items-center gap-1.5"
              >
                <div
                  className={cn(
                    "w-full rounded-lg transition-all",
                    weekProgress[i]
                      ? "bg-primary shadow-sm shadow-blue-200 dark:shadow-blue-900/30"
                      : "bg-slate-100 dark:bg-slate-800",
                    // vary height slightly for visual rhythm
                    i === 3 ? "h-12" : "h-9",
                  )}
                />
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    weekProgress[i]
                      ? "text-primary"
                      : "text-slate-400 dark:text-slate-600",
                  )}
                >
                  {day}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              3 de 5
            </span>{" "}
            sesiones completadas
          </p>
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Actividad reciente
          </h3>
          <ul className="space-y-3">
            {recentActivity.map((item) => (
              <li key={item.label} className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    item.color,
                  )}
                >
                  <span className="material-symbols-outlined text-[16px] filled">
                    {item.icon}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight truncate">
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {item.sub}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Coach banner ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
        <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[22px] text-slate-500 dark:text-slate-400 filled">
            sports
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Tu coach
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            ¿Tienes dudas sobre tu plan? Envía un mensaje directamente a tu
            entrenador.
          </p>
        </div>
        <button className="flex items-center gap-2 shrink-0 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full sm:w-auto justify-center sm:justify-start">
          <span className="material-symbols-outlined text-[17px]">chat</span>
          Enviar mensaje
        </button>
      </div>
    </div>
  );
}
