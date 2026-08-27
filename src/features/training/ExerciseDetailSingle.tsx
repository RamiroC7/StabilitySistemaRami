import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTrainingStore } from "@/features/training/store/trainingStore";
import type { Exercise, SeriesLog } from "@/features/training/types";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Info,
  LayoutList,
  PlayCircle,
  Timer,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CardioSeriesView from "@/features/training/CardioSeriesView";
import RestTimer from "@/features/training/components/RestTimer";
import { buildSeriesKey, formatCarga } from "@/features/training/utils/circuitUtils";
import CoachContactButton from "@/features/training/CoachContactButton";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExerciseDetailSingleProps {
  exercise: Exercise;
  paramIndex: number;
  totalExercises: number;
  isTimerRunning: boolean;
  localRestSecondsLeft: number | null;
  restSecondsTotal: number | null;
  activeRestSetIndex: number | null;
  seriesLog: SeriesLog;
  onNext: () => void;
  onPrev: () => void;
  onSetRest: (setIndex: number) => void;
  onCancelRest: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders the single-exercise (non-circuit) view of ExerciseDetail.
 * All state is derived upstream and passed as props; this component only renders.
 */
export default function ExerciseDetailSingle({
  exercise,
  paramIndex,
  totalExercises,
  isTimerRunning,
  localRestSecondsLeft,
  restSecondsTotal,
  activeRestSetIndex,
  seriesLog,
  onNext,
  onPrev,
  onSetRest,
  onCancelRest,
}: ExerciseDetailSingleProps) {
  const navigate = useNavigate();
  const { dayId } = useParams<{ dayId: string }>();
  const { updateSeriesLog } = useTrainingStore();

  const [instructionsOpen, setInstructionsOpen] = useState(false);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#f7f9fc] dark:bg-slate-950">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 pt-12 pb-4 safe-area-pt w-full shrink-0 z-10">
        <div className="max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3">
            {/* Back to exercise list — does NOT reset training state */}
            <button
              onClick={() => navigate(`/entrenamiento/dia/${dayId}`)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Ver lista del día"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-0.5">
                DÍA {dayId}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ejercicio {paramIndex + 1} de {totalExercises}
              </p>
            </div>

            {/* Lista del día shortcut */}
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
            {Array.from({ length: totalExercises }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full flex-1 transition-all",
                  i < paramIndex
                    ? "bg-emerald-400"
                    : i === paramIndex
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

          {/* Exercise title & category badge */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              {exercise.name}
            </h1>
            <span
              className={cn(
                "inline-flex mt-1.5 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border",
                exercise.category === "Compuesto"
                  ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                  : "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800"
              )}
            >
              {exercise.category}
            </span>
          </div>

          {/* Video link */}
          {exercise.videoUrl && (
            <a
              href={exercise.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary text-sm font-semibold hover:underline min-h-[40px]"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
                <PlayCircle size={16} className="text-primary" strokeWidth={2} />
              </span>
              Ver video de ejecución
              <ExternalLink size={14} className="text-slate-400" />
            </a>
          )}

          {/* Instructions accordion */}
          {exercise.instructions && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <button
                onClick={() => setInstructionsOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 min-h-[52px] text-left"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen size={18} className="text-primary" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    Ver instrucciones del Coach
                  </span>
                </div>
                <ChevronDown
                  size={20}
                  className={cn(
                    "text-slate-400 transition-transform",
                    instructionsOpen && "rotate-180"
                  )}
                />
              </button>

              {instructionsOpen && (
                <div className="px-4 pb-4 pt-0 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-3">
                    {exercise.instructions}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Series table / Cardio view */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            {exercise.cardioDurationMin ? (
              // ── CARDIO MODE ──────────────────────────────────────────────
              <CardioSeriesView exercise={exercise} />
            ) : (
              // ── NORMAL MODE ──────────────────────────────────────────────
              <>
                {/* Weight log reminder */}
                {exercise.writeWeight && (
                  <div className="flex items-center gap-2.5 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-blue-100/50 dark:border-blue-900/30">
                    <Info size={16} className="text-blue-600 dark:text-blue-400" />
                    <p className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
                      Tu profe pidió que registres el peso en este ejercicio
                    </p>
                  </div>
                )}

                {/* Table header */}
                <div className="grid grid-cols-[2rem_1fr_5rem_5rem] gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                  <span />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Objetivo
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
                    Carga
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">
                    REPETICIONES
                  </span>
                </div>

                {/* Series rows interleaved with rest buttons */}
                <div>
                  {exercise.sets.map((set, setIndex) => {
                    const key = buildSeriesKey(exercise.id, setIndex);
                    const log = seriesLog[key];
                    const isDone = log?.done ?? false;

                    return (
                      <div key={setIndex}>
                        {/* Row */}
                        <div
                          className={cn(
                            "grid grid-cols-[2rem_1fr_5rem_5rem] gap-2 items-center px-4 py-3 border-b border-slate-50 dark:border-slate-800/60 last:border-none transition-colors",
                            isDone && "bg-emerald-50/50 dark:bg-emerald-900/10"
                          )}
                        >
                          {/* Set number / done indicator */}
                          <div className="flex items-center justify-center">
                            {isDone ? (
                              <CheckCircle2 size={18} className="text-emerald-500" />
                            ) : (
                              <span className="text-sm font-bold text-slate-400">
                                {set.setNumber}
                              </span>
                            )}
                          </div>

                          {/* Target */}
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                              {set.targetReps} repeticiones
                              {set.targetWeight ? ` @ ${set.targetWeight}kg` : ""}
                            </p>
                          </div>

                          {/* Carga input */}
                          {exercise.writeWeight ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={
                                exercise.carga && exercise.carga !== "-"
                                  ? exercise.carga
                                  : "kg"
                              }
                              value={log?.kg ?? ""}
                              onChange={(e) =>
                                updateSeriesLog(key, "kg", e.target.value)
                              }
                              className={cn(
                                "w-full text-center text-sm font-bold rounded-xl border px-2 py-2 min-h-[40px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all",
                                isDone && "border-emerald-200 dark:border-emerald-800"
                              )}
                            />
                          ) : (
                            <div className="w-full text-center text-sm font-bold text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-700 px-2 py-2 min-h-[40px] flex items-center justify-center">
                              {formatCarga(exercise.carga)}
                            </div>
                          )}

                          {/* Reps input */}
                          {exercise.writeWeight ? (
                            <input
                              type="number"
                              inputMode="numeric"
                              placeholder={set.targetReps}
                              value={log?.reps ?? ""}
                              onChange={(e) =>
                                updateSeriesLog(key, "reps", e.target.value)
                              }
                              className={cn(
                                "w-full text-center text-sm font-bold rounded-xl border px-2 py-2 min-h-[40px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all",
                                isDone && "border-emerald-200 dark:border-emerald-800"
                              )}
                            />
                          ) : (
                            <div className="w-full text-center text-sm font-bold text-slate-400 dark:text-slate-500 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-2 py-2 min-h-[40px] flex items-center justify-center">
                              {set.targetReps}
                            </div>
                          )}
                        </div>

                        {/* Rest button / inline timer (shown between sets, not after last) */}
                        {setIndex < exercise.sets.length - 1 &&
                          exercise.restSeconds > 0 && (
                            <div className="px-4 py-2">
                              {isTimerRunning &&
                              activeRestSetIndex === setIndex &&
                              localRestSecondsLeft !== null &&
                              restSecondsTotal !== null ? (
                                <RestTimer
                                  remaining={localRestSecondsLeft}
                                  total={restSecondsTotal}
                                  onCancel={onCancelRest}
                                />
                              ) : (
                                <button
                                  onClick={() => onSetRest(setIndex)}
                                  className={cn(
                                    "w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wide transition-all min-h-[40px] border",
                                    isDone
                                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700 hover:text-primary"
                                  )}
                                >
                                  <Timer size={16} />
                                  DESCANSO: {exercise.restSeconds}s
                                </button>
                              )}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky navigation footer ──────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-4 py-3 safe-area-pb w-full shrink-0 z-10">
        <div className="max-w-lg mx-auto w-full">
          <div className="flex gap-2">
            {/* Prev exercise button */}
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

            {/* Next / Finish button */}
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
