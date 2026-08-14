import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useStudentProfile,
  calculateAge,
  GOAL_LABELS,
  EXPERIENCE_LABELS,
  ACTIVITY_LABELS,
  GENDER_LABELS,
  PLAN_STATUS_LABELS,
} from "@/hooks/useStudentProfile";
import type {
  StudentProfile as StudentProfileType,
  AssignedPlan,
} from "@/hooks/useStudentProfile";
import {
  useStudentConstancia,
  MOOD_LABELS,
  MOOD_EMOJIS,
  INITIAL_MOOD_LABELS,
  INITIAL_MOOD_EMOJIS,
} from "@/hooks/useStudentConstancia";
import {
  useExerciseWeightLogs,
  type ExerciseWeightLog,
} from "@/hooks/useExerciseWeightLogs";
import WorkoutCalendar from "@/components/WorkoutCalendar";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { formatDateLocal } from "@/lib/utils";
import { detectRpeAlert } from "@/lib/rpeHelpers";
import PlanPreview from "@/features/library/PlanPreview";
import ConfirmActionModal from "@/components/ConfirmActionModal";
import { MacrocycleTab } from "@/components/MacrocycleTab";

// ── Skeleton ───────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark animate-pulse">
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
            {/* Left Column Skeleton */}
            <div className="flex flex-col gap-6">
              <div className="bg-white dark:bg-card-dark rounded-2xl p-6 h-80">
                <div className="flex flex-col items-center">
                  <div className="h-28 w-28 rounded-full bg-gray-200 mb-4" />
                  <div className="h-6 bg-gray-200 rounded w-40 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                </div>
              </div>
              <div className="bg-white dark:bg-card-dark rounded-2xl p-6 h-64">
                <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 bg-gray-100 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
            {/* Right Column Skeleton */}
            <div className="bg-white dark:bg-card-dark rounded-2xl h-96" />
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Tab type ───────────────────────────────────────────────────────────────

type TabKey =
  | "general"
  | "historial"
  | "constancia"
  | "progreso"
  | "macrociclo";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  {
    key: "general",
    label: "Entrenamiento y Objetivos",
    icon: "fitness_center",
  },
  { key: "historial", label: "Historial", icon: "history" },
  { key: "constancia", label: "Constancia", icon: "calendar_month" },
  { key: "progreso", label: "Progreso", icon: "monitoring" },
  { key: "macrociclo", label: "Macrociclo", icon: "view_timeline" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("54")) {
    if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
    cleaned = "549" + cleaned;
  }
  return cleaned;
}

function formatInstagramUsername(instagram: string): string {
  return instagram.replace(/^@/, "").trim();
}

function rpeColor(rpe: number): string {
  if (rpe <= 3)
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400";
  if (rpe <= 6)
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
}

// ── SVG icons ──────────────────────────────────────────────────────────────

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

