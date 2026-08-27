import { useRef, useId } from "react";
import { X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalFocusTrap } from "@/components/ui/Modal";

interface ConfirmActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description: string;
    confirmText?: string;
    variant?: "danger" | "primary";
}

export default function ConfirmActionModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Eliminar",
    variant = "danger",
}: ConfirmActionModalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    useModalFocusTrap({
        isOpen,
        onClose,
        containerRef,
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                aria-hidden="true"
                onClick={onClose}
            />

            <div
                ref={containerRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
                className={cn(
                    "relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left align-middle shadow-2xl transition-all border border-slate-200 dark:border-slate-800",
                    "animate-in fade-in zoom-in duration-200"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        variant === "danger" ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30"
                    )}>
                        <AlertTriangle className={cn(
                            "h-5 w-5",
                            variant === "danger" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"
                        )} aria-hidden="true" />
                    </div>
                    <h3 id={titleId} className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar modal"
                        className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="mt-2">
                    <p id={descriptionId} className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        {description}
                    </p>
                </div>

                <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <button
                        type="button"
                        className="inline-flex justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={cn(
                            "inline-flex justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-md active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2",
                            variant === "danger"
                                ? "bg-red-600 hover:bg-red-700 shadow-red-500/20 focus:ring-red-500"
                                : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 focus:ring-blue-500"
                        )}
                        onClick={() => onConfirm()}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
