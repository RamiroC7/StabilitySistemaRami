import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useExerciseStages } from "../../hooks/useExerciseStages";
import {
  useTrainingPlans,
  useTrainingPlanDetail,
} from "../../hooks/useTrainingPlans";
import AddStageModal from "../../components/AddStageModal";
import AssignPlanModal from "../../components/AssignPlanModal";
import SavePlanModal from "../../components/SavePlanModal";
import type { SavePlanFormData } from "../../components/SavePlanModal";
import DatePicker from "../../components/DatePicker";
import type { PlanExercise } from "../../lib/types";
import type { LibraryExercise } from "@/features/training/store/trainingStore";
import { toast } from "sonner";
import ConfirmActionModal from "../../components/ConfirmActionModal";
import SortableExerciseRow from "./SortableExerciseRow";
import CircuitCard from "./CircuitCard";
import {
  SELECTABLE_FIELDS,
  getSelectionBounds,
  isMultiCellSelection,
  computeFieldUpdate,
  readFieldValue,
  type SelectableField,
  type CellSelectionState,
} from "./cellSelection";
import PlannerTabBar from "../../components/PlannerTabBar";
import { usePlannerTabs } from "../../hooks/usePlannerTabs";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface Day {
  id: string;
  number: number;
  name: string;
}

type PlannerBlock =
  | { type: "single"; id: string; exercise: PlanExercise }
  | { type: "circuit"; id: string; circuitGroup: string; exercises: PlanExercise[] };

function getBlocksForActiveDay(dayExs: PlanExercise[]) {
  const blocks: PlannerBlock[] = [];
  let currentCircuit: string | null = null;
  let currentCircuitExercises: PlanExercise[] = [];

  const sortedDayExs = [...dayExs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const ex of sortedDayExs) {
    if (ex.circuit_group) {
      if (ex.circuit_group === currentCircuit) {
        currentCircuitExercises.push(ex);
      } else {
        if (currentCircuit !== null && currentCircuitExercises.length > 0) {
          blocks.push({
            type: "circuit",
            id: `circuit-${currentCircuit}-${currentCircuitExercises[0].id}`,
            circuitGroup: currentCircuit,
            exercises: currentCircuitExercises,
          });
        }
        currentCircuit = ex.circuit_group;
        currentCircuitExercises = [ex];
      }
    } else {
      if (currentCircuit !== null && currentCircuitExercises.length > 0) {
        blocks.push({
          type: "circuit",
          id: `circuit-${currentCircuit}-${currentCircuitExercises[0].id}`,
          circuitGroup: currentCircuit,
          exercises: currentCircuitExercises,
        });
        currentCircuit = null;
        currentCircuitExercises = [];
      }
      blocks.push({
        type: "single",
        id: ex.id,
        exercise: ex,
      });
    }
  }

  if (currentCircuit !== null && currentCircuitExercises.length > 0) {
    blocks.push({
      type: "circuit",
      id: `circuit-${currentCircuit}-${currentCircuitExercises[0].id}`,
      circuitGroup: currentCircuit,
      exercises: currentCircuitExercises,
    });
  }

  return blocks;
}

// Removed legacy loadFromStorage and saveToStorage since usePlannerTabs handles it

