import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTrainingStore, type LibraryExercise } from '@/features/training/store/trainingStore'
import CreateExerciseModal from './CreateExerciseModal'

interface ExerciseAutocompleteProps {
    value: string
    onChange: (value: string) => void
    onSelectExercise: (exercise: LibraryExercise) => void
    placeholder?: string
}

export default function ExerciseAutocomplete({
    value,
    onChange,
    onSelectExercise,
    placeholder = "Buscar ejercicio..."
}: ExerciseAutocompleteProps) {
    const { globalExercises, isGlobalExercisesLoaded, isGlobalExercisesLoading, fetchGlobalExercises, refreshGlobalExercises } = useTrainingStore()

    const [isOpen, setIsOpen] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

    const updateDropdownPosition = useCallback(() => {
        if (isOpen && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect()
            setDropdownPosition({
                top: rect.bottom,
                left: rect.left,
                // Make sure it's at least 380px wide to show all text regardless of the narrow table cell
                width: Math.max(rect.width, 380)
            })
        }
    }, [isOpen])

    // Focus search input when opening and update position
    useEffect(() => {
        if (isOpen) {
            updateDropdownPosition()

            // Re-calculate position on scroll/resize just in case
            window.addEventListener('scroll', updateDropdownPosition, true)
            window.addEventListener('resize', updateDropdownPosition)
        }

        return () => {
            window.removeEventListener('scroll', updateDropdownPosition, true)
            window.removeEventListener('resize', updateDropdownPosition)
        }
    }, [isOpen, updateDropdownPosition])

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node
            if (
                wrapperRef.current && !wrapperRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const exactMatchExists = useMemo(() => {
        const query = value.trim().toLowerCase();
        if (!query) return true;
        return globalExercises.some(ex => ex.name.toLowerCase() === query);
    }, [value, globalExercises]);

    // Filter exercises locally using useMemo for performance
    const filteredExercises = useMemo(() => {
        if (!value.trim()) {
            return globalExercises;
        }

        const query = value.toLowerCase();
        return globalExercises.filter(ex =>
            ex.name.toLowerCase().includes(query) ||
            ex.category?.name?.toLowerCase().includes(query)
        );
    }, [value, globalExercises]);

    const handleOpen = async () => {
        if (!isOpen) {
            if (!isGlobalExercisesLoaded) {
                fetchGlobalExercises();
            }
            setIsOpen(true)
        }
    }

    // Reset selected index when search changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedIndex(0)
    }, [value])

    // Auto-scroll to selected item
    useEffect(() => {
        if (isOpen && listRef.current) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) {
            if (e.key === 'Enter') {
                e.preventDefault()
                handleOpen()
            }
            return
        }

        const totalOptions = filteredExercises.length + (!isGlobalExercisesLoading && !exactMatchExists ? 1 : 0)

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopPropagation()
            setSelectedIndex((prev) => (prev < totalOptions - 1 ? prev + 1 : prev))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            e.stopPropagation()
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            if (totalOptions === 0) return

            if (selectedIndex < filteredExercises.length) {
                handleSelect(filteredExercises[selectedIndex])
            } else if (!exactMatchExists) {
                setIsOpen(false)
                setIsCreateModalOpen(true)
            }
        } else if (e.key === 'Escape') {
            e.preventDefault()
            setIsOpen(false)
        }
    }

    const handleSelect = (exercise: LibraryExercise) => {
        onSelectExercise(exercise)
        onChange(exercise.name)
        setIsOpen(false)
    }

    const handleExerciseCreated = (newExercise: LibraryExercise) => {
        refreshGlobalExercises()
        onSelectExercise(newExercise)
        onChange(newExercise.name)
        setIsCreateModalOpen(false)
    }

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div
                className="w-full flex items-center cursor-pointer"
                onClick={handleOpen}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value)
                        if (!isOpen) handleOpen()
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={handleOpen}
                    placeholder={placeholder}
                    className="w-full text-sm font-semibold text-[#101418] dark:text-white bg-transparent border-none p-0 focus:ring-0 placeholder-gray-400 cursor-pointer"
                    readOnly={false}
                />
            </div>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-[99999] flex flex-col overflow-hidden"
                    style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`,
                        marginTop: '4px',
                        maxHeight: '380px'
                    }}
                >
                    {/* Results */}
                    <div ref={listRef} className="overflow-y-auto flex-1">
                        {isGlobalExercisesLoading ? (
                            <div className="flex items-center justify-center py-8 gap-2">
                                <span className="material-symbols-outlined text-primary animate-spin text-lg">
                                    progress_activity
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Cargando ejercicios...
                                </span>
                            </div>
                        ) : filteredExercises.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                                <span className="material-symbols-outlined text-3xl text-gray-300 dark:text-gray-600 mb-2">
                                    search_off
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {value ? `Sin resultados para "${value}"` : 'No hay ejercicios disponibles'}
                                </span>
                            </div>
                        ) : (
                            filteredExercises.map((exercise, index) => (
                                <button
                                    key={exercise.id}
                                    type="button"
                                    onClick={() => handleSelect(exercise)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`w-full px-3 py-2.5 text-left transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-b-0 flex items-center gap-3 ${index === selectedIndex ? 'bg-blue-50 dark:bg-slate-700' : 'hover:bg-blue-50 dark:hover:bg-slate-700'}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                            {exercise.name}
                                        </div>
                                        {exercise.category && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                                                    style={{
                                                        backgroundColor: `${exercise.category.color}15`,
                                                        color: exercise.category.color,
                                                        border: `1px solid ${exercise.category.color}30`
                                                    }}
                                                >
                                                    <div
                                                        className="w-1.5 h-1.5 rounded-full"
                                                        style={{ backgroundColor: exercise.category.color }}
                                                    />
                                                    {exercise.category.name}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {exercise.video_url && (
                                        <span className="material-symbols-outlined text-blue-500 text-[20px] flex-shrink-0" title="Tiene video">
                                            play_circle
                                        </span>
                                    )}
                                </button>
                            ))
                        )}

                        {!isGlobalExercisesLoading && !exactMatchExists && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    setIsCreateModalOpen(true);
                                }}
                                onMouseEnter={() => setSelectedIndex(filteredExercises.length)}
                                className={`w-full px-3 py-3 text-left transition-colors border-t border-gray-100 dark:border-gray-700/50 flex items-center gap-3 text-primary group ${selectedIndex === filteredExercises.length ? 'bg-primary/5' : 'hover:bg-primary/5'}`}
                            >
                                <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">add_circle</span>
                                <span className="font-semibold text-sm">
                                    Crear nuevo ejercicio: "{value}"
                                </span>
                            </button>
                        )}
                    </div>

                    {/* Footer with count */}
                    {!isGlobalExercisesLoading && filteredExercises.length > 0 && (
                        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 text-[11px] text-gray-400 font-medium">
                            {filteredExercises.length} ejercicio{filteredExercises.length !== 1 ? 's' : ''} encontrado{filteredExercises.length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>,
                document.body
            )}

            <span className="absolute right-0 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-sm pointer-events-none">
                {isGlobalExercisesLoading ? 'progress_activity' : 'expand_more'}
            </span>

            <CreateExerciseModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                initialName={value}
                onSuccess={handleExerciseCreated}
            />
        </div>
    )
}
