import { useState } from 'react';

interface AddStageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (name: string, color: string) => Promise<{ success: boolean; error?: string }>;
}

const PRESET_COLORS = [
    { name: 'Azul', value: '#3B82F6' },
    { name: 'Verde', value: '#10B981' },
    { name: 'Morado', value: '#8B5CF6' },
    { name: 'Rojo', value: '#EF4444' },
    { name: 'Amarillo', value: '#F59E0B' },
    { name: 'Rosa', value: '#EC4899' },
];

export default function AddStageModal({ isOpen, onClose, onAdd }: AddStageModalProps) {
    const [name, setName] = useState('');
    const [color, setColor] = useState('#3B82F6');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('El nombre es requerido');
            return;
        }

        setIsSubmitting(true);
        setError('');

        const result = await onAdd(name.trim(), color);

        if (result.success) {
            setName('');
            setColor('#3B82F6');
            onClose();
        } else {
            setError(result.error || 'Error al agregar la etapa');
        }

        setIsSubmitting(false);
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setName('');
            setColor('#3B82F6');
            setError('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Agregar Nueva Etapa</h2>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nombre de la Etapa
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej: Fuerza Máxima"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Color
                        </label>
                        <div className="grid grid-cols-6 gap-2">
                            {PRESET_COLORS.map((preset) => (
                                <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => setColor(preset.value)}
                                    className={`w-10 h-10 rounded-lg border-2 transition-all ${color === preset.value
                                            ? 'border-gray-900 dark:border-white scale-110'
                                            : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: preset.value }}
                                    title={preset.name}
                                    disabled={isSubmitting}
                                />
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
                                    Agregando...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">add</span>
                                    Agregar Etapa
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
