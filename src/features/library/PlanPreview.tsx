import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTrainingPlanDetail } from "../../hooks/useTrainingPlans";
import { useExportPlanPDF } from "../../hooks/useExportPlanPDF";
import PlanPDFTemplate from "./components/PlanPDFTemplate";

interface PlanPreviewProps {
  planId: string;
  onClose: () => void;
}

interface TrainingPlanDay {
  id: string;
  plan_id: string;
  day_number: number;
  day_name: string;
  display_order: number;
  training_plan_exercises?: TrainingPlanExercise[];
}

interface TrainingPlanExercise {
  id: string;
  day_id: string;
  stage_id: string | null;
  stage_name: string;
  exercise_name: string;
  video_url: string | null;
  series: number;
  reps: string;
  carga: string;
  pause: string;
  notes: string | null;
  coach_instructions: string | null;
  display_order: number;
  write_weight?: boolean;
  circuit_group?: string | null;
  cardio_duration_min?: number | null;
}

const getCircuitColor = (group: string | null | undefined) => {
  if (!group) return null;
  switch (group.toUpperCase()) {
    case "A":
      return {
        badge: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/50",
        line: "bg-indigo-500 dark:bg-indigo-400",
        text: "text-indigo-600 dark:text-indigo-400",
        rowBg: "bg-indigo-50/5 dark:bg-indigo-950/10 hover:bg-indigo-50/10 dark:hover:bg-indigo-950/20",
      };
    case "B":
      return {
        badge: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-900/50",
        line: "bg-violet-500 dark:bg-violet-400",
        text: "text-violet-600 dark:text-violet-400",
        rowBg: "bg-violet-50/5 dark:bg-violet-950/10 hover:bg-violet-50/10 dark:hover:bg-violet-950/20",
      };
    case "C":
      return {
        badge: "bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-100 dark:border-fuchsia-900/50",
        line: "bg-fuchsia-500 dark:bg-fuchsia-400",
        text: "text-fuchsia-600 dark:text-fuchsia-400",
        rowBg: "bg-fuchsia-50/5 dark:bg-fuchsia-950/10 hover:bg-fuchsia-50/10 dark:hover:bg-fuchsia-950/20",
      };
    case "D":
      return {
        badge: "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-100 dark:border-teal-900/50",
        line: "bg-teal-500 dark:bg-teal-400",
        text: "text-teal-600 dark:text-teal-400",
        rowBg: "bg-teal-50/5 dark:bg-teal-950/10 hover:bg-teal-50/10 dark:hover:bg-teal-950/20",
      };
    default:
      return {
        badge: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-900/50",
        line: "bg-purple-500 dark:bg-purple-400",
        text: "text-purple-600 dark:text-purple-400",
        rowBg: "bg-purple-50/5 dark:bg-purple-950/10 hover:bg-purple-50/10 dark:hover:bg-purple-950/20",
      };
  }
};

