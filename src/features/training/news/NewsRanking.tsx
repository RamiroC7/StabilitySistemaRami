import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  useMonthlyRanking,
  getMonthStart,
  type RankingEntry,
} from "@/hooks/useMonthlyRanking";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  Info,
  CheckCircle2,
  Dumbbell,
  Camera,
  Trophy,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Month navigation helpers ────────────────────────────────────────────────
const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function getMonthLabel(year: number, month: number) {
  return `${MONTH_NAMES[month]} ${year}`;
}

// ─── Podium avatar ────────────────────────────────────────────────────────────
function Avatar({ entry, size = 48 }: { entry: RankingEntry; size?: number }) {
  const initials =
    `${entry.first_name[0] ?? ""}${entry.last_name[0] ?? ""}`.toUpperCase();

  if (entry.profile_image) {
    return (
      <img
        src={entry.profile_image}
        alt={`${entry.first_name} ${entry.last_name}`}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-primary/10 flex items-center justify-center shrink-0"
    >
      <span
        className="text-primary font-bold"
        style={{ fontSize: size * 0.35 }}
      >
        {initials}
      </span>
    </div>
  );
}

// ─── Medal colors ─────────────────────────────────────────────────────────────
const RANK_STYLES: Record<
  number,
  { ring: string; label: string; icon: string }
> = {
  1: { ring: "ring-2 ring-yellow-400", label: "text-yellow-500", icon: "🥇" },
  2: { ring: "ring-2 ring-slate-400", label: "text-slate-400", icon: "🥈" },
  3: { ring: "ring-2 ring-amber-600", label: "text-amber-600", icon: "🥉" },
};

// ─── Top-3 podium ─────────────────────────────────────────────────────────────
function Podium({
  top3,
  currentId,
}: {
  top3: RankingEntry[];
  currentId: string;
}) {
  const [first, second, third] = top3;

  // Podium layout: 2nd | 1st | 3rd
  const ordered = [second, first, third];
  const rankNums = [2, 1, 3];
  const blockH = ["h-28", "h-36", "h-24"];
  const mascotH = ["h-[116px]", "h-[118px]", "h-[116px]"];
  const mascotSrc = ["/2do-puesto.webp", "/1er-puesto.webp", "/3er-puesto.webp"];

  return (
    <div className="flex items-end justify-center gap-1.5 pt-6 pb-0 px-4">
      {ordered.map((entry, i) => {
        if (!entry) return <div key={`empty-${i}`} className="flex-1 min-w-0" />;

        const rankNum = rankNums[i];
        const isMe = entry.student_id === currentId;

        return (
          <div
            key={entry.student_id}
            className="flex flex-col items-center flex-1 min-w-0 relative"
          >
            {/* "Vos" indicator */}
            {isMe && (
              <span className="absolute top-[40%] text-[9px] font-bold text-white bg-primary rounded-full px-1.5 py-0.5 z-20 shadow-md border border-white/20">
                Vos
              </span>
            )}

            {/* Mascot */}
            <img
              src={mascotSrc[i]}
              alt={`Puesto ${rankNum}`}
              className={cn(
                "object-contain drop-shadow-xl z-10 relative",
                mascotH[i],
                "-mb-1.5" // Slight overlap with the podium block
              )}
              draggable={false}
            />

            {/* Podium block */}
            <div
              className={cn(
                "w-full rounded-t-xl flex flex-col items-center justify-start pt-3 relative overflow-hidden shadow-[0_-4px_15px_rgba(0,0,0,0.03)] dark:shadow-none border-x border-t border-b-0",
                blockH[i],
                rankNum === 1
                  ? "bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-900/20 dark:to-slate-900 border-yellow-200/60 dark:border-yellow-700/30"
                  : rankNum === 2
                    ? "bg-gradient-to-b from-slate-50 to-white dark:from-slate-800/40 dark:to-slate-900 border-slate-200 dark:border-slate-700"
                    : "bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-900/10 dark:to-slate-900 border-amber-200/40 dark:border-amber-800/30"
              )}
            >
              {/* Rank Number Background Watermark */}
              <span
                className={cn(
                  "absolute -bottom-1.5 font-black text-6xl leading-none opacity-[0.06] dark:opacity-10 pointer-events-none select-none",
                  rankNum === 1
                    ? "text-yellow-600 dark:text-yellow-400"
                    : rankNum === 2
                      ? "text-slate-600 dark:text-slate-400"
                      : "text-amber-700 dark:text-amber-500"
                )}
              >
                {rankNum}
              </span>

              {/* Name */}
              <p
                className={cn(
                  "text-[11px] font-bold text-center leading-tight max-w-full px-1.5 truncate relative z-10",
                  isMe ? "text-primary" : "text-slate-800 dark:text-slate-200"
                )}
              >
                {entry.first_name} {entry.last_name?.[0]}.
              </p>

              {/* Count */}
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 relative z-10 mt-0.5">
                {entry.attendance_count} asist.
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Single list row ──────────────────────────────────────────────────────────
function RankRow({
  entry,
  currentId,
}: {
  entry: RankingEntry;
  currentId: string;
}) {
  const isMe = entry.student_id === currentId;
  const style = RANK_STYLES[entry.rank];

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors",
        isMe
          ? "bg-primary/5 border border-primary/20"
          : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800",
      )}
    >
      {/* Rank */}
      <div className="w-7 text-center shrink-0">
        {style ? (
          <span className="text-lg">{style.icon}</span>
        ) : (
          <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
            {entry.rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      <Avatar entry={entry} size={38} />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-semibold truncate leading-tight",
            isMe ? "text-primary" : "text-slate-900 dark:text-white",
          )}
        >
          {isMe
            ? `${entry.first_name} ${entry.last_name} (vos)`
            : `${entry.first_name} ${entry.last_name}`}
        </p>
      </div>

      {/* Count */}
      <div className="flex items-center gap-1 shrink-0">
        <Dumbbell size={13} className="text-slate-400" />
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {entry.attendance_count}
        </span>
      </div>
    </div>
  );
}

// ─── Terms & conditions sheet ─────────────────────────────────────────────────
function TermsSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const terms = [
    {
      icon: CheckCircle2,
      title: "Asistencias con honestidad",
      desc: "Las asistencias deben ser marcadas el día que entrenó la persona, dos marcadas el mismo día alteran la posibilidad de ganar.",
    },
    {
      icon: Dumbbell,
      title: "Completar repeticiones y pesos",
      desc: "Registrar repeticiones y pesos en ejercicios solicitados.",
    },
    {
      icon: Camera,
      title: "Historia de instagram",
      desc: "Dos videos en cualquier parte del mes en curso.",
    },
    {
      icon: Trophy,
      title: "En caso de empate",
      desc: "Si varios alumnos tienen la misma cantidad de asistencias, gana quien haya registrado su primera asistencia del mes antes (fecha y hora). En caso de empate total, el descuento se reparte equitativamente.",
    },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[51] transform transition-all duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div
          className="relative w-full bg-white dark:bg-slate-900 rounded-t-3xl p-6 pb-10 safe-area-pb shadow-2xl border-t border-slate-200 dark:border-slate-800 max-w-lg mx-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle/Drag indicator */}
          <div className="flex justify-center pt-0 pb-4">
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            Términos y condiciones
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
            Para acceder al{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              descuento del 50%
            </span>
            , el alumno con mayor asistencia mensual debe cumplir con las
            siguientes condiciones:
          </p>

          <div className="space-y-4">
            {terms.map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {i + 1}. {title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="mt-8 mb-4 w-full py-3 rounded-2xl bg-primary text-white font-semibold text-sm active:opacity-80 transition-opacity"
          >
            Entendido
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NewsRanking() {
  const { professor } = useAuthStore();
  const currentId = professor?.id ?? "";
  const navigate = useNavigate();

  // Month navigation: start at current month
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const [showTerms, setShowTerms] = useState(false);

  const monthStart = getMonthStart(year, month);
  const { ranking, loading, error } = useMonthlyRanking(monthStart);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const isFirstMonth = year === 2026 && month === 2; // Marzo 2026 (0-indexed)

  function prevMonth() {
    if (isFirstMonth) return;
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3, 10);
  const myRank = ranking.find((r) => r.student_id === currentId);

  return (
    <>
      <div className="flex flex-col min-h-full bg-[#f7f9fc] dark:bg-slate-950 pb-6">
        {/* ── Header ── */}
        <header className="flex items-center justify-between px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] bg-background-light dark:bg-background-dark sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800 [transform:translateZ(0)] [isolation:isolate]">
          <button
            onClick={() => navigate("/entrenamiento/comunidad")}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Ranking de Posiciones
          </h2>
          <button
            onClick={() => setShowTerms(true)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full active:scale-95 transition-all shadow-sm border border-primary/10"
            aria-label="Términos y condiciones"
          >
            <Info size={14} />
            Reglas
          </button>
        </header>

        {/* ── Month navigator ── */}
        <div className="flex items-center justify-center gap-4 px-4 mt-6 mb-6">
          <button
            onClick={prevMonth}
            disabled={isFirstMonth}
            className={cn(
              "w-9 h-9 rounded-xl border flex items-center justify-center transition-opacity shadow-sm",
              isFirstMonth
                ? "opacity-30 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 active:opacity-70",
            )}
          >
            <ChevronLeft
              size={18}
              className="text-slate-600 dark:text-slate-300"
            />
          </button>

          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 min-w-[140px] text-center">
            {getMonthLabel(year, month)}
            {isCurrentMonth && (
              <span className="ml-2 text-[10px] font-normal text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                En curso
              </span>
            )}
          </p>

          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className={cn(
              "w-9 h-9 rounded-xl border flex items-center justify-center transition-opacity shadow-sm",
              isCurrentMonth
                ? "opacity-30 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 active:opacity-70",
            )}
          >
            <ChevronRight
              size={18}
              className="text-slate-600 dark:text-slate-300"
            />
          </button>
        </div>

        <div className="text-center px-6 mb-5 flex flex-col gap-0.5">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Ranking de asistencias mensual
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            El 1° gana un{" "}
            <span className="font-semibold text-blue-500 dark:text-blue-400">
              50%
            </span>{" "}
            en su próxima renovación.
          </p>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center px-8 py-20">
            <p className="text-sm text-center text-slate-500 dark:text-slate-400">
              No se pudo cargar el ranking. Intentá de nuevo más tarde.
            </p>
          </div>
        ) : ranking.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Users size={28} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center">
              Sin entrenamientos este mes
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
              Completá tu primer entrenamiento para aparecer en el ranking de{" "}
              {getMonthLabel(year, month)}.
            </p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <div className="mx-4 mb-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <Podium top3={top3} currentId={currentId} />
              </div>
            )}

            {/* My position chip (if not in top 10 and present) */}
            {myRank && myRank.rank > 10 && (
              <div className="mx-4 mb-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between">
                <p className="text-xs text-primary font-semibold">
                  Tu posición: #{myRank.rank}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {myRank.attendance_count} asistencia
                  {myRank.attendance_count !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {/* Full list (rank 4+) */}
            {rest.length > 0 && (
              <div className="px-4 space-y-2">
                {rest.map((entry) => (
                  <RankRow
                     key={entry.student_id}
                     entry={entry}
                     currentId={currentId}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Terms & conditions bottom sheet */}
      {showTerms && (
        <TermsSheet isOpen={showTerms} onClose={() => setShowTerms(false)} />
      )}
    </>
  );
}
