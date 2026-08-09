import { useEffect, useState, Fragment } from "react";
import CoachContactButton from "@/features/training/CoachContactButton";
import { useNavigate, useParams } from "react-router-dom";
import { useTrainingStore } from "@/features/training/store/trainingStore";
import type { Exercise } from "@/features/training/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  SkipForward,
  ArrowLeft,
  Dumbbell,
  PlayCircle,
  ExternalLink,
  BookOpen,
  ChevronDown,
  Info,
  CheckCircle2,
  ArrowRight,
  Trophy,
  Timer,
  LayoutList,
} from "lucide-react";
import CardioSeriesView from "@/features/training/CardioSeriesView";

// ─── Rest Timer Component (reads from Zustand, purely presentational) ────────

function RestTimer({
  remaining,
  total,
  onCancel,
}: {
  remaining: number;
  total: number;
  onCancel: () => void;
}) {
  const pct = total > 0 ? (remaining / total) * 100 : 0;

  return (
    <div className="flex flex-col items-center gap-2 bg-slate-900 rounded-2xl py-3 px-4 my-2 max-w-xs mx-auto">
      {/* Circular progress */}
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="#1e293b"
            strokeWidth="5"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="#0056b2"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 36}`}
            strokeDashoffset={`${2 * Math.PI * 36 * (1 - pct / 100)}`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold text-white tabular-nums tracking-tight">
            {remaining}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between w-full mt-1 px-1">
        <p className="text-xs font-semibold text-slate-300">Descansando…</p>
        <button
          onClick={onCancel}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Saltar descanso"
        >
          <SkipForward size={18} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ExerciseDetail() {
  const navigate = useNavigate();
  const { dayId, exerciseNum } = useParams<{ dayId: string; exerciseNum: string }>();
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const {
    currentDay,
    currentExerciseIndex,
    seriesLog,
    activeRestSetIndex,
    activeRestExerciseId,
    restTargetEndTime,
    restSecondsTotal,
    goToExercise,
    updateSeriesLog,
    markSetDone,
    nextExercise,
    prevExercise,
    startRestTimer,
    stopRestTimer,
    isWorkoutComplete,
    updateActivity,
  } = useTrainingStore();

  const [localRestSecondsLeft, setLocalRestSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (restTargetEndTime === null) {
      queueMicrotask(() => setLocalRestSecondsLeft(null));
      return;
    }

    const calculateRemaining = () => {
      const remaining = Math.max(0, Math.floor((restTargetEndTime - Date.now()) / 1000));
      return remaining;
    };

    const fireAlert = () => {
      // Vibration — Android only
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      // Audio beep — cross-platform (iOS + Android)
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const beep = (start: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.4, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
            osc.start(start);
            osc.stop(start + 0.25);
          };
          beep(ctx.currentTime);
          beep(ctx.currentTime + 0.35);
        }
      } catch {
        // Audio not available
      }
    };

    const initialRemaining = calculateRemaining();
    if (initialRemaining <= 0) {
      fireAlert();
      stopRestTimer();
      queueMicrotask(() => setLocalRestSecondsLeft(null));
      return;
    }

    queueMicrotask(() => setLocalRestSecondsLeft(initialRemaining));

    const intervalId = setInterval(() => {
      const remaining = calculateRemaining();
      if (remaining <= 0) {
        clearInterval(intervalId);
        fireAlert();
        stopRestTimer();
        setLocalRestSecondsLeft(null);
      } else {
        setLocalRestSecondsLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [restTargetEndTime, stopRestTimer]);

  // Update activity on mount to keep workout alive
  useEffect(() => {
    updateActivity();
  }, [updateActivity]);

  // Derive exercise index from URL param (1-based)
  const paramIndex = exerciseNum ? parseInt(exerciseNum, 10) - 1 : 0;
  const totalExercises = currentDay?.exercises.length ?? 0;

  // Sync exercise index from URL param
  useEffect(() => {
    if (currentDay && currentExerciseIndex !== paramIndex) {
      goToExercise(paramIndex);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if workout is complete
  useEffect(() => {
    if (isWorkoutComplete) {
      navigate("/entrenamiento/completado", { replace: true });
    }
  }, [isWorkoutComplete, navigate]);

  // Prevent iOS bounce on non-scrollable areas
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".overflow-y-auto")) {
        if (e.cancelable) e.preventDefault();
      }
    };
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  const isTimerRunning = localRestSecondsLeft !== null;

  // Cancel rest timer if entering a circuit and the timer was started by an exercise outside of this circuit
  useEffect(() => {
    const ex = currentDay?.exercises[paramIndex];
    if (ex?.circuit_group && isTimerRunning && activeRestExerciseId) {
      const isTimerFromCurrentCircuit = currentDay?.exercises.some(
        (circuitEx) => circuitEx.circuit_group === ex.circuit_group && circuitEx.id === activeRestExerciseId
      );
      if (!isTimerFromCurrentCircuit) {
        stopRestTimer();
      }
    }
  }, [paramIndex, currentDay, isTimerRunning, activeRestExerciseId, stopRestTimer]);

  const exercise = currentDay?.exercises[paramIndex];

  if (!exercise) {
    return (
      <div className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Dumbbell size={40} className="text-slate-400" strokeWidth={1.2} />
          <p className="text-sm font-medium">Cargando ejercicio…</p>
        </div>
      </div>
    );
  }

  const handleNextExercise = () => {
    nextExercise();
    const nextIndex = paramIndex + 1;
    if (nextIndex < totalExercises) {
      navigate(`/entrenamiento/dia/${dayId}/ejercicio/${nextIndex + 1}`, {
        replace: true,
      });
    }
    // isWorkoutComplete will redirect via useEffect
  };

  const handlePrevExercise = () => {
    if (paramIndex <= 0) return;
    prevExercise();
    navigate(`/entrenamiento/dia/${dayId}/ejercicio/${paramIndex}`, {
      replace: true,
    });
  };

  const handleSetRest = (setIndex: number) => {
    const key = `${exercise.id}-${setIndex}`;
    markSetDone(key);
    startRestTimer(exercise.restSeconds, setIndex, String(exercise.id));
  };

  const handleCancelRest = () => {
    stopRestTimer();
  };

  // Circuit support calculations
  const circuitExercises: Exercise[] = [];
  let circuitStartIndex = -1;
  let circuitEndIndex = -1;
  let totalRounds = 0;
  let activeRoundIndex = 0;
  let activeRound = 1;
  let isBetweenExercises = false;

  if (exercise.circuit_group) {
    let start = paramIndex;
    while (start >= 0 && currentDay?.exercises[start].circuit_group === exercise.circuit_group) {
      start--;
    }
    circuitStartIndex = start + 1;

    let end = paramIndex;
    while (end < (currentDay?.exercises.length ?? 0) && currentDay?.exercises[end].circuit_group === exercise.circuit_group) {
      end++;
    }
    circuitEndIndex = end - 1;

    for (let i = circuitStartIndex; i <= circuitEndIndex; i++) {
      circuitExercises.push(currentDay!.exercises[i]);
    }

    totalRounds = circuitExercises[0]?.sets.length ?? 0;
    activeRoundIndex = exercise.sets.findIndex((_, sIdx) => !seriesLog[`${exercise.id}-${sIdx}`]?.done);
    if (activeRoundIndex === -1) {
      activeRoundIndex = totalRounds - 1;
    }
    activeRound = activeRoundIndex + 1;
    isBetweenExercises = circuitExercises.some(cEx => seriesLog[`${cEx.id}-${activeRoundIndex}`]?.done);
  }

  const handleCompleteCircuitSet = () => {
    const currentKey = `${exercise.id}-${activeRoundIndex}`;
    markSetDone(currentKey);

    const isLastExerciseInCircuit = paramIndex === circuitEndIndex;
    if (exercise.restSeconds > 0) {
      startRestTimer(exercise.restSeconds, activeRoundIndex, String(exercise.id));
    } else {
      stopRestTimer();
    }

    if (!isLastExerciseInCircuit) {
      const nextIndex = paramIndex + 1;
      navigate(`/entrenamiento/dia/${dayId}/ejercicio/${nextIndex + 1}`, {
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

  if (exercise.circuit_group) {
    return (
      <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#f7f9fc] dark:bg-slate-950">
        {/* ── Header ──────────────────────────────────────────────── */}
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
                        : "bg-slate-200 dark:bg-slate-700",
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-none px-4 py-4 max-w-lg mx-auto w-full">
          <div className="min-h-[calc(100%+1px)] space-y-4">
            
            {/* Rest Timer display if running */}
            {isTimerRunning && !isBetweenExercises && localRestSecondsLeft !== null && restSecondsTotal !== null && (
              <RestTimer
                remaining={localRestSecondsLeft}
                total={restSecondsTotal}
                onCancel={handleCancelRest}
              />
            )}

            {/* Circuit Exercises List */}
            <div className="space-y-3">
              {circuitExercises.map((cEx, cIdx) => {
                const globalIdx = circuitStartIndex + cIdx;
                const isActive = globalIdx === paramIndex;
                const key = `${cEx.id}-${activeRoundIndex}`;
                const log = seriesLog[key];
                const isDone = log?.done ?? false;
                const setObj = cEx.sets[activeRoundIndex];

                return (
                  <Fragment key={cEx.id}>
                    {isActive && isTimerRunning && isBetweenExercises && localRestSecondsLeft !== null && restSecondsTotal !== null && (
                      <div className="mb-3">
                        <RestTimer
                          remaining={localRestSecondsLeft}
                          total={restSecondsTotal}
                          onCancel={handleCancelRest}
                        />
                      </div>
                    )}
                    <div
                      onClick={() => {
                      if (!isActive) {
                        goToExercise(globalIdx);
                        navigate(`/entrenamiento/dia/${dayId}/ejercicio/${globalIdx + 1}`, {
                          replace: true,
                        });
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0",
                          isActive
                            ? "bg-primary text-white"
                            : isDone
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        )}>
                          {isDone ? (
                            <span className="material-symbols-outlined text-[14px]">check</span>
                          ) : (
                            cIdx + 1
                          )}
                        </div>
                        <h3 className={cn(
                          "text-sm font-bold leading-snug",
                          isActive ? "text-primary dark:text-blue-400" : "text-slate-900 dark:text-white"
                        )}>
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

                    {/* Targets & Stats */}
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 space-y-1 pl-8">
                      {setObj && (
                        <p>
                          Objetivo: <span className="font-semibold">{setObj.targetReps} repeticiones</span>
                          {setObj.targetWeight ? ` @ ${setObj.targetWeight}kg` : ""}
                        </p>
                      )}
                      {cEx.instructions && isActive && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-1 leading-relaxed">
                          Instrucciones: {cEx.instructions}
                        </p>
                      )}
                    </div>

                    {/* Interactive inputs only inside the active card */}
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
                                  placeholder={cEx.carga && cEx.carga !== '-' ? (cEx.carga.toLowerCase().includes('kg') ? cEx.carga : `${cEx.carga} kg`) : 'kg'}
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
                              <span>Carga: <span className="font-bold text-slate-800 dark:text-white">{cEx.carga && cEx.carga !== '-' ? (cEx.carga.toLowerCase().includes('kg') ? cEx.carga : `${cEx.carga} kg`) : '—'}</span></span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span>Repeticiones: <span className="font-bold text-slate-800 dark:text-white">{setObj?.targetReps}</span></span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompleteCircuitSet();
                          }}
                          className="mt-2 w-full max-w-xs flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition-all active:scale-[0.98]"
                        >
                          <CheckCircle2 size={14} />
                          {cEx.restSeconds > 0 ? `Marcar Serie y Descansar (${cEx.restSeconds}s)` : "Marcar Serie"}
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
                onClick={handlePrevExercise}
                disabled={paramIndex === 0}
                className={cn(
                  "flex items-center justify-center gap-2 font-bold text-sm py-3.5 rounded-2xl transition-all min-h-[52px] border px-4",
                  paramIndex === 0
                    ? "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98]",
                )}
                title="Ejercicio anterior"
              >
                <ArrowLeft size={18} />
              </button>

              <button
                onClick={handleNextExercise}
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

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#f7f9fc] dark:bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────── */}
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
                DÍA {currentDay?.id}
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
                      : "bg-slate-200 dark:bg-slate-700",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-none px-4 py-4 max-w-lg mx-auto w-full">
        <div className="min-h-[calc(100%+1px)] space-y-4">
        {/* Exercise title */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
            {exercise.name}
          </h1>
          <span
            className={cn(
              "inline-flex mt-1.5 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border",
              exercise.category === "Compuesto"
                ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                : "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
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
                  instructionsOpen && "rotate-180",
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
            // ── CARDIO MODE ────────────────────────────────────────────
            <CardioSeriesView exercise={exercise} />
          ) : (
            // ── NORMAL MODE ────────────────────────────────────────────
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

              {/* Series rows interleaved with rest trigger buttons */}
              <div>
                {exercise.sets.map((set, setIndex) => {
                  const key = `${exercise.id}-${setIndex}`;
                  const log = seriesLog[key];
                  const isDone = log?.done ?? false;

                  return (
                    <div key={setIndex}>
                      {/* Row */}
                      <div
                        className={cn(
                          "grid grid-cols-[2rem_1fr_5rem_5rem] gap-2 items-center px-4 py-3 border-b border-slate-50 dark:border-slate-800/60 last:border-none transition-colors",
                          isDone && "bg-emerald-50/50 dark:bg-emerald-900/10",
                        )}
                      >
                        {/* Set number with done indicator */}
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
                            placeholder={exercise.carga && exercise.carga !== '-' ? exercise.carga : 'kg'}
                            value={log?.kg ?? ""}
                            onChange={(e) =>
                              updateSeriesLog(key, "kg", e.target.value)
                            }
                            className={cn(
                              "w-full text-center text-sm font-bold rounded-xl border px-2 py-2 min-h-[40px] bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all",
                              isDone &&
                              "border-emerald-200 dark:border-emerald-800",
                            )}
                          />
                        ) : (
                          <div className="w-full text-center text-sm font-bold text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-700 px-2 py-2 min-h-[40px] flex items-center justify-center">
                            {exercise.carga && exercise.carga !== '-' ? (exercise.carga.toLowerCase().includes('kg') ? exercise.carga : `${exercise.carga} kg`) : '—'}
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
                              isDone &&
                              "border-emerald-200 dark:border-emerald-800",
                            )}
                          />
                        ) : (
                          <div className="w-full text-center text-sm font-bold text-slate-400 dark:text-slate-500 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-2 py-2 min-h-[40px] flex items-center justify-center">
                            {set.targetReps}
                          </div>
                        )}
                      </div>

                      {/* Rest button / inline timer (shown between sets, not after last) */}
                      {setIndex < exercise.sets.length - 1 && exercise.restSeconds > 0 && (
                        <div className="px-4 py-2">
                          {isTimerRunning && activeRestSetIndex === setIndex && localRestSecondsLeft !== null && restSecondsTotal !== null ? (
                            <RestTimer
                              remaining={localRestSecondsLeft}
                              total={restSecondsTotal}
                              onCancel={handleCancelRest}
                            />
                          ) : (
                            <button
                              onClick={() => handleSetRest(setIndex)}
                              className={cn(
                                "w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wide transition-all min-h-[40px] border",
                                isDone
                                  ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700 hover:text-primary",
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
          {/* Prev / Next row */}
          <div className="flex gap-2">
            {/* Prev exercise button */}
            <button
              onClick={handlePrevExercise}
              disabled={paramIndex === 0}
              className={cn(
                "flex items-center justify-center gap-2 font-bold text-sm py-3.5 rounded-2xl transition-all min-h-[52px] border px-4",
                paramIndex === 0
                  ? "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98]",
              )}
              title="Ejercicio anterior"
            >
              <ArrowLeft size={18} />
            </button>

            {/* Next / Finish button */}
            <button
              onClick={handleNextExercise}
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
