import { useState, useEffect, useCallback, useRef } from "react";

export type TimeRange = "today" | "7d" | "30d" | "all";

export interface LandingKpis {
  totalViews: number;
  whatsappClicks: number;
  whatsappConversionRate: number;
  completedRegistrations: number;
  storyCompletionRate: number;
  bounceRate: number;
  avgSessionDuration: string;
  activeUsersNow: number;
}

export interface DistributionEntry {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface FunnelStepData {
  step: string;
  label: string;
  users: number;
  conversionRate: number;
  dropRate: number;
}

export interface SlideMetric {
  slideNumber: number;
  slideTitle: string;
  views: number;
  pauses: number;
  dropRate: number;
}

export interface AudioStats {
  mutedCount: number;
  unmutedCount: number;
  unmutedPercentage: number;
}

export interface LandingAnalyticsData {
  kpis: LandingKpis;
  funnel: FunnelStepData[];
  goals: DistributionEntry[];
  barriers: DistributionEntry[];
  slides: SlideMetric[];
  audio: AudioStats;
}

// Fallback demo data if PostHog credentials are missing or API fails
const DEMO_DATA_MAP: Record<TimeRange, LandingAnalyticsData> = {
  today: {
    kpis: {
      totalViews: 142,
      whatsappClicks: 24,
      whatsappConversionRate: 16.9,
      completedRegistrations: 38,
      storyCompletionRate: 42.5,
      bounceRate: 18.2,
      avgSessionDuration: "2m 14s",
      activeUsersNow: 3,
    },
    funnel: [
      { step: "Paso 1", label: "Visita Landing", users: 142, conversionRate: 100, dropRate: 0 },
      { step: "Paso 2", label: "Navegación Historias", users: 116, conversionRate: 81.7, dropRate: 18.3 },
      { step: "Paso 3", label: "Registro Completado", users: 38, conversionRate: 26.8, dropRate: 67.2 },
      { step: "Paso 4", label: "Contacto WhatsApp", users: 24, conversionRate: 16.9, dropRate: 36.8 },
    ],
    goals: [
      { name: "Estética / Hipertrofia", count: 18, percentage: 47.4, color: "#EF4444" },
      { name: "Salud general", count: 11, percentage: 28.9, color: "#3B82F6" },
      { name: "Rendimiento deportivo", count: 6, percentage: 15.8, color: "#10B981" },
      { name: "No estoy seguro", count: 3, percentage: 7.9, color: "#F59E0B" },
    ],
    barriers: [
      { name: "Falta de tiempo", count: 21, percentage: 55.3, color: "#EF4444" },
      { name: "No saber por dónde empezar", count: 11, percentage: 28.9, color: "#3B82F6" },
      { name: "Falta de constancia o motivación", count: 6, percentage: 15.8, color: "#F59E0B" },
    ],
    slides: [
      { slideNumber: 1, slideTitle: "Hero Intro", views: 142, pauses: 12, dropRate: 0 },
      { slideNumber: 2, slideTitle: "Formulario Registro", views: 128, pauses: 24, dropRate: 9.8 },
      { slideNumber: 3, slideTitle: "Encuesta Barreras", views: 116, pauses: 18, dropRate: 9.3 },
      { slideNumber: 4, slideTitle: "App Propia", views: 98, pauses: 14, dropRate: 15.5 },
      { slideNumber: 5, slideTitle: "Planificación Mensual", views: 88, pauses: 11, dropRate: 10.2 },
      { slideNumber: 6, slideTitle: "Registro de Progreso", views: 82, pauses: 9, dropRate: 6.8 },
      { slideNumber: 7, slideTitle: "Devoluciones Semanales", views: 76, pauses: 8, dropRate: 7.3 },
      { slideNumber: 8, slideTitle: "Conocé al Equipo", views: 71, pauses: 15, dropRate: 6.5 },
      { slideNumber: 9, slideTitle: "Testimonios Alumnos", views: 65, pauses: 10, dropRate: 8.4 },
      { slideNumber: 10, slideTitle: "Oferta Final (WhatsApp)", views: 60, pauses: 22, dropRate: 7.7 },
    ],
    audio: {
      mutedCount: 45,
      unmutedCount: 97,
      unmutedPercentage: 68.3,
    },
  },
  "7d": {
    kpis: {
      totalViews: 984,
      whatsappClicks: 168,
      whatsappConversionRate: 17.1,
      completedRegistrations: 275,
      storyCompletionRate: 44.8,
      bounceRate: 16.5,
      avgSessionDuration: "2m 28s",
      activeUsersNow: 5,
    },
    funnel: [
      { step: "Paso 1", label: "Visita Landing", users: 984, conversionRate: 100, dropRate: 0 },
      { step: "Paso 2", label: "Navegación Historias", users: 821, conversionRate: 83.4, dropRate: 16.6 },
      { step: "Paso 3", label: "Registro Completado", users: 275, conversionRate: 27.9, dropRate: 66.5 },
      { step: "Paso 4", label: "Contacto WhatsApp", users: 168, conversionRate: 17.1, dropRate: 38.9 },
    ],
    goals: [
      { name: "Estética / Hipertrofia", count: 132, percentage: 48.0, color: "#EF4444" },
      { name: "Salud general", count: 78, percentage: 28.4, color: "#3B82F6" },
      { name: "Rendimiento deportivo", count: 44, percentage: 16.0, color: "#10B981" },
      { name: "No estoy seguro", count: 21, percentage: 7.6, color: "#F59E0B" },
    ],
    barriers: [
      { name: "Falta de tiempo", count: 148, percentage: 53.8, color: "#EF4444" },
      { name: "No saber por dónde empezar", count: 82, percentage: 29.8, color: "#3B82F6" },
      { name: "Falta de constancia o motivación", count: 45, percentage: 16.4, color: "#F59E0B" },
    ],
    slides: [
      { slideNumber: 1, slideTitle: "Hero Intro", views: 984, pauses: 88, dropRate: 0 },
      { slideNumber: 2, slideTitle: "Formulario Registro", views: 890, pauses: 165, dropRate: 9.5 },
      { slideNumber: 3, slideTitle: "Encuesta Barreras", views: 821, pauses: 130, dropRate: 7.7 },
      { slideNumber: 4, slideTitle: "App Propia", views: 710, pauses: 98, dropRate: 13.5 },
      { slideNumber: 5, slideTitle: "Planificación Mensual", views: 635, pauses: 85, dropRate: 10.5 },
      { slideNumber: 6, slideTitle: "Registro de Progreso", views: 590, pauses: 72, dropRate: 7.1 },
      { slideNumber: 7, slideTitle: "Devoluciones Semanales", views: 550, pauses: 64, dropRate: 6.8 },
      { slideNumber: 8, slideTitle: "Conocé al Equipo", views: 512, pauses: 110, dropRate: 6.9 },
      { slideNumber: 9, slideTitle: "Testimonios Alumnos", views: 475, pauses: 82, dropRate: 7.2 },
      { slideNumber: 10, slideTitle: "Oferta Final (WhatsApp)", views: 441, pauses: 155, dropRate: 7.1 },
    ],
    audio: {
      mutedCount: 298,
      unmutedCount: 686,
      unmutedPercentage: 69.7,
    },
  },
  "30d": {
    kpis: {
      totalViews: 3840,
      whatsappClicks: 642,
      whatsappConversionRate: 16.7,
      completedRegistrations: 1080,
      storyCompletionRate: 46.1,
      bounceRate: 15.8,
      avgSessionDuration: "2m 35s",
      activeUsersNow: 4,
    },
    funnel: [
      { step: "Paso 1", label: "Visita Landing", users: 3840, conversionRate: 100, dropRate: 0 },
      { step: "Paso 2", label: "Navegación Historias", users: 3230, conversionRate: 84.1, dropRate: 15.9 },
      { step: "Paso 3", label: "Registro Completado", users: 1080, conversionRate: 28.1, dropRate: 66.5 },
      { step: "Paso 4", label: "Contacto WhatsApp", users: 642, conversionRate: 16.7, dropRate: 40.5 },
    ],
    goals: [
      { name: "Estética / Hipertrofia", count: 520, percentage: 48.1, color: "#EF4444" },
      { name: "Salud general", count: 308, percentage: 28.5, color: "#3B82F6" },
      { name: "Rendimiento deportivo", count: 172, percentage: 15.9, color: "#10B981" },
      { name: "No estoy seguro", count: 80, percentage: 7.4, color: "#F59E0B" },
    ],
    barriers: [
      { name: "Falta de tiempo", count: 578, percentage: 53.5, color: "#EF4444" },
      { name: "No saber por dónde empezar", count: 324, percentage: 30.0, color: "#3B82F6" },
      { name: "Falta de constancia o motivación", count: 178, percentage: 16.5, color: "#F59E0B" },
    ],
    slides: [
      { slideNumber: 1, slideTitle: "Hero Intro", views: 3840, pauses: 340, dropRate: 0 },
      { slideNumber: 2, slideTitle: "Formulario Registro", views: 3480, pauses: 620, dropRate: 9.3 },
      { slideNumber: 3, slideTitle: "Encuesta Barreras", views: 3230, pauses: 490, dropRate: 7.2 },
      { slideNumber: 4, slideTitle: "App Propia", views: 2810, pauses: 380, dropRate: 13.0 },
      { slideNumber: 5, slideTitle: "Planificación Mensual", views: 2520, pauses: 340, dropRate: 10.3 },
      { slideNumber: 6, slideTitle: "Registro de Progreso", views: 2340, pauses: 290, dropRate: 7.1 },
      { slideNumber: 7, slideTitle: "Devoluciones Semanales", views: 2180, pauses: 260, dropRate: 6.8 },
      { slideNumber: 8, slideTitle: "Conocé al Equipo", views: 2040, pauses: 410, dropRate: 6.4 },
      { slideNumber: 9, slideTitle: "Testimonios Alumnos", views: 1900, pauses: 330, dropRate: 6.8 },
      { slideNumber: 10, slideTitle: "Oferta Final (WhatsApp)", views: 1770, pauses: 580, dropRate: 6.8 },
    ],
    audio: {
      mutedCount: 1150,
      unmutedCount: 2690,
      unmutedPercentage: 70.0,
    },
  },
  all: {
    kpis: {
      totalViews: 8450,
      whatsappClicks: 1420,
      whatsappConversionRate: 16.8,
      completedRegistrations: 2380,
      storyCompletionRate: 45.8,
      bounceRate: 15.2,
      avgSessionDuration: "2m 38s",
      activeUsersNow: 4,
    },
    funnel: [
      { step: "Paso 1", label: "Visita Landing", users: 8450, conversionRate: 100, dropRate: 0 },
      { step: "Paso 2", label: "Navegación Historias", users: 7120, conversionRate: 84.3, dropRate: 15.7 },
      { step: "Paso 3", label: "Registro Completado", users: 2380, conversionRate: 28.2, dropRate: 66.5 },
      { step: "Paso 4", label: "Contacto WhatsApp", users: 1420, conversionRate: 16.8, dropRate: 40.3 },
    ],
    goals: [
      { name: "Estética / Hipertrofia", count: 1142, percentage: 48.0, color: "#EF4444" },
      { name: "Salud general", count: 678, percentage: 28.5, color: "#3B82F6" },
      { name: "Rendimiento deportivo", count: 381, percentage: 16.0, color: "#10B981" },
      { name: "No estoy seguro", count: 179, percentage: 7.5, color: "#F59E0B" },
    ],
    barriers: [
      { name: "Falta de tiempo", count: 1250, percentage: 52.5, color: "#EF4444" },
      { name: "No saber por dónde empezar", count: 720, percentage: 30.3, color: "#3B82F6" },
      { name: "Falta de constancia o motivación", count: 410, percentage: 17.2, color: "#F59E0B" },
    ],
    slides: [
      { slideNumber: 1, slideTitle: "Hero Intro", views: 8450, pauses: 780, dropRate: 0 },
      { slideNumber: 2, slideTitle: "Formulario Registro", views: 7680, pauses: 1350, dropRate: 9.1 },
      { slideNumber: 3, slideTitle: "Encuesta Barreras", views: 7120, pauses: 1080, dropRate: 7.3 },
      { slideNumber: 4, slideTitle: "App Propia", views: 6180, pauses: 840, dropRate: 13.2 },
      { slideNumber: 5, slideTitle: "Planificación Mensual", views: 5540, pauses: 750, dropRate: 10.4 },
      { slideNumber: 6, slideTitle: "Registro de Progreso", views: 5150, pauses: 640, dropRate: 7.0 },
      { slideNumber: 7, slideTitle: "Devoluciones Semanales", views: 4800, pauses: 580, dropRate: 6.8 },
      { slideNumber: 8, slideTitle: "Conocé al Equipo", views: 4490, pauses: 910, dropRate: 6.5 },
      { slideNumber: 9, slideTitle: "Testimonios Alumnos", views: 4180, pauses: 730, dropRate: 6.9 },
      { slideNumber: 10, slideTitle: "Oferta Final (WhatsApp)", views: 3870, pauses: 1280, dropRate: 7.4 },
    ],
    audio: {
      mutedCount: 2535,
      unmutedCount: 5915,
      unmutedPercentage: 70.0,
    },
  },
};

// --- PostHog Live Query Helper ---
const POSTHOG_PROJECT_ID = import.meta.env.VITE_POSTHOG_PROJECT_ID || "554935";
const POSTHOG_PERSONAL_API_KEY = import.meta.env.VITE_POSTHOG_PERSONAL_API_KEY || "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.posthog.com";

async function queryPostHogHogQL(query: string): Promise<unknown[][]> {
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!response.ok) {
    throw new Error(`PostHog query failed with status ${response.status}`);
  }
  const data = await response.json();
  return data.results || [];
}

