import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";
import type { WorkoutDay, SeriesLog } from "../types";

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface LibraryExercise {
  id: string;
  name: string;
  video_url: string | null;
  notes: string | null;
  category_id: string;
  category?: Category;
  created_by?: string;
  created_at?: string;
}


// ─── Store ────────────────────────────────────────────────────────────────

export type WorkoutMood = "excelente" | "normal" | "fatigado" | "molestia";
export type MoodValue = "happy" | "neutral" | "sad";

interface TrainingState {
  currentDay: WorkoutDay | null;
  currentExerciseIndex: number;
  seriesLog: SeriesLog;
  activeRestSetIndex: number | null;
  activeRestExerciseId: string | null;
  restTargetEndTime: number | null; // Timestamp for PWA background sync
  restSecondsTotal: number | null;
  workoutStartedAt: number | null;
  rpe: number | null;
  initialMood: MoodValue | null;   // mood ANTES de entrenar (happy/neutral/sad)
  mood: WorkoutMood | null;        // mood FINAL post-entrenamiento
  moodComment: string;
  pendingDayId: string | null; // dayId waiting after mood selection
  isWorkoutComplete: boolean;
  assignmentId: string | null;
  currentDayNumber: number;
  lastActivityTimestamp: number | null; // Last user activity timestamp for 1-hour expiration
  previewDayId: string | null;

  globalExercises: LibraryExercise[];
  isGlobalExercisesLoaded: boolean;
  isGlobalExercisesLoading: boolean;

  // Actions
  startWorkout: (day: WorkoutDay) => void;
  updateActivity: () => void;
  checkWorkoutExpiration: () => boolean; // Returns true if expired
  setAssignmentContext: (assignmentId: string, dayNumber: number) => void;
  setPendingDayId: (dayId: string) => void;
  setPreviewDayId: (dayId: string | null) => void;
  goToExercise: (index: number) => void;
  nextExercise: () => void;
  prevExercise: () => void;
  updateSeriesLog: (key: string, field: "kg" | "reps", value: string) => void;
  markSetDone: (key: string) => void;
  startRestTimer: (seconds: number, setIndex: number, exerciseId?: string) => void;
  stopRestTimer: () => void;
  tickTimer: () => void;
  cancelTimer: () => void;
  setRpe: (value: number) => void;
  setInitialMood: (value: MoodValue) => void;
  setMood: (value: WorkoutMood) => void;
  setMoodComment: (value: string) => void;
  completeWorkout: () => void;
  resetTraining: () => void;
  fetchGlobalExercises: () => Promise<void>;
  refreshGlobalExercises: () => Promise<void>;
}

