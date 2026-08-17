import {
  useLandingAnalytics,
  type TimeRange,
} from "@/hooks/useLandingAnalytics";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  Globe,
  RefreshCw,
  MessageSquare,
  Users,
  Target,
  HelpCircle,
  Volume2,
  Clock,
  CheckCircle2,
  TrendingUp,
  Award,
} from "lucide-react";

export function LandingAnalytics() {
  const {
    timeRange,
    setTimeRange,
    isLoading,
    isLiveUpdating,
    isDemoData,
    lastUpdated,
    data,
    refresh,
  } = useLandingAnalytics();

  const { kpis, funnel, goals, barriers, slides, audio } = data;

  const timeRangeOptions: { id: TimeRange; label: string }[] = [
    { id: "today", label: "Hoy" },
    { id: "7d", label: "Últimos 7 días" },
    { id: "30d", label: "Últimos 30 días" },
    { id: "all", label: "Histórico completo" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Top Bar & Controls ───────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-surface-light p-5 rounded-2xl border border-gray-100 dark:border-border-light shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Landing Page Analytics
              </h1>
              {/* Badge: En Vivo (datos reales de PostHog) vs Datos Demo (fallback, PostHog no responde) */}
              {isDemoData ? (
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  title="No se pudo conectar con PostHog — se están mostrando datos de ejemplo, no reales"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  ⚠️ Datos Demo
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className={`w-2 h-2 rounded-full bg-emerald-500 ${isLiveUpdating ? "animate-ping" : "animate-pulse"}`} />
                  En Vivo
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time range selector */}
          <div className="flex items-center bg-gray-100 dark:bg-surface p-1 rounded-xl border border-gray-200 dark:border-border-light">
            {timeRangeOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTimeRange(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeRange === opt.id
                    ? "bg-white dark:bg-surface-light text-red-600 dark:text-red-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Manual Refresh button */}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-gray-100 dark:bg-surface hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-border-light transition-all disabled:opacity-50"
            title="Actualizar datos ahora"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {/* Last updated timestamp */}
          <span className="text-[11px] text-gray-400 hidden xl:inline">
            Actualizado: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* ── KPI Summary Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Visitas */}
        <div className="bg-white dark:bg-surface-light p-5 rounded-2xl border border-gray-100 dark:border-border-light shadow-card relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Visitas
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {kpis.totalViews.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{kpis.activeUsersNow} activos ahora en la landing</span>
            </div>
          </div>
        </div>

        {/* Card 2: Conversiones a WhatsApp */}
        <div className="bg-white dark:bg-surface-light p-5 rounded-2xl border border-gray-100 dark:border-border-light shadow-card relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Conversión a WhatsApp
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                {kpis.whatsappClicks}
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                ({kpis.whatsappConversionRate}%)
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Clics en CTA final para solicitar info
            </p>
          </div>
        </div>

        {/* Card 3: Registros Completados */}
        <div className="bg-white dark:bg-surface-light p-5 rounded-2xl border border-gray-100 dark:border-border-light shadow-card relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Registros Completados
            </span>
            <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {kpis.completedRegistrations}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Usuarios que enviaron nombre u objetivo
            </p>
          </div>
        </div>

        {/* Card 4: Finalización de Historias */}
        <div className="bg-white dark:bg-surface-light p-5 rounded-2xl border border-gray-100 dark:border-border-light shadow-card relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Historias Completadas
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {kpis.storyCompletionRate}%
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>Tiempo ses.: {kpis.avgSessionDuration}</span>
              <span>•</span>
              <span>Rebote: {kpis.bounceRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Embudo de Conversión & Distribuciones ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Embudo de Conversión (Funnel) - 7 cols */}
        <div className="lg:col-span-7 bg-white dark:bg-surface-light p-6 rounded-2xl border border-gray-100 dark:border-border-light shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-red-500" />
                Embudo de Conversión
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Retención de usuarios desde la primera visita hasta el contacto en WhatsApp
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {funnel.map((item, idx) => (
              <div key={item.step} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-500/10 text-red-600 font-bold flex items-center justify-center text-[11px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {item.users.toLocaleString()} usuarios
                    </span>
                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-surface text-gray-700 dark:text-gray-300 font-semibold text-[11px]">
                      {item.conversionRate}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-gray-100 dark:bg-surface rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-rose-600 transition-all duration-500 rounded-full"
                    style={{ width: `${item.conversionRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distribución de Objetivos de Clientes - 5 cols */}
        <div className="lg:col-span-5 bg-white dark:bg-surface-light p-6 rounded-2xl border border-gray-100 dark:border-border-light shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-red-500" />
                  Objetivos de Entrenamiento
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Desglose de metas elegidas en el formulario
                </p>
              </div>
            </div>

            {/* Donut / Pie Chart */}
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={goals}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {goals.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(17, 24, 39, 0.95)",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-gray-100 dark:border-border-light">
            {goals.map((g) => (
              <div key={g.name} className="flex items-center gap-2 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: g.color }}
                />
                <span className="text-gray-600 dark:text-gray-300 truncate font-medium">
                  {g.name}
                </span>
                <span className="font-bold text-gray-900 dark:text-white ml-auto">
                  {g.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Barreras Principales & Uso de Audio ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Barreras Principales (Encuesta) - 7 cols */}
        <div className="lg:col-span-7 bg-white dark:bg-surface-light p-6 rounded-2xl border border-gray-100 dark:border-border-light shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-500" />
                Barreras Principales
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Respuestas en la encuesta interactiva: "¿Qué te frena hoy a empezar?"
              </p>
            </div>
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barriers}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis type="number" unit="%" domain={[0, 100]} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                />
                <Tooltip
                  formatter={(val: number | undefined) => [`${val ?? 0}%`, "Porcentaje"]}
                  contentStyle={{
                    backgroundColor: "rgba(17, 24, 39, 0.95)",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                  itemStyle={{ color: "#fff" }}
                  labelStyle={{ color: "#fff" }}
                />
                <Bar dataKey="percentage" radius={[0, 8, 8, 0]} barSize={22}>
                  {barriers.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Uso de Audio / Sonido de Fondo - 5 cols */}
        <div className="lg:col-span-5 bg-white dark:bg-surface-light p-6 rounded-2xl border border-gray-100 dark:border-border-light shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-amber-500" />
                  Interacción con Audio
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Comportamiento con la música de fondo
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-surface p-4 rounded-xl border border-gray-100 dark:border-border-light space-y-4 my-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Música Activada
                </span>
                <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  {audio.unmutedPercentage}% ({audio.unmutedCount})
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-800 h-3 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${audio.unmutedPercentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Silenciado
                </span>
                <span className="text-lg font-bold text-gray-500 dark:text-gray-400">
                  {(100 - audio.unmutedPercentage).toFixed(1)}% ({audio.mutedCount})
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 text-center">
            Un alto % de reproducción activa confirma buena tracción del contenido multimedia.
          </p>
        </div>
      </div>

      {/* ── Visualizaciones y Pausas por Slide ───────────────────────────── */}
      <div className="bg-white dark:bg-surface-light p-6 rounded-2xl border border-gray-100 dark:border-border-light shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-500" />
              Retención e Interacción por Slide (Historias 1 a 10)
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Conteo de vistas y pausas manuales en cada historia
            </p>
          </div>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={slides} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <XAxis dataKey="slideNumber" tickFormatter={(val) => `Slide ${val}`} />
              <YAxis />
              <Tooltip
                formatter={(val?: number, name?: string) => [
                  (val ?? 0).toLocaleString(),
                  name === "views" ? "Visualizaciones" : "Pausas",
                ]}
                labelFormatter={(label) => {
                  const s = slides.find((item) => item.slideNumber === Number(label));
                  return s ? `Slide ${label}: ${s.slideTitle}` : `Slide ${label}`;
                }}
                contentStyle={{
                  backgroundColor: "rgba(17, 24, 39, 0.95)",
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  color: "#fff",
                }}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ color: "#fff" }}
              />
              <Bar dataKey="views" name="views" fill="#EF4444" radius={[6, 6, 0, 0]} />
              <Bar dataKey="pauses" name="pauses" fill="#3B82F6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-border-light text-xs font-semibold">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-gray-700 dark:text-gray-300">Visualizaciones</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-gray-700 dark:text-gray-300">Pausas Manuales</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingAnalytics;
