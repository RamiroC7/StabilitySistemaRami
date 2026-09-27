import { forwardRef, useState } from "react";
import { LineChart, Trophy } from "lucide-react";
import type { FeedbackData } from "@/hooks/useFeedbackData";

interface FeedbackCardProps {
  studentName: string;
  studentPhotoUrl: string | null;
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

// Los kg vienen crudos de la DB (input del alumno, o el 1RM estimado por
// Epley con 2 decimales) — redondear a 2 decimales y dejar que Number
// elimine ceros de sobra evita mostrar cosas como "82.500000000000001kg" o
// "82.00kg" por errores de punto flotante en el camino.
function formatKg(kg: number): string {
  return String(Math.round(kg * 100) / 100);
}

// Trunca con "…" en JS en vez de `overflow-hidden`/`text-overflow:ellipsis`
// en CSS: html2canvas corrompe visualmente cualquier texto con
// overflow:hidden (aparece "fantasma", con una franja clara cruzando las
// letras — bug confirmado empíricamente, no depende del color de texto, del
// fondo ni del border-radius del contenedor). Cortar el string antes de
// renderizarlo evita el problema de raíz.
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

// Tarjeta de resumen de rendimiento, pensada para ser capturada con
// html2canvas (ver FeedbackModal). Usa solo clases Tailwind con colores
// estáticos (sin variables CSS ni `gap` en flex, que html2canvas no siempre
// respeta) para que la captura sea fiel al resultado en pantalla. El
// gradiente del header usa los mismos azules de marca que la constancia en
// PDF (PlanPDFTemplate.tsx), para que ambos documentos se vean consistentes.
const FeedbackCard = forwardRef<HTMLDivElement, FeedbackCardProps>(
  ({ studentName, studentPhotoUrl, data }, ref) => {
    const {
      periodLabel,
      rangeLabel,
      useSegmentedAttendance,
      expectedSessions,
      completedSessions,
      attendancePercentage,
      attendanceLevel,
      avgMinutesPerSession,
      avgRpe,
      exerciseProgress,
    } = data;

    const attendanceColor =
      attendanceLevel === "complete" ? "text-emerald-600" : "text-amber-600";
    const attendanceFillColor =
      attendanceLevel === "complete" ? "bg-emerald-500" : "bg-amber-500";

    // Si la foto falla (URL vencida, sin CORS, etc.) se cae al ícono en vez
    // de dejar el ícono de imagen rota — tanto en pantalla como en la
    // descarga/captura con html2canvas.
    const [photoFailed, setPhotoFailed] = useState(false);
    const showPhoto = studentPhotoUrl && !photoFailed;

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
            background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
          }}
        >
          <div className="flex items-center min-w-0">
            {showPhoto ? (
              // background-image + background-size:cover en vez de <img
              // object-cover>: html2canvas no soporta bien object-fit (la
              // imagen se renderiza en su tamaño natural sin recortar,
              // "tapando" el título al exportar) pero sí recorta bien un
              // fondo con background-size:cover. El <img oculto de abajo
              // es solo para detectar onError, ya que un background-image
              // roto no dispara ningún evento.
              <div
                className="w-8 h-8 mr-2.5 rounded-full bg-white/20 bg-cover bg-center shrink-0"
                style={{ backgroundImage: `url('${studentPhotoUrl}')` }}
              />
            ) : (
              <div className="w-8 h-8 mr-2.5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <LineChart size={16} strokeWidth={2.5} />
              </div>
            )}
            {studentPhotoUrl && (
              <img
                src={studentPhotoUrl}
                alt=""
                crossOrigin="anonymous"
                onError={() => setPhotoFailed(true)}
                style={{ display: "none" }}
              />
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold leading-tight whitespace-nowrap">
                Feedback
              </h1>
              <p className="text-[11px] text-white/80 mt-0.5 whitespace-nowrap">
                {truncateText(`${studentName} · ${rangeLabel}`, 34)}
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
                expectedSessions > 0 && attendanceLevel === "partial"
                  ? "text-amber-600"
                  : "text-slate-400"
              }`}
            >
              {expectedSessions > 0 && attendanceLevel === "partial"
                ? "Asistencia parcial"
                : "Asistencia"}
            </p>
            {expectedSessions === 0 ? (
              // Sin ningún plan con fecha vigente en este período: no hay
              // contra qué medir un "esperado", mostrar "3/0 · 100%" sería
              // engañoso (no completó "el período entero", no había nada
              // asignado para completar).
              <>
                <p className="text-xl font-extrabold text-slate-900">
                  {completedSessions} {completedSessions === 1 ? "entrenamiento" : "entrenamientos"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {completedSessions > 0
                    ? "Sin plan asignado en este período, pero entrenó igual."
                    : "Sin plan asignado en este período."}
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
          </section>

          {/* Tiempo promedio por entrenamiento */}
          <section className="py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Tiempo promedio por entrenamiento
            </p>
            {completedSessions === 0 ? (
              <p className="text-sm text-slate-400">
                Sin entrenamientos registrados en este período.
              </p>
            ) : avgMinutesPerSession != null ? (
              <>
                <p className="text-xl font-extrabold text-slate-900">
                  {avgMinutesPerSession} min
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  En promedio, cada sesión duró {avgMinutesPerSession} minutos.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                Sin datos de duración en este período.
              </p>
            )}
          </section>

          {/* Progreso de fuerza */}
          <section className="py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Progreso de fuerza
            </p>
            {exerciseProgress.length === 0 ? (
              <p className="text-sm text-slate-400">
                Sin registros de peso en este período.
              </p>
            ) : (
              exerciseProgress.map((ex) => (
                <div key={ex.exerciseName} className="mb-2">
                  <p className="text-xs font-bold text-slate-500">
                    {ex.exerciseName}
                  </p>
                  <p className="text-lg font-extrabold text-slate-900 flex items-center flex-wrap">
                    {ex.currentKg != null ? `${formatKg(ex.currentKg)}kg` : "—"}
                    {ex.currentReps != null ? ` × ${ex.currentReps}` : ""}
                    {ex.isRecord && (
                      <span className="ml-2 inline-flex items-center text-xs font-bold text-emerald-600">
                        <Trophy size={12} strokeWidth={2.5} className="mr-1" />
                        Récord del período
                      </span>
                    )}
                  </p>
                  {ex.previousKg != null && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Antes: {formatKg(ex.previousKg)}kg
                      {ex.previousReps != null ? ` × ${ex.previousReps}` : ""}
                    </p>
                  )}
                </div>
              ))
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
