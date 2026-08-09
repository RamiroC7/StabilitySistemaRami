import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTrainingStore } from "@/features/training/store/trainingStore";
import { useActiveDayExercises } from "@/hooks/useActiveDayExercises";
import { Pencil, X, CheckCircle2, ArrowLeft, Dumbbell, Save, PlayCircle, BellOff } from "lucide-react";
import { QuickSaveModal } from "@/features/training/QuickSaveModal";
import CoachContactButton from "@/features/training/CoachContactButton";
import type { Exercise } from "@/features/training/types";
import { cn } from "@/lib/utils";

const DND_TIP_KEY = "stability_dnd_tip_shown";

export default function ExerciseList() {
  const navigate = useNavigate();
  const { dayId } = useParams<{ dayId: string }>();
  const currentDay = useTrainingStore((s) => s.currentDay);
  const startWorkout = useTrainingStore((s) => s.startWorkout);
  const setPendingDayId = useTrainingStore((s) => s.setPendingDayId);
  const goToExercise = useTrainingStore((s) => s.goToExercise);
  const assignmentId = useTrainingStore((s) => s.assignmentId);
  const currentDayNumber = useTrainingStore((s) => s.currentDayNumber);
  const updateActivity = useTrainingStore((s) => s.updateActivity);

  // Update activity on mount
  useEffect(() => {
    updateActivity();
  }, [updateActivity]);

  // ── Quick Save state ────────────────────────────────────────────────────
  // Store both kg and reps: key = `${exerciseId}-${setIndex}`, value = { kg: string, reps: string }
  const [quickWeights, setQuickWeights] = useState<
    Record<string, { kg: string; reps: string }>
  >({});
  const [weightModalEx, setWeightModalEx] = useState<Exercise | null>(null);
  const [showRpeModal, setShowRpeModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // ── DnD tip banner ──────────────────────────────────────────────────────
  const [showDndTip, setShowDndTip] = useState(false);
  const [dndFading, setDndFading] = useState(false);

  const dismissDndTip = () => {
    setDndFading(true);
    setTimeout(() => setShowDndTip(false), 400);
  };

  // Load from Supabase only when arriving via direct URL (store is empty)
  const needsLoad = !currentDay && !isExiting;
  const { workoutDay } = useActiveDayExercises(
    needsLoad ? (dayId ?? null) : null,
  );

  useEffect(() => {
    if (needsLoad && workoutDay) {
      if (dayId) {
        setPendingDayId(dayId);
      }
      startWorkout(workoutDay);
    }
  }, [workoutDay, needsLoad, startWorkout, setPendingDayId, dayId]);

  useEffect(() => {
    if (!sessionStorage.getItem(DND_TIP_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowDndTip(true);
      sessionStorage.setItem(DND_TIP_KEY, "1");
      const t = setTimeout(() => dismissDndTip(), 6000);
      return () => clearTimeout(t);
    }
  }, []);

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

  const workout = currentDay ?? workoutDay;

  interface GroupedItem {
    type: "single" | "circuit";
    circuitGroup?: string;
    exercises: Exercise[];
    startIndex: number;
  }

  const groupedExercises: GroupedItem[] = [];
  if (workout) {
    let currentGroup: GroupedItem | null = null;
    workout.exercises.forEach((exercise, idx) => {
      if (exercise.circuit_group) {
        if (currentGroup && currentGroup.type === "circuit" && currentGroup.circuitGroup === exercise.circuit_group) {
          currentGroup.exercises.push(exercise);
        } else {
          currentGroup = {
            type: "circuit",
            circuitGroup: exercise.circuit_group,
            exercises: [exercise],
            startIndex: idx,
          };
          groupedExercises.push(currentGroup);
        }
      } else {
        currentGroup = {
          type: "single",
          exercises: [exercise],
          startIndex: idx,
        };
        groupedExercises.push(currentGroup);
      }
    });
  }

  const handleStartAll = () => {
    goToExercise(0);
    navigate(`/entrenamiento/dia/${dayId}/ejercicio/1`);
  };

  // Loading state — shown when navigating directly via URL bookmark
  if (!workout) {
    return (
      <div className="flex flex-col bg-[#f7f9fc] dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 pt-12 pb-4 safe-area-pt animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-12 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 w-24 rounded-lg bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        </div>
        <div className="flex-1 px-4 py-4 space-y-2 max-w-lg mx-auto w-full">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#f7f9fc] dark:bg-slate-950">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 pt-12 pb-4 safe-area-pt w-full shrink-0 z-10">
        <div className="max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate("/entrenamiento")}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-0.5">
                DÍA {workout.id}
              </p>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex gap-3">
            {[
              {
                icon: "exercise",
                text: `${workout.exercises.length} ejercicios`,
              },
            ].map((m) => (
              <span
                key={m.text}
                className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700"
              >
                <Dumbbell size={13} className="text-slate-400" />
                {m.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── DnD tip banner ───────────────────────────────────────── */}
      {showDndTip && (
        <div
          className={cn(
            "mx-4 mt-4 max-w-lg mx-auto flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl px-4 py-3 transition-all duration-400",
            dndFading ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0"
          )}
        >
          <BellOff size={18} className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="flex-1 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-bold">Consejo:</span> Activá <span className="font-semibold">«No molestar»</span> en tu celular para entrenar sin interrupciones. 💪
          </p>
          <button
            onClick={dismissDndTip}
            className="text-amber-400 dark:text-amber-500 hover:text-amber-600 transition-colors p-0.5 shrink-0"
            aria-label="Cerrar"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Exercise list ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-none px-4 py-4 max-w-lg mx-auto w-full">
        <div className="min-h-[calc(100%+1px)] space-y-3">
          {groupedExercises.map((group, groupIdx) => {
            if (group.type === "single") {
              const exercise = group.exercises[0];
              const isCardio = !!exercise.cardioDurationMin;
              const hasWeight =
                !isCardio &&
                exercise.writeWeight &&
                exercise.sets.some((_, si) => {
                  const entry = quickWeights[`${exercise.id}-${si}`];
                  return entry && (entry.kg || entry.reps);
                });
              return (
                <div
                  key={exercise.id}
                  onClick={() => {
                    goToExercise(group.startIndex);
                    navigate(`/entrenamiento/dia/${dayId}/ejercicio/${group.startIndex + 1}`);
                  }}
                  className="w-full flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm text-left group hover:border-primary/30 transition-all cursor-pointer"
                >
                  {/* Number / Cardio icon */}
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    isCardio
                      ? "bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10"
                      : "bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10"
                  )}>
                    {isCardio ? (
                      <span className="material-symbols-outlined text-orange-500 text-[18px]">directions_run</span>
                    ) : (
                      <span className="text-sm font-bold text-primary">
                        {group.startIndex + 1}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                      {exercise.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isCardio ? (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-orange-400">timer</span>
                          {exercise.sets.length} {exercise.sets.length === 1 ? "serie" : "series"} · {exercise.cardioDurationMin} min c/u
                        </span>
                      ) : (
                        <>
                          {exercise.sets?.length ?? 0} series
                          {exercise.sets?.[0]?.targetReps &&
                            ` × ${exercise.sets[0].targetReps} repeticiones`}
                          {exercise.sets?.[0]?.targetWeight
                            ? ` @ ${exercise.sets[0].targetWeight}kg`
                            : ""}
                        </>
                      )}
                    </p>
                  </div>

                  {/* Weight button — only for non-cardio exercises */}
                  {!isCardio && exercise.writeWeight && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setWeightModalEx(exercise);
                      }}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all shrink-0",
                        hasWeight
                          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-primary/40 hover:text-primary",
                      )}
                    >
                      {hasWeight ? (
                        <>
                          <CheckCircle2 size={12} strokeWidth={2.5} />
                          Peso ✓
                        </>
                      ) : (
                        <>
                          <Pencil size={12} strokeWidth={2} />
                          Peso
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            } else {
              // Circuit Group Layout
              const seriesCount = group.exercises[0]?.sets?.length ?? 0;
              return (
                <div
                  key={`circuit-${group.circuitGroup}-${groupIdx}`}
                  onClick={() => {
                    goToExercise(group.startIndex);
                    navigate(`/entrenamiento/dia/${dayId}/ejercicio/${group.startIndex + 1}`);
                  }}
                  className="w-full bg-blue-50/5 dark:bg-blue-950/5 rounded-2xl border border-blue-100 dark:border-blue-900/60 p-4 shadow-sm text-left hover:border-primary/30 transition-all cursor-pointer space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-blue-100/50 dark:border-blue-900/30">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/50 flex items-center justify-center text-primary dark:text-blue-400 shrink-0">
                      <span className="material-symbols-outlined text-[18px]">layers</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary dark:text-blue-400 uppercase tracking-wider">
                        Circuito {group.circuitGroup}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide">
                        {seriesCount} {seriesCount === 1 ? "serie" : "series"}
                      </p>
                    </div>
                  </div>

                  {/* Nested Exercises */}
                  <div className="space-y-2">
                    {group.exercises.map((exercise, subIdx) => {
                      const isCardio = !!exercise.cardioDurationMin;
                      return (
                        <div key={exercise.id} className="flex items-center gap-3 pl-1">
                          {/* Inner list marker/number */}
                          <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-slate-500">
                              {subIdx + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {exercise.name}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              {isCardio ? (
                                `${exercise.cardioDurationMin} min`
                              ) : (
                                <>
                                  {exercise.sets?.[0]?.targetReps && `${exercise.sets[0].targetReps} repeticiones`}
                                  {exercise.sets?.[0]?.targetWeight ? ` @ ${exercise.sets[0].targetWeight}kg` : ""}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>

      {/* ── Sticky CTA ───────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-4 py-3 safe-area-pb w-full shrink-0 z-10">
        <div className="max-w-lg mx-auto w-full space-y-2">
          <button
            onClick={() => setShowRpeModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm py-4 rounded-2xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all min-h-[52px]"
          >
            <Save size={18} />
            Guardado Rápido
          </button>
          <button
            onClick={handleStartAll}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-sm py-4 rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary-hover active:scale-[0.98] transition-all min-h-[52px]"
          >
            <PlayCircle size={20} strokeWidth={2.5} />
            COMENZAR RUTINA (GO)
          </button>
        </div>
      </div>

      {/* ── Weight Input Bottom Sheet ────────────────────────────── */}
      {weightModalEx && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end"
          onClick={() => setWeightModalEx(null)}
        >
          <div
            className="w-full bg-white dark:bg-slate-900 rounded-t-3xl p-5 space-y-4 animate-slide-up safe-area-pb"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {weightModalEx.name}
              </h3>
              <button
                onClick={() => setWeightModalEx(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {weightModalEx.sets.map((set, i) => {
                const key = `${weightModalEx.id}-${i}`;
                const entry = quickWeights[key] || { kg: "", reps: "" };
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Serie {i + 1}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Objetivo: {set.targetReps} repeticiones ×{" "}
                        {set.targetWeight || "—"} kg
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 block">
                          Repeticiones realizadas
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder={set.targetReps || "Repeticiones"}
                          value={entry.reps}
                          onChange={(e) =>
                            setQuickWeights((prev) => ({
                              ...prev,
                              [key]: { ...entry, reps: e.target.value },
                            }))
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 block">
                          Peso usado (kg)
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder={set.targetWeight?.toString() || "Kg"}
                          value={entry.kg}
                          onChange={(e) =>
                            setQuickWeights((prev) => ({
                              ...prev,
                              [key]: { ...entry, kg: e.target.value },
                            }))
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setWeightModalEx(null)}
              className="w-full bg-primary text-white font-bold text-sm py-3.5 rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {/* ── Quick Save Modal ──────────────────────────────────────── */}
      {assignmentId && currentDayNumber && (
        <QuickSaveModal
          isOpen={showRpeModal}
          onClose={() => setShowRpeModal(false)}
          workoutDay={workout}
          quickWeights={quickWeights}
          assignmentId={assignmentId}
          dayNumber={currentDayNumber}
          onSuccess={() => {
            setIsExiting(true);
            setQuickWeights({});
            setShowRpeModal(false);
          }}
        />
      )}

      <CoachContactButton />
    </div>
  );
}
