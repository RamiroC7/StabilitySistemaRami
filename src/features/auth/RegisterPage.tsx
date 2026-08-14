import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/features/auth/store/authStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

// Step 1: Personal Data Validation
const personalDataSchema = z
  .object({
    firstName: z.string().min(2, "Mínimo 2 caracteres"),
    lastName: z.string().min(2, "Mínimo 2 caracteres"),
    email: z.string().email("Email inválido"),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Debe incluir mayúscula")
      .regex(/[a-z]/, "Debe incluir minúscula")
      .regex(/[0-9]/, "Debe incluir número"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

// Step 2: Terms Validation
const termsSchema = z.object({
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, "Debes aceptar los términos"),
  acceptPrivacy: z
    .boolean()
    .refine((val) => val === true, "Debes aceptar la política"),
});

type PersonalDataForm = z.infer<typeof personalDataSchema>;
type TermsForm = z.infer<typeof termsSchema>;

function getPasswordStrength(password: string): {
  level: "weak" | "medium" | "strong";
  percentage: number;
} {
  if (!password || password.length < 8) {
    return { level: "weak", percentage: 33 };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const score = [hasUpper, hasLower, hasNumber, hasSymbol].filter(
    Boolean,
  ).length;

  if (score >= 4 && password.length >= 8) {
    return { level: "strong", percentage: 100 };
  } else if (score >= 2 && password.length >= 8) {
    return { level: "medium", percentage: 66 };
  }
  return { level: "weak", percentage: 33 };
}

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const role = "student";
  const [personalData, setPersonalData] = useState<PersonalDataForm | null>(
    null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const navigate = useNavigate();
  const { register: registerUser, isLoading, clearError } = useAuthStore();

  useEffect(() => {
    clearError();
  }, [clearError]);

  // Step 1 Form
  const step1Form = useForm<PersonalDataForm>({
    resolver: zodResolver(personalDataSchema),
  });

  // Step 2 Form
  const step2Form = useForm<TermsForm>({
    resolver: zodResolver(termsSchema),
    defaultValues: {
      acceptTerms: false,
      acceptPrivacy: false,
    },
  });

  const password = step1Form.watch("password") || "";
  const passwordStrength = getPasswordStrength(password);

  const handleStep1Submit = (data: PersonalDataForm) => {
    setPersonalData(data);
    setStep(2);
  };

  const handleStep2Submit = async (data: TermsForm) => {
    if (!personalData) return;

    try {
      await registerUser({
        ...personalData,
        role,
        acceptTerms: data.acceptTerms,
        acceptPrivacy: data.acceptPrivacy,
      });

      // Show email verification screen
      setRegisteredEmail(personalData.email);
      setRegistered(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error al crear la cuenta. Intentá de nuevo.";
      toast.error(errorMessage);
    }
  };

  const strengthColors = {
    weak: "bg-red-500",
    medium: "bg-yellow-500",
    strong: "bg-green-500",
  };

  const strengthLabels = {
    weak: "Débil",
    medium: "Media",
    strong: "Fuerte",
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark transition-colors duration-300">
      {/* Left Panel - Only visible on large screens */}
      <div className="hidden lg:flex w-1/2 relative bg-primary items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            alt="Gym weights background"
            className="w-full h-full object-cover opacity-40 mix-blend-multiply"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCInrZDpmQgQD_lEDYX12gML5JldSHxVLiCV9gYhWlVWdJUOq1CDCJoxVJptMj5MR8Btgnc3T1MPzNq2VLQfpQXZlwQ6-LgsfF40KxiGezmniir2kvBFPg7o2N7_3GEhT0TN0qf8ZZBCcsEfZzb57DQew68Yuqi4yAX2x4Rcphemkm4irvU-k2J7_aB7Be-4NvD-XOyW8H8PDB-9k_UwTKcjFMNoNTAqXA78heOVzQqrY3fOqZdfLW9XL53tafKbdRhl9x4tmpnFps"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/60 to-primary/40"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className="bg-white/95 dark:bg-white p-6 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.1)] flex items-center justify-center transform transition-transform duration-500 hover:scale-[1.02]">
            <img
              src="/logo-nuevo-sinfondo.svg"
              alt="Logo"
              className="w-48 sm:w-56 h-auto object-contain drop-shadow-sm"
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

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-text-secondary mb-4">
            <span className={step >= 1 ? "text-primary font-semibold" : ""}>
              Datos
            </span>
            <span>→</span>
            <span className={step >= 2 ? "text-primary font-semibold" : ""}>
              Términos
            </span>
          </div>
          <Progress value={step === 1 ? 50 : 100} className="h-1 mb-6" />

          {/* Form Card */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-xl dark:shadow-none dark:border dark:border-border-dark p-6 sm:p-8">
            {step === 1 && (
              <>
                <div className="mb-6 text-center">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Crear tu Cuenta
                  </h2>
                  <p className="text-muted-light dark:text-muted-dark text-sm">
                    Registrate para comenzar tu entrenamiento
                  </p>
                </div>

                <form
                  onSubmit={step1Form.handleSubmit(handleStep1Submit)}
                  className="space-y-5"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nombre
                      </Label>
                      <input
                        placeholder="Juan"
                        {...step1Form.register("firstName")}
                        className="block w-full px-3 py-2.5 border border-border-light dark:border-border-dark rounded-md bg-input-light dark:bg-input-dark text-text-light dark:text-text-dark placeholder-gray-400 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                      />
                      {step1Form.formState.errors.firstName && (
                        <p className="text-xs text-destructive mt-1">
                          {step1Form.formState.errors.firstName.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Apellido
                      </Label>
                      <input
                        placeholder="Pérez"
                        {...step1Form.register("lastName")}
                        className="block w-full px-3 py-2.5 border border-border-light dark:border-border-dark rounded-md bg-input-light dark:bg-input-dark text-text-light dark:text-text-dark placeholder-gray-400 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                      />
                      {step1Form.formState.errors.lastName && (
                        <p className="text-xs text-destructive mt-1">
                          {step1Form.formState.errors.lastName.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Correo Electrónico
                    </Label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-gray-400 text-lg">
                          mail
                        </span>
                      </div>
                      <input
                        type="email"
                        placeholder="juan@ejemplo.com"
                        {...step1Form.register("email")}
                        className="block w-full pl-10 pr-3 py-2.5 border border-border-light dark:border-border-dark rounded-md bg-input-light dark:bg-input-dark text-text-light dark:text-text-dark placeholder-gray-400 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                      />
                    </div>
                    {step1Form.formState.errors.email && (
                      <p className="text-xs text-destructive mt-1">
                        {step1Form.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Contraseña
                    </Label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-gray-400 text-lg">
                          lock
                        </span>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 8 caracteres"
                        {...step1Form.register("password")}
                        className="block w-full pl-10 pr-10 py-2.5 border border-border-light dark:border-border-dark rounded-md bg-input-light dark:bg-input-dark text-text-light dark:text-text-dark placeholder-gray-400 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                      />
                      <div
                        className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <span className="material-symbols-outlined text-gray-400 text-lg hover:text-gray-600 dark:hover:text-gray-200">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </div>
                    </div>
                    {password && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${strengthColors[passwordStrength.level]}`}
                            style={{ width: `${passwordStrength.percentage}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-medium ${passwordStrength.level === "weak"
                            ? "text-red-500"
                            : passwordStrength.level === "medium"
                              ? "text-yellow-600"
                              : "text-green-500"
                            }`}
                        >
                          {strengthLabels[passwordStrength.level]}
                        </span>
                      </div>
                    )}
                    {step1Form.formState.errors.password && (
                      <p className="text-xs text-destructive mt-1">
                        {step1Form.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Confirmar Contraseña
                    </Label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-gray-400 text-lg">
                          lock
                        </span>
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repite tu contraseña"
                        {...step1Form.register("confirmPassword")}
                        className="block w-full pl-10 pr-10 py-2.5 border border-border-light dark:border-border-dark rounded-md bg-input-light dark:bg-input-dark text-text-light dark:text-text-dark placeholder-gray-400 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                      />
                      <div
                        className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        <span className="material-symbols-outlined text-gray-400 text-lg hover:text-gray-600 dark:hover:text-gray-200">
                          {showConfirmPassword ? "visibility_off" : "visibility"}
                        </span>
                      </div>
                    </div>
                    {step1Form.formState.errors.confirmPassword && (
                      <p className="text-xs text-destructive mt-1">
                        {step1Form.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="mt-2 w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                  >
                    Siguiente
                    <span className="material-symbols-outlined text-[20px] ml-2">
                      arrow_forward
                    </span>
                  </Button>
                </form>
              </>
            )}

            {step === 2 && (
              <>
                <div className="mb-6 text-center">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Términos y Condiciones
                  </h2>
                  <p className="text-muted-light dark:text-muted-dark text-sm">
                    Por favor, acepta los términos para continuar
                  </p>
                </div>

                <form
                  onSubmit={step2Form.handleSubmit(handleStep2Submit)}
                  className="space-y-5"
                >
                  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="acceptTerms"
                        {...step2Form.register("acceptTerms")}
                        className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="acceptTerms"
                        className="text-sm text-gray-700 dark:text-gray-200 cursor-pointer"
                      >
                        Acepto los{" "}
                        <a href="#" className="text-primary hover:underline">
                          Términos y Condiciones
                        </a>{" "}
                        del servicio
                      </label>
                    </div>
                    {step2Form.formState.errors.acceptTerms && (
                      <p className="text-xs text-destructive ml-7">
                        {step2Form.formState.errors.acceptTerms.message}
                      </p>
                    )}

                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="acceptPrivacy"
                        {...step2Form.register("acceptPrivacy")}
                        className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="acceptPrivacy"
                        className="text-sm text-gray-700 dark:text-gray-200 cursor-pointer"
                      >
                        Acepto la{" "}
                        <a href="#" className="text-primary hover:underline">
                          Política de Privacidad
                        </a>
                      </label>
                    </div>
                    {step2Form.formState.errors.acceptPrivacy && (
                      <p className="text-xs text-destructive ml-7">
                        {step2Form.formState.errors.acceptPrivacy.message}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        arrow_back
                      </span>
                      Anterior
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[20px]">
                            progress_activity
                          </span>
                          <span>Creando...</span>
                        </>
                      ) : (
                        <>
                          <span>Crear Cuenta</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </>
            )}

            {/* Login Link */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ¿Ya tienes cuenta?{" "}
                <Link
                  to="/login"
                  className="font-medium text-primary hover:text-blue-700 dark:hover:text-blue-400 transition-colors ml-1"
                >
                  Iniciar Sesión
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Email Verification Screen - shown after successful registration */}
      {registered && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-light dark:bg-background-dark">
          <div className="w-full max-w-md">
            <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-xl dark:shadow-none dark:border dark:border-border-dark p-8">
              <div className="flex flex-col items-center text-center space-y-5">
                {/* Icon */}
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-5xl">
                    mark_email_unread
                  </span>
                </div>

                {/* Title */}
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    ¡Revisá tu email!
                  </h3>
                  <p className="text-muted-light dark:text-muted-dark text-sm mt-2">
                    Enviamos un link de confirmación a:
                  </p>
                  <p className="text-primary font-semibold mt-1 text-sm break-all">
                    {registeredEmail}
                  </p>
                </div>

                {/* Steps */}
                <div className="w-full space-y-3 text-left bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                  {[
                    { icon: "inbox", text: "Abrí tu bandeja de entrada" },
                    { icon: "ads_click", text: "Hacé click en el link de confirmación" },
                    { icon: "login", text: "Luego ingresá con tu email y contraseña" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
                        {item.icon}
                      </span>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{item.text}</p>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500">
                  ¿No lo ves? Revisá tu carpeta de Spam.
                </p>

                {/* Go to login */}
                <button
                  onClick={() => navigate("/login", { replace: true })}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">login</span>
                  Ir al inicio de sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
