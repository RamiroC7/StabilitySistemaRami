import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { GlobalError } from "@/components/GlobalError";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { RequireRole } from "@/components/layout/RequireRole";
import { RequireCompletedProfile } from "@/components/layout/RequireCompletedProfile";
import { Loader2 } from "lucide-react";

// ── Lazy page imports (code splitting) ────────────────────────────────────
const MainLayout = lazy(() => import("@/components/layout/MainLayout"));

const Login = lazy(() => import("@/features/auth/Login"));
const RegisterPage = lazy(() => import("@/features/auth/RegisterPage"));
const StudentRegister = lazy(() => import("@/features/auth/StudentRegister"));
const StudentProfileSetup = lazy(
  () => import("@/features/auth/StudentProfileSetup"),
);
const ForgotPassword = lazy(() => import("@/features/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("@/features/auth/ResetPassword"));
const StudentsList = lazy(() => import("@/features/students/StudentsList"));
const BusinessMetrics = lazy(
  () => import("@/features/metrics/BusinessMetrics"),
);
const Library = lazy(() => import("@/features/library/Library"));
const NewPlan = lazy(() => import("@/features/plans/NewPlan"));
const StudentProfile = lazy(() => import("@/features/students/StudentProfile"));
const PlanExpirations = lazy(() => import("@/features/students/PlanExpirations"));
const TrainingLayout = lazy(() => import("@/features/training/TrainingLayout"));
const TrainingHome = lazy(() => import("@/features/training/TrainingHome"));
const MoodCheckScreen = lazy(
  () => import("@/features/training/MoodCheckScreen"),
);
const ExerciseList = lazy(() => import("@/features/training/ExerciseList"));
const ExerciseDetail = lazy(() => import("@/features/training/ExerciseDetail"));
const WorkoutComplete = lazy(
  () => import("@/features/training/WorkoutComplete"),
);
const TrainingProgress = lazy(
  () => import("@/features/training/TrainingProgress"),
);
const TrainingProfile = lazy(
  () => import("@/features/training/TrainingProfile"),
);
const TrainingCommunity = lazy(
  () => import("@/features/training/TrainingCommunity"),
);
const NewsAboutUs = lazy(() => import("@/features/training/news/NewsAboutUs"));
const NewsRanking = lazy(() => import("@/features/training/news/NewsRanking"));
const NewsVideos = lazy(() => import("@/features/training/news/NewsVideos"));
const NewsBonuses = lazy(() => import("@/features/training/news/NewsBonuses"));
const NotFound404 = lazy(() => import("@/pages/NotFound404"));

// eslint-disable-next-line react-refresh/only-export-components
function PageSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={36} className="animate-spin text-primary" />
    </div>
  );
}

