import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useTrainingStore } from "@/features/training/store/trainingStore";
import { useActiveAssignment } from "@/hooks/useActiveAssignment";
import { useActiveDayExercises } from "@/hooks/useActiveDayExercises";
import { useWorkoutCompletions } from "@/hooks/useWorkoutCompletions";
import { useExerciseWeightLogs } from "@/hooks/useExerciseWeightLogs";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  Dumbbell,
  CalendarX2,
  CheckCircle2,
  User,
  PlayCircle,
  X,
  Eye,
  AlertCircle,
  Trash2,
  XCircle,
} from "lucide-react";

// Decorative gradient overlay for the hero image
const gradientOverlay =
  "linear-gradient(to bottom, rgba(0,86,178,0.55) 0%, rgba(26,26,94,0.90) 100%)";

export default function TrainingHome() {
  const navigate = useNavigate();
  const { professor } = useAuthStore();
  const setAssignmentContext = useTrainingStore((s) => s.setAssignmentContext);
  
  // ── Check if there's a workout in progress ──
  const currentDay = useTrainingStore((s) => s.currentDay);
  const currentExerciseIndex = useTrainingStore((s) => s.currentExerciseIndex);
  const pendingDayId = useTrainingStore((s) => s.pendingDayId);
  const checkWorkoutExpiration = useTrainingStore((s) => s.checkWorkoutExpiration);

  // Determine if there's an active workout
  const hasWorkoutInProgress = !!(currentDay && pendingDayId);

  // ── Check for workout expiration on mount ──
  useEffect(() => {
    const expired = checkWorkoutExpiration();
    if (expired) {
      toast.info("Tu entrenamiento anterior expiró por inactividad. Podés comenzar uno nuevo.");
    }
  }, [checkWorkoutExpiration]);

  // ── Data hooks (assignment + completions fire in parallel) ──
  const { assignment, loading: assignmentLoading } = useActiveAssignment();
  const { completions } = useWorkoutCompletions();

  // ── Background prefetch: warm up /perfil and /progreso caches ──
  // Exercise weight logs land in Zustand; TrainingProgress will see them ready.
  useExerciseWeightLogs(professor?.id);
  // Profile lands in sessionStorage; TrainingProfile reads from there on mount.
  useEffect(() => {
    if (!professor?.id) return;
    const SESSION_KEY = "training_profile_data";
    if (sessionStorage.getItem(SESSION_KEY)) return; // already warm
    supabase
      .from("student_profiles")
      .select("*")
      .eq("id", professor.id)
      .single()
      .then(({ data }) => {
        if (data) {
          try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch { /* ignore */ }
        }
      });
  }, [professor?.id]);

  // Selected day state (null = use the suggested next day)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // Override selected day to always be the workout day when in progress
  const effectiveSelectedDayId = hasWorkoutInProgress 
    ? pendingDayId 
    : selectedDayId;

  // Preview day state
  const previewDayId = useTrainingStore((s) => s.previewDayId);
  const setPreviewDayId = useTrainingStore((s) => s.setPreviewDayId);

  // Cancel workout bottom sheet state
  const [showCancelSheet, setShowCancelSheet] = useState(false);
  const resetTraining = useTrainingStore((s) => s.resetTraining);

  const handleCancelWorkout = () => {
    resetTraining();
    setShowCancelSheet(false);
    setSelectedDayId(null);
  };

  // Determine which day to load: manual selection or suggested next day
  const dayIdToLoad = effectiveSelectedDayId ?? assignment?.currentDayId ?? null;

  const { workoutDay, loading: dayLoading } =
    useActiveDayExercises(dayIdToLoad);

  // Preview day exercises
  const { workoutDay: previewDay, loading: previewLoading, error: previewError } =
    useActiveDayExercises(previewDayId);

  // Handler to open preview
  const handleOpenPreview = useCallback((dayId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent day selection
    setPreviewDayId(dayId);
  }, [setPreviewDayId]);

  const handlePreviewClose = useCallback(() => {
    setPreviewDayId(null);
  }, [setPreviewDayId]);

  // Available days come from the assignment (no separate hook!)
  const availableDays = assignment?.availableDays ?? [];
  const daysPerWeek = assignment?.daysPerWeek ?? 0;

  // Build a Set of completed day numbers for this assignment.
  // Only count completions whose LOCAL calendar date is >= the plan's startDate.
  // We use local date extraction (getFullYear/getMonth/getDate) because:
  //   - completed_at is stored in UTC in Supabase (e.g. "2026-03-02T01:26:16Z")
  //   - In Argentina (UTC-3) that's "2026-03-01 22:26" → local date "2026-03-01"
  //   - start_date is already a local date "2026-03-02"
  //   - "2026-03-01" < "2026-03-02" → correctly excluded ✓
  const toLocalDateStr = (iso: string) => {
    const d = new Date(iso);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  };

  const getMondayOfCurrentWeekStr = (): string => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return (
      monday.getFullYear() +
      "-" +
      String(monday.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(monday.getDate()).padStart(2, "0")
    );
  };
  const currentWeekMondayLocal = getMondayOfCurrentWeekStr();

  const completedDayNumbers = new Set(
    completions
      .filter((c) => {
        if (c.assignmentId !== assignment?.assignmentId) return false;
        const startDay = assignment?.startDate
          ? assignment.startDate.slice(0, 10)
          : null;
        let startDayMinus1: string | null = null;
        if (startDay) {
          const d = new Date(startDay + "T00:00:00");
          d.setDate(d.getDate() - 1);
          startDayMinus1 =
            d.getFullYear() +
            "-" +
            String(d.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getDate()).padStart(2, "0");
        }
        const effectiveLowerBound =
          startDayMinus1 && startDayMinus1 > currentWeekMondayLocal
            ? startDayMinus1
            : currentWeekMondayLocal;

        const completedLocalDay = toLocalDateStr(c.completedAt);
        return completedLocalDay >= effectiveLowerBound;
      })
      .map((c) => c.dayNumber),
  );

  // Calculate this week's completions
  const getThisWeekCompletions = () => {
    const now = new Date();
    // Get Monday of current week
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
    startOfWeek.setDate(now.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // Get Sunday end
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Filter completions in this week
    return completions.filter((c) => {
      const completedDate = new Date(c.completedAt);
      return completedDate >= startOfWeek && completedDate <= endOfWeek;
    });
  };

  const thisWeekCompletions = getThisWeekCompletions();
  const completedThisWeek = thisWeekCompletions.length;

  // Map completions to days of week (0 = Monday, 6 = Sunday)
  const completedDaysOfWeek = new Set(
    thisWeekCompletions.map((c) => {
      const date = new Date(c.completedAt);
      const day = date.getDay(); // 0 = Sunday, 1 = Monday, ...
      return day === 0 ? 6 : day - 1; // Convert to Monday-first: 0 = Mon, 6 = Sun
    }),
  );

  // Calculate completions this month
  const getThisMonthCompletions = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return completions.filter((c) => {
      const completedDate = new Date(c.completedAt);
      return (
        completedDate.getMonth() === currentMonth &&
        completedDate.getFullYear() === currentYear
      );
    });
  };

  const thisMonthCompletions = getThisMonthCompletions();
  const completedThisMonth = thisMonthCompletions.length;

  // The "today" day = first non-completed day in ascending order.
  // If all days are completed, todayDayId is null (no HOY indicator).
  const todayDayId: string | null = assignment
    ? (availableDays
        .slice()
        .sort((a, b) => a.dayNumber - b.dayNumber)
        .find((d) => !completedDayNumbers.has(d.dayNumber))?.id ?? null)
    : null;

  const isLoading = assignmentLoading || (!!assignment && dayLoading);

  // Check if the currently displayed day is already completed
  const currentDisplayDayNumber =
    availableDays.find((d) => d.id === dayIdToLoad)?.dayNumber ??
    assignment?.currentDayNumber ??
    null;
  const isCurrentDayCompleted =
    currentDisplayDayNumber !== null &&
    completedDayNumbers.has(currentDisplayDayNumber ?? -1);

  const firstName = professor?.firstName ?? "Atleta";
  const today = new Date();
  const dateLabel = today.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const handleStart = () => {
    if (!assignment || !workoutDay) return;

    // If there's a workout in progress, continue from where the user left off
    if (hasWorkoutInProgress) {
      // Navigate to the exercise where the user was
      navigate(`/entrenamiento/dia/${pendingDayId}/ejercicio/${currentExerciseIndex + 1}`);
      return;
    }

    // Find the day number for the selected/current day
    const dayNumber =
      availableDays.find((d) => d.id === dayIdToLoad)?.dayNumber ??
      assignment.currentDayNumber;

    // Store assignment context (mood + workoutDay stored after mood selection)
    setAssignmentContext(assignment.assignmentId, dayNumber);
    // Navigate to mood check first; MoodCheckScreen will call startWorkout
    navigate("/entrenamiento/mood/" + dayIdToLoad);
  };

  return (
    <>
    <div className="px-4 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-4 space-y-5 max-w-lg mx-auto">
      {/* ── Header greeting ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize font-medium">
            {dateLabel}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Hola {firstName} 💪
          </h1>
        </div>

        {/* Avatar — click to go to profile */}
        <button
          onClick={() => navigate("/entrenamiento/perfil")}
          className="w-11 h-11 rounded-full bg-gradient-to-br from-[#0056b2] to-[#1a1a5e] flex items-center justify-center shrink-0 shadow-md shadow-blue-200 dark:shadow-blue-900/40 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          type="button"
          title="Ir a mi perfil"
        >
          {professor?.profileImage ? (
            <img
              src={professor.profileImage}
              alt={firstName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User size={22} className="text-white" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* ── Hero workout card ─────────────────────────────────────── */}
      {isLoading ? (
        /* Skeleton */
        <div className="rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse min-h-[220px]" />
      ) : !assignment ? (
        /* ── Empty state — no active plan ──────────────────────────────── */
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm min-h-[220px] px-6 py-10 text-center">
          {/* Icon bubble */}
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-4 ring-slate-50 dark:ring-slate-700/50">
            <Dumbbell
              className="text-slate-400 dark:text-slate-500"
              size={28}
              strokeWidth={1.8}
            />
          </div>

          {/* Copy */}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              No tenés ningún plan asignado actualmente
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] mx-auto leading-relaxed">
              Tu entrenador todavía no te asignó un plan vigente. ¡En breve
              comenzamos! 💪
            </p>
          </div>

          {/* Subtle decorative rule */}
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 dark:text-slate-600 font-medium">
            <CalendarX2 size={13} strokeWidth={2} />
            <span>Sin plan vigente</span>
          </div>
        </div>
      ) : (
        /* Real plan card */
        <div
          className="relative overflow-hidden rounded-2xl shadow-xl min-h-[220px] flex flex-col justify-end"
          style={{
            background:
              gradientOverlay +
              ', url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80") center/cover no-repeat',
          }}
        >
          {/* Content */}
          <div className="relative p-5 pt-12 text-white space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-1">
                Tu Entrenamiento de Hoy
              </p>
              <h2 className="text-xl font-bold leading-tight">
                Día {workoutDay?.id ?? assignment.currentDayNumber}
              </h2>
              <p className="text-xs text-blue-200/80 mt-0.5 font-medium">
                {assignment.planTitle}
              </p>

              {/* Metadata pills */}
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  {
                    icon: "exercise",
                    text: `${workoutDay?.exercises.length ?? assignment.exerciseCount} ejercicios`,
                  },
                ].map((m) => (
                  <span
                    key={m.text}
                    className="flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-medium"
                  >
                    <Dumbbell size={13} className="text-blue-200/90" />
                    {m.text}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA button — hidden when day is already completed */}
            {isCurrentDayCompleted ? (
              <div className="w-full flex items-center justify-center gap-2 bg-emerald-500/90 text-white font-bold text-sm py-3.5 rounded-xl min-h-[48px]">
                <CheckCircle2 size={18} strokeWidth={2.5} />
                DÍA COMPLETADO
              </div>
            ) : (
              <button
                onClick={handleStart}
                className="w-full flex items-center justify-center gap-2 bg-white text-primary font-bold text-sm py-3.5 rounded-xl shadow-lg shadow-black/20 hover:bg-blue-50 active:scale-[0.98] transition-all min-h-[48px]"
              >
                <PlayCircle size={18} strokeWidth={2.5} />
                {hasWorkoutInProgress ? "CONTINUAR RUTINA" : "COMENZAR RUTINA"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Day selector (when assignment exists) ──────────────────── */}
      {assignment && availableDays.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Seleccionar día
            </h3>
            {effectiveSelectedDayId && effectiveSelectedDayId !== todayDayId && !hasWorkoutInProgress && (
              <button
                onClick={() => setSelectedDayId(null)}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Volver a hoy
              </button>
            )}
          </div>

          {/* Info message when workout in progress */}
          {hasWorkoutInProgress && (
            <div className="mb-3 flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5">
              <AlertCircle size={16} className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed flex-1">
                <span className="font-semibold">Entrenamiento en progreso.</span> Completálo para seleccionar otro día.
              </p>
              <button
                onClick={() => setShowCancelSheet(true)}
                className="shrink-0 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                aria-label="Cancelar entrenamiento"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
            {availableDays.map((day) => {
              const isCompleted = completedDayNumbers.has(day.dayNumber);
              const isToday = day.id === todayDayId;
              const isSelected =
                effectiveSelectedDayId === day.id ||
                (!effectiveSelectedDayId && isToday);
              
              // If there's a workout in progress, only allow selecting that specific day
              const isWorkoutDay = hasWorkoutInProgress && day.id === pendingDayId;
              const isDisabledByWorkout = hasWorkoutInProgress && day.id !== pendingDayId;
              const isDisabled = isCompleted || isDisabledByWorkout;

              return (
                <div key={day.id} className="relative shrink-0">
                  <button
                    onClick={() => !isDisabled && setSelectedDayId(day.id)}
                    disabled={isDisabled}
                    className={cn(
                      // Fixed size: always w-[92px], same padding
                      "flex flex-col items-center w-[92px] px-2 pt-3 pb-2 rounded-xl border-2 transition-all relative",
                      isCompleted
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 cursor-not-allowed opacity-70"
                        : isDisabledByWorkout
                          ? "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-40"
                          : isSelected || isWorkoutDay
                            ? "bg-primary/5 border-primary"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
                    )}
                  >
                    {/* Row 1: DÍA label + check */}
                    <div className="flex items-center gap-1">
                      <span
                        className={cn(
                          "text-[11px] font-bold",
                          isCompleted
                            ? "text-emerald-600 dark:text-emerald-400"
                            : isDisabledByWorkout
                              ? "text-slate-400 dark:text-slate-600"
                              : isSelected || isWorkoutDay
                                ? "text-primary"
                                : "text-slate-500 dark:text-slate-400",
                        )}
                      >
                        DÍA {day.dayNumber}
                      </span>
                      {isCompleted && (
                        <CheckCircle2 size={12} className="text-emerald-500" strokeWidth={2.5} />
                      )}
                    </div>

                    {/* Row 2: Day name — fixed 2-line height */}
                    <span
                      className={cn(
                        "text-[11px] text-center leading-tight line-clamp-2 mt-1 h-8 flex items-center",
                        isCompleted
                          ? "text-emerald-600/80 dark:text-emerald-400/80 font-medium"
                          : isDisabledByWorkout
                            ? "text-slate-400 dark:text-slate-600"
                            : isSelected || isWorkoutDay
                              ? "text-slate-900 dark:text-white font-semibold"
                              : "text-slate-500 dark:text-slate-400",
                      )}
                    >
                      {isCompleted ? "Completado" : day.dayName}
                    </span>

                    {/* Row 3: HOY badge or fixed-height spacer — never changes card size */}
                    <div className="h-5 mt-1.5 flex items-center justify-center">
                      {isToday && !isCompleted && !isDisabledByWorkout && (
                        <div className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-primary to-blue-600 shadow-md shadow-primary/30 animate-pulse">
                          <span className="text-[9px] text-white font-extrabold uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-white" />
                            HOY
                          </span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Preview button - disabled if workout in progress on another day */}
                  {!isCompleted && !isDisabledByWorkout && (
                    <button
                      onClick={(e) => handleOpenPreview(day.id, e)}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all z-10"
                      aria-label="Ver ejercicios"
                    >
                      <Eye size={11} className="text-slate-500 dark:text-slate-400" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Hint text */}
          <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-slate-400 dark:text-slate-500">
            <Eye size={12} />
            <span>Toca el ícono para ver los ejercicios</span>
          </div>
        </div>
      )}

      {/* Metrics row */}
      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-900/30">
            <Dumbbell size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {completedThisMonth}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                este mes
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
              Sesiones completadas
            </p>
          </div>
        </div>
      </div>

      {/* ── Weekly progress strip ─────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Esta semana
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {completedThisWeek} / {daysPerWeek || "—"} sesiones
          </span>
        </div>
        <div className="flex gap-1.5">
          {["L", "M", "X", "J", "V", "S", "D"].map((day, i) => {
            const done = completedDaysOfWeek.has(i);
            return (
              <div
                key={day}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div
                  className={cn(
                    "w-full h-8 rounded-lg transition-all",
                    done
                      ? "bg-primary shadow-sm shadow-blue-300 dark:shadow-blue-900/40"
                      : "bg-slate-100 dark:bg-slate-800",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    done
                      ? "text-primary"
                      : "text-slate-300 dark:text-slate-600",
                  )}
                >
                  {day}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Day Preview Bottom Sheet ──────────────────── */}
      {previewDayId && (
        <div 
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handlePreviewClose}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-t-3xl w-full flex flex-col max-h-[88vh] animate-in slide-in-from-bottom-6 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {previewDay?.name || "Cargando..."}
                </h3>
                {previewDay && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Dumbbell size={13} className="text-slate-400 dark:text-slate-500" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {previewDay.exercises.length} ejercicios
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={handlePreviewClose}
                className="ml-3 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
              >
                <X size={16} className="text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            {/* Exercise List */}
            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              {previewLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 animate-pulse">
                      <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : previewError ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    <AlertCircle size={24} className="text-red-500 dark:text-red-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">No se pudieron cargar los ejercicios</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{previewError}</p>
                  </div>
                  <button
                    onClick={() => setPreviewDayId(null)}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    Cerrar
                  </button>
                </div>
              ) : !previewDay ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 animate-pulse">
                      <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : previewDay.exercises.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Dumbbell size={32} className="text-slate-300 dark:text-slate-700" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No hay ejercicios en este día</p>
                </div>
              ) : (
                previewDay.exercises.map((exercise, idx) => (
                  <div
                    key={exercise.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                        {exercise.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                          {exercise.sets.length}×{exercise.sets[0]?.targetReps || "—"}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-xs text-slate-500 dark:text-slate-500">
                          {exercise.restSeconds ? (
                            exercise.restSeconds < 60 
                              ? `${exercise.restSeconds}s descanso` 
                              : `${Math.round(exercise.restSeconds / 60)}min descanso`
                          ) : (
                            "sin descanso"
                          )}
                        </span>
                      </div>
                      {exercise.category && (
                        <div className="mt-1.5">
                          <span className="inline-block text-[10px] font-bold text-primary/70 dark:text-primary/80 uppercase tracking-wider">
                            {exercise.category}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {previewDay && previewDay.exercises.length > 0 && (
              <div
                className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-100 dark:border-slate-800 shrink-0"
              >
                <button
                  onClick={() => {
                    handlePreviewClose();
                    setSelectedDayId(previewDayId);
                  }}
                  className="w-full py-3.5 px-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl transition-colors shadow-md shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <PlayCircle size={18} />
                  Seleccionar este día
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>

      {/* ── Cancel Workout Bottom Sheet ───────────────── */}
      {showCancelSheet && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowCancelSheet(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[101] max-w-lg mx-auto">
            <div className="bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>

              <div className="px-6 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
                {/* Close button */}
                <button
                  onClick={() => setShowCancelSheet(false)}
                  className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                  </div>
                </div>

                {/* Title & description */}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    ¿Cancelar entrenamiento?
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Se perderá todo el progreso registrado en esta sesión. Podés retomarlo cuando quieras.
                  </p>
                </div>

                {/* Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleCancelWorkout}
                    className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold transition-all shadow-md shadow-red-200 dark:shadow-red-900/30"
                  >
                    Sí, cancelar sesión
                  </button>
                  <button
                    onClick={() => setShowCancelSheet(false)}
                    className="w-full py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] text-slate-700 dark:text-slate-300 font-semibold transition-all"
                  >
                    Volver al entrenamiento
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
