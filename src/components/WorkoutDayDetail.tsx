import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { WorkoutCompletion } from "@/hooks/useWorkoutCompletions";
import { Loader2, Trash2, X, Clock, Flame, Smile } from "lucide-react";

interface WorkoutDayDetailProps {
  completion: WorkoutCompletion;
  studentId: string;
  onClose: () => void;
  onDeleted: () => void;
  deleteCompletion: (
    completionId: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

interface CompletionDetail {
  mood: string | null;
  moodComment: string | null;
}

interface ExerciseLogRow {
  exercise_name: string;
  plan_day_name: string | null;
  series: number;
  sets_detail: { set_number: number; actual_reps: string | null; kg: number | null }[];
}

const MOOD_LABELS: Record<string, string> = {
  excellent: "Excelente",
  normal: "Normal",
  tired: "Fatigado",
  pain: "Con molestia",
};

const rpeLabel = (rpe: number | null) => {
  if (!rpe) return null;
  if (rpe <= 3) return `${rpe}/10 · Fácil`;
  if (rpe <= 6) return `${rpe}/10 · Moderado`;
  if (rpe <= 8) return `${rpe}/10 · Duro`;
  return `${rpe}/10 · Máximo`;
};

export default function WorkoutDayDetail({
  completion,
  studentId,
  onClose,
  onDeleted,
  deleteCompletion,
}: WorkoutDayDetailProps) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CompletionDetail | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLogRow[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [completionRes, logsRes] = await Promise.all([
        supabase
          .from("workout_completions")
          .select("mood, mood_comment")
          .eq("id", completion.id)
          .maybeSingle(),
        supabase
          .from("exercise_weight_logs")
          .select("exercise_name, plan_day_name, series, sets_detail")
          .eq("student_id", studentId)
          .eq("assignment_id", completion.assignmentId)
          .eq("plan_day_number", completion.dayNumber),
      ]);

      if (cancelled) return;

      if (completionRes.data) {
        setDetail({
          mood: completionRes.data.mood,
          moodComment: completionRes.data.mood_comment,
        });
      }
      if (logsRes.data) {
        setExerciseLogs(logsRes.data as ExerciseLogRow[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [completion.id, completion.assignmentId, completion.dayNumber, studentId]);

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteCompletion(completion.id);
    setIsDeleting(false);
    if (result.success) {
      toast.success("Entrenamiento eliminado");
      onDeleted();
    } else {
      toast.error(result.error ?? "No se pudo eliminar. Intenta de nuevo.");
      setConfirmingDelete(false);
    }
  };

  const dayLabel =
    exerciseLogs[0]?.plan_day_name || `Día ${completion.dayNumber}`;
  const dateLabel = new Date(completion.completedAt).toLocaleDateString(
    "es-AR",
    { weekday: "long", day: "numeric", month: "long" },
  );

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm"
        onClick={() => !isDeleting && onClose()}
      />
      <div className="fixed inset-0 z-[101] flex items-center justify-center px-4">
        <div className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 px-6 pt-6 pb-6">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>

          {!confirmingDelete ? (
            <>
              {/* ── Header ── */}
              <div className="mb-5 pr-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {dayLabel}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">
                  {dateLabel}
                </p>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* ── Stats rápidos ── */}
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                      <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {completion.durationMinutes ?? "—"}
                        {completion.durationMinutes ? " min" : ""}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                      <Flame className="w-4 h-4 text-primary mx-auto mb-1" />
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {rpeLabel(completion.rpe) ?? "—"}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                      <Smile className="w-4 h-4 text-primary mx-auto mb-1" />
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {(detail?.mood && MOOD_LABELS[detail.mood]) ?? "—"}
                      </p>
                    </div>
                  </div>

                  {detail?.moodComment && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-5 px-1">
                      "{detail.moodComment}"
                    </p>
                  )}

                  {/* ── Ejercicios registrados ── */}
                  {exerciseLogs.length > 0 && (
                    <div className="space-y-2 mb-5">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Pesos registrados
                      </p>
                      {exerciseLogs.map((log, i) => (
                        <div
                          key={i}
                          className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3"
                        >
                          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">
                            {log.exercise_name}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {log.sets_detail
                              .filter((s) => s.kg != null && s.actual_reps)
                              .map((s, si) => (
                                <span
                                  key={si}
                                  className="text-xs px-2 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                >
                                  {s.kg}kg × {s.actual_reps}
                                </span>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── Eliminar ── */}
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 size={18} />
                Eliminar entrenamiento
              </button>
            </>
          ) : (
            <>
              {/* ── Confirmación de borrado ── */}
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <Trash2 className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  ¿Eliminar entrenamiento?
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Se va a borrar la sesión del {dateLabel} y los pesos
                  registrados ese día. No se puede deshacer.
                </p>
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-all shadow-lg active:scale-[0.98] bg-red-600 hover:bg-red-700 shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 size={20} />
                      Sí, eliminar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={isDeleting}
                  className="w-full inline-flex justify-center rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3.5 text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Volver
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
