import { useState } from "react"
import { useNavigate } from "react-router-dom"
import RoutineList from "./RoutineList"
import ExerciseList from "./ExerciseList"

export default function Library() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<'routines' | 'exercises'>('routines')
    const [searchQuery, setSearchQuery] = useState("")

    // Lifted states for Exercise modals
    const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false)
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

    return (
        <div className="flex flex-col h-full overflow-hidden relative min-w-0 bg-background-light dark:bg-background-dark">
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-none">
                <div className="px-4 pt-4 md:px-8 md:pt-6">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">Biblioteca</h1>
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 dark:border-slate-700 gap-4">
                        <div className="flex gap-4 md:gap-8 overflow-x-auto">
                            <button
                                onClick={() => setActiveTab('routines')}
                                className={`pb-3 px-2 border-b-[3px] font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'routines'
                                    ? "border-primary text-primary"
                                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300"
                                    }`}
                            >
                                Planes y Rutinas
                            </button>
                            <button
                                onClick={() => setActiveTab('exercises')}
                                className={`pb-3 px-2 border-b-[3px] font-bold text-sm transition-colors whitespace-nowrap ${activeTab === 'exercises'
                                    ? "border-primary text-primary"
                                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300"
                                    }`}
                            >
                                Base de Ejercicios
                            </button>
                        </div>

                        <div className="flex items-center gap-2 pb-2 flex-none">
                            <div className="relative w-full sm:w-48 lg:w-64">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                    <span className="material-symbols-outlined text-[18px]">search</span>
                                </span>
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-8 pl-9 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                    placeholder={activeTab === 'routines' ? "Buscar rutina..." : "Buscar ejercicio..."}
                                    type="text"
                                />
                            </div>
                            {activeTab === 'routines' ? (
                                <button
                                    onClick={() => navigate("/planificador?mode=new")}
                                    className="h-8 px-3 bg-primary hover:bg-primary-dark text-white rounded-lg shadow-sm hover:shadow flex items-center justify-center gap-1.5 transition-all duration-200 font-bold text-xs whitespace-nowrap"
                                >
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                    Crear Plantilla
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsCategoryModalOpen(true)}
                                        className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:border-primary/30 transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">settings</span>
                                        Gestionar Categorías
                                    </button>
                                    <button
                                        onClick={() => setIsExerciseModalOpen(true)}
                                        className="h-8 px-3 bg-primary hover:bg-primary-dark text-white rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">add</span>
                                        Nuevo Ejercicio
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-background-light dark:bg-background-dark">
                {activeTab === 'routines' ? (
                    <RoutineList searchQuery={searchQuery} />
                ) : (
                    <ExerciseList
                        searchQuery={searchQuery}
                        isModalOpen={isExerciseModalOpen}
                        setIsModalOpen={setIsExerciseModalOpen}
                        isCategoryModalOpen={isCategoryModalOpen}
                        setIsCategoryModalOpen={setIsCategoryModalOpen}
                    />
                )}
            </main>
        </div>
    )
}
