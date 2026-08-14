import { useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { useCategories, type ExerciseCategory } from "@/hooks/useCategories"

interface CategoryManagerProps {
    isOpen: boolean
    onClose: () => void
    onCategoryCreated?: () => void
}

const COLOR_OPTIONS = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
    '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1'
]

export default function CategoryManager({ isOpen, onClose, onCategoryCreated }: CategoryManagerProps) {
    const { categories, isLoading: isLoadingCats, reload } = useCategories()
    const [isLoadingMut, setIsLoadingMut] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        color: '#3B82F6'
    })

    // Ya no es necesario el fetchCategories local porque useCategories se encarga.
    // Solo mostramos loading spinner si isLoadingCats o isLoadingMut son true
    const isLoading = isLoadingCats || isLoadingMut

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name.trim()) {
            toast.error('El nombre es requerido')
            return
        }

        setIsLoadingMut(true)
        try {
            if (editingId) {
                // Update existing category
                const { error } = await supabase
                    .from('exercise_categories')
                    .update({
                        name: formData.name.trim(),
                        color: formData.color
                    })
                    .eq('id', editingId)

                if (error) throw error
                toast.success('Categoría actualizada')
            } else {
                // Create new category
                const { error } = await supabase
                    .from('exercise_categories')
                    .insert({
                        name: formData.name.trim(),
                        color: formData.color
                    })

                if (error) throw error
                toast.success('Categoría creada exitosamente')
                onCategoryCreated?.()
            }

            // Reset form
            setFormData({ name: '', color: '#3B82F6' })
            setEditingId(null)
            setIsCreating(false)
            reload() // <-- Invalida caché para que otros componentes se enteren
        } catch (error: unknown) {
            console.error('Error saving category:', error)
            if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
                toast.error('Ya existe una categoría con ese nombre')
            } else {
                toast.error('Error al guardar la categoría')
            }
        } finally {
            setIsLoadingMut(false)
        }
    }

    const handleEdit = (category: ExerciseCategory) => {
        setFormData({
            name: category.name,
            color: category.color
        })
        setEditingId(category.id)
        setIsCreating(true)
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de eliminar la categoría "${name}"?`)) {
            return
        }

        setIsLoadingMut(true)
        try {
            const { error } = await supabase
                .from('exercise_categories')
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.success('Categoría eliminada')
            reload() // <-- Invalida y recarga
        } catch (error) {
            console.error('Error deleting category:', error)
            toast.error('Error al eliminar la categoría')
        } finally {
            setIsLoadingMut(false)
        }
    }

    const handleCancel = () => {
        setFormData({ name: '', color: '#3B82F6' })
        setEditingId(null)
        setIsCreating(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-lg">Gestionar Categorías</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Create/Edit Form */}
                    {isCreating ? (
                        <form onSubmit={handleSubmit} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-4">
                            <h4 className="font-semibold text-sm">
                                {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
                            </h4>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nombre *</label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                                    placeholder="Ej: Fuerza"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Color</label>
                                <div className="flex gap-2">
                                    {COLOR_OPTIONS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color })}
                                            className={cn(
                                                "w-8 h-8 rounded-full border-2 transition-all",
                                                formData.color === color
                                                    ? "border-slate-900 dark:border-white scale-110"
                                                    : "border-transparent hover:scale-105"
                                            )}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg disabled:opacity-50"
                                >
                                    {editingId ? 'Actualizar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[20px]">add</span>
                            Nueva Categoría
                        </button>
                    )}

                    {/* Categories List */}
                    <div className="space-y-2">
                        <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400">
                            Categorías Existentes ({categories.length})
                        </h4>

                        {isLoading && categories.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                Cargando...
                            </div>
                        ) : categories.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                No hay categorías creadas
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {categories.map((category) => (
                                    <div
                                        key={category.id}
                                        className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm transition-shadow"
                                    >
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: category.color }}
                                        >
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm text-slate-900 dark:text-white">
                                                {category.name}
                                            </p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleEdit(category)}
                                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                title="Editar"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(category.id, category.name)}
                                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                title="Eliminar"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
