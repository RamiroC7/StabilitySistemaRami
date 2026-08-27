import { SkipForward } from "lucide-react";

interface RestTimerProps {
  remaining: number;
  total: number;
  onCancel: () => void;
}

/**
 * Purely presentational rest timer widget.
 * Receives `remaining` and `total` seconds as props; the countdown logic lives
 * in `useRestTimer`.
 */
export default function RestTimer({ remaining, total, onCancel }: RestTimerProps) {
  const pct = total > 0 ? (remaining / total) * 100 : 0;

  return (
    <div className="flex flex-col items-center gap-2 bg-slate-900 rounded-2xl py-3 px-4 my-2 max-w-xs mx-auto">
      {/* Circular progress */}
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#1e293b" strokeWidth="5" />
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
