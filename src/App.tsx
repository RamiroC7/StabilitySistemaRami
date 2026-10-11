import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { router } from "@/router";
import { useAuthStore } from "@/features/auth/store/authStore";
import { initSentry } from "@/lib/sentry";

// Se inicializa a nivel de modulo (antes de que React monte nada), junto a
// los demas globales de observabilidad (Analytics, SpeedInsights mas abajo).
initSentry();

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

// No gastar datos del usuario en prefetch si pidio ahorro de datos o esta en 2g.
function shouldSkipPrefetch(): boolean {
  const connection = (
    navigator as Navigator & { connection?: NetworkInformation }
  ).connection;
  return (
    !!connection?.saveData ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g"
  );
}

function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  // Rol (o null si no hay sesion): decide QUE chunks vale la pena precargar.
  const role = useAuthStore((state) => state.professor?.role ?? null);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (shouldSkipPrefetch()) return;

    // Prefetch por rol, en idle y despues del primer render. Un alumno nunca
    // baja los chunks del coach (ni viceversa). BusinessMetrics (recharts,
    // ~390 kB) queda afuera a proposito: se baja recien al entrar al dashboard.
    // Fire-and-forget: los errores se ignoran a proposito.
    const prefetch = () => {
      if (role === null) {
        import("@/features/auth/Login").catch(() => {});
      } else if (role === "coach") {
        import("@/features/students/StudentsList").catch(() => {});
        import("@/features/plans/NewPlan").catch(() => {});
        import("@/features/library/Library").catch(() => {});
        import("@/features/students/PlanExpirations").catch(() => {});
      } else {
        import("@/features/training/TrainingHome").catch(() => {});
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(prefetch, 1500);
    return () => clearTimeout(timer);
  }, [role]);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        richColors
        offset="calc(env(safe-area-inset-top, 0px) + 16px)"
      />
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;
