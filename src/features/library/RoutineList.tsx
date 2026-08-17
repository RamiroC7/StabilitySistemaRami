import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";

import { useTrainingPlans } from "../../hooks/useTrainingPlans";
import { useExportPlanPDF } from "../../hooks/useExportPlanPDF";
import { usePlanFolders, type PlanFolder } from "../../hooks/usePlanFolders";
import type { TrainingPlanSummary } from "../../hooks/useTrainingPlans";

import PlanPreview from "./PlanPreview";
import PlanPDFTemplate from "./components/PlanPDFTemplate";
import AssignedStudentsModal from "../../components/AssignedStudentsModal";
import AssignPlanModal from "../../components/AssignPlanModal";
import ConfirmActionModal from "../../components/ConfirmActionModal";

// ─── Folder card ─────────────────────────────────────────────────────────────

function FolderCard({
  folder,
  planCount,
  isOpen,
  isDragOver,
  onClick,
  onRename,
  onDelete,
}: {
  folder: PlanFolder;
  planCount: number;
  isOpen: boolean;
  isDragOver: boolean;
  onClick: () => void;
  onRename: (folder: PlanFolder) => void;
  onDelete: (folder: PlanFolder) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuOpenUp, setMenuOpenUp] = useState(false);
  const folderMenuBtnRef = useRef<HTMLButtonElement>(null);
  const { setNodeRef } = useDroppable({ id: `folder-${folder.id}` });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150 select-none
        ${isDragOver
          ? "border-primary bg-primary/10 dark:bg-primary/20 shadow-md scale-[1.02]"
          : isOpen
            ? "border-primary/50 bg-primary/5 dark:bg-primary/10"
            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary/40 hover:shadow-sm"
        }`}
    >
      <span
        className={`material-symbols-outlined text-[28px] transition-colors ${
          isDragOver ? "text-primary" : isOpen ? "text-primary" : "text-amber-400 dark:text-amber-300"
        }`}
      >
        {isOpen ? "folder_open" : "folder"}
      </span>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
          {folder.name}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {planCount} {planCount === 1 ? "plan" : "planes"}
        </p>
      </div>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          ref={folderMenuBtnRef}
          onClick={(e) => {
            e.stopPropagation();
            if (!menuOpen) {
              const rect = folderMenuBtnRef.current?.getBoundingClientRect();
              setMenuOpenUp(!!rect && rect.bottom + 120 > window.innerHeight);
            }
            setMenuOpen((v) => !v);
          }}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">more_vert</span>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className={`absolute right-0 z-20 w-44 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 py-1 ${menuOpenUp ? "bottom-8" : "top-8"}`}>
              <button
                onClick={() => { setMenuOpen(false); onRename(folder); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Renombrar
              </button>
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
              <button
                onClick={() => { setMenuOpen(false); onDelete(folder); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Eliminar carpeta
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Draggable Plan Card ──────────────────────────────────────────────────────

function DraggablePlanCard({
  plan,
  onCardClick,
  onMenuAction,
  isExporting,
  openMenuId,
  setOpenMenuId,
  folders,
}: {
  plan: TrainingPlanSummary;
  onCardClick: (id: string) => void;
  onMenuAction: (e: React.MouseEvent | undefined, action: string, plan: TrainingPlanSummary, extra?: string) => void;
  isExporting: boolean;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  folders: PlanFolder[];
}) {
  const [planMenuOpenUp, setPlanMenuOpenUp] = useState(false);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [submenuOpenLeft, setSubmenuOpenLeft] = useState(true);
  const planMenuBtnRef = useRef<HTMLButtonElement>(null);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `plan-${plan.id}`,
  });

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onCardClick(plan.id)}
      className={`bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md border border-slate-200 dark:border-slate-700 transition-all duration-200 flex flex-col group h-full cursor-grab active:cursor-grabbing relative
        ${isDragging ? "opacity-40 scale-95" : ""}`}
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
          {plan.title}
        </h3>
        <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
          <button
            ref={planMenuBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              if (openMenuId !== plan.id) {
                const rect = planMenuBtnRef.current?.getBoundingClientRect();
                setPlanMenuOpenUp(!!rect && rect.bottom + 280 > window.innerHeight);
                const isLargeScreen = window.innerWidth >= 1024;
                const sidebarWidth = isLargeScreen ? 288 : 0;
                setSubmenuOpenLeft(!!rect && (rect.left - 420 > sidebarWidth));
              }
              setOpenMenuId(openMenuId === plan.id ? null : plan.id);
              setFolderMenuOpen(false);
            }}
            className="h-8 w-8 -mr-2 -mt-2 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 transition-colors"
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>

          {openMenuId === plan.id && (
            <>
              <div
                className="fixed inset-0 z-[39]"
                onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}
              />
              <div className={`absolute right-0 z-[40] w-52 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 py-1 ${planMenuOpenUp ? "bottom-8" : "top-8"}`}>
                <button
                  onClick={(e) => onMenuAction(e, "edit", plan)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Editar plan
                </button>
                <button
                  onClick={(e) => onMenuAction(e, "rename", plan)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">drive_file_rename_outline</span>
                  Renombrar plan
                </button>
                <button
                  onClick={(e) => onMenuAction(e, "duplicate", plan)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  Duplicar plan
                </button>
                <button
                  onClick={(e) => onMenuAction(e, "viewStudents", plan)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">group</span>
                  Ver alumnos asignados
                </button>
                <button
                  onClick={(e) => onMenuAction(e, "assign", plan)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  Asignar a alumno
                </button>
                <button
                  onClick={(e) => onMenuAction(e, "exportPDF", plan)}
                  disabled={isExporting}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                  )}
                  Exportar a PDF
                </button>

                {folders.length > 0 && (
                  <div
                    className="relative"
                    onMouseLeave={() => setFolderMenuOpen(false)}
                  >
                    <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                    <button
                      onMouseEnter={() => setFolderMenuOpen(true)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderMenuOpen((prev) => !prev);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between transition-colors duration-150 ${
                        folderMenuOpen ? "bg-slate-50 dark:bg-slate-700/50" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-slate-400">folder_open</span>
                        Mover a carpeta
                      </span>
                      <span className="material-symbols-outlined text-[16px] text-slate-400">
                        {submenuOpenLeft ? "chevron_left" : "chevron_right"}
                      </span>
                    </button>

                    {folderMenuOpen && (
                      <div className={`absolute z-[50] w-52 bg-white dark:bg-slate-800 rounded-md shadow-xl border border-slate-200 dark:border-slate-700 py-1 max-h-60 overflow-y-auto ${
                        planMenuOpenUp ? "bottom-0" : "top-0"
                      } ${
                        submenuOpenLeft ? "right-[100%] mr-1" : "left-[100%] ml-1"
                      }`}>
                        {plan.folder_id && (
                          <button
                            onClick={(e) => {
                              setFolderMenuOpen(false);
                              onMenuAction(e, "moveToFolder", plan, "null");
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[16px] text-slate-400">drive_file_move_rtl</span>
                            Quitar de carpeta
                          </button>
                        )}
                        {folders.filter((f) => f.id !== plan.folder_id).map((f) => (
                          <button
                            key={f.id}
                            onClick={(e) => {
                              setFolderMenuOpen(false);
                              onMenuAction(e, "moveToFolder", plan, f.id);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[16px] text-amber-400">folder</span>
                            {f.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                <button
                  onClick={(e) => onMenuAction(e, "delete", plan)}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Eliminar plan
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-100 dark:border-blue-800">
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          {plan.total_weeks} {plan.total_weeks === 1 ? "Semana" : "Semanas"}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-600">
          <span className="material-symbols-outlined text-[14px]">calendar_today</span>
          {plan.total_days} Dias/Sem
        </span>
      </div>

      <PlanCardFooter
        plan={plan}
        onAssignClick={() => onMenuAction(undefined, "assign", plan)}
        onViewStudentsClick={() => onMenuAction(undefined, "viewStudents", plan)}
      />
    </article>
  );
}

// ─── Plan card footer ─────────────────────────────────────────────────────────

function PlanCardFooter({
  plan,
  onAssignClick,
  onViewStudentsClick,
}: {
  plan: TrainingPlanSummary;
  onAssignClick: () => void;
  onViewStudentsClick: () => void;
}) {
  return (
    <div className="mt-auto border-t border-slate-100 dark:border-slate-700 pt-4 flex items-center justify-between">
      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Asignado a:</span>
      <div className="flex items-center gap-2">
        {plan.assignedCount === 0 ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onAssignClick(); }}
            className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors"
          >
            <div className="w-8 h-8 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">person_add</span>
            </div>
            <span className="text-xs font-medium">Asignar</span>
          </button>
        ) : (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onViewStudentsClick(); }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="Ver alumnos asignados"
          >
            <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-white">group</span>
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {plan.assignedCount} {plan.assignedCount === 1 ? "alumno" : "alumnos"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Folder name modal ────────────────────────────────────────────────────────

function FolderNameModal({
  initialName,
  onConfirm,
  onCancel,
}: {
  initialName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          {initialName ? "Renombrar carpeta" : "Nueva carpeta"}
        </h2>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(value);
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Nombre de la carpeta"
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(value)}
            disabled={!value.trim()}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-primary hover:bg-primary-dark text-white transition-colors disabled:opacity-50"
          >
            {initialName ? "Guardar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanRenameModal({
  initialName,
  onConfirm,
  onCancel,
}: {
  initialName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onPointerDown={(e) => e.stopPropagation()}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          Renombrar plan
        </h2>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onConfirm(value);
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Nombre del plan"
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(value)}
            disabled={!value.trim()}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-primary hover:bg-primary-dark text-white transition-colors disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Root drop zone ───────────────────────────────────────────────────────────

function RootDropZone({ isVisible }: { isVisible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "folder-null" });
  if (!isVisible) return null;
  return (
    <div
      ref={setNodeRef}
      className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border-2 border-dashed text-sm font-medium transition-all duration-150 mb-4
        ${isOver
          ? "border-primary bg-primary/10 dark:bg-primary/20 text-primary"
          : "border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500"
        }`}
    >
      <span className="material-symbols-outlined text-[18px]">drive_file_move_rtl</span>
      Soltar aqui para quitar de carpeta
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RoutineList({ searchQuery }: { searchQuery: string }) {
  const navigate = useNavigate();

  const { plans, loading, deletePlan, duplicatePlan, renamePlan, assignPlanToStudents } = useTrainingPlans();
  const { exportPDF, isExporting, templateRef, pdfData } = useExportPlanPDF();
  const {
    folders,
    loading: foldersLoading,
    createFolder,
    renameFolder,
    deleteFolder,
    movePlanToFolder,
  } = usePlanFolders();

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planToDelete, setPlanToDelete] = useState<{ id: string; title: string } | null>(null);
  const [planToRename, setPlanToRename] = useState<TrainingPlanSummary | null>(null);
  // folderPath is a stack of folders: [] = root, [A] = inside A, [A, B] = inside A > B
  const [folderPath, setFolderPath] = useState<PlanFolder[]>([]);
  const activeFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : null;
  const [folderNameModal, setFolderNameModal] = useState<{
    mode: "create" | "rename";
    folder?: PlanFolder;
  } | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<PlanFolder | null>(null);
  const [draggingPlanId, setDraggingPlanId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const [assignPlan, setAssignPlan] = useState<TrainingPlanSummary | null>(null);
  const [viewStudentsPlan, setViewStudentsPlan] = useState<TrainingPlanSummary | null>(null);
  const [isAssignSubmitting, setIsAssignSubmitting] = useState(false);

  // suppress unused warning - useRef needed for PDF template

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const filteredPlans = plans.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const rootPlans = filteredPlans.filter((p) => !p.folder_id);
  const plansInFolder = (folderId: string) =>
    filteredPlans.filter((p) => p.folder_id === folderId);

  // Folders visible at the current level
  const visibleFolders = folders.filter((f) => f.parent_id === activeFolderId);

  const activeFolder = activeFolderId
    ? folders.find((f) => f.id === activeFolderId) ?? null
    : null;

  const displayedPlans = activeFolderId ? plansInFolder(activeFolderId) : rootPlans;
  const draggingPlan = draggingPlanId ? plans.find((p) => p.id === draggingPlanId) : null;

  const handleMenuAction = async (
    e: React.MouseEvent | undefined,
    action: string,
    plan: TrainingPlanSummary,
    extra?: string,
  ) => {
    e?.stopPropagation();
    setOpenMenuId(null);
    switch (action) {
      case "edit":
        navigate(`/planificador?planId=${plan.id}&mode=edit`);
        break;
      case "rename":
        setPlanToRename(plan);
        break;
      case "duplicate":
        toast.promise(duplicatePlan(plan.id), {
          loading: "Duplicando plan...",
          success: (r) => {
            if (r.success) return "Plan duplicado exitosamente";
            throw new Error(r.error || "Error al duplicar");
          },
          error: (err) => err.message || "Error al duplicar plan",
        });
        break;
      case "delete":
        setPlanToDelete(plan);
        break;
      case "exportPDF":
        toast.promise(exportPDF(plan.id), {
          loading: "Generando PDF...",
          success: "PDF descargado correctamente",
          error: "Error al generar el PDF",
        });
        break;
      case "moveToFolder": {
        const targetFolderId = extra === "null" ? null : (extra ?? null);
        const folderName = targetFolderId
          ? folders.find((f) => f.id === targetFolderId)?.name
          : null;
        toast.promise(movePlanToFolder(plan.id, targetFolderId), {
          loading: "Moviendo plan...",
          success: () =>
            folderName ? `Plan movido a "${folderName}"` : "Plan quitado de la carpeta",
          error: "Error al mover el plan",
        });
        break;
      }
      case "assign":
        setAssignPlan(plan);
        break;
      case "viewStudents":
        setViewStudentsPlan(plan);
        break;
    }
  };

  const handleAssign = async (studentIds: string[]) => {
    if (!assignPlan) return;
    setIsAssignSubmitting(true);
    try {
      const result = await assignPlanToStudents(
        assignPlan.id,
        studentIds,
        new Date(assignPlan.start_date + 'T00:00:00'),
        new Date(assignPlan.end_date + 'T00:00:00'),
      );
      if (result.success) {
        setAssignPlan(null);
        toast.success("Plan asignado correctamente");
      } else {
        toast.error(result.error || "Error al asignar plan");
      }
    } catch (err) {
      console.error("Error assigning plan:", err);
      toast.error("Error al asignar plan");
    } finally {
      setIsAssignSubmitting(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingPlanId(String(event.active.id).replace("plan-", ""));
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) { setDragOverFolderId(null); return; }
    const overId = String(event.over.id);
    setDragOverFolderId(
      overId.startsWith("folder-") ? overId.replace("folder-", "") : null,
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingPlanId(null);
    setDragOverFolderId(null);
    const { active, over } = event;
    if (!over) return;
    const planId = String(active.id).replace("plan-", "");
    const overId = String(over.id);
    if (!overId.startsWith("folder-")) return;
    const rawTarget = overId.replace("folder-", "");
    const targetFolderId = rawTarget === "null" ? null : rawTarget;
    const plan = plans.find((p) => p.id === planId);
    if (!plan || plan.folder_id === targetFolderId) return;
    const folderName = targetFolderId
      ? folders.find((f) => f.id === targetFolderId)?.name
      : null;
    toast.promise(movePlanToFolder(planId, targetFolderId), {
      loading: "Moviendo plan...",
      success: () =>
        folderName ? `Plan movido a "${folderName}"` : "Plan quitado de la carpeta",
      error: "Error al mover el plan",
    });
  };

  const handleFolderNameConfirm = async (name: string) => {
    if (!folderNameModal) return;
    if (folderNameModal.mode === "create") {
      toast.promise(createFolder(name, activeFolderId), {
        loading: "Creando carpeta...",
        success: "Carpeta creada",
        error: "Error al crear carpeta",
      });
    } else if (folderNameModal.folder) {
      toast.promise(renameFolder(folderNameModal.folder.id, name), {
        loading: "Renombrando...",
        success: "Carpeta renombrada",
        error: "Error al renombrar",
      });
    }
    setFolderNameModal(null);
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;
    toast.promise(deleteFolder(folderToDelete.id), {
      loading: "Eliminando carpeta...",
      success: "Carpeta eliminada (los planes volvieron a la raiz)",
      error: "Error al eliminar carpeta",
    });
    // If we deleted the active folder or an ancestor, go back to root
    if (folderPath.some((f) => f.id === folderToDelete.id)) setFolderPath([]);
    setFolderToDelete(null);
  };

  if (loading || foldersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Cargando planes...</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        {/* Header bar: breadcrumb + new folder button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <button
              onClick={() => setFolderPath([])}
              className={`font-semibold transition-colors ${
                folderPath.length === 0
                  ? "text-slate-900 dark:text-white cursor-default"
                  : "text-primary hover:text-primary/80"
              }`}
            >
              Todos los planes
            </button>
            {folderPath.map((folder, idx) => (
              <>
                <span key={`sep-${folder.id}`} className="material-symbols-outlined text-[16px] text-slate-400">chevron_right</span>
                <button
                  key={folder.id}
                  onClick={() => setFolderPath(folderPath.slice(0, idx + 1))}
                  className={`font-semibold flex items-center gap-1.5 transition-colors ${
                    idx === folderPath.length - 1
                      ? "text-slate-900 dark:text-white cursor-default"
                      : "text-primary hover:text-primary/80"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-amber-400">
                    {idx === folderPath.length - 1 ? "folder_open" : "folder"}
                  </span>
                  {folder.name}
                </button>
              </>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Total de planes */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="material-symbols-outlined text-primary text-[18px]">event_note</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total:</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{plans.length}</span>
              </div>
            </div>
            
            <button
              onClick={() => setFolderNameModal({ mode: "create" })}
              className="flex items-center gap-1.5 text-xs font-bold px-3 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:border-primary/30 bg-white dark:bg-slate-800 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">create_new_folder</span>
              {activeFolderId ? "Nueva subcarpeta" : "Nueva carpeta"}
            </button>
          </div>
        </div>

        {/* Drop zone to remove plan from folder */}
        <RootDropZone isVisible={!!draggingPlanId && activeFolderId !== null} />

        {/* Folders grid — current level only */}
        {visibleFolders.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
            {visibleFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                planCount={filteredPlans.filter((p) => p.folder_id === folder.id).length}
                isOpen={false}
                isDragOver={dragOverFolderId === folder.id}
                onClick={() => setFolderPath([...folderPath, folder])}
                onRename={(f) => setFolderNameModal({ mode: "rename", folder: f })}
                onDelete={(f) => setFolderToDelete(f)}
              />
            ))}
          </div>
        )}

        {/* Plans grid */}
        {displayedPlans.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">
                folder_open
              </span>
              <p className="text-slate-600 dark:text-slate-400 mb-2">
                {searchQuery
                  ? "No se encontraron planes"
                  : activeFolderId
                    ? "Esta carpeta esta vacia"
                    : "No hay planes guardados"}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500">
                {searchQuery
                  ? "Intenta con otros terminos de busqueda"
                  : activeFolderId
                    ? "Arrasta planes aqui o usa el menu de cada plan"
                    : "Crea planes desde el Planificador"}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
            {displayedPlans.map((plan) => (
              <DraggablePlanCard
                key={plan.id}
                plan={plan}
                onCardClick={(id) => setSelectedPlanId(id)}
                onMenuAction={handleMenuAction}
                isExporting={isExporting}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                folders={folders}
              />
            ))}
          </div>
        )}
      </div>

      <DragOverlay>
        {draggingPlan && (
          <div className="bg-white dark:bg-slate-800 rounded-xl px-5 py-4 shadow-2xl border border-primary/40 opacity-95 pointer-events-none w-64">
            <p className="font-bold text-slate-900 dark:text-white text-sm truncate">
              {draggingPlan.title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {draggingPlan.total_weeks} sem · {draggingPlan.total_days} dias/sem
            </p>
          </div>
        )}
      </DragOverlay>

      {selectedPlanId && (
        <PlanPreview planId={selectedPlanId} onClose={() => setSelectedPlanId(null)} />
      )}

      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1, pointerEvents: "none" }}>
        {pdfData && <PlanPDFTemplate ref={templateRef} data={pdfData} />}
      </div>

      {planToDelete && (
        <ConfirmActionModal
          isOpen
          onClose={() => setPlanToDelete(null)}
          onConfirm={async () => {
            await deletePlan(planToDelete.id);
            setPlanToDelete(null);
          }}
          title="Eliminar plan"
          description={`Estas seguro de que queres eliminar "${planToDelete.title}"? Esta accion no se puede deshacer.`}
          confirmText="Eliminar"
          variant="danger"
        />
      )}

      {folderToDelete && (
        <ConfirmActionModal
          isOpen
          onClose={() => setFolderToDelete(null)}
          onConfirm={handleDeleteFolder}
          title="Eliminar carpeta"
          description={`Eliminar la carpeta "${folderToDelete.name}"? Los planes que contiene volveran a la raiz.`}
          confirmText="Eliminar"
          variant="danger"
        />
      )}

      {planToRename && (
        <PlanRenameModal
          initialName={planToRename.title}
          onConfirm={async (newName) => {
            const planId = planToRename.id;
            setPlanToRename(null);
            toast.promise(renamePlan(planId, newName), {
              loading: "Renombrando plan...",
              success: "Plan renombrado exitosamente",
              error: "Error al renombrar el plan",
            });
          }}
          onCancel={() => setPlanToRename(null)}
        />
      )}

      {folderNameModal && (
        <FolderNameModal
          initialName={folderNameModal.folder?.name ?? ""}
          onConfirm={handleFolderNameConfirm}
          onCancel={() => setFolderNameModal(null)}
        />
      )}

      {assignPlan && (
        <AssignPlanModal
          isOpen
          onClose={() => setAssignPlan(null)}
          onAssign={handleAssign}
          isSubmitting={isAssignSubmitting}
          planTitle={assignPlan.title}
          planStartDate={new Date(assignPlan.start_date + 'T00:00:00')}
          planEndDate={new Date(assignPlan.end_date + 'T00:00:00')}
        />
      )}

      {viewStudentsPlan && (
        <AssignedStudentsModal
          isOpen
          onClose={() => setViewStudentsPlan(null)}
          planId={viewStudentsPlan.id}
          planTitle={viewStudentsPlan.title}
        />
      )}
    </DndContext>
  );
}