function withSuspense(Component: React.ComponentType) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  // ── Coach routes (sidebar layout) ──────────────────────────────────────
  {
    path: "/",
    errorElement: <GlobalError />,
    element: (
      <RequireAuth>
        <RequireRole role="coach">
          <Suspense fallback={<PageSkeleton />}>
            <MainLayout />
          </Suspense>
        </RequireRole>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/inicio" replace />,
      },
      {
        path: "inicio",
        element: withSuspense(StudentsList),
      },
      {
        path: "dashboard",
        element: withSuspense(BusinessMetrics),
      },
      {
        path: "biblioteca",
        element: withSuspense(Library),
      },
      {
        path: "planificador",
        element: withSuspense(NewPlan),
      },
      {
        path: "asignaciones",
        element: withSuspense(PlanExpirations),
      },
      {
        path: "alumno/:studentId",
        element: withSuspense(StudentProfile),
      },
    ],
  },

  // ── Student training routes (mobile layout with bottom nav) ─────────────
  {
    path: "/entrenamiento",
    errorElement: <GlobalError />,
    element: (
      <RequireAuth>
        <RequireRole role="student">
          <RequireCompletedProfile>
            <Suspense fallback={<PageSkeleton />}>
              <TrainingLayout />
            </Suspense>
          </RequireCompletedProfile>
        </RequireRole>
      </RequireAuth>
    ),
    children: [
      { index: true, element: withSuspense(TrainingHome) },
      { path: "progreso", element: withSuspense(TrainingProgress) },
      { path: "comunidad", element: withSuspense(TrainingCommunity) },
      { path: "perfil", element: withSuspense(TrainingProfile) },
    ],
  },
  // ── News subsections (outside TrainingLayout) ─────────────────────────
  {
    path: "/entrenamiento/comunidad/quienes-somos",
    errorElement: <GlobalError />,
    element: (
      <RequireAuth>
        <RequireRole role="student">
          <RequireCompletedProfile>
            {withSuspense(NewsAboutUs)}
          </RequireCompletedProfile>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: "/entrenamiento/comunidad/ranking",
    errorElement: <GlobalError />,
    element: (
      <RequireAuth>
        <RequireRole role="student">
          <RequireCompletedProfile>
            {withSuspense(NewsRanking)}
          </RequireCompletedProfile>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: "/entrenamiento/comunidad/videos",
    errorElement: <GlobalError />,
    element: (
      <RequireAuth>
        <RequireRole role="student">
          <RequireCompletedProfile>
            {withSuspense(NewsVideos)}
          </RequireCompletedProfile>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: "/entrenamiento/comunidad/bonificaciones",
    errorElement: <GlobalError />,
    element: (
      <RequireAuth>
        <RequireRole role="student">
          <RequireCompletedProfile>
            {withSuspense(NewsBonuses)}
          </RequireCompletedProfile>
        </RequireRole>
      </RequireAuth>
    ),
  },
  // Mood check before workout
  {
    path: "/entrenamiento/mood/:dayId",
    errorElement: <GlobalError />,
    element: (
      <RequireAuth>
        <RequireRole role="student">
          <RequireCompletedProfile>
            {withSuspense(MoodCheckScreen)}
          </RequireCompletedProfile>
        </RequireRole>
      </RequireAuth>
    ),
  },
  // Workout flow — full-screen, no bottom nav
  {
    path: "/entrenamiento/dia/:dayId",
    errorElement: <GlobalError />,
    element: (
      <RequireAuth>
        <RequireRole role="student">
          <RequireCompletedProfile>
            {withSuspense(ExerciseList)}
          </RequireCompletedProfile>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: "/entrenamiento/dia/:dayId/ejercicio/:exerciseNum",
    errorElement: <GlobalError />,
    element: (
      <RequireAuth>
        <RequireRole role="student">
          <RequireCompletedProfile>
            {withSuspense(ExerciseDetail)}
          </RequireCompletedProfile>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: "/entrenamiento/completado",
    errorElement: <GlobalError />,
    element: (
      <RequireAuth>
        <RequireRole role="student">
          <RequireCompletedProfile>
            {withSuspense(WorkoutComplete)}
          </RequireCompletedProfile>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // ── Auth routes ────────────────────────────────────────────────────────
  {
    path: "/login",
    errorElement: <GlobalError />,
    element: withSuspense(Login),
  },
  {
    path: "/register",
    errorElement: <GlobalError />,
    element: withSuspense(RegisterPage),
  },
  {
    path: "/register/student",
    errorElement: <GlobalError />,
    element: withSuspense(StudentRegister),
  },
  {
    path: "/register/complete-profile",
    errorElement: <GlobalError />,
    element: <RequireAuth>{withSuspense(StudentProfileSetup)}</RequireAuth>,
  },
  {
    path: "/recuperar-password",
    errorElement: <GlobalError />,
    element: withSuspense(ForgotPassword),
  },
  {
    path: "/actualizar-password",
    errorElement: <GlobalError />,
    element: withSuspense(ResetPassword),
  },
  // ── Catch-all route (404 - página no encontrada) ──────────────────────
  {
    path: "*",
    element: withSuspense(NotFound404),
  },
]);
