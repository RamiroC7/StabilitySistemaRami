import { useState, useMemo } from "react";
import { useStudents } from "../../hooks/useStudents";
import { Plus, Search, Calendar, ChevronRight, User } from "lucide-react";
import { format, isPast, isToday, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";

export default function PlanExpirations() {
    const { students, loading, error } = useStudents();
    const [searchQuery, setSearchQuery] = useState("");

    const assignmentsList = useMemo(() => {
        if (!students) return [];

        const list = students.flatMap((student) => {
            if (!student.activeAssignments || student.activeAssignments.length === 0) {
                return [];
            }

            return student.activeAssignments.map((assignment) => ({
                studentId: student.id,
                studentName: student.fullName,
                studentImage: student.profileImageUrl,
                isArchived: student.isArchived,
                planTitle: assignment.plan_title,
                startDate: new Date(assignment.start_date + "T00:00:00"),
                endDate: new Date(assignment.end_date + "T00:00:00"),
                daysPerWeek: assignment.days_per_week,
            }));
        });

        // Filtramos alumnos archivados y aplicamos búsqueda si existe
        return list
            .filter((item) => !item.isArchived)
            .filter((item) =>
                searchQuery
                    ? item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.planTitle.toLowerCase().includes(searchQuery.toLowerCase())
                    : true,
            )
            // Ordenamos por fecha de vencimiento (los más próximos a vencer primero)
            .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    }, [students, searchQuery]);

    const getExpirationStatus = (endDate: Date) => {
        if (isPast(endDate) && !isToday(endDate)) {
            return {
                label: "Vencido",
                className: "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
                urgent: true,
            };
        }

        if (isToday(endDate)) {
            return {
                label: "Vence hoy",
                className: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800",
                urgent: true,
            };
        }

        const daysLeft = differenceInDays(endDate, new Date());

        if (daysLeft <= 7) {
            return {
                label: `Vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`,
                className: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
                urgent: false,
            };
        }

        return {
            label: "Activo",
            className: "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
            urgent: false,
        };
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-6xl mx-auto w-full flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">
                                Vencimientos
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Lleva el control de las fechas de vencimiento de los planes de tus alumnos
                            </p>
                        </div>

                        <div className="relative w-full sm:w-72">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <Search size={18} />
                            </span>
                            <input
                                type="text"
                                placeholder="Buscar alumno o plan..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-10 pl-10 pr-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                            <p className="text-red-800 dark:text-red-200 text-sm">
                                <strong>Error:</strong> No se pudieron cargar los datos.
                            </p>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                        {loading ? (
                            <div className="flex-1 flex items-center justify-center p-12">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : assignmentsList.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-4">
                                    <Calendar className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                    No hay planes asignados
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                                    {searchQuery ? "No se encontraron resultados para tu búsqueda." : "Actualmente ninguno de tus alumnos activos tiene un plan."}
                                </p>
                                <Link
                                    to="/planificador"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                                >
                                    <Plus size={18} />
                                    Ir al planificador
                                </Link>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="px-6 py-4">Alumno</th>
                                            <th className="px-6 py-4">Plan Asignado</th>
                                            <th className="px-6 py-4">Inicio</th>
                                            <th className="px-6 py-4">Fin</th>
                                            <th className="px-6 py-4">Estado</th>
                                            <th className="px-6 py-4 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {assignmentsList.map((assignment, index) => {
                                            const status = getExpirationStatus(assignment.endDate);

                                            return (
                                                <tr
                                                    key={`${assignment.studentId}-${index}`}
                                                    className="group hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                                {assignment.studentImage ? (
                                                                    <img
                                                                        src={assignment.studentImage}
                                                                        alt={assignment.studentName}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <User className="w-4 h-4 text-slate-400" />
                                                                )}
                                                            </div>
                                                            <span className="font-semibold text-slate-900 dark:text-white">
                                                                {assignment.studentName}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                            {assignment.planTitle}
                                                        </span>
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            {assignment.daysPerWeek} días/sem
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                        {format(assignment.startDate, "d MMM yyyy", { locale: es })}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`font-medium ${status.urgent ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                                            {format(assignment.endDate, "d MMM yyyy", { locale: es })}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${status.className}`}>
                                                            {status.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Link
                                                            to={`/alumno/${assignment.studentId}`}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:text-white border border-primary/30 hover:bg-primary rounded-lg transition-all"
                                                        >
                                                            Ver Perfil
                                                            <ChevronRight className="w-3.5 h-3.5" />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
