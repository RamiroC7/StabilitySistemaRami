import { useAuthStore } from "@/features/auth/store/authStore";
import WorkoutCalendar from "@/components/WorkoutCalendar";
import { useExerciseWeightLogs } from "@/hooks/useExerciseWeightLogs";
import type {
  ExerciseGroup,
  ExerciseWeightLog,
} from "@/hooks/useExerciseWeightLogs";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dumbbell,
  ChevronDown,
  Trophy,
  Calendar,
  BarChart2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Mini sparkline using SVG ────────────────────────────────────────────────
function Sparkline({
  values,
  color = "#0056b2",
}: {
  values: number[];
  color?: string;
}) {
  if (values.length < 2) return null;

  const W = 100;
  const H = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - ((v - min) / range) * (H - 4) - 2,
  ]);

  const d = points
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(" ");

  const area = `${d} L${points[points.length - 1][0]},${H} L${points[0][0]},${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-9"
    >
      <defs>
        <linearGradient
          id={`sg-${color.replace("#", "")}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace("#", "")})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

// ─── Best RM from a group's logs ─────────────────────────────────────────────
function getBestRm(logs: ExerciseWeightLog[]) {
  const rms = logs
    .map((l) => l.calculated_rm)
    .filter((v): v is number => v != null && v > 0);
  return rms.length ? Math.max(...rms) : null;
}

// ─── Exercise card ────────────────────────────────────────────────────────────
function ExerciseCard({ group }: { group: ExerciseGroup }) {
  const [expanded, setExpanded] = useState(false);

  const sortedLogs = [...group.logs].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
  );

  const sparkValues = sortedLogs
    .map((l) =>
      Math.max(...l.sets_detail.map((s) => s.kg ?? 0).filter((k) => k > 0), 0),
    )
    .filter((v) => v > 0);

  const bestRm = getBestRm(group.logs);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <Dumbbell size={20} className="text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
            {group.exercise_name}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            {group.logs.length}{" "}
            {group.logs.length === 1 ? "registro" : "registros"}
          </p>
        </div>

        <ChevronDown
          size={20}
          className={cn(
            "text-slate-300 dark:text-slate-600 transition-transform shrink-0",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded section */}
      {expanded && (
        <div className="flex flex-col border-t border-slate-100 dark:border-slate-800">
          {/* Stats row */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            {[
              {
                label: "Mejor RM",
                value: bestRm != null ? `${bestRm.toFixed(0)} kg` : "—",
                Icon: Trophy,
              },
              {
                label: "Sesiones",
                value: group.logs.length.toString(),
                Icon: Calendar,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center py-3 gap-0.5"
              >
                <s.Icon
                  size={16}
                  className="text-slate-400 dark:text-slate-500"
                />
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {s.value}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Sparkline section */}
          {sparkValues.length >= 2 && (
            <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-2">
                Evolución del peso
              </p>
              <Sparkline values={sparkValues} />
            </div>
          )}

          {/* Session Timeline */}
          <div className="border-t border-slate-100 dark:border-slate-800">
            <div className="px-4 py-3 bg-slate-50/30 dark:bg-slate-800/20">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
                Historial de sesiones
              </p>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800/60 font-normal">
              {[...sortedLogs].reverse().map((log) => {
                const rm = log.calculated_rm;
                return (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="w-10 text-center shrink-0">
                      <span className="text-[11px] font-bold text-primary">
                        {formatDate(log.logged_at)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1">
                        {log.sets_detail.map((s, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-px px-1.5 py-0.5"
                          >
                            {s.actual_reps ?? s.target_reps}r
                            {s.kg != null && s.kg > 0 ? `·${s.kg}k` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                    {rm != null && rm > 0 && (
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] font-bold text-primary">
                          {rm.toFixed(0)} kg
                        </p>
                        <p className="text-[9px] text-slate-400 uppercase font-semibold">
                          RM
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function TrainingProgress() {
  const { professor } = useAuthStore();
  const { groups, loading } = useExerciseWeightLogs(professor?.id);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-text-main dark:text-white pb-24 transition-colors duration-200">
      <main className="flex flex-col gap-6 px-4 pt-4">
        {/* Constancia Section */}
        <section className="flex flex-col gap-4">
          <SectionTitle
            Icon={Calendar}
            title="Constancia"
            subtitle="Tu historial de sesiones"
          />
          {professor?.id && <WorkoutCalendar studentId={professor.id} />}
        </section>

        {/* Progreso Section */}
        <section className="flex flex-col gap-4">
          <SectionTitle
            Icon={Dumbbell}
            title="Progreso de Pesos"
            subtitle="Evolución por ejercicio"
          />

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 py-10 px-6 text-center shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <BarChart2 size={28} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Sin registros aún
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Completá entrenamientos para ver tu progreso aquí.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map((g) => (
                <ExerciseCard key={g.exercise_name} group={g} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}



function SectionTitle({
  Icon,
  title,
  subtitle,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon size={20} strokeWidth={1.5} className="text-primary" />
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
