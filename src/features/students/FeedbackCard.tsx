import { forwardRef } from "react";
import type { FeedbackData } from "@/hooks/useFeedbackData";

interface FeedbackCardProps {
  studentName: string;
  data: FeedbackData;
}

// RPE ideal entre 5 y 9: por debajo sugiere subir peso, por encima sugiere
// bajar intensidad (riesgo de sobreentrenamiento).
function rpeColorClass(avgRpe: number): string {
  if (avgRpe < 5) return "text-amber-600";
  if (avgRpe > 9) return "text-red-600";
  return "text-emerald-600";
}

function rpeMessage(avgRpe: number): string {
  if (avgRpe < 5) return "Sugerencia: podés subir un poco los pesos.";
  if (avgRpe > 9) return "Sugerencia: bajá la intensidad, hay riesgo de sobreentrenar.";
  return "Rango correcto, sin ajustes.";
}

// Tarjeta de resumen de rendimiento, pensada para ser capturada con
// html2canvas (ver FeedbackModal). Usa solo clases Tailwind con colores
// estáticos (sin variables CSS ni `gap` en flex, que html2canvas no siempre
// respeta) para que la captura sea fiel al resultado en pantalla.
const FeedbackCard = forwardRef<HTMLDivElement, FeedbackCardProps>(
  ({ studentName, data }, ref) => {
    const {
      periodLabel,
      rangeLabel,
      useSegmentedAttendance,
      expectedSessions,
      completedSessions,
      attendancePercentage,
      attendanceLevel,
      minutesTrained,
      avgRpe,
      weightLogStatus,
      weightLogDays,
      exerciseProgress,
    } = data;

    const attendanceColor =
      attendanceLevel === "complete" ? "text-emerald-600" : "text-amber-600";
    const attendanceFillColor =
      attendanceLevel === "complete" ? "bg-emerald-500" : "bg-amber-500";

    const exerciseNames = exerciseProgress.map((e) => e.exerciseName).join(", ");

    return (
      <div
        ref={ref}
        className="w-[320px] bg-white rounded-2xl overflow-hidden"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 text-white flex items-center justify-between"
          style={{
            background: "linear-gradient(135deg, #4338CA 0%, #7C3AED 100%)",
          }}
        >
          <div className="flex items-center min-w-0">
            <div className="w-8 h-8 mr-2.5 rounded-full bg-white/20 flex items-center justify-center text-sm shrink-0">
              🎯
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold leading-tight truncate">
                Feedback
              </h1>
              <p className="text-[11px] text-white/80 mt-0.5 truncate">
                {studentName} · {rangeLabel}
              </p>
            </div>
          </div>
          <span className="shrink-0 ml-2 text-[9px] font-bold uppercase tracking-wide bg-white/20 rounded-full px-2 py-1">
            {periodLabel}
          </span>
        </div>

        <div className="px-5 divide-y divide-slate-100">
          {/* Asistencia */}
          <section className="py-3">
            <p
              className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${
                attendanceLevel === "partial" ? "text-amber-600" : "text-slate-400"
              }`}
            >
              {attendanceLevel === "partial" ? "Asistencia parcial" : "Asistencia"}
            </p>
            {useSegmentedAttendance ? (
              <div className="flex mb-2">
                {Array.from({ length: expectedSessions }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i < expectedSessions - 1 ? "mr-1" : ""
                    } ${i < completedSessions ? attendanceFillColor : "bg-slate-100"}`}
                  />
                ))}
              </div>
            ) : (
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full ${attendanceFillColor}`}
                  style={{ width: `${attendancePercentage}%` }}
                />
              </div>
            )}
            <p className={`text-xl font-extrabold ${attendanceColor}`}>
              {completedSessions}/{expectedSessions} · {attendancePercentage}%
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {attendanceLevel === "complete"
                ? "Completaste el período entero."
                : `Entrenaste ${completedSessions} de ${expectedSessions} sesiones esperadas.`}
            </p>
          </section>

          {/* Tiempo invertido */}
          <section className="py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Tiempo invertido
            </p>
            <p className="text-xl font-extrabold text-slate-900">
              {minutesTrained} min
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Invertiste {minutesTrained} minutos en este período.
            </p>
          </section>

          {/* Registro de pesos */}
          <section className="py-3">
            <p
              className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${
                weightLogStatus === "none"
                  ? "text-red-600"
                  : weightLogStatus === "partial"
                    ? "text-amber-600"
                    : "text-slate-400"
              }`}
            >
              {weightLogStatus === "none"
                ? "Sin registro de peso"
                : weightLogStatus === "partial"
                  ? "Pesos parcial"
                  : "Registro de pesos"}
            </p>
            {weightLogStatus === "none" ? (
              <p className="text-lg font-extrabold uppercase text-red-600">
                No hubo registros de peso
              </p>
            ) : weightLogStatus === "partial" ? (
              <>
                <p className="text-xl font-extrabold text-amber-600">
                  {weightLogDays}/{completedSessions} días
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Registraste pesos algunos días del período.
                </p>
              </>
            ) : (
              <>
                {exerciseProgress.map((ex) => (
                  <p
                    key={ex.exerciseName}
                    className="text-xl font-extrabold text-slate-900"
                  >
                    {ex.previousKg != null ? `${ex.previousKg}kg → ` : ""}
                    {ex.currentKg != null ? `${ex.currentKg}kg` : "—"}
                    {ex.deltaKg != null && ex.deltaKg !== 0 && (
                      <span
                        className={`text-sm font-bold ml-2 ${
                          ex.deltaKg > 0 ? "text-emerald-600" : "text-red-500"
                        }`}
                      >
                        {ex.deltaKg > 0 ? "+" : ""}
                        {ex.deltaKg}kg
                      </span>
                    )}
                  </p>
                ))}
                <p className="text-xs text-slate-500 mt-1">
                  {exerciseProgress.some((e) => e.deltaKg != null)
                    ? `Avance en ${exerciseNames}.`
                    : `Registro en ${exerciseNames}.`}
                </p>
              </>
            )}
          </section>

          {/* RPE promedio */}
          <section className="py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              RPE promedio
            </p>
            {avgRpe != null ? (
              <>
                <p className={`text-xl font-extrabold ${rpeColorClass(avgRpe)}`}>
                  {avgRpe.toFixed(1)} / 10
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {rpeMessage(avgRpe)}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                Sin datos de RPE en este período.
              </p>
            )}
          </section>
        </div>

        <div className="px-5 py-2.5 bg-slate-50 text-center">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Generado con Stability
          </p>
        </div>
      </div>
    );
  },
);
FeedbackCard.displayName = "FeedbackCard";

export default FeedbackCard;
