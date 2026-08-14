import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface CircuitCardProps {
    id: string;
    circuitGroup: string;
    series: string | number;
    onUpdateSeries: (value: string | number) => void;
    restBetweenRounds: string | number;
    onUpdateRestBetweenRounds: (value: string) => void;
    children: React.ReactNode;
}

export default function CircuitCard({ 
    id, 
    circuitGroup, 
    series, 
    onUpdateSeries, 
    restBetweenRounds,
    onUpdateRestBetweenRounds,
    children 
}: CircuitCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        boxShadow: isDragging ? "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" : "none",
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`border-2 border-blue-200 dark:border-blue-900 rounded-lg my-4 overflow-hidden bg-blue-50/5 dark:bg-blue-950/5 shadow-sm transition-shadow ${
                isDragging ? "bg-white dark:bg-gray-800 opacity-90 border-primary" : ""
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/30 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/60">
                <div className="flex items-center gap-2">
                    <div
                        className="flex items-center justify-center text-gray-400 cursor-grab active:cursor-grabbing hover:text-primary outline-none"
                        {...attributes}
                        {...listeners}
                    >
                        <span className="material-symbols-outlined text-lg pointer-events-none">
                            drag_indicator
                        </span>
                    </div>
                    <span className="font-bold text-sm text-[#0056b3] dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-lg">layers</span>
                        Circuito {circuitGroup}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Series:
                        </span>
                        <input
                            className="w-12 h-8 text-center text-sm font-semibold bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-900 focus:ring-1 focus:ring-primary p-0 shadow-sm"
                            type="text"
                            inputMode="numeric"
                            value={series !== undefined && series !== null ? series : ""}
                            onChange={(e) => {
                                const val = e.target.value;
                                onUpdateSeries(val === "" ? "" : parseInt(val) || 0);
                            }}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide" title="Descanso al terminar una vuelta completa del circuito">
                            Descanso entre series (s):
                        </span>
                        <input
                            className="w-16 h-8 text-center text-sm font-semibold bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-900 focus:ring-1 focus:ring-primary p-0 shadow-sm text-center"
                            type="text"
                            placeholder="ej: 90"
                            value={restBetweenRounds !== undefined && restBetweenRounds !== null ? restBetweenRounds : ""}
                            onChange={(e) => {
                                onUpdateRestBetweenRounds(e.target.value);
                            }}
                        />
                    </div>
                </div>
            </div>
            {/* Rows */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white/30 dark:bg-gray-900/30">
                {children}
            </div>
        </div>
    );
}