export default function NewPlan() {
  const { stages, loading: stagesLoading, addStage } = useExerciseStages();
  const { savePlan, updatePlan, assignPlanToStudents } = useTrainingPlans();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Detect edit mode from URL params
  const planId = searchParams.get("planId");
  const isEditMode = searchParams.get("mode") === "edit" && !!planId;
  const shouldOpenAssign = searchParams.get("openAssign") === "true";

  // Load existing plan data when in edit mode
  const { plan: loadedPlan, loading: planLoading } =
    useTrainingPlanDetail(planId);

  // Track if plan has been loaded to prevent re-hydration
  const planLoadedRef = useRef(false);

  // Tab Management
  const {
    tabs,
    activeTabId,
    activeTab,
    isInitialized,
    createTab,
    closeTab,
    switchTab,
    updateActiveTab,
    canCreateMoreTabs,
  } = usePlannerTabs();

  // Local state that shadows activeTab to prevent jumping while typing
  // We use the active tab's data as initial state, or default values if not loaded
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [activeDay, setActiveDay] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [planTitle, setPlanTitle] = useState<string>("");
  const [savedPlanId, setSavedPlanId] = useState<string | null>(planId || null);

  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editAssignedCount, setEditAssignedCount] = useState(0);
  const [isDeleteDayModalOpen, setIsDeleteDayModalOpen] = useState(false);
  const [dayToDelete, setDayToDelete] = useState<string | null>(null);
  const [isDeleteExerciseModalOpen, setIsDeleteExerciseModalOpen] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);

  // Seleccion tipo planilla de calculo (Series/Reps/Carga/Pausa) — ver cellSelection.ts
  const [cellSelection, setCellSelection] = useState<CellSelectionState | null>(null);
  const cellTableRef = useRef<HTMLDivElement>(null);
  const cellClipboardRef = useRef<string[][] | null>(null);
  const cellDragRef = useRef<{ anchorRow: number; anchorCol: number } | null>(null);

  // Sync local state when active tab changes
  useEffect(() => {
    if (!isInitialized || !activeTab) return;

    setExercises(activeTab.exercises);
    setDays(activeTab.days);
    setActiveDay(activeTab.activeDay);
    setStartDate(activeTab.startDate || new Date());
    setEndDate(activeTab.endDate || new Date());
    setPlanTitle(activeTab.planTitle);
    setSavedPlanId(activeTab.savedPlanId);
    
    // Reset history when switching tabs
    exercisesHistoryRef.current = [activeTab.exercises];
    historyPointerRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
    setCellSelection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, isInitialized]); // Only depend on activeTabId to not overwrite local changes while typing

  // La seleccion de celdas se indexa por posicion dentro del dia activo — al
  // cambiar de dia esos indices ya no significan nada, hay que limpiarla.
  useEffect(() => {
    setCellSelection(null);
  }, [activeDay]);

  // Auto-save local state changes back to the active tab hook
  useEffect(() => {
    if (isEditMode || !isInitialized || !activeTab) return;

    const timer = setTimeout(() => {
      setSaveStatus("saving");
      
      updateActiveTab({
        exercises,
        days,
        activeDay,
        startDate,
        endDate,
        planTitle,
      });

      setSaveStatus("saved");
      const clearTimer = setTimeout(() => setSaveStatus(null), 2000);
      return () => clearTimeout(clearTimer);
    }, 1000);

    return () => clearTimeout(timer);
  }, [exercises, days, activeDay, startDate, endDate, planTitle, isEditMode, isInitialized, updateActiveTab, activeTab]);

  const exercisesHistoryRef = useRef<PlanExercise[][]>([]);
  const historyPointerRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [copiedDayExercises, setCopiedDayExercises] = useState<PlanExercise[] | null>(null);

  // Initialize history on mount/hydrate
  useEffect(() => {
    if (exercisesHistoryRef.current.length === 0 && exercises.length > 0) {
      exercisesHistoryRef.current = [exercises];
      historyPointerRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
    }
  }, [exercises]);

  const commitExercises = useCallback((updater: (prev: PlanExercise[]) => PlanExercise[]) => {
    setExercises((prev) => {
      const next = updater(prev);
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      
      const history = exercisesHistoryRef.current.slice(0, historyPointerRef.current + 1);
      
      // Strict Mode Protection: Prevent pushing duplicate contiguous states
      if (history.length > 0 && JSON.stringify(history[history.length - 1]) === JSON.stringify(next)) {
        return next;
      }
      
      history.push(next);
      if (history.length > 50) history.shift();
      
      exercisesHistoryRef.current = history;
      historyPointerRef.current = history.length - 1;
      
      // Delay state update to avoid updating state during another state transition
      setTimeout(() => {
        setCanUndo(historyPointerRef.current > 0);
        setCanRedo(historyPointerRef.current < exercisesHistoryRef.current.length - 1);
      }, 0);
      
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (historyPointerRef.current > 0) {
      historyPointerRef.current -= 1;
      setExercises(exercisesHistoryRef.current[historyPointerRef.current]);
      setCanUndo(historyPointerRef.current > 0);
      setCanRedo(historyPointerRef.current < exercisesHistoryRef.current.length - 1);
      toast.info("Acción deshecha");
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (historyPointerRef.current < exercisesHistoryRef.current.length - 1) {
      historyPointerRef.current += 1;
      setExercises(exercisesHistoryRef.current[historyPointerRef.current]);
      setCanUndo(historyPointerRef.current > 0);
      setCanRedo(historyPointerRef.current < exercisesHistoryRef.current.length - 1);
      toast.info("Acción rehecha");
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleCopyDay = () => {
    const dayExs = exercises.filter(ex => ex.day_id === activeDay);
    if (dayExs.length === 0) {
      toast.error("No hay ejercicios en este día para copiar");
      return;
    }
    setCopiedDayExercises(dayExs);
    toast.success("Día copiado");
  };

  const handlePasteDay = () => {
    if (!copiedDayExercises || copiedDayExercises.length === 0) return;
    
    const newExercises = copiedDayExercises.map((ex, idx) => ({
      ...ex,
      id: Date.now().toString() + "_" + idx,
      day_id: activeDay,
    }));
    
    commitExercises(prev => [...prev, ...newExercises]);
    toast.success("Ejercicios pegados en el día actual");
  };

  // Hydrate state from loaded plan (edit mode)
  useEffect(() => {
    if (!isEditMode || !loadedPlan || planLoadedRef.current) return;
    planLoadedRef.current = true;

    console.log("[NewPlan] Hydrating plan from DB:", loadedPlan);

    // Set plan metadata
    setPlanTitle(loadedPlan.title);
    setStartDate(new Date(loadedPlan.start_date + "T00:00:00"));
    setEndDate(new Date(loadedPlan.end_date + "T00:00:00"));

    // Build days from loaded plan
    interface LoadedDay {
      id: string;
      day_number: number;
      day_name: string;
      display_order: number;
      training_plan_exercises?: LoadedExercise[];
    }
    interface LoadedExercise {
      id: string;
      stage_id: string | null;
      stage_name: string | null;
      exercise_name: string;
      video_url: string | null;
      series: number;
      reps: string;
      carga: string;
      pause: string;
      notes: string | null;
      display_order: number;
      write_weight?: boolean;
      cardio_duration_min?: number | null;
      circuit_group?: string | null;
    }

    const sortedDays = [...(loadedPlan.training_plan_days || [])].sort(
      (a: LoadedDay, b: LoadedDay) => a.display_order - b.display_order,
    );

    const hydratedDays: Day[] = sortedDays.map((d: LoadedDay) => ({
      id: d.id,
      number: d.day_number,
      name: d.day_name,
    }));

    const hydratedExercises: PlanExercise[] = [];
    for (const day of sortedDays) {
      const dayExercises = [...(day.training_plan_exercises || [])].sort(
        (a: LoadedExercise, b: LoadedExercise) =>
          a.display_order - b.display_order,
      );
      for (const ex of dayExercises) {
          hydratedExercises.push({
          id: ex.id,
          day_id: day.id,
          stage_id: ex.stage_id || "",
          stage_name: ex.stage_name || "",
          exercise_name: ex.exercise_name,
          video_url: ex.video_url,
          series: ex.series,
          reps: ex.reps,
          carga: ex.carga || "-",
          pause: ex.pause,
          notes: ex.notes || "",
          order: ex.display_order,
          write_weight: ex.write_weight ?? false,
          cardio_duration_min: ex.cardio_duration_min ?? undefined,
          circuit_group: ex.circuit_group || null,
        });
      }
    }

    if (hydratedDays.length > 0) {
      setDays(hydratedDays);
      setActiveDay(hydratedDays[0].id);
    }
    if (hydratedExercises.length > 0) {
      setExercises(hydratedExercises);
    }

    // Get assigned count
    const assignedCount = loadedPlan.training_plan_assignments?.[0]?.count || 0;
    setEditAssignedCount(assignedCount);

    // Open assign modal if requested via URL
    if (shouldOpenAssign) {
      setIsAssignModalOpen(true);
    }

    console.log(
      "[NewPlan] Hydrated:",
      hydratedDays.length,
      "days,",
      hydratedExercises.length,
      "exercises",
    );
  }, [loadedPlan, isEditMode, shouldOpenAssign]);

    // No op for initial useEffect since we handle it in activeTab effect

  const handleAddDay = () => {
    if (days.length >= 7) {
      toast.error("El límite máximo es de 7 días");
      return;
    }
    const newDayNumber = days.length + 1;
    const newDay: Day = {
      id: Date.now().toString(),
      number: newDayNumber,
      name: `Día ${newDayNumber}`,
    };
    setDays([...days, newDay]);
    setActiveDay(newDay.id);
    toast.success(`Día ${newDayNumber} agregado`);
  };

  const handleDeleteDay = (dayId: string) => {
    if (days.length === 1) {
      toast.error("Debe haber al menos un día en el plan");
      return;
    }

    setDayToDelete(dayId);
    setIsDeleteDayModalOpen(true);
  };

  const confirmDeleteDay = () => {
    if (!dayToDelete) return;

    const dayId = dayToDelete;
    // Remove exercises for this day
    commitExercises((prev) => prev.filter((ex) => ex.day_id !== dayId));

    // Remove day
    const newDays = days.filter((d) => d.id !== dayId);

    // Re-number days
    const reorderedDays = newDays.map((d, index) => ({
      ...d,
      number: index + 1,
      name: `Día ${index + 1}`,
    }));

    setDays(reorderedDays);

    // Switch active day if needed
    if (activeDay === dayId) {
      setActiveDay(reorderedDays[0].id);
    }
    toast.success("Día eliminado");
    setDayToDelete(null);
    setIsDeleteDayModalOpen(false);
  };

  const handleAddExercise = () => {
    const activeDayExercises = exercises.filter((ex) => ex.day_id === activeDay);

    let defaultStageId = stages.length > 0 ? stages[0].id : "";
    let defaultStageName = stages.length > 0 ? stages[0].name : "";

    if (activeDayExercises.length > 0) {
      const lastExercise = activeDayExercises[activeDayExercises.length - 1];
      defaultStageId = lastExercise.stage_id || "";
      defaultStageName = lastExercise.stage_name || "";
    }

    const newExercise: PlanExercise = {
      id: Date.now().toString(),
      day_id: activeDay,
      stage_id: defaultStageId,
      stage_name: defaultStageName,
      exercise_name: "",
      series: "",
      reps: "",
      carga: "",
      pause: "",
      notes: "",
      order: exercises.length,
      write_weight: false,
    };
    commitExercises((prev) => [...prev, newExercise]);
  };

  const handleDeleteExercise = (id: string) => {
    setExerciseToDelete(id);
    setIsDeleteExerciseModalOpen(true);
  };

  const confirmDeleteExercise = () => {
    if (exerciseToDelete) {
      commitExercises((prev) => prev.filter((ex) => ex.id !== exerciseToDelete));
      setExerciseToDelete(null);
      toast.success("Ejercicio eliminado");
      setIsDeleteExerciseModalOpen(false);
    }
  };

  const handleUpdateExercise = (
    id: string,
    field: keyof PlanExercise,
    value: string | number | boolean,
  ) => {
    commitExercises((prevExercises) =>
      prevExercises.map((ex) =>
        ex.id === id ? { ...ex, [field]: value } : ex,
      ),
    );
  };

  const handleStageChange = (exerciseId: string, stageId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    if (stage) {
      handleUpdateExercise(exerciseId, "stage_id", stageId);
      handleUpdateExercise(exerciseId, "stage_name", stage.name);
    }
  };

  const handleAddStage = async (name: string, color: string) => {
    return await addStage(name, color);
  };

  const handleOpenSaveModal = () => {
    // Validation before opening modal
    const exercisesWithContent = exercises.filter((ex) =>
      ex.exercise_name.trim(),
    );
    if (exercisesWithContent.length === 0) {
      toast.error("El plan debe tener al menos un ejercicio con nombre");
      return;
    }

    if (days.length === 0) {
      toast.error("El plan debe tener al menos un día");
      return;
    }

    setIsSaveModalOpen(true);
  };

  const handleSaveToLibrary = async (formData: SavePlanFormData) => {
    try {
      setIsSaving(true);

      const planPayload = {
        title: formData.name,
        startDate,
        endDate,
        days,
        exercises: exercises.filter((ex) => ex.exercise_name.trim()),
        isTemplate: true,
        durationWeeks: formData.durationWeeks,
      };

      const targetPlanId = isEditMode && planId ? planId : formData.overwritePlanId;
      const result = targetPlanId
        ? await updatePlan(targetPlanId, planPayload)
        : await savePlan(planPayload);

      if (result.success) {
        setSavedPlanId(result.planId!);
        // Mostrar solo el título del toast según el modo (sin descripción)
        toast.success(
          targetPlanId ? "Plan actualizado" : "Plan guardado en biblioteca",
        );
        setIsSaveModalOpen(false);
        if (targetPlanId) {
          navigate("/biblioteca");
        } else {
          // Si guardamos un nuevo plan desde una tab, cerramos la tab actual
          closeTab(activeTabId);
        }
      } else {
        toast.error(`Error al guardar: ${result.error}`);
      }
    } catch (error) {
      console.error("Error saving plan:", error);
      toast.error("Error inesperado al guardar el plan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignPlan = async (studentIds: string[]) => {
    try {
      setIsAssigning(true);

      // If plan is not saved yet, save it first
      let planIdToAssign = savedPlanId || planId;

      if (!planIdToAssign) {
        // Save the plan first
        const saveResult = await savePlan({
          title: planTitle,
          startDate,
          endDate,
          days,
          exercises,
          isTemplate: false,
        });

        if (!saveResult.success) {
          toast.error(saveResult.error || "Error al guardar el plan");
          return;
        }

        planIdToAssign = saveResult.planId!;
        setSavedPlanId(planIdToAssign);
      }

      // Assign to students
      if (assignPlanToStudents && planIdToAssign) {
        const result = await assignPlanToStudents(
          planIdToAssign,
          studentIds,
          startDate,
          endDate,
        );

        if (result.success) {
          toast.success(
            `Plan asignado a ${studentIds.length} ${studentIds.length === 1 ? "alumno" : "alumnos"}`,
          );
          setIsAssignModalOpen(false);
          if (!isEditMode) {
            closeTab(activeTabId);
          }
        } else {
          toast.error(result.error || "Error al asignar plan");
        }
      }
    } catch (error) {
      console.error("Error assigning plan:", error);
      toast.error("Error al asignar plan");
    } finally {
      setIsAssigning(false);
    }
  };

  const getStageColor = (stageName: string) => {
    const stage = stages.find((s) => s.name === stageName);
    return stage?.color || "#3B82F6";
  };

  const handleExerciseSelect = (exerciseId: string, exercise: LibraryExercise) => {
    handleUpdateExercise(exerciseId, "exercise_name", exercise.name);
    handleUpdateExercise(exerciseId, "video_url", exercise.video_url || "");
    handleUpdateExercise(exerciseId, "notes", exercise.notes || "");
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      commitExercises((prev) => {
        const activeDayExs = prev.filter((ex) => ex.day_id === activeDay);
        const otherExs = prev.filter((ex) => ex.day_id !== activeDay);

        const currentBlocks = getBlocksForActiveDay(activeDayExs);
        const oldIndex = currentBlocks.findIndex((b) => b.id === active.id);
        const newIndex = currentBlocks.findIndex((b) => b.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedBlocks = arrayMove(currentBlocks, oldIndex, newIndex);
          const flattenedActiveDayExercises: PlanExercise[] = [];
          let globalOrder = 0;
          
          for (const block of reorderedBlocks) {
            if (block.type === "single") {
              flattenedActiveDayExercises.push({
                ...block.exercise,
                order: globalOrder++,
              });
            } else {
              for (const ex of block.exercises) {
                flattenedActiveDayExercises.push({
                  ...ex,
                  order: globalOrder++,
                });
              }
            }
          }
          return [...otherExs, ...flattenedActiveDayExercises];
        }
        return prev;
      });
    }
  };

  const activeDayExercises = exercises.filter((ex) => ex.day_id === activeDay);
  const activeDayBlocks = getBlocksForActiveDay(activeDayExercises);

  // Mapa fila (posicion en activeDayBlocks) -> ejercicio, solo para bloques
  // "single". Los circuitos quedan afuera de la seleccion tipo planilla
  // (tienen su propia UI de grupo, con series/pausa compartidas).
  const exerciseByRowIndex = new Map<number, PlanExercise>();
  activeDayBlocks.forEach((block, rowIndex) => {
    if (block.type === "single") exerciseByRowIndex.set(rowIndex, block.exercise);
  });

  // Click = seleccionar la celda (como en una planilla de calculo), NO
  // enfocar el input para editar — por eso el preventDefault incondicional.
  // Para escribir: doble-click, o tipear directo (arranca edicion
  // reemplazando el valor, ver handleCellTableKeyDown).
  const handleCellMouseDown = (rowIndex: number, field: SelectableField, e: React.MouseEvent) => {
    e.preventDefault();
    const colIndex = SELECTABLE_FIELDS.indexOf(field);
    if (e.shiftKey && cellSelection) {
      setCellSelection({ ...cellSelection, focusRow: rowIndex, focusCol: colIndex });
    } else {
      cellDragRef.current = { anchorRow: rowIndex, anchorCol: colIndex };
      setCellSelection({ anchorRow: rowIndex, anchorCol: colIndex, focusRow: rowIndex, focusCol: colIndex });
    }
    cellTableRef.current?.focus();
  };

  // Doble-click en una celda: ahi si entra en modo edicion (foco real en el
  // input, texto pre-seleccionado para poder tipear encima).
  const handleCellDoubleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.focus();
    e.currentTarget.select();
  };

  // Arrastre tipo planilla de calculo: como el mousedown ya movio el foco al
  // contenedor (no al input), no hay seleccion nativa de texto que pelear —
  // este listener solo tiene que extender el rectangulo mientras el mouse
  // sigue apretado. Usa elementFromPoint en vez de un listener por celda.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = cellDragRef.current;
      if (!drag) return;

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const cellEl = el?.closest("[data-cell-row][data-cell-field]") as HTMLElement | null;
      if (!cellEl) return;

      const row = Number(cellEl.dataset.cellRow);
      const field = cellEl.dataset.cellField as SelectableField;
      const col = SELECTABLE_FIELDS.indexOf(field);

      setCellSelection((prev) =>
        prev ? { anchorRow: drag.anchorRow, anchorCol: drag.anchorCol, focusRow: row, focusCol: col } : prev,
      );
    };

    const handleMouseUp = () => {
      cellDragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Enfoca el input real de una celda (usado para entrar en modo edicion
  // desde el teclado — Enter/F2, o al empezar a tipear directo).
  const focusCellInput = (rowIndex: number, field: SelectableField) => {
    const inputEl = document.querySelector<HTMLInputElement>(
      `[data-cell-row="${rowIndex}"][data-cell-field="${field}"]`,
    );
    return inputEl;
  };

  const handleClearSelectedCells = () => {
    if (!cellSelection) return;
    const { minRow, maxRow, minCol, maxCol } = getSelectionBounds(cellSelection);

    const idsInRange = new Set<string>();
    for (let r = minRow; r <= maxRow; r++) {
      const ex = exerciseByRowIndex.get(r);
      if (ex) idsInRange.add(ex.id);
    }
    if (idsInRange.size === 0) return;

    commitExercises((prev) =>
      prev.map((ex) => {
        if (!idsInRange.has(ex.id)) return ex;
        let patch: Partial<PlanExercise> = {};
        for (let c = minCol; c <= maxCol; c++) {
          const update = computeFieldUpdate(ex, SELECTABLE_FIELDS[c], "");
          if (update) patch = { ...patch, ...update };
        }
        return Object.keys(patch).length > 0 ? { ...ex, ...patch } : ex;
      }),
    );
    toast.success("Datos borrados");
  };

  const handleCopySelectedCells = async () => {
    if (!cellSelection) return;
    const { minRow, maxRow, minCol, maxCol } = getSelectionBounds(cellSelection);

    const matrix: string[][] = [];
    for (let r = minRow; r <= maxRow; r++) {
      const ex = exerciseByRowIndex.get(r);
      const rowValues: string[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        rowValues.push(ex ? readFieldValue(ex, SELECTABLE_FIELDS[c]) : "");
      }
      matrix.push(rowValues);
    }
    cellClipboardRef.current = matrix;

    try {
      const tsv = matrix.map((row) => row.join("\t")).join("\n");
      await navigator.clipboard.writeText(tsv);
    } catch {
      // Sin permiso de escritura al portapapeles del sistema — el interno
      // (cellClipboardRef) alcanza igual para copiar/pegar dentro de la app.
    }
    toast.success("Datos copiados");
  };

  const handlePasteSelectedCells = async () => {
    if (!cellSelection) return;

    let matrix: string[][] | null = null;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        matrix = text
          .replace(/\r/g, "")
          .split("\n")
          .filter((row) => row.length > 0)
          .map((row) => row.split("\t"));
      }
    } catch {
      // Sin permiso de lectura del portapapeles del sistema — se usa el
      // ultimo bloque copiado dentro de la app (si hay).
    }
    if (!matrix || matrix.length === 0) matrix = cellClipboardRef.current;
    if (!matrix || matrix.length === 0) return;

    const { minRow, minCol } = getSelectionBounds(cellSelection);
    const numCols = matrix[0].length;

    const patchByExerciseId = new Map<string, Partial<PlanExercise>>();
    for (let i = 0; i < matrix.length; i++) {
      const ex = exerciseByRowIndex.get(minRow + i);
      if (!ex) continue;
      let patch = patchByExerciseId.get(ex.id) ?? {};
      for (let j = 0; j < numCols; j++) {
        const targetCol = minCol + j;
        if (targetCol >= SELECTABLE_FIELDS.length) continue;
        const update = computeFieldUpdate(ex, SELECTABLE_FIELDS[targetCol], matrix[i][j] ?? "");
        if (update) patch = { ...patch, ...update };
      }
      patchByExerciseId.set(ex.id, patch);
    }
    if (patchByExerciseId.size === 0) return;

    commitExercises((prev) =>
      prev.map((ex) => {
        const patch = patchByExerciseId.get(ex.id);
        return patch && Object.keys(patch).length > 0 ? { ...ex, ...patch } : ex;
      }),
    );
    toast.success("Datos pegados");
  };

  const handleCellTableKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!cellSelection) return;
    // El evento burbujea desde cualquier input del día (Ejercicio, Notas,
    // etc). Solo interceptamos si el foco real esta en el contenedor mismo
    // — eso es "modo seleccionado" (click simple o arrastre, sin editar
    // ningun input todavia). Si el usuario ya esta escribiendo en un campo
    // (doble-click, o empezo a tipear y el foco paso al input real),
    // e.target va a ser ese input, no el contenedor, y dejamos pasar todo
    // nativo sin tocar nada.
    if (e.target !== cellTableRef.current) return;

    const isMeta = e.ctrlKey || e.metaKey;
    const multi = isMultiCellSelection(cellSelection);

    if (e.key === "Delete" || e.key === "Backspace") {
      // Con 1 sola celda tambien: seleccionada (no en edicion), Supr la
      // borra entera de una — como en cualquier planilla de calculo.
      e.preventDefault();
      handleClearSelectedCells();
      return;
    }
    if (isMeta && e.key.toLowerCase() === "c") {
      e.preventDefault();
      void handleCopySelectedCells();
      return;
    }
    if (isMeta && e.key.toLowerCase() === "v") {
      e.preventDefault();
      void handlePasteSelectedCells();
      return;
    }
    if (e.key === "Escape") {
      setCellSelection(null);
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const deltas: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const [dRow, dCol] = deltas[e.key];
      const maxRow = Math.max(0, activeDayBlocks.length - 1);
      const nextRow = Math.min(Math.max(cellSelection.focusRow + dRow, 0), maxRow);
      const nextCol = Math.min(Math.max(cellSelection.focusCol + dCol, 0), SELECTABLE_FIELDS.length - 1);
      setCellSelection(
        e.shiftKey
          ? { ...cellSelection, focusRow: nextRow, focusCol: nextCol }
          : { anchorRow: nextRow, anchorCol: nextCol, focusRow: nextRow, focusCol: nextCol },
      );
      return;
    }
    if (!multi && (e.key === "Enter" || e.key === "F2")) {
      // Entra en modo edicion sin tocar el valor actual.
      e.preventDefault();
      focusCellInput(cellSelection.focusRow, SELECTABLE_FIELDS[cellSelection.focusCol])?.select();
      return;
    }
    if (!multi && !isMeta && !e.altKey && e.key.length === 1) {
      // Tipear un caracter con 1 sola celda seleccionada: arranca edicion
      // reemplazando el valor (igual que en Excel/Sheets), en vez de que no
      // pase nada porque no hay ningun input enfocado.
      const ex = exerciseByRowIndex.get(cellSelection.focusRow);
      if (!ex) return;
      const field = SELECTABLE_FIELDS[cellSelection.focusCol];
      const update = computeFieldUpdate(ex, field, e.key);
      if (!update) return; // celda bloqueada (circuito/cardio) — no hay nada que tipear

      e.preventDefault();
      commitExercises((prev) =>
        prev.map((item) => (item.id === ex.id ? { ...item, ...update } : item)),
      );
      // Foca el input real recien despues de que el nuevo valor se
      // renderice, con el cursor al final, para que se pueda seguir
      // tipeando de forma nativa. setTimeout (no requestAnimationFrame):
      // no depende de que la pestaña este compositando frames activamente.
      setTimeout(() => {
        const inputEl = focusCellInput(cellSelection.focusRow, field);
        if (inputEl) {
          inputEl.focus();
          const len = inputEl.value.length;
          inputEl.setSelectionRange(len, len);
        }
      });
    }
  };

  const handleCellTableBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setCellSelection(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative min-w-0 bg-background-light dark:bg-background-dark">
      {!isEditMode && (
        <PlannerTabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitchTab={switchTab}
          onCloseTab={closeTab}
          onCreateTab={createTab}
          canCreateMoreTabs={canCreateMoreTabs}
        />
      )}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 z-20">
        <div className="px-8 pt-5 pb-1">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-3 text-xs font-medium text-gray-400">
              <div className="flex items-center gap-2">
                <span className="hover:text-primary cursor-pointer">
                  Planificador
                </span>
                <span className="material-symbols-outlined text-[10px]">
                  chevron_right
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  {isEditMode ? "Editar Plan" : "Nuevo Plan"}
                </span>
              </div>
              {planLoading && (
                <div className="flex items-center gap-1.5 text-[10px] text-primary ml-2">
                  <span className="material-symbols-outlined text-[14px] animate-spin">
                    progress_activity
                  </span>
                  <span>Cargando plan...</span>
                </div>
              )}
              {saveStatus && !planLoading && (
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 ml-2 transition-opacity">
                  {saveStatus === "saving" ? (
                    <>
                      <span className="material-symbols-outlined text-[14px] animate-spin">
                        progress_activity
                      </span>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[14px] text-green-600 dark:text-green-500">
                        check_circle
                      </span>
                      <span className="text-green-600 dark:text-green-500">
                        Cambios guardados
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {!isEditMode && (
                <div className="flex gap-2 text-gray-400 text-sm h-9 items-center px-2 border-r border-gray-200 dark:border-gray-700 mr-2">
                   {tabs.length} / 5 tabs
                </div>
              )}
              {isEditMode && (
                <button
                  onClick={() => navigate("/biblioteca")}
                  className="flex items-center justify-center rounded-lg h-9 px-4 bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 font-bold transition-colors text-sm shadow-sm"
                >
                  <span className="material-symbols-outlined text-lg mr-2">
                    arrow_back
                  </span>
                  Volver a Biblioteca
                </button>
              )}
              <button
                onClick={handleOpenSaveModal}
                className={`flex items-center justify-center rounded-lg h-9 px-5 font-bold transition-colors text-sm shadow-sm ${isEditMode
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
              >
                <span className="material-symbols-outlined text-lg mr-2">
                  {isEditMode ? "sync" : "save"}
                </span>
                {isEditMode ? "Actualizar Plan" : "Guardar en Biblioteca"}
              </button>
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="flex items-center justify-center rounded-lg h-9 px-5 bg-[#0056b3] text-white text-sm font-bold shadow-sm hover:bg-[#004494] transition-colors"
              >
                <span className="material-symbols-outlined text-lg mr-2">
                  person_add
                </span>
                Asignar plan a alumno
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input
              className="w-full max-w-2xl bg-transparent text-2xl font-bold leading-tight border-none p-0 focus:ring-0 text-[#101418] dark:text-white placeholder-gray-400 hover:bg-gray-50 rounded px-1 -ml-1 transition-colors"
              type="text"
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
              placeholder="Nombre del plan..."
            />
            <span className="material-symbols-outlined text-gray-400 text-xl">
              edit
            </span>
          </div>
          {isEditMode && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-2 ${editAssignedCount > 0
                ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {editAssignedCount > 0 ? "warning" : "edit_note"}
              </span>
              {editAssignedCount > 0
                ? `Editando plan con ${editAssignedCount} ${editAssignedCount === 1 ? "alumno asignado" : "alumnos asignados"}. Los cambios se reflejarán en sus planes activos.`
                : 'Modo edición — los cambios se guardarán al hacer click en "Actualizar Plan".'}
            </div>
          )}
        </div>
        <div className="px-8 flex flex-col gap-4 pb-0">
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <DatePicker
                  label="Desde"
                  icon="calendar_today"
                  value={startDate}
                  onChange={setStartDate}
                />
                <span className="text-gray-300 material-symbols-outlined text-sm">
                  arrow_forward
                </span>
                <DatePicker
                  label="Hasta"
                  icon="event"
                  value={endDate}
                  onChange={setEndDate}
                />
              </div>
            </div>
            <div className="flex items-center gap-6"></div>
          </div>
          <div className="flex items-end gap-1 mt-2 overflow-x-auto">
            {days.map((day) => (
              <div key={day.id} className="relative group">
                <button
                  onClick={() => setActiveDay(day.id)}
                  className={`px-6 py-2.5 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeDay === day.id
                    ? "border-primary text-primary bg-white dark:bg-[#1a202c] font-bold"
                    : "border-transparent text-[#5e758d] hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                >
                  {day.name}
                </button>
                {days.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDay(day.id);
                    }}
                    className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 rounded-full shadow-sm hover:scale-110 p-0.5 z-10"
                    title="Eliminar día"
                  >
                    <span className="material-symbols-outlined text-red-500 text-[14px] leading-tight block">
                      delete
                    </span>
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={handleAddDay}
              disabled={days.length >= 7}
              className="ml-2 flex items-center gap-1 px-3 py-2 text-[#5e758d] hover:text-primary font-bold text-xs uppercase tracking-wide transition-colors whitespace-nowrap mb-0.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-[#5e758d]"
            >
              <span className="material-symbols-outlined text-lg">
                add_circle
              </span>
              Agregar Día
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-6">
        {/* Toolbar for Undo/Redo & Copy/Paste */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
               onClick={handleUndo}
               disabled={!canUndo}
               className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
               title="Deshacer (Ctrl+Z)"
            >
              <span className="material-symbols-outlined text-[16px]">undo</span> Deshacer
            </button>
            <button
               onClick={handleRedo}
               disabled={!canRedo}
               className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
               title="Rehacer (Ctrl+Shift+Z)"
            >
               <span className="material-symbols-outlined text-[16px]">redo</span> Rehacer
            </button>
          </div>
          <div className="flex gap-2">
            <button 
               onClick={handleCopyDay} 
               className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 disabled:opacity-50 shadow-sm"
               title="Copiar todos los ejercicios de este día"
            >
               <span className="material-symbols-outlined text-[16px]">content_copy</span> Copiar Día
            </button>
            <button 
               onClick={handlePasteDay} 
               disabled={!copiedDayExercises || copiedDayExercises.length === 0} 
               className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
               title="Pegar los ejercicios copiados en este día"
            >
               <span className="material-symbols-outlined text-[16px]">content_paste</span> Pegar Día
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a202c] shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[900px]">
          <div className="grid grid-cols-[140px_80px_40px_3fr_50px_80px_80px_100px_80px_80px_2fr_50px] gap-0 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-[11px] font-bold text-[#5e758d] uppercase tracking-wider items-center sticky top-0 z-10">
            <div className="py-3 text-center border-r border-gray-200 dark:border-gray-700">
              Etapa
            </div>
            <div className="py-3 text-center border-r border-gray-200 dark:border-gray-700">
              Circuito
            </div>
            <div className="py-3 text-center">#</div>
            <div className="py-3 px-3 border-l border-gray-100 dark:border-gray-800">
              Ejercicio
            </div>
            <div className="py-3 text-center border-l border-gray-100 dark:border-gray-800">
              Video
            </div>
            <div
              className="py-3 text-center border-l border-gray-100 dark:border-gray-800 cursor-help"
              title="Click selecciona (arrastra o shift+click para varias) · Supr borra · doble-click o tipear para editar · Ctrl+C/V copia y pega"
            >
              Series
            </div>
            <div
              className="py-3 text-center border-l border-gray-100 dark:border-gray-800 cursor-help"
              title="Click selecciona (arrastra o shift+click para varias) · Supr borra · doble-click o tipear para editar · Ctrl+C/V copia y pega"
            >
              Reps / Min
            </div>
            <div
              className="py-3 text-center border-l border-gray-100 dark:border-gray-800 cursor-help"
              title="Click selecciona (arrastra o shift+click para varias) · Supr borra · doble-click o tipear para editar · Ctrl+C/V copia y pega"
            >
              Carga (kg)
            </div>
            <div
              className="py-3 text-center border-l border-gray-100 dark:border-gray-800 cursor-help"
              title="Click selecciona (arrastra o shift+click para varias) · Supr borra · doble-click o tipear para editar · Ctrl+C/V copia y pega"
            >
              Pausa (s)
            </div>
            <div className="py-3 text-center border-l border-gray-100 dark:border-gray-800">
              Escribir Peso
            </div>
            <div className="py-3 px-3 border-l border-gray-100 dark:border-gray-800">
              Notas
            </div>
            <div className="py-3 text-center border-l border-gray-100 dark:border-gray-800"></div>
          </div>

          {/* Exercise Rows */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activeDayBlocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                ref={cellTableRef}
                tabIndex={-1}
                onKeyDown={handleCellTableKeyDown}
                onBlur={handleCellTableBlur}
                className="divide-y divide-gray-100 dark:divide-gray-800 outline-none"
              >
                {activeDayBlocks.map((block, rowIndex) => {
                  if (block.type === "single") {
                    let selectedFields: Set<SelectableField> | undefined;
                    if (cellSelection) {
                      const { minRow, maxRow, minCol, maxCol } = getSelectionBounds(cellSelection);
                      if (rowIndex >= minRow && rowIndex <= maxRow) {
                        selectedFields = new Set(
                          SELECTABLE_FIELDS.slice(minCol, maxCol + 1),
                        );
                      }
                    }
                    return (
                      <SortableExerciseRow
                        key={block.id}
                        exercise={block.exercise}
                        stageColor={getStageColor(block.exercise.stage_name || "")}
                        stagesLoading={stagesLoading}
                        stages={stages}
                        handleStageChange={handleStageChange}
                        handleUpdateExercise={handleUpdateExercise}
                        handleExerciseSelect={handleExerciseSelect}
                        handleDeleteExercise={handleDeleteExercise}
                        circuitPosition="none"
                        isInsideCircuit={false}
                        rowIndex={rowIndex}
                        selectedFields={selectedFields}
                        onCellMouseDown={(field, e) => handleCellMouseDown(rowIndex, field, e)}
                        onCellDoubleClick={handleCellDoubleClick}
                      />
                    );
                  } else {
                    return (
                      <CircuitCard
                        key={block.id}
                        id={block.id}
                        circuitGroup={block.circuitGroup}
                        series={block.exercises[0]?.series || ""}
                        onUpdateSeries={(newSeries) => {
                          // Update series for all exercises in this circuit
                          block.exercises.forEach((ex) => {
                            handleUpdateExercise(ex.id, "series", newSeries);
                          });
                        }}
                        restBetweenRounds={block.exercises[block.exercises.length - 1]?.pause || ""}
                        onUpdateRestBetweenRounds={(newRest) => {
                          const lastEx = block.exercises[block.exercises.length - 1];
                          if (lastEx) {
                            handleUpdateExercise(lastEx.id, "pause", newRest);
                          }
                        }}
                      >
                        {block.exercises.map((exercise, index) => {
                          let position: "first" | "middle" | "last" = "middle";
                          if (index === 0) {
                            position = block.exercises.length === 1 ? "last" : "first";
                          } else if (index === block.exercises.length - 1) {
                            position = "last";
                          }
                          return (
                            <SortableExerciseRow
                              key={exercise.id}
                              exercise={exercise}
                              stageColor={getStageColor(exercise.stage_name || "")}
                              stagesLoading={stagesLoading}
                              stages={stages}
                              handleStageChange={handleStageChange}
                              handleUpdateExercise={handleUpdateExercise}
                              handleExerciseSelect={handleExerciseSelect}
                              handleDeleteExercise={handleDeleteExercise}
                              circuitPosition={position}
                              isInsideCircuit={true}
                            />
                          );
                        })}
                      </CircuitCard>
                    );
                  }
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Add New Exercise Button Area */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setIsAddStageModalOpen(true)}
            className="flex items-center justify-center gap-2 h-12 px-6 rounded-lg border-2 border-dashed border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-400 transition-all shadow-sm bg-white dark:bg-gray-800"
            title="Agregar nueva etapa"
          >
            <span className="material-symbols-outlined">add</span>
            <span className="font-bold text-sm">Nueva Etapa</span>
          </button>

          <button
            onClick={handleAddExercise}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-lg border-2 border-dashed border-[#dae0e7] dark:border-gray-600 text-primary hover:bg-primary/5 hover:border-primary transition-all shadow-sm bg-white dark:bg-gray-800"
          >
            <span className="material-symbols-outlined">add_circle</span>
            <span className="font-bold text-sm">Agregar Nuevo Ejercicio</span>
          </button>
        </div>

        <div className="h-12"></div>
      </main>

      {/* Add Stage Modal */}
      <AddStageModal
        isOpen={isAddStageModalOpen}
        onClose={() => setIsAddStageModalOpen(false)}
        onAdd={handleAddStage}
      />

      {/* Assign Plan Modal */}
      <AssignPlanModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onAssign={handleAssignPlan}
        isSubmitting={isAssigning}
        planTitle={planTitle}
        planStartDate={startDate}
        planEndDate={endDate}
      />

      {/* Save Plan Modal */}
      <SavePlanModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveToLibrary}
        isSubmitting={isSaving}
        initialData={{
          title: planTitle,
          daysCount: days.length,
          startDate,
          endDate,
        }}
        currentPlanId={savedPlanId || planId}
      />
      <ConfirmActionModal
        isOpen={isDeleteDayModalOpen}
        onClose={() => setIsDeleteDayModalOpen(false)}
        onConfirm={confirmDeleteDay}
        title="¿Eliminar día?"
        description="Esta acción eliminará el día y todos los ejercicios asignados a él. Esta acción no se puede deshacer."
        confirmText="Eliminar día"
      />

      <ConfirmActionModal
        isOpen={isDeleteExerciseModalOpen}
        onClose={() => setIsDeleteExerciseModalOpen(false)}
        onConfirm={confirmDeleteExercise}
        title="¿Eliminar ejercicio?"
        description="Esta acción eliminará el ejercicio del plan. Esta acción no se puede deshacer."
        confirmText="Eliminar ejercicio"
      />
    </div>
  );
}
