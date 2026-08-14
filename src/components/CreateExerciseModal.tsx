import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";
import type { LibraryExercise } from "@/features/training/store/trainingStore";

const exerciseSchema = z.object({
    name: z.string().min(1, "El nombre del ejercicio es requerido"),
    category_id: z.string().min(1, "Debes seleccionar una categoría"),
    video_url: z.string().url("Debe ser una URL válida").optional().or(z.literal("")),
    notes: z.string().optional(),
});

type ExerciseFormValues = z.infer<typeof exerciseSchema>;



interface CreateExerciseModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialName: string;
    onSuccess: (exercise: LibraryExercise) => void;
}

export default function CreateExerciseModal({
    isOpen,
    onClose,
    initialName,
    onSuccess,
}: CreateExerciseModalProps) {
    const { professor } = useAuthStore();
    const { categories, isLoading: isLoadingCats } = useCategories();

    const {
        register,
        handleSubmit,
        setValue,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<ExerciseFormValues>({
        resolver: zodResolver(exerciseSchema),
        defaultValues: {
            name: initialName,
            category_id: "",
            video_url: "",
            notes: "",
        },
    });

    // Hydrate initialName if it changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setValue("name", initialName);
        }
    }, [isOpen, initialName, setValue]);

    // Pre-select the first category when categories become available
    useEffect(() => {
        if (categories.length > 0) {
            setValue("category_id", categories[0].id);
        }
    }, [categories, setValue]);

    const onSubmit = async (data: ExerciseFormValues) => {
        if (!professor) {
            toast.error("Debes iniciar sesión para crear ejercicios");
            return;
        }

        try {
            // 1. Insert into Supabase
            const { data: newExerciseData, error } = await supabase
                .from("exercises")
                .insert({
                    name: data.name.trim(),
                    category_id: data.category_id,
                    video_url: data.video_url?.trim() || null,
                    notes: data.notes?.trim() || null,
                    created_by: professor.id,
                })
                .select('*, category:exercise_categories(id, name, color)')
                .single();

            if (error) throw error;

            toast.success("Ejercicio creado exitosamente");

            onSuccess(newExerciseData as LibraryExercise);

            reset();
            onClose();
        } catch (error) {
            console.error("Error creating exercise:", error);
            toast.error("Error al crear el ejercicio");
        }
    };

    if (!isOpen) return null;

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999999] backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-xl">
                                add_circle
                            </span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                Crear nuevo ejercicio
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Agrega un ejercicio al catálogo global
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            Nombre del Ejercicio <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            {...register("name")}
                            placeholder="Ej: Flexiones Diamante"
                            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm font-medium ${errors.name
                                ? "border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50 dark:bg-red-900/10"
                                : "border-gray-200 dark:border-gray-600 focus:ring-primary focus:border-primary bg-white dark:bg-slate-700"
                                } text-gray-900 dark:text-white transition-colors`}
                            disabled={isSubmitting}
                            autoFocus
                        />
                        {errors.name && (
                            <p className="mt-1.5 text-xs text-red-500 font-medium">
                                {errors.name.message}
                            </p>
                        )}
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            Categoría <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <select
                                {...register("category_id")}
                                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm font-medium pr-8 appearance-none ${errors.category_id
                                    ? "border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50 dark:bg-red-900/10"
                                    : "border-gray-200 dark:border-gray-600 focus:ring-primary focus:border-primary bg-white dark:bg-slate-700"
                                    } text-gray-900 dark:text-white transition-colors disabled:opacity-50`}
                                disabled={isSubmitting || isLoadingCats}
                            >
                                {isLoadingCats ? (
                                    <option value="">Cargando categorías...</option>
                                ) : categories.length === 0 ? (
                                    <option value="">No hay categorías</option>
                                ) : (
                                    categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </option>
                                    ))
                                )}
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 pointer-events-none text-lg">
                                expand_more
                            </span>
                        </div>
                        {errors.category_id && (
                            <p className="mt-1.5 text-xs text-red-500 font-medium">
                                {errors.category_id.message}
                            </p>
                        )}
                    </div>

                    {/* Video URL */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            URL del Video <span className="text-gray-400 font-normal">(Opcional)</span>
                        </label>
                        <input
                            type="text"
                            {...register("video_url")}
                            placeholder="https://youtube.com/..."
                            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm font-medium ${errors.video_url
                                ? "border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50 dark:bg-red-900/10"
                                : "border-gray-200 dark:border-gray-600 focus:ring-primary focus:border-primary bg-white dark:bg-slate-700"
                                } text-gray-900 dark:text-white transition-colors`}
                            disabled={isSubmitting}
                        />
                        {errors.video_url && (
                            <p className="mt-1.5 text-xs text-red-500 font-medium">
                                {errors.video_url.message}
                            </p>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            Notas del Coach <span className="text-gray-400 font-normal">(Opcional)</span>
                        </label>
                        <textarea
                            {...register("notes")}
                            rows={3}
                            placeholder="Instrucciones o detalles adicionales..."
                            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-sm font-medium text-gray-900 dark:text-white resize-none transition-colors"
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Footer actions */}
                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="material-symbols-outlined text-[18px] animate-spin">
                                        progress_activity
                                    </span>
                                    Creando...
                                </>
                            ) : (
                                "Crear y Seleccionar"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
