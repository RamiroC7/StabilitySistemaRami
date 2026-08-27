import { useNavigate, useParams } from "react-router-dom";
import { Dumbbell } from "lucide-react";
import { useTrainingStore } from "@/features/training/store/trainingStore";
import { useRestTimer } from "@/features/training/hooks/useRestTimer";
import { useExerciseDetailSetup } from "@/features/training/hooks/useExerciseDetailSetup";
import {
  getCircuitBounds,
  getCircuitRoundState,
  isBetweenExercisesInCircuit,
  buildSeriesKey,
} from "@/features/training/utils/circuitUtils";
import ExerciseDetailCircuit, {
  buildCompleteCircuitSetHandler,
} from "@/features/training/ExerciseDetailCircuit";
import ExerciseDetailSingle from "@/features/training/ExerciseDetailSingle";

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * ExerciseDetail — thin orchestrator.
 *
 * Responsibilities:
 *  1. Runs setup hooks (URL sync, redirect, activity ping, iOS bounce, cross-circuit timer cancel).
 *  2. Runs the rest-timer hook.
 *  3. Derives circuit state using pure functions from circuitUtils.
 *  4. Builds event handlers that call the Zustand store.
 *  5. Delegates all rendering to <ExerciseDetailCircuit> or <ExerciseDetailSingle>.
 */
export default function ExerciseDetail() {
  const navigate = useNavigate();
  const { dayId } = useParams<{ dayId: string }>();

  // ── Setup (side-effects + derived params) ───────────────────────────────
  const { paramIndex, totalExercises, exercise } = useExerciseDetailSetup();

  // ── Store ────────────────────────────────────────────────────────────────
  const {
    currentDay,
    seriesLog,
    activeRestSetIndex,
    restTargetEndTime,
    restSecondsTotal,
    markSetDone,
    nextExercise,
    prevExercise,
    startRestTimer,
    stopRestTimer,
  } = useTrainingStore();

  // ── Rest timer ────────────────────────────────────────────────────────────
  const { localRestSecondsLeft, isTimerRunning } = useRestTimer({
    restTargetEndTime,
    stopRestTimer,
  });

  // ── Loading state ─────────────────────────────────────────────────────────
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

  // ── Navigation handlers ───────────────────────────────────────────────────
  const handleNextExercise = () => {
    nextExercise();
    const nextIndex = paramIndex + 1;
    if (nextIndex < totalExercises) {
      navigate(`/entrenamiento/dia/${dayId}/ejercicio/${nextIndex + 1}`, {
        replace: true,
      });
    }
    // isWorkoutComplete → redirect handled inside useExerciseDetailSetup
  };

  const handlePrevExercise = () => {
    if (paramIndex <= 0) return;
    prevExercise();
    navigate(`/entrenamiento/dia/${dayId}/ejercicio/${paramIndex}`, {
      replace: true,
    });
  };

  const handleSetRest = (setIndex: number) => {
    const key = buildSeriesKey(exercise.id, setIndex);
    markSetDone(key);
    startRestTimer(exercise.restSeconds, setIndex, String(exercise.id));
  };

  const handleCancelRest = () => stopRestTimer();

  // ── Circuit branch ────────────────────────────────────────────────────────
  if (exercise.circuit_group && currentDay) {
    const circuitBounds = getCircuitBounds(currentDay.exercises, paramIndex);

    if (circuitBounds) {
      const { circuitStartIndex, circuitEndIndex, circuitExercises } = circuitBounds;
      const { totalRounds, activeRoundIndex, activeRound } = getCircuitRoundState(
        circuitExercises,
        exercise,
        seriesLog
      );
      const betweenExercises = isBetweenExercisesInCircuit(
        circuitExercises,
        activeRoundIndex,
        seriesLog
      );

      const handleCompleteCircuitSet = buildCompleteCircuitSetHandler({
        exerciseId: exercise.id,
        exerciseRestSeconds: exercise.restSeconds,
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
      });

      return (
        <ExerciseDetailCircuit
          exercise={exercise}
          circuitExercises={circuitExercises}
          circuitStartIndex={circuitStartIndex}
          activeRound={activeRound}
          totalRounds={totalRounds}
          activeRoundIndex={activeRoundIndex}
          isBetweenExercises={betweenExercises}
          paramIndex={paramIndex}
          totalExercises={totalExercises}
          isTimerRunning={isTimerRunning}
          localRestSecondsLeft={localRestSecondsLeft}
          restSecondsTotal={restSecondsTotal}
          seriesLog={seriesLog}
          onCompleteSet={handleCompleteCircuitSet}
          onNext={handleNextExercise}
          onPrev={handlePrevExercise}
          onCancelRest={handleCancelRest}
        />
      );
    }
  }

  // ── Single exercise branch ────────────────────────────────────────────────
  return (
    <ExerciseDetailSingle
      exercise={exercise}
      paramIndex={paramIndex}
      totalExercises={totalExercises}
      isTimerRunning={isTimerRunning}
      localRestSecondsLeft={localRestSecondsLeft}
      restSecondsTotal={restSecondsTotal}
      activeRestSetIndex={activeRestSetIndex}
      seriesLog={seriesLog}
      onNext={handleNextExercise}
      onPrev={handlePrevExercise}
      onSetRest={handleSetRest}
      onCancelRest={handleCancelRest}
    />
  );
}
