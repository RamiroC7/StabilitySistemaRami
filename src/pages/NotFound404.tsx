import { useNavigate } from "react-router-dom";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/features/auth/store/authStore";

export default function NotFound404() {
  const navigate = useNavigate();
  const professor = useAuthStore((state) => state.professor);

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    // Redirect based on user role
    if (professor) {
      if (professor.role === "student") {
        navigate("/entrenamiento");
      } else {
        navigate("/inicio");
      }
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 px-6 text-center">
      <div className="relative">
        {/* Animated background effect */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        {/* Icon */}
        <div className="mb-8 flex justify-center">
          <div className="rounded-full bg-gray-800/50 p-6 backdrop-blur-sm">
            <FileQuestion
              size={80}
              className="text-primary"
              strokeWidth={1.5}
            />
          </div>
        </div>

        {/* Error code */}
        <div className="mb-4">
          <h1 className="text-8xl font-bold text-white/10">404</h1>
        </div>

        {/* Title */}
        <h2 className="mb-3 text-3xl font-bold text-white">
          Página no encontrada
        </h2>

        {/* Description */}
        <p className="mb-10 max-w-md text-base text-gray-400">
          Lo sentimos, la página que estás buscando no existe o ha sido movida.
          Verifica la URL o regresa a la página principal.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={handleGoBack}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800/50 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition-all hover:border-gray-600 hover:bg-gray-800 active:scale-95"
          >
            <ArrowLeft size={20} />
            Volver atrás
          </button>

          <button
            onClick={handleGoHome}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-95"
          >
            <Home size={20} />
            Ir al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
