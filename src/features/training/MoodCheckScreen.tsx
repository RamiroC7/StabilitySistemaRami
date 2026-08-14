import { useParams, useNavigate } from "react-router-dom";
import { useTrainingStore } from "@/features/training/store/trainingStore";
import { useActiveDayExercises } from "@/hooks/useActiveDayExercises";
import type { MoodValue } from "@/features/training/store/trainingStore";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft, WifiOff, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

// ── Mood options ───────────────────────────────────────────────────────────

const MOODS: {
  value: MoodValue;
  image: string;
  label: string;
  description: string;
  colorClass: string;
}[] = [
    {
      value: "happy",
      image: "/contento.webp",
      label: "Feliz",
      description: "Con energía y buen ánimo",
      colorClass: "emerald",
    },
    {
      value: "neutral",
      image: "/neutro.webp",
      label: "Normal",
      description: "Sin nada en particular",
      colorClass: "blue",
    },
    {
      value: "sad",
      image: "/triste.webp",
      label: "Bajo",
      description: "Poca energía o motivación",
      colorClass: "amber",
    },
  ];

// ── Component ──────────────────────────────────────────────────────────────

export default function MoodCheckScreen() {
  const { dayId } = useParams<{ dayId: string }>();
  const navigate = useNavigate();
  const { setInitialMood, startWorkout, setPendingDayId } = useTrainingStore();

  const { workoutDay, loading } = useActiveDayExercises(dayId ?? null);

  // If data still hasn't arrived after 4 seconds, show an offline error
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (workoutDay) { queueMicrotask(() => setTimedOut(false)); return; }
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, [workoutDay]);

  const handleMoodSelect = (mood: MoodValue) => {
    if (!workoutDay || !dayId) return;
    setInitialMood(mood);
    setPendingDayId(dayId); // Store the dayId for later continuation
    startWorkout(workoutDay);
    navigate("/entrenamiento/dia/" + dayId);
  };

  // ── Loading / offline error state ─────────────────────────────────────────
  if (!workoutDay && (loading || timedOut)) {
    return (
      <div className="flex flex-col bg-white dark:bg-slate-950 items-center justify-center min-h-screen w-full gap-5 px-8 text-center">
        {timedOut ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              {!navigator.onLine
                ? <WifiOff size={32} className="text-amber-500" />
                : <AlertCircle size={32} className="text-amber-500" />}
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {!navigator.onLine ? "Sin conexión" : "No se pudo cargar"}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-[260px]">
                {!navigator.onLine
                  ? "Los ejercicios de este día no se descargaron antes de perder señal. Volvé al inicio y abrí este día cuando tengas internet."
                  : "No se pudieron cargar los ejercicios. Por favor intentá de nuevo."}
              </p>
            </div>
            <button
              onClick={() => navigate("/entrenamiento")}
              className="px-6 py-3 bg-primary text-white font-semibold rounded-2xl text-sm"
            >
              Volver al Inicio
            </button>
          </>
        ) : (
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white dark:bg-slate-950 items-center min-h-screen w-full transition-colors duration-300">
      {/* ── Top Bar ───────────────────────────────────────────── */}
      <div className="w-full max-w-lg px-6 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-2 flex justify-start">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95"
          aria-label="Volver"
        >
          <ChevronLeft size={26} />
        </button>
      </div>

      <div className="flex flex-col items-center max-w-lg w-full px-6 pt-4 pb-12">
        {/* ── Logo ────────────────────────────────────────────── */}
        <div className="bg-white/95 dark:bg-white p-4 rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100/50 flex items-center justify-center mb-8 transform hover:scale-105 transition-all duration-500">
          <img
            src="/logo-nuevo-sinfondo.svg"
            alt="Logo"
            className="w-32 h-auto object-contain drop-shadow-sm"
          />
        </div>

        {/* ── Title ────────────────────────────────────────────── */}
        <h1 className="text-3xl font-bold text-center text-slate-900 dark:text-white tracking-tight leading-tight">
          ¿Cómo te sentís hoy?
        </h1>
        <p className="mt-3 text-sm text-center text-slate-500 dark:text-slate-400 max-w-[260px] leading-relaxed">
          Un breve registro de tu energía antes de empezar a entrenar.
        </p>

        {/* ── Mood buttons ─────────────────────────────────────── */}
        <div className="w-full mt-4 flex flex-col gap-4">
          {MOODS.map((mood) => (
            <button
              key={mood.value}
              onClick={() => handleMoodSelect(mood.value)}
              className={cn(
                "group w-full flex items-center gap-5 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all duration-200",
                "hover:border-primary/30 hover:shadow-md active:scale-[0.98]",
                "dark:hover:bg-slate-800/80"
              )}
            >
              {/* Image container */}
              <div className="w-16 h-16 shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 select-none shadow-inner p-2">
                <img src={mood.image} alt={mood.label} className="w-full h-full object-contain drop-shadow-sm scale-110" />
              </div>

              {/* Text info */}
              <div className="text-left flex-1 min-w-0">
                <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {mood.label}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">
                  {mood.description}
                </p>
              </div>

              {/* Arrow */}
              <ChevronRight
                size={20}
                className="text-slate-300 dark:text-slate-600 group-hover:text-primary group-hover:translate-x-1 transition-all"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
