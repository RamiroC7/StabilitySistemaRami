import { Navigate } from "react-router-dom"
import { useAuthStore } from "@/features/auth/store/authStore"

interface RequireRoleProps {
    role: 'student' | 'coach'
    children: React.ReactNode
}

export function RequireRole({ role, children }: RequireRoleProps) {
    const professor = useAuthStore((state) => state.professor)

    if (!professor) {
        return <Navigate to="/login" replace />
    }

    if (professor.role !== role) {
        // Redirect to the correct home based on the user's actual role
        // IMPORTANT: never redirect to "/" here — coaches route lives at "/" and
        // would cause an infinite loop if a student lands on it.
        const home = professor.role === "coach" ? "/inicio" : "/entrenamiento";
        return <Navigate to={home} replace />
    }

    return <>{children}</>
}
