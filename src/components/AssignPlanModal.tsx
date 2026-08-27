import { useState, useMemo, useCallback, useRef, useId } from "react";
import { useStudents } from "@/hooks/useStudents";
import type { StudentWithAssignments } from "@/hooks/useStudents";
import { useModalFocusTrap } from "@/components/ui/Modal";

interface AssignPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (studentIds: string[]) => Promise<void>;
  isSubmitting: boolean;
  planTitle?: string;
  planStartDate?: Date;
  planEndDate?: Date;
}

export default function AssignPlanModal({
  isOpen,
  onClose,
  onAssign,
  isSubmitting,
  planTitle,
  planStartDate,
  planEndDate,
}: AssignPlanModalProps) {
  const { students, loading, error } = useStudents();
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useModalFocusTrap({
    isOpen,
    onClose: () => {
      if (!isSubmitting) {
        setSelectedStudentIds(new Set());
        setSearchQuery("");
        onClose();
      }
    },
    containerRef,
    initialFocusRef,
    disableEscape: isSubmitting,
  });

  // Check date conflicts
  const hasDateConflict = useCallback(
    (student: StudentWithAssignments): boolean => {
      if (!planStartDate || !planEndDate || !student.activeAssignments?.length)
        return false;
      return student.activeAssignments.some((assignment) => {
        const aStart = new Date(assignment.start_date + 'T00:00:00');
        const aEnd = new Date(assignment.end_date + 'T00:00:00');
        return planStartDate <= aEnd && planEndDate >= aStart;
      });
    },
    [planStartDate, planEndDate]
  );

  // Filter students by search query
  const filteredStudents = useMemo(
    () =>
      students.filter((s) =>
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [students, searchQuery]
  );

  // Count conflicts
  const conflictCount = useMemo(
    () => filteredStudents.filter((s) => hasDateConflict(s)).length,
    [filteredStudents, hasDateConflict]
  );

  if (!isOpen) return null;

  const handleToggleStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudentIds(newSelected);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.size === 0) return;
    await onAssign(Array.from(selectedStudentIds));
    setSelectedStudentIds(new Set());
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedStudentIds(new Set());
      setSearchQuery("");
      onClose();
    }
  };



  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xl">
                person_add
              </span>
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-white">
                Asignar Plan a Alumnos
              </h2>
              {planTitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[300px]">
                  {planTitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Cerrar modal"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[20px]">
              search
            </span>
            <input
              ref={initialFocusRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar alumno por nombre..."
              aria-label="Buscar alumno por nombre"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder-gray-400"
              disabled={isSubmitting}
            />
          </div>

          {/* Date range info + conflict warning */}
          {planStartDate && planEndDate && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-2.5 py-1.5 rounded-md">
                <span className="material-symbols-outlined text-[14px]">
                  date_range
                </span>
                {planStartDate.toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                —{" "}
                {planEndDate.toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              {conflictCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 rounded-md border border-amber-200 dark:border-amber-800">
                  <span className="material-symbols-outlined text-[14px]">
                    warning
                  </span>
                  {conflictCount} alumno{conflictCount !== 1 ? "s" : ""} con
                  planes asignados
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                refresh
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3 block">
                {searchQuery ? "search_off" : "group"}
              </span>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {searchQuery
                  ? `Sin resultados para "${searchQuery}"`
                  : "No hay alumnos disponibles"}
              </p>
            </div>
          )}

          {!loading && !error && filteredStudents.length > 0 && (
            <>
              <div className="mb-3 flex items-center justify-end">
                <span className="text-xs text-gray-400">
                  {filteredStudents.length} {filteredStudents.length === 1 ? 'alumno' : 'alumnos'}
                </span>
              </div>

              <div className="space-y-2">
                {filteredStudents.map((student) => {
                  const isSelected = selectedStudentIds.has(student.id);
                  const conflict = hasDateConflict(student);
                  return (
                    <label
                      key={student.id}
                      className={`flex items-center gap-4 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                        ? "border-primary bg-primary/5"
                        : conflict
                          ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
                          : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                        } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleStudent(student.id)}
                        disabled={isSubmitting}
                        className="sr-only"
                      />

                      <span
                        className={`material-symbols-outlined text-2xl flex-shrink-0 ${isSelected ? "text-primary" : "text-gray-300"}`}
                      >
                        {isSelected ? "check_box" : "check_box_outline_blank"}
                      </span>

                      <div className="flex-shrink-0">
                        {student.profileImageUrl ? (
                          <img
                            src={student.profileImageUrl}
                            alt={student.fullName}
                            className="w-11 h-11 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            <span className="material-symbols-outlined text-gray-400 text-xl">
                              person
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {student.fullName}
                        </p>
                        {/* Active assignments */}
                        {student.activeAssignments &&
                          student.activeAssignments.length > 0 ? (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {student.activeAssignments
                              .slice(0, 2)
                              .map((assignment, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-[10px] font-medium text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800"
                                >
                                  <span className="material-symbols-outlined text-[12px]">
                                    assignment
                                  </span>
                                  {assignment.plan_title.length > 18
                                    ? assignment.plan_title.substring(0, 18) +
                                    "…"
                                    : assignment.plan_title}
                                </span>
                              ))}
                            {student.activeAssignments.length > 2 && (
                              <span className="text-[10px] text-gray-400 font-medium">
                                +{student.activeAssignments.length - 2} más
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Sin planes asignados
                          </p>
                        )}
                      </div>

                      {/* Conflict badge */}
                      {conflict && (
                        <div
                          className="flex-shrink-0"
                          title="El alumno tiene un plan activo que se solapa con las fechas de este plan"
                        >
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
                            <span className="material-symbols-outlined text-[14px]">
                              warning
                            </span>
                            Plan asignado
                          </span>
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          {selectedStudentIds.size > 0 && (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="material-symbols-outlined text-lg text-primary">
                check_circle
              </span>
              <span>
                {selectedStudentIds.size}{" "}
                {selectedStudentIds.size === 1
                  ? "alumno seleccionado"
                  : "alumnos seleccionados"}
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={
                isSubmitting || selectedStudentIds.size === 0 || loading
              }
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">
                    progress_activity
                  </span>
                  Asignando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">
                    assignment
                  </span>
                  Asignar Plan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
