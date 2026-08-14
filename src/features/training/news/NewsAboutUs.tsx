import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function NewsAboutUs() {
  const navigate = useNavigate();

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-[#1F2937] dark:text-gray-100 flex flex-col h-screen">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] bg-background-light dark:bg-background-dark sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800 [transform:translateZ(0)] [isolation:isolate]">
        <button
          onClick={() => navigate("/entrenamiento/comunidad")}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          ¿Quiénes somos?
        </h2>
        <div className="w-8"></div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 flex items-center justify-center px-6 bg-background-light dark:bg-background-dark">
        <div className="max-w-sm w-full text-center space-y-6 -mt-12">
          {/* Logo */}
          <div className="mb-2">
            <img
              src="/logo-nuevo-sinfondo.svg"
              alt="Stability"
              className="w-32 h-32 mx-auto object-contain"
            />
          </div>

          {/* Message */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
              Estamos trabajando para traer novedades para vos
            </h3>
            
            {/* Animated dots */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse [animation-delay:0.4s]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