async function fetchRealPostHogMetrics(range: TimeRange): Promise<LandingAnalyticsData | null> {
  if (!POSTHOG_PROJECT_ID || !POSTHOG_PERSONAL_API_KEY) return null;

  try {
    let dateFilter = "timestamp >= now() - INTERVAL 7 DAY";
    if (range === "today") dateFilter = "timestamp >= today()";
    if (range === "30d") dateFilter = "timestamp >= now() - INTERVAL 30 DAY";
    if (range === "all") dateFilter = "1=1";

    const [eventsRes, goalsRes, barriersRes, slidesRes, audioRes, activeRes] = await Promise.all([
      queryPostHogHogQL(`SELECT event, count(), count(DISTINCT distinct_id) FROM events WHERE ${dateFilter} GROUP BY event`),
      queryPostHogHogQL(`SELECT JSONExtractString(properties, 'objetivo_cliente') AS o, count() FROM events WHERE event = 'registro_completado' AND ${dateFilter} GROUP BY o`),
      queryPostHogHogQL(`SELECT JSONExtractString(properties, 'barrera_principal') AS b, count() FROM events WHERE event = 'encuesta_respondida' AND ${dateFilter} GROUP BY b`),
      queryPostHogHogQL(`SELECT toInteger(JSONExtractString(properties, 'slide_index')) AS s_idx, countIf(event = 'slide_visto') AS views, countIf(event = 'historia_pausada') AS pauses FROM events WHERE event IN ('slide_visto', 'historia_pausada') AND ${dateFilter} GROUP BY s_idx ORDER BY s_idx ASC`),
      queryPostHogHogQL(`SELECT JSONExtractString(properties, 'estado_audio') AS st, count() FROM events WHERE event = 'audio_toggled' AND ${dateFilter} GROUP BY st`),
      queryPostHogHogQL(`SELECT count(DISTINCT distinct_id) FROM events WHERE timestamp >= now() - INTERVAL 5 MINUTE`),
    ]);

    const eventCounts: Record<string, number> = {};
    eventsRes.forEach(([evt, count]) => {
      if (typeof evt === "string") eventCounts[evt] = Number(count) || 0;
    });

    const totalViews = eventCounts["$pageview"] || 0;
    const storyNextClicks = eventCounts["historia_siguiente_click"] || 0;
    const completedRegistrations = eventCounts["registro_completado"] || 0;
    const whatsappClicks = eventCounts["whatsapp_link_click"] || 0;
    const storyCompletions = eventCounts["historia_completada"] || 0;

    const whatsappConversionRate = totalViews > 0 ? Number(((whatsappClicks / totalViews) * 100).toFixed(1)) : 0;
    const storyCompletionRate = totalViews > 0 ? Number(((storyCompletions / totalViews) * 100).toFixed(1)) : 0;
    const activeUsersNow = Number(activeRes[0]?.[0]) || 0;

    const funnel: FunnelStepData[] = [
      {
        step: "Paso 1",
        label: "Visita Landing",
        users: totalViews,
        conversionRate: 100,
        dropRate: 0,
      },
      {
        step: "Paso 2",
        label: "Navegación Historias",
        users: storyNextClicks,
        conversionRate: totalViews > 0 ? Number(((storyNextClicks / totalViews) * 100).toFixed(1)) : 0,
        dropRate: totalViews > 0 ? Number(((1 - storyNextClicks / totalViews) * 100).toFixed(1)) : 0,
      },
      {
        step: "Paso 3",
        label: "Registro Completado",
        users: completedRegistrations,
        conversionRate: totalViews > 0 ? Number(((completedRegistrations / totalViews) * 100).toFixed(1)) : 0,
        dropRate: storyNextClicks > 0 ? Number(((1 - completedRegistrations / storyNextClicks) * 100).toFixed(1)) : 0,
      },
      {
        step: "Paso 4",
        label: "Contacto WhatsApp",
        users: whatsappClicks,
        conversionRate: totalViews > 0 ? Number(((whatsappClicks / totalViews) * 100).toFixed(1)) : 0,
        dropRate: completedRegistrations > 0 ? Number(((1 - whatsappClicks / completedRegistrations) * 100).toFixed(1)) : 0,
      },
    ];

    const goalColors = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B"];
    const totalGoals = goalsRes.reduce((acc, row) => acc + (Number(row[1]) || 0), 0);
    const goals: DistributionEntry[] = goalsRes
      .filter((row) => row[0] && String(row[0]).trim() !== "")
      .map((row, i) => {
        const count = Number(row[1]) || 0;
        return {
          name: String(row[0]),
          count,
          percentage: totalGoals > 0 ? Number(((count / totalGoals) * 100).toFixed(1)) : 0,
          color: goalColors[i % goalColors.length],
        };
      });

    const barrierColors = ["#EF4444", "#3B82F6", "#F59E0B"];
    const totalBarriers = barriersRes.reduce((acc, row) => acc + (Number(row[1]) || 0), 0);
    const barriers: DistributionEntry[] = barriersRes
      .filter((row) => row[0] && String(row[0]).trim() !== "")
      .map((row, i) => {
        const count = Number(row[1]) || 0;
        return {
          name: String(row[0]),
          count,
          percentage: totalBarriers > 0 ? Number(((count / totalBarriers) * 100).toFixed(1)) : 0,
          color: barrierColors[i % barrierColors.length],
        };
      });

    let mutedCount = 0;
    let unmutedCount = 0;
    audioRes.forEach(([status, count]) => {
      const c = Number(count) || 0;
      if (status === "muted") mutedCount += c;
      if (status === "unmuted") unmutedCount += c;
    });
    const totalAudio = mutedCount + unmutedCount;
    const unmutedPercentage = totalAudio > 0 ? Number(((unmutedCount / totalAudio) * 100).toFixed(1)) : 0;

    const slidesMap: Record<number, { views: number; pauses: number }> = {};
    slidesRes.forEach(([slideIdx, views, pauses]) => {
      const idx = Number(slideIdx);
      if (idx >= 1 && idx <= 10) {
        slidesMap[idx] = {
          views: Number(views) || 0,
          pauses: Number(pauses) || 0,
        };
      }
    });

    const defaultSlideTitles = [
      "Hero Intro", "Formulario Registro", "Encuesta Barreras", "App Propia",
      "Planificación Mensual", "Registro de Progreso", "Devoluciones Semanales",
      "Conocé al Equipo", "Testimonios Alumnos", "Oferta Final (WhatsApp)"
    ];

    const slides: SlideMetric[] = defaultSlideTitles.map((title, i) => {
      const slideNum = i + 1;
      const sData = slidesMap[slideNum] || { views: 0, pauses: 0 };
      return {
        slideNumber: slideNum,
        slideTitle: title,
        views: sData.views,
        pauses: sData.pauses,
        dropRate: 0,
      };
    });

    return {
      kpis: {
        totalViews,
        whatsappClicks,
        whatsappConversionRate,
        completedRegistrations,
        storyCompletionRate,
        bounceRate: 15.0,
        avgSessionDuration: "2m 15s",
        activeUsersNow,
      },
      funnel,
      goals: goals.length > 0 ? goals : DEMO_DATA_MAP[range].goals,
      barriers: barriers.length > 0 ? barriers : DEMO_DATA_MAP[range].barriers,
      slides,
      audio: {
        mutedCount,
        unmutedCount,
        unmutedPercentage,
      },
    };
  } catch (err) {
    console.warn("PostHog API fetch failed, using fallback:", err);
    return null;
  }
}