export default function PlanPreview({ planId, onClose }: PlanPreviewProps) {
  const navigate = useNavigate();
  const { plan, loading, error } = useTrainingPlanDetail(planId);
  const { exportPDF, isExporting, templateRef, pdfData } = useExportPlanPDF();
  const [activeDay, setActiveDay] = useState(0);

  const handleEditPlan = () => {
    navigate(`/planificador?planId=${planId}&mode=edit`);
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-4xl w-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">
              Cargando plan...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-4xl w-full">
          <div className="text-center">
            <span className="material-symbols-outlined text-6xl text-red-400 mb-4">
              error
            </span>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {error || "No se pudo cargar el plan"}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const days = (plan.training_plan_days || []) as TrainingPlanDay[];
  const currentDay = days[activeDay];
  const exercises = [...(currentDay?.training_plan_exercises || [])]
    .sort((a, b) => a.display_order - b.display_order) as TrainingPlanExercise[];

  // Format dates
  const formatDate = (dateStr: string) => {
    const normalized = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
    const date = new Date(normalized);
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 flex-none">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              {plan.title}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatDate(plan.start_date)} - {formatDate(plan.end_date)} ·{" "}
              {plan.total_weeks} semanas · {plan.total_days} días/sem
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Day Tabs */}
        <div className="flex gap-2 px-6 pt-4 border-b border-slate-200 dark:border-slate-700 overflow-x-auto flex-none no-scrollbar">
          {days.map((day, index: number) => (
            <button
              key={day.id}
              onClick={() => setActiveDay(index)}
              className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${activeDay === index
                ? "bg-primary text-white"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
            >
              {day.day_name}
            </button>
          ))}
        </div>

        {/* Exercise Table */}
        <div className="flex-1 overflow-auto p-6">
          {exercises.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">
                fitness_center
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                No hay ejercicios en este día
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Etapa
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider w-12">
                      #
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Ejercicio
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Video
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Series
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Reps
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Carga
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Pausa
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Peso requerido
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Notas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {exercises.map((exercise, index: number) => {
                    const circuitGroup = exercise.circuit_group;
                    const isInsideCircuit = !!circuitGroup;
                    const isFirstInCircuit = isInsideCircuit && (index === 0 || exercises[index - 1].circuit_group !== circuitGroup);
                    const isLastInCircuit = isInsideCircuit && (index === exercises.length - 1 || exercises[index + 1].circuit_group !== circuitGroup);
                    const circuitColors = getCircuitColor(circuitGroup);
                    const isCardio = exercise.stage_name?.toLowerCase() === "cardio" || !!exercise.cardio_duration_min;

                    return (
                      <tr
                        key={exercise.id}
                        className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${
                          isInsideCircuit && circuitColors
                            ? `${circuitColors.rowBg}`
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <td className="py-3 px-4">
                          {(() => {
                            const stageLower = exercise.stage_name?.toLowerCase();
                            const isStageCardio = stageLower === "cardio" || !!exercise.cardio_duration_min;
                            let badgeClasses = "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800";
                            let iconName = "";

                            if (isStageCardio) {
                              badgeClasses = "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-900/50";
                              iconName = "directions_run";
                            } else if (stageLower === "desarrollo") {
                              badgeClasses = "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/50";
                              iconName = "fitness_center";
                            } else if (stageLower === "activacion" || stageLower === "activación") {
                              badgeClasses = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/50";
                              iconName = "bolt";
                            }

                            return (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${badgeClasses}`}>
                                {iconName && (
                                  <span className="material-symbols-outlined text-[14px]">
                                    {iconName}
                                  </span>
                                )}
                                {exercise.stage_name}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                          {index + 1}
                        </td>
                        <td className={`py-3 px-4 text-sm font-medium text-slate-900 dark:text-white relative ${isInsideCircuit ? "pl-8" : ""}`}>
                          {isInsideCircuit && circuitColors && (
                            <div className="absolute left-2.5 top-0 bottom-0 w-3 pointer-events-none flex items-center justify-center">
                              <div
                                className={`absolute w-0.5 ${circuitColors.line}`}
                                style={{
                                  top: isFirstInCircuit ? "50%" : "0px",
                                  bottom: isLastInCircuit ? "50%" : "0px",
                                }}
                              />
                              <div className={`absolute w-1.5 h-1.5 rounded-full ${circuitColors.line}`} />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span>{exercise.exercise_name}</span>
                              {exercise.circuit_group && circuitColors && (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${circuitColors.badge}`}>
                                  <span className="material-symbols-outlined text-[10px] font-bold">link</span>
                                  Circuito {exercise.circuit_group}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {exercise.video_url ? (
                            <a
                              href={exercise.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                play_circle
                              </span>
                            </a>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">
                              —
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-slate-700 dark:text-slate-300">
                          {exercise.series || "—"}
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-slate-700 dark:text-slate-300">
                          {isCardio && exercise.cardio_duration_min
                            ? `${exercise.cardio_duration_min} min`
                            : exercise.reps || "—"}
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-slate-700 dark:text-slate-300">
                          {isCardio ? "—" : exercise.carga || "—"}
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-slate-700 dark:text-slate-300">
                          {exercise.pause || "sin descanso"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {exercise.write_weight ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                              <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400 filled">
                                check
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-sm">
                              —
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                          {exercise.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700 flex-none">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
          >
            Cerrar
          </button>
          <button
            onClick={() => exportPDF(planId)}
            disabled={isExporting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">
                picture_as_pdf
              </span>
            )}
            {isExporting ? "Generando..." : "Descargar PDF"}
          </button>
          <button
            onClick={handleEditPlan}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Editar Plan
          </button>
        </div>

        {/* Hidden PDF template — rendered off-screen for html2canvas capture */}
        <div
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            zIndex: -1,
            pointerEvents: "none",
          }}
        >
          {pdfData && <PlanPDFTemplate ref={templateRef} data={pdfData} />}
        </div>
      </div>
    </div>
  );
}
