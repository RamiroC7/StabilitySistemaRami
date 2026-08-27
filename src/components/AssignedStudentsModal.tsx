import { useState, useEffect, useCallback, useRef, useId } from "react";
import { useTrainingPlans } from "../hooks/useTrainingPlans";
import { toast } from "sonner";
import ConfirmActionModal from "./ConfirmActionModal";
import { useModalFocusTrap } from "@/components/ui/Modal";

interface AssignedStudent {
  assignmentId: string;
  studentId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  startDate: string;
  endDate: string;
  status: string;
  currentDay: number;
  completedDays: number;
  totalDays: number;
  assignedAt: string;
}

interface AssignedStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planTitle: string;
}

export default function AssignedStudentsModal({
  isOpen,
  onClose,
  planId,
  planTitle,
}: AssignedStudentsModalProps) {
  const { getAssignedStudents, unassignStudent } = useTrainingPlans();
  const [students, setStudents] = useState<AssignedStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useModalFocusTrap({
    isOpen,
    onClose,
    containerRef,
  });

  const fetchStudents = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await getAssignedStudents(planId);
      if (result.success) {
        setStudents(result.students as AssignedStudent[]);
      } else {
        setError(result.error || "Error al cargar alumnos");
      }
    } catch (err) {
      setError("Error inesperado");
      console.error(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  useEffect(() => {
    if (isOpen && planId) {
      fetchStudents();
    }
  }, [isOpen, planId, fetchStudents]);

  const [studentToUnassign, setStudentToUnassign] = useState<AssignedStudent | null>(null);

  const handleConfirmUnassign = async () => {
    if (!studentToUnassign) return;
    const student = studentToUnassign;
    setStudentToUnassign(null);

    try {
      setUnassigningId(student.assignmentId);
      const result = await unassignStudent(student.assignmentId);
      if (result.success) {
        setStudents((prev) =>
          prev.filter((s) => s.assignmentId !== student.assignmentId)
        );
        toast.success(`${student.fullName} desasignado del plan`);
      } else {
        toast.error(result.error || "Error al desasignar");
      }
    } finally {
      setUnassigningId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return {
          label: "Activo",
          className:
            "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
        };
      case "completed":
        return {
          label: "Completado",
          className:
            "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
        };
      case "paused":
        return {
          label: "En pausa",
          className:
            "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        };
      default:
        return {
          label: status,
          className:
            "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600",
        };
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-xl">
                  group
                </span>
              </div>
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  Alumnos Asignados
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {planTitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <span className="material-symbols-outlined text-3xl text-primary animate-spin block mb-2">
                    progress_activity
                  </span>
                  <p className="text-sm text-gray-500">Cargando alumnos...</p>
                </div>
              </div>
            )}

          {error && !loading && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <span className="material-symbols-outlined text-red-500 text-lg">
                error
              </span>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {!loading && !error && students.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3">
                person_off
              </span>
              <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
                Sin alumnos asignados
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Este plan no tiene alumnos asignados aún.
              </p>
            </div>
          )}

          {!loading && !error && students.length > 0 && (
            <div className="space-y-2">
              {/* Count header */}
              <div className="flex items-center justify-between px-1 mb-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {students.length}{" "}
                  {students.length === 1 ? "alumno" : "alumnos"}
                </span>
              </div>

              {students.map((student) => {
                const badge = getStatusBadge(student.status);
                const progress =
                  student.totalDays > 0
                    ? Math.round(
                        (student.completedDays / student.totalDays) * 100
                      )
                    : 0;

                return (
                  <div
                    key={student.assignmentId}
                    className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-600 hover:border-gray-200 dark:hover:border-gray-500 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {student.avatarUrl ? (
                          <img
                            src={student.avatarUrl}
                            alt={student.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-primary text-lg">
                            person
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {student.fullName}
                          </h4>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {student.email}
                        </p>

                        {/* Progress + Dates */}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">
                              calendar_today
                            </span>
                            {new Date(student.startDate).toLocaleDateString(
                              "es-AR",
                              { day: "2-digit", month: "short" }
                            )}
                          </span>
                          {student.totalDays > 0 && (
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">
                                trending_up
                              </span>
                              Día {student.completedDays} de{" "}
                              {student.totalDays} ({progress}%)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Unassign */}
                      <button
                        onClick={() => setStudentToUnassign(student)}
                        disabled={unassigningId === student.assignmentId}
                        className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                        title="Desasignar alumno"
                      >
                        {unassigningId === student.assignmentId ? (
                          <span className="material-symbols-outlined text-lg animate-spin">
                            progress_activity
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-lg">
                            person_remove
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>

    <ConfirmActionModal
      isOpen={!!studentToUnassign}
      onClose={() => setStudentToUnassign(null)}
      onConfirm={handleConfirmUnassign}
      title="¿Desasignar alumno?"
      description={`¿Estás seguro de que querés desasignar a "${studentToUnassign?.fullName}" de este plan? Esta acción no se puede deshacer.`}
      confirmText="Desasignar"
      variant="danger"
    />
    </>
  );
}