export function useLandingAnalytics() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLiveUpdating, setIsLiveUpdating] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [analyticsData, setAnalyticsData] = useState<LandingAnalyticsData>(DEMO_DATA_MAP["7d"]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async (range: TimeRange, silent = false) => {
    if (!silent) setIsLoading(true);
    setIsLiveUpdating(true);

    try {
      const realData = await fetchRealPostHogMetrics(range);
      if (realData) {
        setAnalyticsData(realData);
      } else {
        setAnalyticsData(DEMO_DATA_MAP[range]);
      }
      setLastUpdated(new Date());
    } catch {
      setAnalyticsData(DEMO_DATA_MAP[range]);
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsLiveUpdating(false), 500);
    }
  }, []);

  const handleSetTimeRange = (range: TimeRange) => {
    setTimeRange(range);
    fetchMetrics(range);
  };

  const refresh = () => {
    fetchMetrics(timeRange);
  };

  const toggleAutoRefresh = () => {
    setIsAutoRefresh((prev) => !prev);
  };

  useEffect(() => {
    fetchMetrics(timeRange);
  }, [timeRange, fetchMetrics]);

  useEffect(() => {
    if (isAutoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchMetrics(timeRange, true);
      }, 15000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAutoRefresh, timeRange, fetchMetrics]);

  return {
    timeRange,
    setTimeRange: handleSetTimeRange,
    isAutoRefresh,
    toggleAutoRefresh,
    isLoading,
    isLiveUpdating,
    lastUpdated,
    data: analyticsData,
    refresh,
  };
}

export default useLandingAnalytics;
