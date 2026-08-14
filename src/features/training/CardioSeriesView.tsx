import { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Play, Pause, SkipForward, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/features/training/types";

// ─── RestTimer (reutilizado inline para cardio) ───────────────────────────────

function CardioRestTimer({
  remaining,
  total,
  onCancel,
}: {
  remaining: number;
  total: number;
  onCancel: () => void;
}) {
  const pct = total > 0 ? (remaining / total) * 100 : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const label = mins > 0
    ? `${mins}:${String(secs).padStart(2, "0")}`
    : `${secs}s`;

  return (
    <div className="flex flex-col items-center gap-2 bg-slate-900 rounded-2xl py-3 px-4 my-2 max-w-xs mx-auto">
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#1e293b" strokeWidth="5" />
          <circle
            cx="40" cy="40" r="36"
            fill="none" stroke="#f97316" strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 36}`}
            strokeDashoffset={`${2 * Math.PI * 36 * (1 - pct / 100)}`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-white tabular-nums">{label}</span>
        </div>
      </div>
      <div className="flex items-center justify-between w-full px-1">
        <p className="text-xs font-semibold text-slate-300">Descansando…</p>
        <button
          onClick={onCancel}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Saltar descanso"
        >
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Countdown clock face ─────────────────────────────────────────────────────

function CountdownFace({
  totalSeconds,
  remaining,
  isRunning,
}: {
  totalSeconds: number;
  remaining: number;
  isRunning: boolean;
}) {
  const pct = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const R = 56;
  const circumference = 2 * Math.PI * R;

  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
        {/* Track */}
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f1f5f9" strokeWidth="8" className="dark:stroke-slate-800" />
        {/* Progress */}
        <circle
          cx="70" cy="70" r={R}
          fill="none"
          stroke={isRunning ? "#f97316" : "#fb923c"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-4xl font-bold tabular-nums text-slate-900 dark:text-white tracking-tight">
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-500">
          {isRunning ? "corriendo" : remaining === 0 ? "completado" : "listo"}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CardioSeriesViewProps {
  exercise: Exercise;
}

type SeriesState = "idle" | "running" | "paused" | "done";

export default function CardioSeriesView({ exercise }: CardioSeriesViewProps) {
  const totalSeries = exercise.sets.length;
  const durationMin = exercise.cardioDurationMin ?? 1;
  const totalSeconds = durationMin * 60;
  const restSeconds = exercise.restSeconds;

  const [currentSeries, setCurrentSeries] = useState(0); // 0-indexed
  const [seriesState, setSeriesState] = useState<SeriesState[]>(
    () => Array.from({ length: totalSeries }, () => "idle" as SeriesState)
  );
  const [remaining, setRemaining] = useState(totalSeconds);
  const [isResting, setIsResting] = useState(false);
  const [restRemaining, setRestRemaining] = useState(restSeconds);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  // Reset remaining when switching series
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(totalSeconds);
  }, [currentSeries, totalSeconds]);

  const startSeries = () => {
    clearTimer();
    setSeriesState((prev) => {
      const next = [...prev];
      next[currentSeries] = "running";
      return next;
    });

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTimer();
          // Mark as done
          setSeriesState((s) => {
            const next = [...s];
            next[currentSeries] = "done";
            return next;
          });
          // Start rest if not last series
          setCurrentSeries((idx) => {
            if (idx < totalSeries - 1 && restSeconds > 0) {
              setIsResting(true);
              setRestRemaining(restSeconds);
            }
            return idx;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pauseSeries = () => {
    clearTimer();
    setSeriesState((prev) => {
      const next = [...prev];
      next[currentSeries] = "paused";
      return next;
    });
  };

  const skipSeries = () => {
    clearTimer();
    setSeriesState((prev) => {
      const next = [...prev];
      next[currentSeries] = "done";
      return next;
    });
    setRemaining(0);
    if (currentSeries < totalSeries - 1 && restSeconds > 0) {
      setIsResting(true);
      setRestRemaining(restSeconds);
    }
  };

  // Rest timer
  useEffect(() => {
    if (!isResting) return;

    const id = setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setIsResting(false);
          setCurrentSeries((idx) => Math.min(idx + 1, totalSeries - 1));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [isResting, totalSeries]);

  const cancelRest = () => {
    setIsResting(false);
    setCurrentSeries((idx) => Math.min(idx + 1, totalSeries - 1));
  };

  const allDone = seriesState.every((s) => s === "done");

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 bg-orange-50 dark:bg-orange-900/20 px-4 py-3 border-b border-orange-100 dark:border-orange-900/30">
        <Timer size={16} className="text-orange-500" />
        <p className="text-[11px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wide">
          Cardio · {durationMin} min × {totalSeries} {totalSeries === 1 ? "serie" : "series"}
        </p>
      </div>

      {/* Series list */}
      <div className="divide-y divide-slate-50 dark:divide-slate-800">
        {Array.from({ length: totalSeries }).map((_, i) => {
          const state = seriesState[i];
          const isActive = i === currentSeries;
          const isPast = state === "done";
          const isFuture = !isActive && !isPast;

          return (
            <div key={i}>
              {/* Serie row */}
              <div
                className={cn(
                  "px-4 py-4 transition-colors",
                  isActive && !isPast && "bg-orange-50/60 dark:bg-orange-900/10",
                  isPast && "bg-emerald-50/40 dark:bg-emerald-900/10",
                  isFuture && "opacity-50",
                )}
              >
                {/* Serie header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isPast ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : (
                      <span className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center">
                        <span className="text-xs font-bold text-slate-400">{i + 1}</span>
                      </span>
                    )}
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Serie {i + 1}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    {durationMin} min
                  </span>
                </div>

                {/* Active series content */}
                {isActive && !isPast && (
                  <div className="space-y-4">
                    {/* Clock */}
                    <CountdownFace
                      totalSeconds={totalSeconds}
                      remaining={remaining}
                      isRunning={state === "running"}
                    />

                    {/* Controls */}
                    <div className="flex gap-2 max-w-xs mx-auto">
                      {state === "idle" && (
                        <button
                          onClick={startSeries}
                          className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm py-3 rounded-xl shadow-md shadow-orange-200 dark:shadow-orange-900/30 active:scale-[0.98] transition-all min-h-[48px]"
                        >
                          <Play size={18} />
                          Iniciar Serie
                        </button>
                      )}

                      {state === "running" && (
                        <>
                          <button
                            onClick={pauseSeries}
                            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm py-3 rounded-xl border border-slate-200 dark:border-slate-700 active:scale-[0.98] transition-all min-h-[48px]"
                          >
                            <Pause size={18} />
                            Pausar
                          </button>
                          <button
                            onClick={skipSeries}
                            title="Marcar como hecho"
                            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-sm active:scale-[0.98] transition-all min-h-[48px]"
                          >
                            <SkipForward size={16} />
                            Listo
                          </button>
                        </>
                      )}

                      {state === "paused" && (
                        <>
                          <button
                            onClick={startSeries}
                            className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm py-3 rounded-xl shadow-md shadow-orange-200 dark:shadow-orange-900/30 active:scale-[0.98] transition-all min-h-[48px]"
                          >
                            <Play size={18} />
                            Reanudar
                          </button>
                          <button
                            onClick={skipSeries}
                            title="Marcar como hecho"
                            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-sm active:scale-[0.98] transition-all min-h-[48px]"
                          >
                            <SkipForward size={16} />
                            Listo
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Completed badge */}
                {isPast && (
                  <div className="flex items-center justify-center gap-2 py-1">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      ✓ Completada
                    </span>
                  </div>
                )}
              </div>

              {/* Rest timer between series */}
              {isResting && i === currentSeries && restSeconds > 0 && (
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50">
                  <CardioRestTimer
                    remaining={restRemaining}
                    total={restSeconds}
                    onCancel={cancelRest}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All done banner */}
      {allDone && (
        <div className="flex items-center justify-center gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 border-t border-emerald-100 dark:border-emerald-900/30">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <p className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
            ¡Cardio completado! Pasá al siguiente ejercicio.
          </p>
        </div>
      )}
    </div>
  );
}
