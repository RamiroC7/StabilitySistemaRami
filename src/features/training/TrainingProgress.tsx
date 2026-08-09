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
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Mini sparkline ───────────────────────────────────────────────────────────
function Sparkline({ values }: { values: number[] }) {
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
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-9">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path
        d={d}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r="2.5"
        fill="#3b82f6"
      />
    </svg>
  );
}

// ─── Best RM from a group's logs ──────────────────────────────────────────────
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
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.99] transition-all"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <Dumbbell size={18} className="text-primary" strokeWidth={2} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
            {group.exercise_name}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            {group.logs.length} {group.logs.length === 1 ? "registro" : "registros"}
          </p>
        </div>

        {/* Best RM badge */}
        {bestRm != null && (
          <span className="shrink-0 text-[11px] font-bold text-primary bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg">
            {bestRm.toFixed(0)} kg RM
          </span>
        )}

        <ChevronDown
          size={18}
          strokeWidth={2}
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
          <div className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800">
            {[
              {
                label: "Mejor RM",
                value: bestRm != null ? `${bestRm.toFixed(0)} kg` : "—",
                Icon: Trophy,
                iconBg: "bg-amber-50 dark:bg-amber-900/20",
                iconColor: "text-amber-500",
              },
              {
                label: "Sesiones",
                value: group.logs.length.toString(),
                Icon: Calendar,
                iconBg: "bg-blue-50 dark:bg-blue-900/30",
                iconColor: "text-primary",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center py-4 gap-1.5 bg-white dark:bg-slate-900"
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.iconBg)}>
                  <s.Icon size={15} className={s.iconColor} strokeWidth={2} />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {s.value}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide font-semibold">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Sparkline */}
          {sparkValues.length >= 2 && (
            <div className="px-4 pt-4 pb-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-2">
                Evolución del peso
              </p>
              <Sparkline values={sparkValues} />
            </div>
          )}

          {/* Session timeline */}
          <div className="border-t border-slate-100 dark:border-slate-800">
            <div className="px-4 py-3">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
                Historial de sesiones
              </p>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {[...sortedLogs].reverse().map((log) => {
                const rm = log.calculated_rm;
                return (
                  <div key={log.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-11 shrink-0">
                      <span className="text-[11px] font-bold text-primary leading-tight">
                        {formatDate(log.logged_at)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-wrap gap-1">
                      {log.sets_detail.map((s, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded px-1.5 py-0.5 font-medium"
                        >
                          {s.actual_reps ?? s.target_reps}r
                          {s.kg != null && s.kg > 0 ? ` · ${s.kg}k` : ""}
                        </span>
                      ))}
                    </div>
                    {rm != null && rm > 0 && (
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] font-bold text-primary">
                          {rm.toFixed(0)} kg
                        </p>
                        <p className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide">
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

// ─── Section title ────────────────────────────────────────────────────────────
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
    <div className="flex items-center gap-3 px-1">
      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
        <Icon size={18} strokeWidth={2} className="text-primary" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
          {title}
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TrainingProgress() {
  const { professor } = useAuthStore();
  const { groups, loading } = useExerciseWeightLogs(professor?.id);

  const totalSessions = groups.reduce((acc, g) => acc + g.logs.length, 0);
  const totalExercises = groups.length;

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-text-main dark:text-white pb-28 transition-colors duration-200">
      <div className="flex flex-col gap-6 px-4 pt-6">

        {/* ── Summary strip ──────────────────────────────────────────── */}
        {!loading && (totalSessions > 0 || totalExercises > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Sesiones registradas",
                value: totalSessions,
                Icon: TrendingUp,
                iconBg: "bg-blue-50 dark:bg-blue-900/30",
                iconColor: "text-primary",
              },
              {
                label: "Ejercicios trackeados",
                value: totalExercises,
                Icon: Dumbbell,
                iconBg: "bg-blue-50 dark:bg-blue-900/30",
                iconColor: "text-primary",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 shadow-sm"
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", s.iconBg)}>
                  <s.Icon size={18} strokeWidth={2} className={s.iconColor} />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">
                    {s.value}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-tight">
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Constancia ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <SectionTitle
            Icon={Calendar}
            title="Constancia"
            subtitle="Tu historial de sesiones"
          />
          {professor?.id && <WorkoutCalendar studentId={professor.id} />}
        </section>

        {/* ── Progreso de Pesos ───────────────────────────────────────── */}
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
                <BarChart2 size={28} strokeWidth={1.8} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Sin registros aún
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
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

      </div>
    </div>
  );
}