// ── Info row ───────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  colorClass = "text-sky-500", // Default to sky blue
  bgClass = "bg-sky-50 dark:bg-sky-950/30",
}: {
  icon: string;
  label: string;
  value: string | null | undefined;
  colorClass?: string;
  bgClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 shadow-sm">
      <div
        className={`w-10 h-10 rounded-lg ${bgClass} flex items-center justify-center shrink-0`}
      >
        <span
          className={`material-symbols-outlined ${colorClass} text-[20px] filled`}
        >
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mb-0.5">
          {label}
        </p>
        <p className="text-sm font-bold text-slate-900 dark:text-white break-words leading-snug">
          {value || (
            <span className="text-slate-300 font-normal italic">
              Sin especificar
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function PhoneRow({ phone }: { phone: string | null }) {
  return (
    <InfoRow
      icon="phone"
      label="Teléfono"
      value={phone}
      colorClass="text-sky-500"
      bgClass="bg-sky-50 dark:bg-sky-950/30"
    />
  );
}

function InstagramRow({ instagram }: { instagram: string | null }) {
  const username = instagram ? formatInstagramUsername(instagram) : null;
  return (
    <InfoRow
      icon="alternate_email"
      label="Instagram"
      value={username ? `@${username}` : null}
      colorClass="text-sky-500"
      bgClass="bg-sky-50 dark:bg-sky-950/30"
    />
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  unit,
  colorClass = "text-sky-500",
  bgClass = "bg-sky-50 dark:bg-sky-950/30",
}: {
  icon: string;
  label: string;
  value: string | number | null;
  unit?: string;
  colorClass?: string;
  bgClass?: string;
}) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl p-3.5 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-lg ${bgClass} flex items-center justify-center shrink-0`}
      >
        <span
          className={`material-symbols-outlined ${colorClass} text-[20px] filled`}
        >
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mb-0.5">
          {label}
        </p>
        <p className="text-sm font-bold text-slate-900 dark:text-white break-words whitespace-normal leading-snug">
          {value != null ? (
            <>
              {value}
              {unit && (
                <span className="text-xs font-medium text-slate-400 ml-0.5">
                  {unit}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-200 font-normal italic">—</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ── General tab ────────────────────────────────────────────────────────────

function GeneralTab({ student }: { student: StudentProfileType }) {
  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-card-dark rounded-xl p-5 shadow-card border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <span className="material-symbols-outlined text-[18px] filled">
              person
            </span>
          </div>
          Información Personal
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard
            icon="event"
            label="Nacimiento"
            value={formatDateLocal(student.birthDate)}
            colorClass="text-sky-500"
            bgClass="bg-sky-50 dark:bg-sky-950/30"
          />
          <StatCard
            icon="wc"
            label="Género"
            value={student.gender ? GENDER_LABELS[student.gender] : null}
            colorClass="text-sky-500"
            bgClass="bg-sky-50 dark:bg-sky-950/30"
          />
          <PhoneRow phone={student.phone || null} />
          <InstagramRow instagram={student.instagram || null} />
        </div>
      </div>
      <div className="bg-white dark:bg-card-dark rounded-xl p-5 shadow-card border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <span className="material-symbols-outlined text-[18px] filled">
              fitness_center
            </span>
          </div>
          Entrenamiento y Objetivos
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard
            icon="target"
            label="Objetivo"
            value={
              student.primaryGoal ? GOAL_LABELS[student.primaryGoal] : null
            }
            colorClass="text-sky-500"
            bgClass="bg-sky-50 dark:bg-sky-950/30"
          />
          <StatCard
            icon="military_tech"
            label="Nivel"
            value={
              student.trainingExperience
                ? EXPERIENCE_LABELS[student.trainingExperience]
                : null
            }
            colorClass="text-sky-500"
            bgClass="bg-sky-50 dark:bg-sky-950/30"
          />
          <StatCard
            icon="bolt"
            label="Actividad"
            value={
              student.activityLevel
                ? ACTIVITY_LABELS[student.activityLevel]
                : null
            }
            colorClass="text-sky-500"
            bgClass="bg-sky-50 dark:bg-sky-950/30"
          />
          <StatCard
            icon="sports_basketball"
            label="Deporte"
            value={student.sports || null}
            colorClass="text-sky-500"
            bgClass="bg-sky-50 dark:bg-sky-950/30"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-card-dark rounded-xl p-5 shadow-card border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <span className="material-symbols-outlined text-[18px] filled">
              medical_information
            </span>
          </div>
          Información Médica
        </h3>

        <div className="grid grid-cols-1 gap-3">
          <InfoRow
            icon="warning"
            label="Lesiones Previas"
            value={student.previousInjuries}
            colorClass="text-sky-500"
            bgClass="bg-sky-50 dark:bg-sky-950/30"
          />
          <InfoRow
            icon="health_and_safety"
            label="Condiciones Médicas"
            value={student.medicalConditions}
            colorClass="text-sky-500"
            bgClass="bg-sky-50 dark:bg-sky-950/30"
          />
        </div>
      </div>
    </div>
  );
}

// ── Historial tab ──────────────────────────────────────────────────────────

function HistorialTab({ plans }: { plans: AssignedPlan[] }) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  if (plans.length === 0) {
    return (
      <div className="bg-white dark:bg-card-dark rounded-2xl p-12 shadow-card border border-gray-200 dark:border-gray-700 text-center">
        <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4 block">
          assignment
        </span>
        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">
          Sin planificaciones asignadas
        </h3>
        <p className="text-sm text-gray-500">
          Este alumno no tiene planes de entrenamiento asignados aún.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">
            toc
          </span>
          Historial de Planificaciones
        </h3>
        {plans.map((plan) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const endDate = new Date(plan.endDate + "T00:00:00");
          endDate.setHours(0, 0, 0, 0);

          const isOverdue = plan.status === "active" && today > endDate;
          const displayStatus = isOverdue ? "vencido" : plan.status;
          const displayLabel = isOverdue
            ? "Vencido"
            : PLAN_STATUS_LABELS[plan.status] || plan.status;

          const statusColor =
            displayStatus === "active"
              ? "bg-green-50 text-green-700 border-green-200"
              : displayStatus === "completed"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : displayStatus === "paused"
                  ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                  : "bg-gray-50 text-gray-700 border-gray-200";

          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.planId)}
              className="bg-white dark:bg-card-dark rounded-xl p-5 shadow-card border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                    {plan.planTitle}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {plan.daysPerWeek} días/semana • {plan.totalWeeks} semanas
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColor}`}
                  >
                    {displayLabel}
                  </span>
                  <span className="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors text-[20px]">
                    open_in_new
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    calendar_today
                  </span>
                  {new Date(plan.startDate + "T00:00:00").toLocaleDateString(
                    "es-AR",
                  )}
                </span>
                <span>→</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    event
                  </span>
                  {new Date(plan.endDate + "T00:00:00").toLocaleDateString(
                    "es-AR",
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {selectedPlanId && (
        <PlanPreview
          planId={selectedPlanId}
          onClose={() => setSelectedPlanId(null)}
        />
      )}
    </>
  );
}

// ── Constancia tab ─────────────────────────────────────────────────────────

function ConstanciaTab({ studentId }: { studentId: string }) {
  const { plans, isLoading } = useStudentConstancia(studentId);
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [rpeAlert, setRpeAlert] = useState<"high" | "low" | null>(null);

  useEffect(() => {
    const loadRpeAlert = async () => {
      const { data, error } = await supabase
        .from("workout_completions")
        .select("rpe")
        .eq("student_id", studentId)
        .order("completed_at", { ascending: false })
        .limit(3);

      if (!error && data && data.length > 0) {
        const rpes = (data as { rpe: number | null }[]).map((d) => d.rpe);
        const alert = detectRpeAlert(rpes);
        setRpeAlert(alert);
      }
    };

    if (studentId) {
      loadRpeAlert();
    }
  }, [studentId]);

  // Set initial open plan when data loads (only once)
  useEffect(() => {
    if (!isLoading && !hasInitialized && plans.length > 0) {
      const firstWithSessions = plans.find((p) => p.sessions.length > 0);
      if (firstWithSessions) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpenPlan(firstWithSessions.assignmentId);
      }
      setHasInitialized(true);
    }
  }, [isLoading, plans, hasInitialized]);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-card-dark rounded-2xl h-20 border border-gray-200 dark:border-gray-700"
          />
        ))}
      </div>
    );
  }

  if (plans.length === 0 || plans.every((p) => p.sessions.length === 0)) {
    return (
      <div className="space-y-4">
        <WorkoutCalendar studentId={studentId} />
        <div className="bg-white dark:bg-card-dark rounded-2xl p-12 shadow-card border border-gray-200 dark:border-gray-700 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4 block">
            calendar_month
          </span>
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">
            Sin sesiones registradas
          </h3>
          <p className="text-sm text-gray-500">
            Aquí aparecerán los entrenamientos completados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WorkoutCalendar studentId={studentId} />

      {/* RPE Alert */}
      {rpeAlert && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border ${
            rpeAlert === "high"
              ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
              : "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[22px] mt-0.5 ${
              rpeAlert === "high" ? "text-red-500" : "text-amber-500"
            }`}
          >
            {rpeAlert === "high" ? "warning" : "info"}
          </span>
          <div>
            <p
              className={`font-bold text-sm ${
                rpeAlert === "high"
                  ? "text-red-700 dark:text-red-400"
                  : "text-amber-700 dark:text-amber-400"
              }`}
            >
              {rpeAlert === "high"
                ? "⚠️ 3 sesiones consecutivas con RPE muy alto (≥8)"
                : "ℹ️ 3 sesiones consecutivas con RPE muy bajo (≤3)"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {rpeAlert === "high"
                ? "Considera revisar la carga de entrenamiento o consultar con el alumno sobre su recuperación."
                : "Puede indicar que el plan es demasiado ligero o que el alumno no está registrando el esfuerzo real."}
            </p>
          </div>
        </div>
      )}

      <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">
          calendar_month
        </span>
        Registro de Entrenamientos
      </h3>

      {plans.map((plan) => {
        const isOpen = openPlan === plan.assignmentId;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(plan.endDate + "T00:00:00");
        endDate.setHours(0, 0, 0, 0);

        const isOverdue = plan.status === "active" && today > endDate;
        const displayStatus = isOverdue ? "vencido" : plan.status;
        const displayLabel = isOverdue
          ? "Vencido"
          : PLAN_STATUS_LABELS[plan.status] || plan.status;

        const statusColor =
          displayStatus === "active"
            ? "bg-green-50 text-green-700 border-green-200"
            : displayStatus === "completed"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : displayStatus === "paused"
                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                : "bg-gray-50 text-gray-700 border-gray-200";

        return (
          <div
            key={plan.assignmentId}
            className="bg-white dark:bg-card-dark rounded-2xl shadow-card border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Plan header — toggle */}
            <button
              onClick={() => setOpenPlan(isOpen ? null : plan.assignmentId)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {plan.planTitle}
                  </h4>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${statusColor}`}
                  >
                    {displayLabel}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(plan.startDate + "T00:00:00").toLocaleDateString(
                    "es-AR",
                  )}{" "}
                  →{" "}
                  {new Date(plan.endDate + "T00:00:00").toLocaleDateString(
                    "es-AR",
                  )}{" "}
                  • {plan.sessions.length} sesión
                  {plan.sessions.length !== 1 ? "es" : ""}
                </p>
              </div>
              <span
                className={`material-symbols-outlined text-gray-400 text-[20px] ml-4 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                expand_more
              </span>
            </button>

            {/* Sessions list */}
            {isOpen && (
              <div className="border-t border-gray-100 dark:border-gray-800">
                {plan.sessions.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    Sin sesiones completadas en este plan.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_72px_72px_1fr] gap-2 px-5 py-2 bg-gray-50 dark:bg-gray-800/50">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                        Fecha
                      </span>
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">
                        Inicio
                      </span>
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">
                        RPE
                      </span>
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">
                        Al finalizar
                      </span>
                    </div>

                    {plan.sessions.map((session) => (
                      <div key={session.id} className="flex flex-col">
                        {/* Fila principal */}
                        <div className="grid grid-cols-[1fr_72px_72px_1fr] gap-2 items-center px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                          {/* Fecha + día */}
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {new Date(session.completedAt).toLocaleDateString(
                                "es-AR",
                                { day: "2-digit", month: "short" },
                              )}
                            </p>
                            <p className="text-xs text-gray-400">
                              Día {session.dayNumber} •{" "}
                              {new Date(session.completedAt).toLocaleTimeString(
                                "es-AR",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                              {session.durationMinutes != null && (
                                <> • {session.durationMinutes} min</>
                              )}
                            </p>
                          </div>

                          {/* Estado Inicial */}
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            {session.initialMood ? (
                              <>
                                <span className="text-xl leading-none">
                                  {INITIAL_MOOD_EMOJIS[session.initialMood] ??
                                    "❓"}
                                </span>
                                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 text-center">
                                  {INITIAL_MOOD_LABELS[session.initialMood] ??
                                    session.initialMood}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-300 italic">
                                —
                              </span>
                            )}
                          </div>

                          {/* RPE */}
                          <div className="flex items-center justify-center">
                            {session.rpe != null ? (
                              <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-full ${rpeColor(session.rpe)}`}
                              >
                                {session.rpe}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300 italic">
                                —
                              </span>
                            )}
                          </div>

                          {/* Mood Final */}
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            {session.mood ? (
                              <>
                                <span className="text-xl leading-none">
                                  {MOOD_EMOJIS[session.mood] ?? "❓"}
                                </span>
                                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 text-center">
                                  {MOOD_LABELS[session.mood] ?? session.mood}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-300 italic">
                                —
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Comentario (si existe) */}
                        {session.moodComment && (
                          <div className="px-5 pb-3 -mt-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2 italic border-l-2 border-gray-200 dark:border-gray-700">
                              💬 {session.moodComment}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Fuerza Tab – LogRow component ─────────────────────────────────────────

function LogRow({
  log,
  onDelete,
}: {
  log: ExerciseWeightLog;
  onDelete: (log: ExerciseWeightLog) => void;
}) {
  const displayRm =
    log.calculated_rm != null ? log.calculated_rm.toFixed(2) : "-";

  return (
    <tr>
      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300 text-sm font-medium">
        {new Date(log.logged_at).toLocaleDateString("es-AR")}
      </td>
      <td className="py-2 pr-4 text-gray-500 dark:text-gray-400 text-xs">
        Día {log.plan_day_number} — {log.plan_day_name}
      </td>
      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300 text-sm font-medium">
        {log.series}
      </td>
      <td className="py-2 pr-4">
        <div className="flex flex-wrap gap-1">
          {log.sets_detail.map((s) => (
            <span
              key={s.set_number}
              className="text-[10px] bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 text-gray-600 dark:text-gray-300 font-medium"
            >
              S{s.set_number}: {s.actual_reps ?? s.target_reps} reps
              {s.kg != null ? ` @ ${s.kg}kg` : ""}
            </span>
          ))}
        </div>
      </td>
      <td className="py-2">
        <div className="flex flex-col gap-1">
          {/* RM Calculado Automáticamente */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-primary">
              {displayRm} kg
            </span>
            {log.calculated_rm != null && (
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                Auto
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="py-2 pl-2">
        <button
          onClick={() => onDelete(log)}
          title="Eliminar registro"
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </td>
    </tr>
  );
}

// ── Fuerza Tab component ───────────────────────────────────────────────────

function FuerzaTab({ studentId }: { studentId: string | undefined }) {
  const { groups, loading, deleteWeightLog } = useExerciseWeightLogs(studentId);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ExerciseWeightLog | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteWeightLog(pendingDelete.id);
    } catch (err) {
      console.error("Error eliminando registro:", err);
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">
        <span className="material-symbols-outlined text-4xl mb-3 block animate-spin">
          hourglass_empty
        </span>
        Cargando registros de fuerza...
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
          fitness_center
        </span>
        <p className="text-gray-500 text-sm">
          No hay registros de peso aún. Se generarán cuando el alumno complete
          ejercicios con "Escribir Peso" activado.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {groups.map((group) => {
          const isOpen = openGroup === group.exercise_name;

          const chartData = group.logs
            .filter((l) => l.calculated_rm != null)
            .map((l) => ({
              date: new Date(l.logged_at).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "short",
              }),
              rm: l.calculated_rm,
            }));

          return (
            <div
              key={group.exercise_name}
              className="bg-white dark:bg-card-dark rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
            >
              {/* Acordeón header */}
              <button
                onClick={() =>
                  setOpenGroup(isOpen ? null : group.exercise_name)
                }
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    fitness_center
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {group.exercise_name}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">
                    {group.logs.length} registro
                    {group.logs.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <span
                  className={`material-symbols-outlined text-gray-400 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>

              {/* Contenido del acordeón */}
              {isOpen && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 space-y-6">
                  {/* Tabla de registros */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                          <th className="pb-2 pr-4">Fecha</th>
                          <th className="pb-2 pr-4">Día del Plan</th>
                          <th className="pb-2 pr-4">Series</th>
                          <th className="pb-2 pr-4">Detalle (Sets)</th>
                          <th className="pb-2">RM Calculado (kg)</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {group.logs.map((log) => (
                          <LogRow
                            key={log.id}
                            log={log}
                            onDelete={setPendingDelete}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Gráfico RM vs Fecha */}
                  {chartData.length >= 2 && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                        Evolución del RM
                      </p>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={chartData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f0"
                          />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "#9ca3af" }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#9ca3af" }}
                            unit=" kg"
                          />
                          <Tooltip
                            formatter={(value) => [`${value} kg`, "RM"]}
                            labelStyle={{ color: "#1f2937" }}
                          />
                          <Line
                            type="monotone"
                            dataKey="rm"
                            stroke="#0056b3"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: "#0056b3" }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmActionModal
        isOpen={!!pendingDelete}
        onClose={() => !isDeleting && setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar registro"
        description={
          pendingDelete
            ? `¿Eliminar el registro del ${new Date(pendingDelete.logged_at).toLocaleDateString("es-AR")} para "${pendingDelete.exercise_name}"? Esta acción no se puede deshacer.`
            : ""
        }
        confirmText={isDeleting ? "Eliminando..." : "Eliminar"}
        variant="danger"
      />
    </>
  );
}

// ── Progreso tab ───────────────────────────────────────────────────────────

function ProgresoTab({ studentId }: { studentId: string | undefined }) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-card-dark rounded-2xl p-6 shadow-card border border-gray-200 dark:border-gray-700">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">
            fitness_center
          </span>
          Rendimiento y Fuerza
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Progreso de Marcas Personales (PR)
        </p>

        <FuerzaTab studentId={studentId} />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function StudentProfile() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { student, plans, isLoading, error } = useStudentProfile(studentId);
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleArchive = async () => {
    if (!studentId) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("student_profiles")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", studentId);

      if (error) throw error;

      setShowArchiveModal(false);
      // Recargar la página para mostrar el nuevo estado
      window.location.reload();
    } catch (err) {
      console.error("Error archiving student:", err);
      alert("Error al archivar el alumno. Intenta de nuevo.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnarchive = async () => {
    if (!studentId) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("student_profiles")
        .update({ is_archived: false })
        .eq("id", studentId);

      if (error) throw error;

      setShowUnarchiveModal(false);
      // Recargar la página para mostrar el nuevo estado
      window.location.reload();
    } catch (err) {
      console.error("Error unarchiving student:", err);
      alert("Error al desarchivar el alumno. Intenta de nuevo.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!studentId) return;

    setActionLoading(true);
    try {
      // Usar supabase.functions.invoke() en lugar de fetch() manual
      // El cliente maneja el token automáticamente, igual que las queries normales
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "delete-student",
        { body: { studentId } },
      );

      if (fnError) {
        throw new Error(fnError.message || "Error al eliminar el alumno");
      }
      if (!result?.success) {
        throw new Error(result?.error || "Error al eliminar el alumno");
      }

      setShowDeleteModal(false);
      navigate("/inicio");
    } catch (err) {
      console.error("Error deleting student:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Error al eliminar el alumno. Intenta de nuevo.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) return <ProfileSkeleton />;

  if (error || !student) {
    return (
      <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined text-6xl text-red-300 mb-4 block">
              error
            </span>
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
              {error || "Alumno no encontrado"}
            </h2>
            <button
              onClick={() => navigate("/inicio")}
              className="mt-4 px-6 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Volver
            </button>
          </div>
        </main>
      </div>
    );
  }

  const avatarUrl = student.profileImageUrl || student.profileImage || null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-card-dark">
      <main className="flex-1 overflow-y-auto">
        <div className="w-full">
          {/* Back Button */}
          <button
            onClick={() => navigate("/inicio")}
            className="w-full px-4 lg:px-6 h-16 flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all text-sm font-bold group border-b border-gray-200 dark:border-gray-700"
          >
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm border border-slate-100 dark:border-slate-800">
              <span className="material-symbols-outlined text-[20px]">
                arrow_back
              </span>
            </div>
            Volver a Alumnos
          </button>

          <div className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">
              {/* Left Column - Student Info */}
              <div className="flex flex-col border-r border-gray-200 dark:border-gray-700">
                {/* Profile Card */}
                <div className="bg-white dark:bg-card-dark p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-4">
                      <div
                        className="h-28 w-28 rounded-full bg-gray-200 bg-cover bg-center ring-4 ring-blue-50 dark:ring-gray-700 shadow-md"
                        style={{
                          backgroundImage: avatarUrl
                            ? `url('${avatarUrl}')`
                            : "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22system-ui%22 font-size=%2236%22 fill=%22%239ca3af%22%3E" +
                              (student.firstName?.[0]?.toUpperCase() || "?") +
                              "%3C/text%3E%3C/svg%3E')",
                        }}
                      />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      {student.fullName}
                    </h1>
                    <p className="text-sm text-gray-500 mb-4">
                      {student.birthDate
                        ? `${calculateAge(student.birthDate)} años`
                        : "Edad no especificada"}
                    </p>

                    <div className="w-full space-y-3 mb-6">
                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <span className="material-symbols-outlined text-[20px] text-primary/60">
                          email
                        </span>
                        <span className="truncate">{student.email}</span>
                      </div>
                      {student.phone && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-[20px] text-primary/60">
                              phone
                            </span>
                            <span>{student.phone}</span>
                          </div>
                          <button
                            onClick={() =>
                              window.open(
                                `https://wa.me/${formatPhoneForWhatsApp(student.phone!)}?text=Hola!`,
                                "_blank",
                              )
                            }
                            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                            style={{ background: "#25D366" }}
                          >
                            <WhatsAppIcon />
                            Contactar por WhatsApp
                          </button>
                        </div>
                      )}
                      {student.instagram && (
                        <div className="flex flex-col gap-2 pt-1">
                          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-[20px] text-primary/60">
                              link
                            </span>
                            <span className="truncate">
                              @{formatInstagramUsername(student.instagram)}
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              window.open(
                                `https://instagram.com/${formatInstagramUsername(student.instagram!)}`,
                                "_blank",
                              )
                            }
                            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                            style={{
                              background:
                                "linear-gradient(135deg, #E1306C 0%, #F56040 100%)",
                            }}
                          >
                            <InstagramIcon />
                            Ver Perfil de Instagram
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Physical Stats */}
                <div className="bg-white dark:bg-card-dark p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary text-[20px]">
                      straighten
                    </span>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Datos Físicos
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <span className="material-symbols-outlined text-primary text-[20px] mb-1 block">
                        monitor_weight
                      </span>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">
                        Peso
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white break-words whitespace-normal leading-tight mt-1">
                        {student.weightKg
                          ? `${Number(student.weightKg).toFixed(1)} kg`
                          : "—"}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <span className="material-symbols-outlined text-primary text-[20px] mb-1 block">
                        height
                      </span>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">
                        Altura
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white break-words whitespace-normal leading-tight mt-1">
                        {student.heightCm ? `${student.heightCm} cm` : "—"}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <span className="material-symbols-outlined text-primary text-[20px] mb-1 block">
                        sports
                      </span>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">
                        Deporte
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white break-words whitespace-normal leading-tight mt-1">
                        {student.sports || "—"}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <span className="material-symbols-outlined text-primary text-[20px] mb-1 block">
                        trending_up
                      </span>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">
                        Nivel
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white break-words whitespace-normal leading-tight mt-1">
                        {student.trainingExperience
                          ? EXPERIENCE_LABELS[student.trainingExperience]
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="bg-white dark:bg-card-dark p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary text-[20px]">
                      settings
                    </span>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Acciones
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {student.isArchived ? (
                      <button
                        onClick={() => setShowUnarchiveModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 font-medium rounded-xl transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          unarchive
                        </span>
                        Desarchivar Alumno
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowArchiveModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          archive
                        </span>
                        Archivar Alumno
                      </button>
                    )}
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-medium rounded-xl transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        delete
                      </span>
                      Eliminar Alumno
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column - Tabs */}
              <div className="bg-white dark:bg-card-dark overflow-hidden">
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  {TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all border-b-2 ${
                        activeTab === tab.key
                          ? "text-primary border-primary bg-blue-50/50 dark:bg-blue-900/10"
                          : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {tab.icon}
                      </span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {activeTab === "general" && <GeneralTab student={student} />}
                  {activeTab === "historial" && <HistorialTab plans={plans} />}
                  {activeTab === "constancia" && studentId && (
                    <ConstanciaTab studentId={studentId} />
                  )}
                  {activeTab === "progreso" && (
                    <ProgresoTab studentId={studentId} />
                  )}
                  {activeTab === "macrociclo" && studentId && (
                    <MacrocycleTab
                      studentId={studentId}
                      studentCreatedAt={student.createdAt}
                      studentName={student.fullName}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !actionLoading && setShowArchiveModal(false)}
          />
          <div className="relative bg-white dark:bg-card-dark rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full">
                <span className="material-symbols-outlined text-gray-600 dark:text-gray-400 text-[24px]">
                  archive
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Archivar Alumno
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              ¿Estás seguro que deseas archivar a{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {student?.fullName}
              </span>
              ? El alumno se moverá al final de la lista en /inicio y aparecerá
              en gris. Podrás seguir viendo su perfil y desarchivarlo más tarde.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowArchiveModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleArchive}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-[18px]">
                      progress_activity
                    </span>
                    Archivando...
                  </>
                ) : (
                  "Archivar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unarchive Modal */}
      {showUnarchiveModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !actionLoading && setShowUnarchiveModal(false)}
          />
          <div className="relative bg-white dark:bg-card-dark rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[24px]">
                  unarchive
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Desarchivar Alumno
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              ¿Deseas reactivar a{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {student?.fullName}
              </span>
              ? El alumno volverá a aparecer en la lista principal de /inicio
              con los demás alumnos activos.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUnarchiveModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleUnarchive}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-[18px]">
                      progress_activity
                    </span>
                    Desarchivando...
                  </>
                ) : (
                  "Desarchivar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !actionLoading && setShowDeleteModal(false)}
          />
          <div className="relative bg-white dark:bg-card-dark rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-[24px]">
                  delete_forever
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Eliminar Alumno
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              ¿Estás seguro que deseas eliminar a{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {student?.fullName}
              </span>
              ?
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-6 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">
                warning
              </span>
              <span>
                Esta acción es <strong>permanente</strong> y no se puede
                deshacer. Se eliminarán todos los datos del alumno: perfil,
                historial de entrenamientos, registros de fuerza y su cuenta de
                acceso.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-[18px]">
                      progress_activity
                    </span>
                    Eliminando...
                  </>
                ) : (
                  "Eliminar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
