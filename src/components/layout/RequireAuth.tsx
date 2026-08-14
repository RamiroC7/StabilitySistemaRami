import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";

// Timeout máximo para evitar pantalla de carga infinita.
// 10 s: iOS puede suspender la red al volver de segundo plano;
// Supabase necesita tiempo extra para rehidratar la sesión.
const AUTH_TIMEOUT_MS = 10000;

function AuthLoadingScreen() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen w-full"
      style={{ background: "#ffffff" }}
    >
      {/* Logo — mismo asset que genera el splash estático de iOS */}
      <img
        src="/logo-nuevo-sinfondo.svg"
        alt="Stability"
        style={{ width: "55vw", maxWidth: 280, height: "auto" }}
      />

      {/* Indicador de carga sutil — barra fina en la parte inferior */}
      <div
        style={{
          position: "fixed",
          bottom: 48,
          left: "50%",
          transform: "translateX(-50%)",
          width: 80,
          height: 2,
          background: "rgba(0,0,0,0.08)",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "40%",
            background: "rgba(0,0,0,0.2)",
            borderRadius: 99,
            animation: "splashBar 1.6s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes splashBar {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const professor = useAuthStore((state) => state.professor);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const location = useLocation();
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Timeout de seguridad: si isInitializing tarda más de AUTH_TIMEOUT_MS,
  // asumimos que algo falló y redirigimos a login
  useEffect(() => {
    if (!isInitializing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      if (isInitializing) {
        console.warn(
          "[RequireAuth] Auth initialization timed out after",
          AUTH_TIMEOUT_MS,
          "ms",
        );
        setHasTimedOut(true);
      }
    }, AUTH_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isInitializing]);

  // Si ocurre timeout, redirigir a login para evitar pantalla blanca
  if (hasTimedOut && isInitializing) {
    console.warn("[RequireAuth] Redirecting to login due to timeout");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Esperar mientras se inicializa la autenticación
  if (isInitializing) {
    return <AuthLoadingScreen />;
  }

  // Zustand con persist hidrata el estado sincrónicamente desde localStorage
  // antes del primer render, por lo que no necesitamos esperar ningún delay.
  if (!isAuthenticated && !professor) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
