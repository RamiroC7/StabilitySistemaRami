import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ExerciseAutocomplete from "../../components/ExerciseAutocomplete";
import type { PlanExercise } from "../../lib/types";
import type { LibraryExercise } from "@/features/training/store/trainingStore";

interface SortableExerciseRowProps {
    exercise: PlanExercise;
    stageColor: string;
    stagesLoading: boolean;
    stages: { id: string; name: string }[];
    handleStageChange: (exerciseId: string, stageId: string) => void;
    handleUpdateExercise: (exerciseId: string, field: keyof PlanExercise, value: string | number | boolean) => void;
    handleExerciseSelect: (exerciseId: string, selectedExercise: LibraryExercise) => void;
    handleDeleteExercise: (exerciseId: string) => void;
    circuitPosition?: 'first' | 'middle' | 'last' | 'none';
    isInsideCircuit?: boolean;
}

export default function SortableExerciseRow({
    exercise,
    stageColor,
    stagesLoading,
    stages,
    handleStageChange,
    handleUpdateExercise,
    handleExerciseSelect,
    handleDeleteExercise,
    circuitPosition = 'none',
    isInsideCircuit = false,
}: SortableExerciseRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: exercise.id, disabled: isInsideCircuit });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        boxShadow: isDragging ? "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" : "none",
    };

    // Detectar si la etapa es CARDIO
    const isCardio = exercise.stage_name?.toLowerCase() === "cardio";

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return;

        const gridElement = e.currentTarget;
        const rowElement = gridElement.parentElement as HTMLElement;
        if (!rowElement) return;

        const navigables = Array.from(gridElement.querySelectorAll(".navigable-cell")) as HTMLElement[];
        const activeElement = document.activeElement as HTMLElement;
        const index = navigables.findIndex((el) => el === activeElement || el.contains(activeElement));

        if (index === -1) return;

        // Horizontal navigation
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            if (activeElement.tagName === "INPUT" && (activeElement as HTMLInputElement).type === "text") {
                const input = activeElement as HTMLInputElement;
                if (input.selectionStart !== input.selectionEnd) return;
                if (e.key === "ArrowRight" && input.selectionEnd !== input.value.length) return;
                if (e.key === "ArrowLeft" && input.selectionStart !== 0) return;
            }

            if (e.key === "ArrowRight" && index < navigables.length - 1) {
                e.preventDefault();
                const nextEl = navigables[index + 1];
                const toFocus = ["INPUT", "SELECT", "BUTTON"].includes(nextEl.tagName) ? nextEl : nextEl.querySelector("input, select, button");
                if (toFocus) (toFocus as HTMLElement).focus();
            } else if (e.key === "ArrowLeft" && index > 0) {
                e.preventDefault();
                const prevEl = navigables[index - 1];
                const toFocus = ["INPUT", "SELECT", "BUTTON"].includes(prevEl.tagName) ? prevEl : prevEl.querySelector("input, select, button");
                if (toFocus) (toFocus as HTMLElement).focus();
            }
        }

        // Vertical navigation
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            // Allow native select dropdown navigation
            if (activeElement.tagName === "SELECT") return;

            e.preventDefault();
            const targetRow = (e.key === "ArrowUp" ? rowElement.previousElementSibling : rowElement.nextElementSibling) as HTMLElement;

            if (targetRow) {
                const targetNavigables = Array.from(targetRow.querySelectorAll(".navigable-cell")) as HTMLElement[];
                const targetCell = targetNavigables[index];

                if (targetCell) {
                    const toFocus = ["INPUT", "SELECT", "BUTTON"].includes(targetCell.tagName) ? targetCell : targetCell.querySelector("input, select, button");
                    if (toFocus) {
                        (toFocus as HTMLElement).focus();

                        // Select all text for rapid typing/replacement if it's a text input
                        if ((toFocus as HTMLInputElement).tagName === "INPUT" && (toFocus as HTMLInputElement).type === "text") {
                            setTimeout(() => (toFocus as HTMLInputElement).select(), 0);
                        }
                    }
                }
            }
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${isDragging ? "bg-white dark:bg-gray-800 opacity-90" : ""
                }`}
        >
            <div
                className="absolute left-0 top-0 bottom-0 w-1 z-10"
                style={{ backgroundColor: stageColor }}
            ></div>
            <div
                className="grid grid-cols-[140px_80px_40px_3fr_50px_80px_80px_100px_80px_80px_2fr_50px] items-stretch hover:bg-blue-50/30 transition-colors"
                onKeyDown={handleKeyDown}
            >
                {/* Columna: Etapa */}
                <div className="px-2 py-2 flex items-center justify-center border-r border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="relative w-full">
                        <select
                            value={exercise.stage_id}
                            onChange={(e) => handleStageChange(exercise.id, e.target.value)}
                            className={`navigable-cell w-full text-[10px] font-bold uppercase tracking-wide bg-white border rounded py-1.5 pl-2 pr-6 focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer appearance-none shadow-sm ${exercise.stage_id
                                ? "text-primary border-blue-200 dark:border-blue-900"
                                : "text-gray-400 border-gray-200 dark:border-gray-600"
                                }`}
                            disabled={stagesLoading}
                        >
                            {!exercise.stage_id && (
                                <option value="" disabled>
                                    Seleccionar etapa
                                </option>
                            )}
                            {stages.map((stage) => (
                                <option key={stage.id} value={stage.id}>
                                    {stage.name}
                                </option>
                            ))}
                        </select>
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 material-symbols-outlined text-primary text-sm pointer-events-none">
                            arrow_drop_down
                        </span>
                    </div>
                </div>

                {/* Columna: Circuito */}
                <div className="px-2 py-2 flex items-center justify-center border-r border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/30">
                    <div className="relative w-full">
                        <select
                            value={exercise.circuit_group || ""}
                            onChange={(e) => handleUpdateExercise(exercise.id, "circuit_group", e.target.value)}
                            className="navigable-cell w-full text-xs font-semibold bg-white dark:bg-gray-800 border rounded py-1 pl-2 pr-6 focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer appearance-none shadow-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600"
                        >
                            <option value="">—</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                        </select>
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-sm pointer-events-none">
                            arrow_drop_down
                        </span>
                    </div>
                </div>

                {/* Columna: Drag handle */}
                <div className="flex items-center justify-center h-12 text-gray-300 outline-none">
                    {isInsideCircuit ? (
                        <span className="material-symbols-outlined text-sm text-blue-400 dark:text-blue-500 select-none cursor-default" title="En circuito">
                            link
                        </span>
                    ) : (
                        <div
                            className="flex items-center justify-center w-full h-full cursor-grab active:cursor-grabbing hover:text-primary"
                            {...attributes}
                            {...listeners}
                        >
                            <span className="material-symbols-outlined text-lg pointer-events-none">
                                drag_indicator
                            </span>
                        </div>
                    )}
                </div>

                {/* Columna: Ejercicio */}
                <div className="px-3 h-12 flex items-center border-l border-gray-100 dark:border-gray-800">
                    <div className="relative w-full flex items-center gap-2">
                        {isCardio && (
                            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-orange-100 text-orange-600 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800">
                                <span className="material-symbols-outlined text-[11px]">directions_run</span>
                                Cardio
                            </span>
                        )}
                        <div className="navigable-cell flex-1">
                            <ExerciseAutocomplete
                                value={exercise.exercise_name}
                                onChange={(value) => handleUpdateExercise(exercise.id, "exercise_name", value)}
                                onSelectExercise={(selectedExercise) => handleExerciseSelect(exercise.id, selectedExercise)}
                                placeholder="Nombre del ejercicio"
                            />
                        </div>
                    </div>
                </div>

                {/* Columna: Video */}
                <div className="h-12 flex items-center justify-center border-l border-gray-100 dark:border-gray-800">
                    {exercise.video_url ? (
                        <a
                            href={exercise.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                            title="Ver video"
                        >
                            <span className="material-symbols-outlined text-[18px]">
                                play_circle
                            </span>
                        </a>
                    ) : (
                        <span className="material-symbols-outlined text-[18px] text-gray-300">
                            videocam_off
                        </span>
                    )}
                </div>

                {/* Columna: Series */}
                <div className="px-2 h-12 flex items-center justify-center border-l border-gray-100 dark:border-gray-800">
                    {exercise.circuit_group ? (
                        <div className="w-full h-8 rounded bg-gray-50 dark:bg-gray-900/50 border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500" title="Las series se configuran a nivel de circuito">
                            <span className="material-symbols-outlined text-[16px]">lock</span>
                        </div>
                    ) : (
                        <input
                            className="navigable-cell w-full h-8 text-center text-sm font-medium bg-[#f5f7f8] dark:bg-gray-800 rounded border-none focus:ring-1 focus:ring-primary p-0"
                            type="text"
                            inputMode="numeric"
                            value={exercise.series !== undefined && exercise.series !== null ? exercise.series : ""}
                            onChange={(e) => {
                                const val = e.target.value;
                                handleUpdateExercise(exercise.id, "series", val === "" ? "" : parseInt(val) || 0);
                            }}
                        />
                    )}
                </div>

                {/* Columna: Reps / Duración en min (CARDIO) */}
                <div className="px-2 h-12 flex items-center justify-center border-l border-gray-100 dark:border-gray-800">
                    {isCardio ? (
                        <div className="relative w-full flex items-center">
                            <input
                                className="navigable-cell w-full h-8 text-center text-sm font-medium bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800 focus:ring-1 focus:ring-orange-400 p-0 pr-6 text-orange-700 dark:text-orange-300"
                                type="text"
                                inputMode="numeric"
                                placeholder="min"
                                title="Duración en minutos"
                                value={exercise.cardio_duration_min !== undefined && exercise.cardio_duration_min !== null ? exercise.cardio_duration_min : ""}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateExercise(exercise.id, "cardio_duration_min", val === "" ? "" : parseInt(val) || 0);
                                }}
                            />
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 material-symbols-outlined text-orange-400 text-[13px] pointer-events-none">timer</span>
                        </div>
                    ) : (
                        <input
                            className="navigable-cell w-full h-8 text-center text-sm font-medium bg-[#f5f7f8] dark:bg-gray-800 rounded border-none focus:ring-1 focus:ring-primary p-0"
                            type="text"
                            value={exercise.reps}
                            onChange={(e) => handleUpdateExercise(exercise.id, "reps", e.target.value)}
                        />
                    )}
                </div>

                {/* Columna: Carga — oculta en CARDIO */}
                <div className="px-2 h-12 flex items-center justify-center border-l border-gray-100 dark:border-gray-800">
                    {isCardio ? (
                        <div className="w-full h-8 rounded bg-gray-50 dark:bg-gray-900/50 border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
                            <span className="text-gray-300 dark:text-gray-600 text-[11px]">—</span>
                        </div>
                    ) : (
                        <input
                            className="navigable-cell w-full h-8 text-center text-sm font-medium bg-[#f5f7f8] dark:bg-gray-800 rounded border-none focus:ring-1 focus:ring-primary p-0"
                            type="text"
                            value={exercise.carga}
                            onChange={(e) => handleUpdateExercise(exercise.id, "carga", e.target.value)}
                        />
                    )}
                </div>

                {/* Columna: Pausa (siempre visible, con conectores de circuito) */}
                <div className="px-2 h-12 flex items-center justify-center border-l border-gray-100 dark:border-gray-800 relative">
                    {circuitPosition && circuitPosition !== 'none' && (
                        <>
                            {(circuitPosition === 'first' || circuitPosition === 'middle') && (
                                <div className="absolute bottom-0 top-1/2 left-1/2 w-[2px] -translate-x-1/2 bg-blue-400 dark:bg-blue-500/60 z-0 pointer-events-none" />
                            )}
                            {(circuitPosition === 'middle' || circuitPosition === 'last') && (
                                <div className="absolute top-0 bottom-1/2 left-1/2 w-[2px] -translate-x-1/2 bg-blue-400 dark:bg-blue-500/60 z-0 pointer-events-none" />
                            )}
                        </>
                    )}
                    <div className="relative z-10 w-full flex items-center justify-center">
                        <input
                            className={`navigable-cell w-full h-8 text-center text-sm font-medium bg-[#f5f7f8] dark:bg-gray-800 rounded border-none focus:ring-1 focus:ring-primary p-0 ${
                                circuitPosition === 'last' ? "opacity-60 bg-gray-100 dark:bg-gray-900/50 cursor-not-allowed select-none" : ""
                            }`}
                            type="text"
                            value={exercise.pause}
                            onChange={(e) => handleUpdateExercise(exercise.id, "pause", e.target.value)}
                            disabled={circuitPosition === 'last'}
                            placeholder={circuitPosition === 'last' ? "Arriba" : ""}
                            title={circuitPosition === 'last' ? "Pausa de fin de ronda (configurada en el encabezado del circuito)" : ""}
                        />
                        {circuitPosition === 'last' && (
                            <span className="absolute right-1 text-blue-500 dark:text-blue-400 material-symbols-outlined text-[16px] pointer-events-none" title="Pausa de fin de ronda (configurada arriba)">
                                lock
                            </span>
                        )}
                    </div>
                </div>

                {/* Columna: Escribir Peso — oculta en CARDIO */}
                <div className="h-12 flex items-center justify-center border-l border-gray-100 dark:border-gray-800">
                    {isCardio ? (
                        <div className="w-7 h-7 rounded-md border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
                            <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-[14px]">block</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => handleUpdateExercise(exercise.id, "write_weight", !exercise.write_weight)}
                            title="Indicar que el alumno debe escribir el peso"
                            className={`navigable-cell w-7 h-7 rounded-md border-2 flex items-center justify-center transition-all ${exercise.write_weight
                                ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
                                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-emerald-400"
                                }`}
                        >
                            {exercise.write_weight && (
                                <span className="material-symbols-outlined text-[16px] filled">
                                    check
                                </span>
                            )}
                        </button>
                    )}
                </div>

                {/* Columna: Notas */}
                <div className="px-3 h-12 flex items-center border-l border-gray-100 dark:border-gray-800">
                    <input
                        className="navigable-cell w-full text-xs text-[#5e758d] bg-transparent border-none p-0 focus:ring-0 placeholder-gray-300"
                        placeholder="Notas..."
                        type="text"
                        value={exercise.notes || ""}
                        onChange={(e) => handleUpdateExercise(exercise.id, "notes", e.target.value)}
                    />
                </div>

                {/* Columna: Eliminar */}
                <div className="h-12 flex items-center justify-center border-l border-gray-100 dark:border-gray-800 group/row">
                    <button
                        onClick={() => handleDeleteExercise(exercise.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Eliminar ejercicio"
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            delete
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
