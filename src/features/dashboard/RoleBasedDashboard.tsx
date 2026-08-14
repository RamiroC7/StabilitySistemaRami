import { Navigate } from "react-router-dom"
import { useAuthStore } from "@/features/auth/store/authStore"
import CoachDashboard from "../../../iu/CoachDashboard"

export default function RoleBasedDashboard() {
    const { professor } = useAuthStore()

    if (!professor) {
        return <Navigate to="/login" replace />
    }

    // If student and profile is incomplete, redirect to complete profile
    if (professor.role === 'student' && !professor.hasCompletedProfile) {
        return <Navigate to="/register/complete-profile" replace />
    }

    // Students go to the mobile training app
    if (professor.role === 'student') {
        return <Navigate to="/entrenamiento" replace />
    }

    return <CoachDashboard />
}
