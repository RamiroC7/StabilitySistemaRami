import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { X, Loader2, Save } from "lucide-react";
import { useWorkoutCompletions } from "@/hooks/useWorkoutCompletions";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useTrainingStore } from "@/features/training/store/trainingStore";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { WorkoutDay, SeriesLog } from "@/features/training/types";
import type { WorkoutMood } from "@/features/training/store/trainingStore";

// ── Constants ──────────────────────────────────────────────────────────────

const RPE_LABELS: Record<number, string> = {
  1: "Muy fácil",
  2: "Fácil",
  3: "Moderado",
  4: "Un poco duro",
  5: "Duro",
  6: "Duro",
  7: "Muy duro",
  8: "Muy duro",
  9: "Extremo",
  10: "Máximo",
};

const rpeColor = (selected: number | null, value: number) => {
  if (selected !== value)
    return "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300";
  if (value <= 3)
    return "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-300 dark:shadow-emerald-900";
  if (value <= 6)
    return "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-300 dark:shadow-amber-900";
  return "bg-red-500 border-red-500 text-white shadow-lg shadow-red-300 dark:shadow-red-900";
};

const POST_MOODS: {
  value: WorkoutMood;
  emoji: string;
  label: string;
}[] = [
    { value: "excelente", emoji: "🔥", label: "Excelente" },
    { value: "normal", emoji: "😊", label: "Normal" },
    { value: "fatigado", emoji: "😓", label: "Fatigado" },
    { value: "molestia", emoji: "🤕", label: "Molestia" },
  ];

// ── Props ──────────────────────────────────────────────────────────────────

interface QuickSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  workoutDay: WorkoutDay;
  quickWeights: Record<string, { kg: string; reps: string }>;
  assignmentId: string;
  dayNumber: number;
  onSuccess: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function QuickSaveModal({
  isOpen,
  onClose,
  workoutDay,
  quickWeights,
  assignmentId,
  dayNumber,
  onSuccess,
}: QuickSaveModalProps) {
  const navigate = useNavigate();
  const { saveCompletion } = useWorkoutCompletions();
  const professor = useAuthStore((s) => s.professor);
  const initialMood = useTrainingStore((s) => s.initialMood);
  const resetTraining = useTrainingStore((s) => s.resetTraining);

  const [rpe, setRpe] = useState<number | null>(null);
  const [mood, setMood] = useState<WorkoutMood | null>(null);
  const [moodComment, setMoodComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  // Build a full seriesLog from the weights entered (mark all sets as done)
  const buildSeriesLog = (): SeriesLog => {
    const log: SeriesLog = {};
    for (const ex of workoutDay.exercises) {
      for (let i = 0; i < ex.sets.length; i++) {
        const key = `${ex.id}-${i}`;
        const entry = quickWeights[key];
        log[key] = {
          kg: entry?.kg || ex.sets[i].targetWeight?.toString() || "",
          reps: entry?.reps || ex.sets[i].targetReps || "",
          done: true,
        };
      }
    }
    return log;
  };

  const totalSets = workoutDay.exercises.reduce(
    (acc, ex) => acc + ex.sets.length,
    0,
  );

  const handleSave = async () => {
    if (!initialMood) {
      toast.error(
        "Error: No se registró el estado de ánimo inicial. Por favor reiniciá la rutina.",
      );
      return;
    }

    if (!rpe || !mood) {
      toast.error("Por favor completá todos los campos requeridos (*)");
      return;
    }

    setIsSaving(true);
    const seriesLog = buildSeriesLog();

    // Calculate workout duration
    const workoutStartedAt = useTrainingStore.getState().workoutStartedAt;
    const durationMinutes = workoutStartedAt
      ? Math.round((Date.now() - workoutStartedAt) / 60000)
      : null;

    const result = await saveCompletion({
      assignmentId,
      dayNumber,
      rpe,
      initialMood,
      mood,
      moodComment: moodComment || null,
      totalSetsDone: totalSets,
      seriesLog,
      durationMinutes,
    });

    if (result.success) {
      // Save exercise_weight_logs for exercises that require weight registration
      const exercisesToLog = workoutDay.exercises.filter(
        (ex) => ex.writeWeight,
      );
      if (exercisesToLog.length > 0 && professor?.id) {
        const logsToInsert = exercisesToLog
          .map((ex) => {
            const setsDetail = ex.sets.map((set, i) => {
              const key = `${ex.id}-${i}`;
              const entry = quickWeights[key];
              return {
                set_number: set.setNumber,
                target_reps: set.targetReps,
                actual_reps: entry?.reps ? entry.reps : null,
                kg: entry?.kg ? parseFloat(entry.kg) : null,
              };
            });

            // Solo guardar si al menos una serie tiene datos reales
            const hasRealData = setsDetail.some(
              (s) => s.kg != null && s.kg > 0 && s.actual_reps != null && s.actual_reps !== ""
            );
            if (!hasRealData) return null;

            return {
              student_id: professor.id,
              assignment_id: assignmentId,
              exercise_id: String(ex.id),
              exercise_name: ex.name,
              plan_day_number: dayNumber,
              plan_day_name: workoutDay.name,
              series: ex.sets.length,
              sets_detail: setsDetail,
            };
          })
          .filter(Boolean);

        if (logsToInsert.length > 0) {
          const { error } = await supabase
            .from("exercise_weight_logs")
            .insert(logsToInsert);

          if (error) {
            console.error("[QuickSaveModal] Error saving weight logs:", error);
          }
        }
      }

      toast.success("¡Entrenamiento guardado! 💪");
      onSuccess();
      resetTraining();
      navigate("/entrenamiento", { replace: true });
    } else {
      toast.error("No se pudo guardar. Intentá de nuevo.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Registrar sensaciones
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Campos con * son obligatorios
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6 safe-area-pb">
          {/* ── RPE ─────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Esfuerzo percibido (RPE) <span className="text-red-500">*</span>
              </p>
              {rpe && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {RPE_LABELS[rpe]}
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                <button
                  key={value}
                  onClick={() => setRpe(value)}
                  className={cn(
                    "h-12 flex items-center justify-center rounded-xl border-2 font-bold text-base transition-all active:scale-95 min-h-[44px]",
                    rpeColor(rpe, value),
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Fácil
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                Muy duro
              </span>
            </div>
          </div>

          {/* ── Post-workout mood ────────────────────────────────── */}
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              ¿Cómo terminaste? <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-4 gap-2">
              {POST_MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMood(m.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 font-medium text-xs transition-all active:scale-95 min-h-[64px]",
                    mood === m.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary/40",
                  )}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Comment ─────────────────────────────────────────── */}
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
              Comentario{" "}
              <span className="text-xs font-normal text-slate-400">
                (opcional)
              </span>
            </p>
            <textarea
              value={moodComment}
              onChange={(e) => setMoodComment(e.target.value)}
              placeholder="¿Algo que quieras recordar de esta sesión?"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* ── Save button ──────────────────────────────────────── */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-sm py-4 rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 min-h-[54px]"
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={18} />
                Guardar Entrenamiento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
