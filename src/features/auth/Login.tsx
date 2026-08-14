import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/features/auth/store/authStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login, isLoading, error: authError, clearError } = useAuthStore();

  useEffect(() => {
    clearError();
  }, [clearError]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {},
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      toast.success("¡Bienvenido de nuevo!");

      const currentProfessor = useAuthStore.getState().professor;

      if (currentProfessor?.role === "coach") {
        navigate("/inicio", { replace: true });
      } else if (currentProfessor?.role === "student") {
        if (!currentProfessor.hasCompletedProfile) {
          navigate("/register/complete-profile", { replace: true });
        } else {
          navigate("/entrenamiento", { replace: true });
        }
      } else {
        navigate("/", { replace: true });
      }
    } catch (error) {
      // El error específico se muestra en el cuadro de error y en authStore
      const errorMessage =
        error instanceof Error ? error.message : "Error al iniciar sesión";

      // Mostrar toast solo si es un error importante
      if (errorMessage.includes("demasiadas veces")) {
        toast.error(errorMessage);
      }

      console.error("Error al iniciar sesión:", error);
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark transition-colors duration-300">
      {/* Left Panel - Only visible on large screens */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center overflow-hidden bg-[#0b1d3a]">
        {/* Gym background photo */}
        <img
          alt="Gym background"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-30"
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80"
        />
        {/* Blue overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d2654]/95 via-[#1240a0]/80 to-[#0d2654]/90" />
        {/* Subtle radial glow in center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(37,99,235,0.25),transparent)]" />

        <div className="relative z-10 flex items-center justify-center">
          <div className="bg-white rounded-3xl px-10 py-8 shadow-2xl">
            <img
              src="/logo-nuevo-sinfondo.svg"
              alt="Stability"
              className="w-64 h-auto object-contain"
            />
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 lg:p-12 overflow-y-auto relative">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-6">
            <div className="bg-white/95 dark:bg-white p-4 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.05)] w-full max-w-[160px] flex items-center justify-center border border-slate-50">
              <img
                src="/logo-nuevo-sinfondo.svg"
                alt="Logo"
                className="w-full h-auto object-contain drop-shadow-sm"
              />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Bienvenido de nuevo
            </h2>
            <p className="text-muted-light dark:text-muted-dark text-sm">
              Gestiona tu entrenamiento profesional
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-xl dark:shadow-none dark:border dark:border-border-dark p-6 sm:p-8">
            {/* Login Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Error Alert */}
              {authError && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      {authError}
                    </p>
                    {authError.toLowerCase().includes("no está registrado") && (
                      <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                        Si es la primera vez, puedes{" "}
                        <Link
                          to="/register"
                          className="font-semibold hover:underline"
                        >
                          crear una cuenta aquí
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <Label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Correo Electrónico
                </Label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="text-gray-400 w-5 h-5" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="ejemplo@correo.com"
                    {...register("email")}
                    className="block w-full pl-10 pr-3 py-2.5 border border-border-light dark:border-border-dark rounded-md bg-input-light dark:bg-input-dark text-text-light dark:text-text-dark placeholder-gray-400 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <Label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Contraseña
                  </Label>
                  <Link
                    to="/recuperar-password"
                    className="text-xs font-medium text-primary hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="text-gray-400 w-5 h-5" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...register("password")}
                    className="block w-full pl-10 pr-10 py-2.5 border border-border-light dark:border-border-dark rounded-md bg-input-light dark:bg-input-dark text-text-light dark:text-text-dark placeholder-gray-400 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                  />
                  <div
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="text-gray-400 w-5 h-5 hover:text-gray-600 dark:hover:text-gray-200" />
                    ) : (
                      <Eye className="text-gray-400 w-5 h-5 hover:text-gray-600 dark:hover:text-gray-200" />
                    )}
                  </div>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5 mr-2" />
                      <span>Iniciando...</span>
                    </>
                  ) : (
                    <>
                      <span>Iniciar Sesión</span>
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Register Link */}
          <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            ¿No tienes cuenta?
            <Link
              to="/register"
              className="font-medium text-primary hover:text-blue-700 dark:hover:text-blue-400 ml-1"
            >
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