export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => ({
      currentDay: null,
      currentExerciseIndex: 0,
      seriesLog: {},
      activeRestSetIndex: null,
      activeRestExerciseId: null,
      restTargetEndTime: null,
      restSecondsTotal: null,
      workoutStartedAt: null,
      rpe: null,
  initialMood: null,
  mood: null,
  moodComment: "",
  pendingDayId: null,
  isWorkoutComplete: false,
  assignmentId: null,
  currentDayNumber: 1,
      lastActivityTimestamp: null,
      previewDayId: null,

  globalExercises: [],
  isGlobalExercisesLoaded: false,
  isGlobalExercisesLoading: false,

  updateActivity: () => {
    set({ lastActivityTimestamp: Date.now() });
  },

  checkWorkoutExpiration: () => {
    const { lastActivityTimestamp, currentDay } = get();
    
    // If no workout in progress, nothing to expire
    if (!currentDay) return false;
    
    // If no timestamp, assume it's a fresh workout (shouldn't happen but be safe)
    if (!lastActivityTimestamp) return false;
    
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const elapsed = Date.now() - lastActivityTimestamp;
    
    if (elapsed > ONE_HOUR_MS) {
      get().resetTraining();
      return true;
    }
    
    return false;
  },

  startWorkout: (day: WorkoutDay) => {
    // NOTE: initialMood is intentionally NOT reset here — it was set before
    // navigating here from MoodCheckScreen and must persist until saveCompletion.
    set({
      currentDay: day,
      currentExerciseIndex: 0,
      seriesLog: {},
      activeRestSetIndex: null,
      activeRestExerciseId: null,
      restTargetEndTime: null,
      restSecondsTotal: null,
      workoutStartedAt: Date.now(),
      rpe: null,
      mood: null,
      moodComment: "",
      isWorkoutComplete: false,
      lastActivityTimestamp: Date.now(), // Track activity
    });
  },

  setAssignmentContext: (assignmentId, dayNumber) => {
    set({ assignmentId, currentDayNumber: dayNumber });
  },

  setPendingDayId: (dayId) => {
    set({ pendingDayId: dayId });
  },

  setPreviewDayId: (dayId) => {
    set({ previewDayId: dayId });
  },

  goToExercise: (index) => {
    // Timer intentionally NOT stopped here so it keeps running while navigating
    set({ currentExerciseIndex: index, lastActivityTimestamp: Date.now() });
  },

  nextExercise: () => {
    const { currentDay, currentExerciseIndex } = get();
    if (!currentDay) return;
    const next = currentExerciseIndex + 1;
    if (next >= currentDay.exercises.length) {
      get().stopRestTimer();
      set({ isWorkoutComplete: true });
    } else {
      set({ currentExerciseIndex: next });
    }
  },

  prevExercise: () => {
    const { currentExerciseIndex } = get();
    if (currentExerciseIndex > 0) {
      set({ currentExerciseIndex: currentExerciseIndex - 1 });
    }
  },

  updateSeriesLog: (key, field, value) => {
    set((state) => ({
      seriesLog: {
        ...state.seriesLog,
        [key]: {
          ...state.seriesLog[key],
          kg: state.seriesLog[key]?.kg ?? "",
          reps: state.seriesLog[key]?.reps ?? "",
          done: state.seriesLog[key]?.done ?? false,
          [field]: value,
        },
      },
      lastActivityTimestamp: Date.now(),
    }));
  },

  markSetDone: (key) => {
    const state = get();
    set({
      seriesLog: {
        ...state.seriesLog,
        [key]: {
          ...state.seriesLog[key],
          kg: state.seriesLog[key]?.kg ?? "",
          reps: state.seriesLog[key]?.reps ?? "",
          done: true,
        },
      },
      lastActivityTimestamp: Date.now(),
    });
  },

  startRestTimer: (seconds: number, setIndex: number, exerciseId?: string) => {
    set({ 
      activeRestSetIndex: setIndex,
      activeRestExerciseId: exerciseId ?? null,
      restTargetEndTime: Date.now() + seconds * 1000, 
      restSecondsTotal: seconds 
    });
  },

  stopRestTimer: () => {
    set({ activeRestSetIndex: null, activeRestExerciseId: null, restTargetEndTime: null, restSecondsTotal: null });
  },

  tickTimer: () => {
    // kept for backward compat, no-op now that interval runs inside store
  },

  cancelTimer: () => {
    get().stopRestTimer();
  },

  setRpe: (value) => set({ rpe: value }),

  setInitialMood: (value) => set({ initialMood: value }),

  setMood: (value) => set({ mood: value }),

  setMoodComment: (value) => set({ moodComment: value }),

  completeWorkout: () => set({ isWorkoutComplete: true }),

  resetTraining: () => {
    set({
      currentDay: null,
      currentExerciseIndex: 0,
      seriesLog: {},
      activeRestSetIndex: null,
      activeRestExerciseId: null,
      restTargetEndTime: null,
      restSecondsTotal: null,
      workoutStartedAt: null,
      rpe: null,
      initialMood: null,
      mood: null,
      moodComment: "",
      pendingDayId: null,
      isWorkoutComplete: false,
      lastActivityTimestamp: null,
      assignmentId: null,
      currentDayNumber: 1,
      previewDayId: null,
    });
  },

  fetchGlobalExercises: async () => {
    const { isGlobalExercisesLoaded, isGlobalExercisesLoading } = get();
    if (isGlobalExercisesLoaded || isGlobalExercisesLoading) return;

    set({ isGlobalExercisesLoading: true });
    try {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, video_url, notes, category_id, created_by, created_at, category:exercise_categories(id, name, color)")
        .order("name", { ascending: true });

      if (error) throw error;
      set({
        globalExercises: (data as unknown as LibraryExercise[]) || [],
        isGlobalExercisesLoaded: true,
      });
    } catch (error) {
      console.error("Error loading global exercises:", error);
    } finally {
      set({ isGlobalExercisesLoading: false });
    }
  },

  refreshGlobalExercises: async () => {
    set({ isGlobalExercisesLoading: true });
    try {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, video_url, notes, category_id, created_by, created_at, category:exercise_categories(id, name, color)")
        .order("name", { ascending: true });

      if (error) throw error;
      set({
        globalExercises: (data as unknown as LibraryExercise[]) || [],
        isGlobalExercisesLoaded: true,
      });
    } catch (error) {
      console.error("Error refreshing global exercises:", error);
    } finally {
      set({ isGlobalExercisesLoading: false });
    }
  },
}),
    {
      name: "training-storage", // name of the item in the storage (must be unique)
      partialize: (state) => ({
        // We persist only the workout progress state
        currentDay: state.currentDay,
        currentExerciseIndex: state.currentExerciseIndex,
        seriesLog: state.seriesLog,
        activeRestSetIndex: state.activeRestSetIndex,
        activeRestExerciseId: state.activeRestExerciseId,
        restTargetEndTime: state.restTargetEndTime,
        restSecondsTotal: state.restSecondsTotal,
        workoutStartedAt: state.workoutStartedAt,
        rpe: state.rpe,
        initialMood: state.initialMood,
        mood: state.mood,
        moodComment: state.moodComment,
        pendingDayId: state.pendingDayId,
        isWorkoutComplete: state.isWorkoutComplete,
        lastActivityTimestamp: state.lastActivityTimestamp,
        assignmentId: state.assignmentId,
        currentDayNumber: state.currentDayNumber,
      }),
    }
  )
);
