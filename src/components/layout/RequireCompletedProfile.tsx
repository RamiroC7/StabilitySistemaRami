import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/authStore";

/**
 * Guard que verifica que el alumno haya completado su perfil.
 * Si el perfil no está completo, redirige a /register/complete-profile.
 * Debe usarse DENTRO de RequireAuth y RequireRole para evitar checks innecesarios.
 */
export function RequireCompletedProfile({
  children,
}: {
  children: React.ReactNode;
}) {
  const professor = useAuthStore((state) => state.professor);

  // Si no hay professor, RequireAuth ya habrá redirigido — este caso no debería ocurrir
  if (!professor) {
    return <Navigate to="/login" replace />;
  }

  // Solo los alumnos necesitan completar el perfil
  if (professor.role === "student" && !professor.hasCompletedProfile) {
    return <Navigate to="/register/complete-profile" replace />;
  }

  return <>{children}</>;
}
