import { useState } from "react";
import { useStudentConstancia } from "@/hooks/useStudentConstancia";
import { useWorkoutCompletions } from "@/hooks/useWorkoutCompletions";
import { ChevronLeft, ChevronRight, TrendingUp, Info } from "lucide-react";

const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];

interface WorkoutCalendarProps {
  studentId: string;
}

export default function WorkoutCalendar({ studentId }: WorkoutCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  // Use precisely the hooks we updated with SWR!
  const { completions, loading: loadingCompletions } =
    useWorkoutCompletions(studentId);
  const { plans, isLoading: loadingPlans } = useStudentConstancia(studentId);

  // Transform plan constancia back into assignments structure that the calendar needs
  const assignments = plans.map((p) => ({
    startDate: p.startDate,
    endDate: p.endDate,
    daysPerWeek: p.daysPerWeek,
  }));

  const loading = loadingCompletions || loadingPlans;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // La app se lanzó en Marzo 2026 (mes 2 en Date de JS)
  const isMinMonth = year === 2026 && month <= 2;

  const prevMonth = () => {
    if (isMinMonth) return;
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const nextMonth = () =>
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const monthLabel = currentMonth.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
  const monthLabelCapitalized =
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first

  const d = new Date();
  const todayStr =
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");

  // Build a Set of 'YYYY-MM-DD' strings for completed dates
  const completedDates: Set<string> = new Set(
    completions.map((c) => c.completedAt.slice(0, 10)),
  );

  // Calculate expected workouts and attendance percentage for the CURRENT WEEK (Monday-Sunday)
  const calculateWeekAttendance = () => {
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
    const thisWeekCompletions = completions.filter((c) => {
      const completedDate = new Date(c.completedAt);
      return completedDate >= startOfWeek && completedDate <= endOfWeek;
    });

    // Find active assignment for this week
    let expectedDays = 0;
    for (const assignment of assignments) {
      const assignStart = new Date(assignment.startDate);
      const assignEnd = new Date(assignment.endDate);

      // Check if assignment is active this week
      if (assignEnd >= startOfWeek && assignStart <= endOfWeek) {
        expectedDays = assignment.daysPerWeek;
        break; // Use first active assignment
      }
    }

    const percentage =
      expectedDays > 0
        ? Math.round((thisWeekCompletions.length / expectedDays) * 100)
        : 0;

    return {
      expected: expectedDays,
      completed: thisWeekCompletions.length,
      percentage: Math.min(percentage, 100), // Cap at 100%
    };
  };

  const attendance = calculateWeekAttendance();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
      {/* Month navigation */}
      <div className="flex justify-between items-center mb-4">
        <p className="font-semibold text-text-main dark:text-white">
          {monthLabelCapitalized}
        </p>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            disabled={isMinMonth}
            className={`p-1 rounded-full ${
              isMinMonth
                ? "opacity-30 cursor-not-allowed"
                : "hover:bg-slate-100 dark:hover:bg-slate-700 text-text-muted"
            }`}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextMonth}
            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-text-muted"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-y-4 gap-x-2 text-center mb-4">
        {WEEK_DAYS.map((d, i) => (
          <div key={i} className="text-xs text-text-muted font-medium">
            {d}
          </div>
        ))}

        {/* Leading empty cells */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Day cells */}
        {loading
          ? Array.from({ length: daysInMonth }).map((_, i) => (
              <div key={i} className="flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 animate-pulse" />
              </div>
            ))
          : Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = dateStr === todayStr;
              const isCompleted = completedDates.has(dateStr);

              if (isToday) {
                return (
                  <div key={day} className="flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-medium shadow-md shadow-emerald-200 dark:shadow-none">
                      {day}
                    </div>
                  </div>
                );
              }
              if (isCompleted) {
                return (
                  <div key={day} className="flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium shadow-md shadow-blue-200 dark:shadow-none">
                      {day}
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={day}
                  className="text-sm font-medium text-text-main dark:text-white py-1 flex items-center justify-center"
                >
                  {day}
                </div>
              );
            })}
      </div>

      {/* Attendance Stats */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-700 mt-2">
        {attendance.expected > 0 ? (
          /* Two-column: left = content, right = mascot spanning full height */
          <div className="flex items-stretch gap-3">
            {/* Left: title + bar + details */}
            <div className="flex-1 flex flex-col justify-between gap-2">
              {/* Title row: icon + label + percentage badge */}
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-primary flex-shrink-0" />
                <span className="text-sm font-medium text-text-main dark:text-slate-300">
                  Constancia de la semana
                </span>
                <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  {attendance.percentage}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full transition-all duration-700 rounded-full bg-blue-500"
                  style={{ width: `${attendance.percentage}%` }}
                />
              </div>

              {/* Details */}
              <p className="text-xs text-text-muted dark:text-slate-400">
                <span className="font-semibold text-text-main dark:text-slate-300">
                  {attendance.completed} de {attendance.expected}
                </span>{" "}
                entrenamientos completados esta semana
              </p>
            </div>

            {/* Right: mascot spanning full height */}
            <div className="flex-shrink-0 w-14 self-stretch flex items-center justify-center">
              {attendance.percentage >= 100 ? (
                <img
                  src="/contento.webp"
                  alt="¡Semana completa!"
                  className="w-full h-full object-contain drop-shadow-md"
                  title="¡Semana completa! 🏆"
                />
              ) : attendance.completed > 0 ? (
                <img
                  src="/neutro.webp"
                  alt="En progreso"
                  className="w-full h-full object-contain drop-shadow-md"
                  title="¡Vas bien, seguí entrenando!"
                />
              ) : (
                <img
                  src="/triste.webp"
                  alt="Sin entrenar"
                  className="w-full h-full object-contain drop-shadow-md"
                  title="¡Te estamos esperando!"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Info size={18} className="text-slate-400" />
            <p className="text-sm text-text-muted dark:text-slate-400">
              Sin plan activo esta semana
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
