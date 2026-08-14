import { useSearchParams } from "react-router-dom";
import { useBusinessMetrics, type GenderEntry } from "@/hooks/useBusinessMetrics";
import LandingAnalytics from "@/features/metrics/LandingAnalytics";
import { Users, Globe } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from "recharts";

// --- Loading Skeleton ---
function MetricCardSkeleton() {
  return (
    <div className={`bg-white dark:bg-surface-light rounded-xl p-6 shadow-card border border-gray-200 dark:border-border-light h-[156px] animate-pulse`}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-3 bg-gray-200 rounded w-32" />
        <div className="h-8 w-8 bg-gray-200 rounded-md" />
      </div>
      <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
      <div className="h-8 bg-gray-100 rounded w-full mt-auto" />
    </div>
  );
}

// --- Donut Chart ---
const CIRCUMFERENCE = 2 * Math.PI * 40;

function DonutChart({
  genderDistribution,
  total,
}: {
  genderDistribution: GenderEntry[];
  total: number;
}) {
  const hasData = total > 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full aspect-square max-w-[200px] mb-6">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* background track */}
          <circle cx="50" cy="50" fill="none" r="40" stroke="#f3f4f6" strokeWidth="10" />

          {hasData ? (
            genderDistribution.map((seg) => (
              <circle
                key={seg.label}
                cx="50"
                cy="50"
                fill="none"
                r="40"
                stroke={seg.stroke}
                strokeWidth="10"
                strokeDasharray={seg.dashArray}
                strokeDashoffset={seg.dashOffset}
                strokeLinecap="round"
              />
            ))
          ) : (
            <circle
              cx="50" cy="50" fill="none" r="40"
              stroke="#e5e7eb" strokeWidth="10"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-gray-400">Total</span>
          <span className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{total}</span>
        </div>
      </div>

      {hasData ? (
        <div className="flex items-center justify-center gap-4 w-full flex-wrap">
          {genderDistribution.map((seg) => (
            <div key={seg.label} className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.stroke }} />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{seg.label}</span>
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{seg.percent}%</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center">Sin datos de género registrados</p>
      )}
    </div>
  );
}

// --- Main Component ---
export default function BusinessMetrics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "landing" ? "landing" : "system";

  const { metrics, historicalData, selectedMonth, setSelectedMonth, isLoading, error } = useBusinessMetrics();

  const handleTabChange = (tab: "system" | "landing") => {
    if (tab === "landing") {
      setSearchParams({ tab: "landing" });
    } else {
      setSearchParams({});
    }
  };

  // Generar opciones de meses (a partir de febrero de 2026)
  const generateMonthsOptions = () => {
    const options = [];
    const now = new Date();
    // Limitar hasta febrero de 2026 (año 2026, mes índice 1)
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      if (d.getFullYear() < 2026 || (d.getFullYear() === 2026 && d.getMonth() < 1)) {
        break;
      }
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
      const capLabel = label.charAt(0).toUpperCase() + label.slice(1);
      options.push({ value, label: capLabel });
    }
    return options;
  };

  const monthOptions = generateMonthsOptions();

  // Formatear data histórica de género para el gráfico
  const formattedGenderHistory = historicalData.map((h) => ({
    name: h.label,
    Hombres: h.gender.male,
    Mujeres: h.gender.female,
    Otros: h.gender.other,
  }));

  // Formatear data histórica de activos/nuevos para el gráfico
  const formattedEnrollmentHistory = historicalData.map((h) => ({
    name: h.label,
    Activos: h.activeStudents,
    Nuevos: h.newStudents,
  }));

  // Preparar datos para gráficos de RPE y Actividad
  const dayLabelsMap: Record<string, string> = {
    Lun: "Lunes",
    Mar: "Martes",
    Mié: "Miércoles",
    Jue: "Jueves",
    Vie: "Viernes",
    Sáb: "Sábado",
    Dom: "Domingo"
  };

  const activityDaysData = Object.entries(metrics?.peakActivity?.days ?? {}).map(([day, count]) => ({
    name: day,
    fullName: dayLabelsMap[day] || day,
    Cantidad: count,
  }));

  const rpeDistributionData = Object.entries(metrics?.rpeDistribution?.counts ?? {}).map(([rpe, count]) => ({
    rpe: `RPE ${rpe}`,
    Cantidad: count,
    val: parseInt(rpe),
  }));

  // Calcular porcentaje de cambio emocional
  const emoTotal = metrics?.emotionalImpact?.total ?? 0;
  const emoImproved = metrics?.emotionalImpact?.improved ?? 0;
  const emoStable = metrics?.emotionalImpact?.stable ?? 0;
  const emoFatigued = metrics?.emotionalImpact?.fatigued ?? 0;
  
  const emoPositivePercent = emoTotal > 0 
    ? Math.round(((emoImproved + emoStable) / emoTotal) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark relative">
      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        
        {/* Header con título y Selector de Mes */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Estadísticas</h1>
            <p className="text-sm text-gray-500 mt-1">Monitorea el rendimiento del sistema y las analíticas de tu landing page.</p>
          </div>

          {activeTab === "system" && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Mes de análisis:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border border-slate-200 dark:border-border-light bg-white dark:bg-surface-light rounded-xl text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium cursor-pointer"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Tabs de Navegación entre Sistemas de Estadísticas ── */}
        <div className="flex items-center gap-2 mb-8 bg-white dark:bg-surface-light p-1.5 rounded-2xl border border-gray-200 dark:border-border-light shadow-sm w-fit">
          <button
            onClick={() => handleTabChange("system")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === "system"
                ? "bg-primary text-white shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Métricas del Gimnasio</span>
          </button>
          
          <button
            onClick={() => handleTabChange("landing")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === "landing"
                ? "bg-red-600 text-white shadow-md"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface"
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Landing Page Analytics</span>
          </button>
        </div>

        {activeTab === "landing" ? (
          <LandingAnalytics />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <span className="material-symbols-outlined text-red-400 text-5xl mb-3">error_outline</span>
            <p className="text-gray-600 font-medium">No se pudieron cargar las métricas</p>
            <p className="text-sm text-gray-400 mt-1">{error}</p>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-8 pb-8">

            {/* --- 1. Tarjetas Métricas Principales --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

              {/* Alumnos Activos */}
              {isLoading ? <MetricCardSkeleton /> : (
                <div className="bg-white dark:bg-surface-light rounded-xl p-6 shadow-card border border-gray-200 dark:border-border-light flex flex-col h-[140px] relative overflow-hidden group hover:border-blue-200 transition-all">
                  <div className="flex items-center justify-between relative z-10 mb-2">
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Alumnos Activos</span>
                    <span className="material-symbols-outlined text-primary bg-blue-50 dark:bg-blue-950/40 p-1.5 rounded-md text-[20px]">groups</span>
                  </div>
                  <div className="relative z-10 mt-auto">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">{metrics?.activeStudents ?? 0}</span>
                  </div>
                  <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-primary/5 rounded-full group-hover:scale-110 transition-transform" />
                </div>
              )}

              {/* Nuevos este Mes */}
              {isLoading ? <MetricCardSkeleton /> : (
                <div className="bg-white dark:bg-surface-light rounded-xl p-6 shadow-card border border-gray-200 dark:border-border-light flex flex-col h-[140px] relative overflow-hidden group hover:border-green-200 transition-all">
                  <div className="flex items-center justify-between relative z-10 mb-2">
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Nuevos en el Mes</span>
                    <span className="material-symbols-outlined text-green-600 bg-green-50 dark:bg-green-950/40 p-1.5 rounded-md text-[20px]">person_add</span>
                  </div>
                  <div className="relative z-10 mt-auto flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {metrics?.newThisMonth ?? 0}
                    </span>
                    {metrics && metrics.growthPercent !== null && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${metrics.growthPercent >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {metrics.growthPercent >= 0 ? "+" : ""}{metrics.growthPercent}% vs ant.
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-green-500/5 rounded-full group-hover:scale-110 transition-transform pointer-events-none" />
                </div>
              )}

              {/* Tasa de Retención */}
              {isLoading ? <MetricCardSkeleton /> : (
                <div className="bg-white dark:bg-surface-light rounded-xl p-6 shadow-card border border-gray-200 dark:border-border-light flex flex-col h-[140px] relative overflow-hidden group hover:border-indigo-200 transition-all">
                  <div className="flex items-center justify-between relative z-10 mb-2">
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Retención de Clientes</span>
                    <span className="material-symbols-outlined text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 p-1.5 rounded-md text-[20px]">calculate</span>
                  </div>
                  <div className="relative z-10 mt-auto">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {metrics?.retentionPercent != null ? `${metrics.retentionPercent}%` : "—"}
                    </span>
                  </div>
                  <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-indigo-500/5 rounded-full group-hover:scale-110 transition-transform pointer-events-none" />
                </div>
              )}

              {/* Promedio de Edad */}
              {isLoading ? <MetricCardSkeleton /> : (
                <div className="bg-white dark:bg-surface-light rounded-xl p-6 shadow-card border border-gray-200 dark:border-border-light flex flex-col h-[140px] relative overflow-hidden group hover:border-orange-200 transition-all">
                  <div className="flex items-center justify-between relative z-10 mb-2">
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Promedio de Edad</span>
                    <span className="material-symbols-outlined text-orange-500 bg-orange-50 dark:bg-orange-950/40 p-1.5 rounded-md text-[20px]">cake</span>
                  </div>
                  <div className="relative z-10 mt-auto">
                    {metrics?.averageAge != null ? (
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        {metrics.averageAge} <span className="text-base font-medium text-gray-500">años</span>
                      </span>
                    ) : (
                      <span className="text-4xl font-bold text-gray-400">—</span>
                    )}
                  </div>
                  <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-orange-500/5 rounded-full group-hover:scale-110 transition-transform" />
                </div>
              )}
            </div>

            {/* --- 2. Frecuencia de Entrenamiento y Días/Horas de Actividad --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Frecuencia Real vs Planificada */}
              <div className="lg:col-span-5 bg-white dark:bg-surface-light rounded-xl shadow-card border border-gray-200 dark:border-border-light p-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">fitness_center</span>
                    Frecuencia de Entrenamiento
                  </h2>
                  <p className="text-sm text-gray-500 mb-6">Promedio de entrenamientos semanales por alumno activo.</p>
                </div>

                {isLoading ? (
                  <div className="h-32 bg-gray-100 animate-pulse rounded-lg" />
                ) : (
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-semibold text-slate-500 uppercase">Planificado</span>
                        <div className="text-3xl font-extrabold text-slate-700 dark:text-slate-200 mt-1">
                          {metrics?.trainingFrequency?.planned ?? 0}
                        </div>
                        <span className="text-[10px] text-slate-400">días/semana</span>
                      </div>
                      
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Real (Logueado)</span>
                        <div className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                          {metrics?.trainingFrequency?.real ?? 0}
                        </div>
                        <span className="text-[10px] text-emerald-500">días/semana</span>
                      </div>
                    </div>

                    <div className="w-full">
                      <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                        <span>Progreso de adherencia</span>
                        <span>
                          {metrics?.trainingFrequency && metrics.trainingFrequency.planned > 0
                            ? Math.min(100, Math.round((metrics.trainingFrequency.real / metrics.trainingFrequency.planned) * 100))
                            : 0}%
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                          style={{
                            width: `${
                              metrics?.trainingFrequency && metrics.trainingFrequency.planned > 0
                                ? Math.min(100, Math.round((metrics.trainingFrequency.real / metrics.trainingFrequency.planned) * 100))
                                : 0
                            }%`
                          }}
                        />
                      </div>
                    </div>

                    <p className="text-xs italic text-gray-500 text-center mt-2">
                      {metrics?.trainingFrequency && metrics.trainingFrequency.real >= metrics.trainingFrequency.planned
                        ? "🎉 ¡Tus alumnos están cumpliendo con el volumen programado!"
                        : "⚠️ Adherencia por debajo de lo planificado. Evalúa la carga o disponibilidad de los alumnos."}
                    </p>
                  </div>
                )}
              </div>

              {/* Días y Horas de Mayor Actividad */}
              <div className="lg:col-span-7 bg-white dark:bg-surface-light rounded-xl shadow-card border border-gray-200 dark:border-border-light p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">schedule</span>
                  Días y Horas de Mayor Actividad
                </h2>
                <p className="text-sm text-gray-500 mb-6">Distribución de finalizaciones de rutinas por día y bloque horario.</p>

                {isLoading ? (
                  <div className="h-48 bg-gray-100 animate-pulse rounded-lg" />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Gráfico de barras por días */}
                    <div className="h-[180px]">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-3">Por día de la semana</span>
                      {activityDaysData.every(d => d.Cantidad === 0) ? (
                        <div className="h-full flex items-center justify-center border border-dashed border-gray-200 dark:border-slate-800 rounded-lg text-slate-400 text-xs">
                          Sin entrenamientos registrados este mes
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="90%">
                          <BarChart data={activityDaysData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
                            <Tooltip formatter={(v) => [v, "Entrenamientos"]} labelStyle={{ color: "#1f2937" }} />
                            <Bar dataKey="Cantidad" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Distribución horaria */}
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-3">Por bloques horarios</span>
                      
                      <div className="space-y-3">
                        {[
                          { label: "Mañana (6:00 - 12:00)", count: metrics?.peakActivity?.hours?.morning ?? 0, icon: "light_mode", color: "bg-amber-100 text-amber-600 dark:bg-amber-950/20" },
                          { label: "Mediodía/Tarde (12:00 - 18:00)", count: metrics?.peakActivity?.hours?.afternoon ?? 0, icon: "wb_sunny", color: "bg-orange-100 text-orange-600 dark:bg-orange-950/20" },
                          { label: "Tarde/Noche (18:00 - 24:00)", count: metrics?.peakActivity?.hours?.evening ?? 0, icon: "dark_mode", color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/20" },
                          { label: "Madrugada (0:00 - 6:00)", count: metrics?.peakActivity?.hours?.night ?? 0, icon: "bedtime", color: "bg-slate-100 text-slate-600 dark:bg-slate-800/40" },
                        ].map((item, idx) => {
                          const totalHours = (metrics?.peakActivity?.hours?.morning ?? 0) +
                                             (metrics?.peakActivity?.hours?.afternoon ?? 0) +
                                             (metrics?.peakActivity?.hours?.evening ?? 0) +
                                             (metrics?.peakActivity?.hours?.night ?? 0);
                          const pct = totalHours > 0 ? Math.round((item.count / totalHours) * 100) : 0;
                          
                          return (
                            <div key={idx} className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center`}>
                                <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{item.label}</span>
                                  <span className="font-bold text-slate-900 dark:text-white">{item.count} ({pct}%)</span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* --- 3. Impacto Emocional e Intensidad (RPE) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Impacto Emocional */}
              <div className="lg:col-span-6 bg-white dark:bg-surface-light rounded-xl shadow-card border border-gray-200 dark:border-border-light p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">sentiment_satisfied</span>
                  Impacto Emocional del Entrenamiento
                </h2>
                <p className="text-sm text-gray-500 mb-6">Comparativa de estado de ánimo del alumno antes vs. después del entrenamiento.</p>

                {isLoading ? (
                  <div className="h-40 bg-gray-100 animate-pulse rounded-lg" />
                ) : emoTotal === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center border border-dashed border-gray-200 dark:border-slate-800 rounded-lg text-slate-400 text-sm">
                    <span className="material-symbols-outlined text-3xl mb-1">sentiment_neutral</span>
                    Sin registros de estado de ánimo este mes
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    
                    <div className="flex items-center gap-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 p-4 rounded-xl">
                      <span className="text-3xl">😊 🚀</span>
                      <div>
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{emoPositivePercent}%</span>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Entrenamientos con balance anímico favorable (Mejorado o Estable)</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {[
                        { label: "Mejora Anímica (Triste/Neutro → Excelente/Normal)", count: emoImproved, color: "bg-emerald-500" },
                        { label: "Estable / Positivo", count: emoStable, color: "bg-blue-500" },
                        { label: "Fatigado o Con Dolor", count: emoFatigued, color: "bg-rose-500" },
                      ].map((item, idx) => {
                        const pct = Math.round((item.count / emoTotal) * 100);
                        return (
                          <div key={idx}>
                            <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mb-1">
                              <span className="font-medium">{item.label}</span>
                              <span className="font-bold">{item.count} ({pct}%)</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* RPE Promedio */}
              <div className="lg:col-span-6 bg-white dark:bg-surface-light rounded-xl shadow-card border border-gray-200 dark:border-border-light p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">bolt</span>
                  Distribución de RPE Promedio
                </h2>
                <p className="text-sm text-gray-500 mb-6">Autopercepción del esfuerzo en escala RPE (1 a 10) durante este período.</p>

                {isLoading ? (
                  <div className="h-40 bg-gray-100 animate-pulse rounded-lg" />
                ) : !metrics || metrics.rpeDistribution?.average === null ? (
                  <div className="h-40 flex flex-col items-center justify-center border border-dashed border-gray-200 dark:border-slate-800 rounded-lg text-slate-400 text-sm">
                    <span className="material-symbols-outlined text-3xl mb-1">bolt</span>
                    Sin registros de RPE este mes
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-6 items-center">
                    {/* Gran promedio */}
                    <div className="text-center bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">RPE Medio</span>
                      <span className="text-5xl font-black text-blue-600 dark:text-blue-400 my-1">{metrics.rpeDistribution.average}</span>
                      <span className="text-[10px] text-slate-400 font-bold px-2.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full">
                        {metrics.rpeDistribution.average <= 3 ? "Suave" : metrics.rpeDistribution.average <= 6 ? "Moderado" : metrics.rpeDistribution.average <= 8 ? "Intenso" : "Máximo"}
                      </span>
                    </div>

                    {/* Gráfico histograma RPE */}
                    <div className="h-[150px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rpeDistributionData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                          <XAxis dataKey="rpe" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                          <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} allowDecimals={false} />
                          <Tooltip formatter={(v) => [v, "Sesiones"]} labelStyle={{ color: "#1f2937" }} />
                          <Bar dataKey="Cantidad">
                            {rpeDistributionData.map((entry, index) => {
                              let color = "#10B981"; // suave
                              if (entry.val > 3 && entry.val <= 6) color = "#F59E0B"; // moderado
                              if (entry.val > 6 && entry.val <= 8) color = "#EF4444"; // intenso
                              if (entry.val > 8) color = "#B91C1C"; // extremo
                              return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* --- 4. Demografía y Objetivos (Nivel de Experiencia y Deportes) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Objetivos de Alumnos (Existente) */}
              <div className="lg:col-span-6 bg-white dark:bg-surface-light rounded-xl shadow-card border border-gray-200 dark:border-border-light p-6 flex flex-col">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Objetivos de Alumnos</h2>
                  <p className="text-sm text-gray-500 mb-6">Distribución de metas principales de entrenamiento.</p>
                </div>

                {isLoading ? (
                  <div className="flex flex-col gap-4 flex-1 animate-pulse">
                    {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-100 rounded w-full" />)}
                  </div>
                ) : metrics?.goalDistribution && metrics.goalDistribution.length > 0 ? (
                  <div className="flex flex-col gap-4 flex-1">
                    {metrics.goalDistribution.map((goal) => {
                      const widthPct = Math.max(4, Math.round((goal.count / metrics.maxGoalCount) * 100));
                      return (
                        <div key={goal.key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{goal.label}</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                              {goal.count} {goal.count === 1 ? "alumno" : "alumnos"}
                            </span>
                          </div>
                          <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${widthPct}%`, backgroundColor: goal.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 text-center py-6">
                    <span className="material-symbols-outlined text-gray-300 text-4xl mb-2">bar_chart</span>
                    <p className="text-gray-400 text-sm">Sin datos de objetivos registrados</p>
                  </div>
                )}
              </div>

              {/* Género (Existente) */}
              <div className="lg:col-span-6 bg-white dark:bg-surface-light rounded-xl shadow-card border border-gray-200 dark:border-border-light p-6 flex flex-col">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Distribución por Género</h2>
                {isLoading ? (
                  <div className="flex flex-col items-center animate-pulse py-6">
                    <div className="w-36 h-36 rounded-full bg-gray-200 mb-6" />
                  </div>
                ) : (
                  <DonutChart
                    genderDistribution={metrics?.genderDistribution ?? []}
                    total={metrics?.totalStudentsForGender ?? 0}
                  />
                )}
              </div>

            </div>

            {/* --- 5. Nivel de Experiencia y Deportes Complementarios --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Nivel de Experiencia */}
              <div className="lg:col-span-6 bg-white dark:bg-surface-light rounded-xl shadow-card border border-gray-200 dark:border-border-light p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">school</span>
                  Niveles de Experiencia
                </h2>
                <p className="text-sm text-gray-500 mb-6">Nivel técnico autodeclarado de los alumnos activos.</p>

                {isLoading ? (
                  <div className="flex flex-col gap-4 animate-pulse">
                    {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-100 rounded w-full" />)}
                  </div>
                ) : metrics?.experienceDistribution && metrics.experienceDistribution.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {metrics.experienceDistribution.map((exp) => {
                      const totalStudents = metrics.activeStudents || 1;
                      const pct = Math.round((exp.count / totalStudents) * 100);
                      return (
                        <div key={exp.key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{exp.label}</span>
                            <span className="font-bold text-gray-900 dark:text-white">{exp.count} ({pct}%)</span>
                          </div>
                          <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-6">Sin información de experiencia</p>
                )}
              </div>

              {/* Deportes Complementarios */}
              <div className="lg:col-span-6 bg-white dark:bg-surface-light rounded-xl shadow-card border border-gray-200 dark:border-border-light p-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">sports_soccer</span>
                    Deportes Complementarios
                  </h2>
                  <p className="text-sm text-gray-500 mb-6">Otras disciplinas que practican tus alumnos.</p>
                </div>

                {isLoading ? (
                  <div className="flex flex-wrap gap-2 animate-pulse">
                    {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 w-20 bg-gray-100 rounded-full" />)}
                  </div>
                ) : metrics?.sportsDistribution && metrics.sportsDistribution.length > 0 ? (
                  <div className="flex flex-wrap gap-3 mt-2 flex-1 items-start">
                    {metrics.sportsDistribution.map((sport) => (
                      <span
                        key={sport.name}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400 border border-sky-100 dark:border-sky-900/30 shadow-sm transition-transform hover:scale-105"
                      >
                        <span className="material-symbols-outlined text-[14px]">sports_basketball</span>
                        {sport.name}
                        <span className="bg-sky-200/50 dark:bg-sky-900/40 px-1.5 py-0.5 rounded-full text-[10px] ml-1">
                          {sport.count}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 text-center py-6 border border-dashed border-gray-200 dark:border-slate-800 rounded-lg text-slate-400 text-sm">
                    <span className="material-symbols-outlined text-3xl mb-1">sports_kabaddi</span>
                    Ningún alumno declaró deportes complementarios
                  </div>
                )}
              </div>

            </div>

            {/* --- 6. Tendencias Históricas e Historial Mensual --- */}
            <div className="bg-white dark:bg-surface-light rounded-xl shadow-card border border-gray-200 dark:border-border-light p-6 lg:p-8">
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">analytics</span>
                  Evolución Histórica (Últimos 6 meses)
                </h2>
                <p className="text-sm text-gray-500 mt-1">Sigue el crecimiento del negocio, registros y tendencias demográficas.</p>
              </div>

              {isLoading ? (
                <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Crecimiento de Alumnos */}
                  <div>
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300 block mb-4 text-center sm:text-left">
                      Historial de Alumnos Activos e Inscripciones
                    </span>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={formattedEnrollmentHistory} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorActivos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                            </linearGradient>
                            <linearGradient id="colorNuevos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" className="dark:hidden" />
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                          <Tooltip labelStyle={{ color: "#1f2937" }} />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                          <Area type="monotone" dataKey="Activos" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorActivos)" />
                          <Area type="monotone" dataKey="Nuevos" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorNuevos)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Evolución de Género */}
                  <div>
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300 block mb-4 text-center sm:text-left">
                      Evolución Demográfica por Género
                    </span>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={formattedGenderHistory} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" className="dark:hidden" />
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                          <Tooltip labelStyle={{ color: "#1f2937" }} />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                          <Bar dataKey="Hombres" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Mujeres" stackId="a" fill="#60A5FA" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Otros" stackId="a" fill="#9CA3AF" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
