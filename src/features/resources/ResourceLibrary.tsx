

export default function ResourceLibrary() {
    return (
        <div className="flex flex-col h-full overflow-hidden relative min-w-0 bg-background-light dark:bg-background-dark">
            <header className="bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="px-8 pt-8 pb-0">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Biblioteca</h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Gestiona tus rutinas y base de datos de ejercicios.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="p-2 text-slate-400 hover:text-primary transition-colors rounded-full hover:bg-blue-50 dark:hover:bg-slate-800">
                                <span className="material-symbols-outlined">notifications</span>
                            </button>
                            <button className="p-2 text-slate-400 hover:text-primary transition-colors rounded-full hover:bg-blue-50 dark:hover:bg-slate-800">
                                <span className="material-symbols-outlined">settings</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-8">
                        <button className="pb-4 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-b-2 border-transparent transition-all">
                            Planes y Rutinas
                        </button>
                        <button className="pb-4 text-sm font-bold text-primary dark:text-blue-400 border-b-2 border-primary dark:border-blue-400 transition-all">
                            Base de Ejercicios
                        </button>
                    </div>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-surface-light dark:bg-surface-dark p-4 rounded-xl shadow-soft border border-slate-200/60 dark:border-slate-800">
                        <div className="flex flex-1 w-full lg:w-auto gap-4 items-center">
                            <div className="relative w-full lg:max-w-md group">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">search</span>
                                </span>
                                <input className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white placeholder:text-slate-400 transition-all" placeholder="Buscar por nombre..." type="text" />
                            </div>
                            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden lg:block"></div>
                            <div className="hidden lg:flex gap-2 overflow-x-auto hide-scrollbar">
                                <button className="whitespace-nowrap px-4 py-2 bg-primary text-white text-xs font-medium rounded-full shadow-sm hover:shadow-md hover:bg-primary-hover transition-all">Todos</button>
                                <button className="whitespace-nowrap px-4 py-2 bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-medium rounded-full transition-colors">Piernas</button>
                                <button className="whitespace-nowrap px-4 py-2 bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-medium rounded-full transition-colors">Pectorales</button>
                                <button className="whitespace-nowrap px-4 py-2 bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-medium rounded-full transition-colors">Espalda</button>
                            </div>
                            <div className="lg:hidden">
                                <button className="flex items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
                                    <span className="material-symbols-outlined text-[20px]">filter_list</span>
                                </button>
                            </div>
                        </div>
                        <button className="w-full lg:w-auto whitespace-nowrap bg-primary hover:bg-primary-hover text-white text-sm font-semibold py-2.5 px-6 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 transition-all active:scale-[0.98]">
                            <span className="material-symbols-outlined text-[20px]">add</span>
                            <span>Nuevo Ejercicio</span>
                        </button>
                    </div>
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-soft border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                                    <th className="px-6 py-4 w-32">Video</th>
                                    <th className="px-6 py-4 w-1/4">Ejercicio</th>
                                    <th className="px-6 py-4">Observaciones Técnicas</th>
                                    <th className="px-6 py-4 w-24 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                <tr className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-slate-200 shadow-sm group-hover:shadow-md transition-shadow cursor-pointer">
                                            <img alt="Woman doing bulgarian split squats in gym" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAu-GRFzCWqmCBBtxeS6QqJKXTlTivcF4kXJJ05MsCNn2bAvtPtzPui11eBly-jkSeVqG4M9OlsG7hm5J2PIkuI1bnaE6p2FIlgfOKfgnyXypx54cBlOrX41YWqIwMD2T5GtWkgnJ0w17z2W4XavwqPOAYINAmbtBLCKg1DtuKiHx-tY0npyHM5dOlCNzeFBR4qhTHfomPX54YpDCI3b6U4iOk1t6FWRTwQsIuzHHIYLt_xdME6eD1xmhZGsFeuQ3YypNB9KtuVjCzI" />
                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/30 transition-colors">
                                                <span className="material-symbols-outlined text-white text-[24px]">play_circle</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="font-bold text-slate-900 dark:text-white text-sm">Sentadilla Búlgara</span>
                                            <span className="inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
                                                Piernas
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                                            Bajar controlado hasta 90 grados, mantener el torso inclinado levemente hacia adelante. Asegurar estabilidad en el pie de apoyo.
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 text-right align-middle">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 text-primary hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Editar">
                                                <span className="material-symbols-outlined text-[20px]">edit</span>
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Eliminar">
                                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {/* Additional rows can be added here following the same pattern */}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
