import { Fragment } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTrainingStore } from "@/features/training/store/trainingStore";
import type { Exercise, SeriesLog } from "@/features/training/types";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  LayoutList,
  PlayCircle,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import RestTimer from "@/features/training/components/RestTimer";
import { buildSeriesKey, formatCarga } from "@/features/training/utils/circuitUtils";
import CoachContactButton from "@/features/training/CoachContactButton";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExerciseDetailCircuitProps {
  exercise: Exercise;
  circuitExercises: Exercise[];
  circuitStartIndex: number;
  activeRound: number;
  totalRounds: number;
  activeRoundIndex: number;
  isBetweenExercises: boolean;
  paramIndex: number;
  totalExercises: number;
  isTimerRunning: boolean;
  localRestSecondsLeft: number | null;
  restSecondsTotal: number | null;
  seriesLog: SeriesLog;
  onCompleteSet: () => void;
  onNext: () => void;
  onPrev: () => void;
  onCancelRest: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders the circuit-mode view of ExerciseDetail.
 * All circuit data is derived upstream (in ExerciseDetail) and passed as props;
 * this component is responsible only for rendering.
 */
export default function ExerciseDetailCircuit({
  exercise,
  circuitExercises,
  circuitStartIndex,
  activeRound,
  totalRounds,
  activeRoundIndex,
  isBetweenExercises,
  paramIndex,
  totalExercises,
  isTimerRunning,
  localRestSecondsLeft,
  restSecondsTotal,
  seriesLog,
  onCompleteSet,
  onNext,
  onPrev,
  onCancelRest,
}: ExerciseDetailCircuitProps) {
  const navigate = useNavigate();
  const { dayId } = useParams<{ dayId: string }>();
  const { goToExercise, updateSeriesLog } = useTrainingStore();

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#f7f9fc] dark:bg-slate-950">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 pt-12 pb-4 safe-area-pt w-full shrink-0 z-10">
        <div className="max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/entrenamiento/dia/${dayId}`)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Ver lista del día"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-0.5">
                Circuito {exercise.circuit_group}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ronda {activeRound} de {totalRounds}
              </p>
            </div>

            <button
              onClick={() => navigate(`/entrenamiento/dia/${dayId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Volver a la lista del día"
            >
              <LayoutList size={14} />
              Lista
            </button>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5 mt-4">
            {Array.from({ length: totalRounds }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full flex-1 transition-all",
                  i < activeRoundIndex
                    ? "bg-emerald-400"
                    : i === activeRoundIndex
                      ? "bg-primary"
                      : "bg-slate-200 dark:bg-slate-700"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-none px-4 py-4 max-w-lg mx-auto w-full">
        <div className="min-h-[calc(100%+1px)] space-y-4">

          {/* Rest Timer — between rounds (shown above the list) */}
          {isTimerRunning &&
            !isBetweenExercises &&
            localRestSecondsLeft !== null &&
            restSecondsTotal !== null && (
              <RestTimer
                remaining={localRestSecondsLeft}
                total={restSecondsTotal}
                onCancel={onCancelRest}
              />
            )}

          {/* Circuit exercise cards */}
          <div className="space-y-3">
            {circuitExercises.map((cEx, cIdx) => {
              const globalIdx = circuitStartIndex + cIdx;
              const isActive = globalIdx === paramIndex;
              const key = buildSeriesKey(cEx.id, activeRoundIndex);
              const log = seriesLog[key];
              const isDone = log?.done ?? false;
              const setObj = cEx.sets[activeRoundIndex];

              return (
                <Fragment key={cEx.id}>
                  {/* Rest Timer — between exercises (shown above the active card) */}
                  {isActive &&
                    isTimerRunning &&
                    isBetweenExercises &&
                    localRestSecondsLeft !== null &&
                    restSecondsTotal !== null && (
                      <div className="mb-3">
                        <RestTimer
                          remaining={localRestSecondsLeft}
                          total={restSecondsTotal}
                          onCancel={onCancelRest}
                        />
                      </div>
                    )}

                  <div
                    onClick={() => {
                      if (!isActive) {
                        goToExercise(globalIdx);
                        navigate(
                          `/entrenamiento/dia/${dayId}/ejercicio/${globalIdx + 1}`,
                          { replace: true }
                        );
                      }
                    }}
                    className={cn(
                      "rounded-2xl border transition-all p-4 shadow-sm text-left relative overflow-hidden cursor-pointer",
                      isActive
                        ? "border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20"
                        : isDone
                          ? "border-emerald-100 bg-emerald-50/20 dark:border-emerald-900/30 dark:bg-emerald-950/10"
                          : "border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-slate-200"
                    )}
                  >
                    {/* Exercise header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0",
                            isActive
                              ? "bg-primary text-white"
                              : isDone
                                ? "bg-emerald-500 text-white"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          )}
                        >
                          {isDone ? (
                            <span className="material-symbols-outlined text-[14px]">check</span>
                          ) : (
                            cIdx + 1
                          )}
                        </div>
                        <h3
                          className={cn(
                            "text-sm font-bold leading-snug",
                            isActive
                              ? "text-primary dark:text-blue-400"
                              : "text-slate-900 dark:text-white"
                          )}
                        >
                          {cEx.name}
                        </h3>
                      </div>

                      {cEx.videoUrl && (
                        <a
                          href={cEx.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:text-primary-hover p-1"
                          title="Ver video"
                        >
                          <PlayCircle size={16} />
                        </a>
                      )}
                    </div>

                    {/* Targets & instructions */}
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 space-y-1 pl-8">
                      {setObj && (
                        <p>
                          Objetivo:{" "}
                          <span className="font-semibold">
                            {setObj.targetReps} repeticiones
                          </span>
                          {setObj.targetWeight ? ` @ ${setObj.targetWeight}kg` : ""}
                        </p>
                      )}
                      {cEx.instructions && isActive && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-1 leading-relaxed">
                          Instrucciones: {cEx.instructions}
                        </p>
                      )}
                    </div>

                    {/* Interactive inputs — only visible on the active card */}
                    {isActive && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 pl-8">
                        {cEx.writeWeight && (
                          <div className="flex items-center gap-2.5 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-xl mb-2">
                            <Info size={14} className="text-blue-600 dark:text-blue-400" />
                            <p className="text-[10px] font-medium text-blue-700 dark:text-blue-300">
                              Registrá el peso y las reps reales a continuación:
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 max-w-xs">
                          {cEx.writeWeight ? (
                            <>
                              <div className="flex-1">
                                <label className="text-[9px] text-slate-500 dark:text-slate-400 mb-1 block">
                                  Peso (kg)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder={formatCarga(cEx.carga)}
                                  value={log?.kg ?? ""}
                                  onChange={(e) =>
                                    updateSeriesLog(key, "kg", e.target.value)
                                  }
                                  className="w-full text-center text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-[9px] text-slate-500 dark:text-slate-400 mb-1 block">
                                  Repeticiones
                                </label>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  placeholder={setObj?.targetReps}
                                  value={log?.reps ?? ""}
                                  onChange={(e) =>
                                    updateSeriesLog(key, "reps", e.target.value)
                                  }
                                  className="w-full text-center text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                />
                              </div>
                            </>
                          ) : (
                            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>
                                Carga:{" "}
                                <span className="font-bold text-slate-800 dark:text-white">
                                  {formatCarga(cEx.carga)}
                                </span>
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span>
                                Repeticiones:{" "}
                                <span className="font-bold text-slate-800 dark:text-white">
                                  {setObj?.targetReps}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCompleteSet();
                          }}
                          className="mt-2 w-full max-w-xs flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition-all active:scale-[0.98]"
                        >
                          <CheckCircle2 size={14} />
                          {cEx.restSeconds > 0
                            ? `Marcar Serie y Descansar (${cEx.restSeconds}s)`
                            : "Marcar Serie"}
                        </button>
                      </div>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Sticky navigation footer ──────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-4 py-3 safe-area-pb w-full shrink-0 z-10">
        <div className="max-w-lg mx-auto w-full">
          <div className="flex gap-2">
            <button
              onClick={onPrev}
              disabled={paramIndex === 0}
              className={cn(
                "flex items-center justify-center gap-2 font-bold text-sm py-3.5 rounded-2xl transition-all min-h-[52px] border px-4",
                paramIndex === 0
                  ? "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98]"
              )}
              title="Ejercicio anterior"
            >
              <ArrowLeft size={18} />
            </button>

            <button
              onClick={onNext}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white font-bold text-sm py-3.5 rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary-hover active:scale-[0.98] transition-all min-h-[52px]"
            >
              {paramIndex + 1 < totalExercises ? (
                <>
                  <ArrowRight size={18} />
                  Siguiente Ejercicio
                </>
              ) : (
                <>
                  <Trophy size={18} />
                  Finalizar Entrenamiento
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <CoachContactButton />
    </div>
  );
}

// ─── Inline handler builder (used by the parent orchestrator) ─────────────────

/**
 * Returns the `handleCompleteCircuitSet` callback.
 * Exported so ExerciseDetail (the orchestrator) can build it with full context.
 */
export function buildCompleteCircuitSetHandler({
  exerciseId,
  exerciseRestSeconds,
  activeRoundIndex,
  totalRounds,
  paramIndex,
  circuitEndIndex,
  circuitStartIndex,
  dayId,
  markSetDone,
  startRestTimer,
  stopRestTimer,
  navigate,
}: {
  exerciseId: string | number;
  exerciseRestSeconds: number;
  activeRoundIndex: number;
  totalRounds: number;
  paramIndex: number;
  circuitEndIndex: number;
  circuitStartIndex: number;
  dayId: string | undefined;
  markSetDone: (key: string) => void;
  startRestTimer: (seconds: number, setIndex: number, exerciseId?: string) => void;
  stopRestTimer: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return () => {
    const key = buildSeriesKey(exerciseId, activeRoundIndex);
    markSetDone(key);

    const isLastExerciseInCircuit = paramIndex === circuitEndIndex;

    if (exerciseRestSeconds > 0) {
      startRestTimer(exerciseRestSeconds, activeRoundIndex, String(exerciseId));
    } else {
      stopRestTimer();
    }

    if (!isLastExerciseInCircuit) {
      navigate(`/entrenamiento/dia/${dayId}/ejercicio/${paramIndex + 2}`, {
        replace: true,
      });
    } else {
      if (activeRoundIndex + 1 < totalRounds) {
        navigate(`/entrenamiento/dia/${dayId}/ejercicio/${circuitStartIndex + 1}`, {
          replace: true,
        });
      } else {
        toast.success("¡Circuito completado!");
      }
    }
  };
}
