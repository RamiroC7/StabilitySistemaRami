import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTrainingStore } from "@/features/training/store/trainingStore";
import type { Exercise } from "@/features/training/types";

interface UseExerciseDetailSetupResult {
  paramIndex: number;
  totalExercises: number;
  exercise: Exercise | undefined;
}

/**
 * Handles all side-effect coordination for the ExerciseDetail screen:
 *
 * 1. Syncs the URL param (`exerciseNum`) into Zustand's `currentExerciseIndex`.
 * 2. Redirects to the completion screen when `isWorkoutComplete` becomes true.
 * 3. Prevents iOS overscroll bounce on non-scrollable areas.
 * 4. Calls `updateActivity()` on mount to keep the 1-hour workout session alive.
 * 5. Cancels a cross-circuit rest timer (timer started by a different circuit).
 */
export function useExerciseDetailSetup(): UseExerciseDetailSetupResult {
  const navigate = useNavigate();
  const { exerciseNum } = useParams<{ dayId: string; exerciseNum: string }>();

  const {
    currentDay,
    currentExerciseIndex,
    activeRestExerciseId,
    restTargetEndTime,
    goToExercise,
    stopRestTimer,
    isWorkoutComplete,
    updateActivity,
  } = useTrainingStore();

  const paramIndex = exerciseNum ? parseInt(exerciseNum, 10) - 1 : 0;
  const totalExercises = currentDay?.exercises.length ?? 0;
  const exercise = currentDay?.exercises[paramIndex];
  const isTimerRunning = restTargetEndTime !== null;

  // 1. Sync URL param → store index (only on first mount)
  useEffect(() => {
    if (currentDay && currentExerciseIndex !== paramIndex) {
      goToExercise(paramIndex);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Redirect when workout completes
  useEffect(() => {
    if (isWorkoutComplete) {
      navigate("/entrenamiento/completado", { replace: true });
    }
  }, [isWorkoutComplete, navigate]);

  // 3. Prevent iOS overscroll bounce on non-scrollable areas
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

  // 4. Keep workout session alive
  useEffect(() => {
    updateActivity();
  }, [updateActivity]);

  // 5. Cancel rest timer started by an exercise outside the current circuit
  useEffect(() => {
    if (!exercise?.circuit_group || !isTimerRunning || !activeRestExerciseId) return;

    const isTimerFromCurrentCircuit = currentDay?.exercises.some(
      (cEx) =>
        cEx.circuit_group === exercise.circuit_group &&
        cEx.id === activeRestExerciseId
    );

    if (!isTimerFromCurrentCircuit) {
      stopRestTimer();
    }
  }, [paramIndex, currentDay, isTimerRunning, activeRestExerciseId, exercise, stopRestTimer]);

  return { paramIndex, totalExercises, exercise };
}
