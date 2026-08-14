import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  step3Schema,
  step4Schema,
  step5Schema,
  type Step3FormData,
  type Step4FormData,
  type Step5FormData,
} from "@/features/auth/schemas/studentProfileSchema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function StudentProfileSetup() {
  const [currentStep, setCurrentStep] = useState(3); // Steps 3, 4, 5
  const [step3Data, setStep3Data] = useState<Step3FormData | null>(null);
  const [step4Data, setStep4Data] = useState<Step4FormData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const navigate = useNavigate();
  const { completeStudentProfile, isLoading } = useAuthStore();

  // Step 3 Form
  const step3Form = useForm<Step3FormData>({
    resolver: zodResolver(step3Schema),
  });

  // Step 4 Form
  const step4Form = useForm<Step4FormData>({
    resolver: zodResolver(step4Schema),
  });

  // Step 5 Form
  const step5Form = useForm<Step5FormData>({
    resolver: zodResolver(step5Schema),
  });

  // Handle image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 5MB");
      return;
    }

    // Validate file type
    if (
      !["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
        file.type,
      )
    ) {
      toast.error("Solo se permiten archivos PNG, JPG o WEBP");
      return;
    }

    setUploadedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Step 3 Submit
  const handleStep3Submit = (data: Step3FormData) => {
    setStep3Data({ ...data, profileImage: uploadedFile || undefined });
    setCurrentStep(4);
  };

  // Step 4 Submit
  const handleStep4Submit = (data: Step4FormData) => {
    setStep4Data(data);
    setCurrentStep(5);
  };

  // Step 5 Submit - Final
  const handleStep5Submit = async (data: Step5FormData) => {
    if (!step3Data || !step4Data) {
      toast.error("Datos incompletos. Por favor completa todos los pasos.");
      console.error("Datos faltantes:", { step3Data, step4Data, data });
      return;
    }

    try {
      console.log("Enviando datos del perfil:", {
        ...step3Data,
        ...step4Data,
        ...data,
      });

      await completeStudentProfile({
        ...step3Data,
        ...step4Data,
        ...data,
      });

      toast.success("¡Perfil completado exitosamente!");

      // Redirigir inmediatamente al dashboard del alumno
      navigate("/entrenamiento", { replace: true });
    } catch (error) {
      let errorMessage = "Error al completar el perfil";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        const err = error as { message?: string; error_description?: string };
        if (err.message) {
          errorMessage = err.message;
        } else if (err.error_description) {
          errorMessage = err.error_description;
        }
      }

      toast.error(errorMessage);
      console.error("Error detallado al completar perfil:", error);
    }
  };

  const goBack = () => {
    if (currentStep > 3) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = ((currentStep - 2) / 3) * 100; // Steps 3, 4, 5 of 5 total

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-4 relative overflow-x-hidden antialiased transition-colors duration-300">
      {/* Background gradients */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#F0F4F8] to-[#E2E8F0] dark:from-[#0f1923] dark:to-[#1a2c3d] z-0" />
      <div className="fixed inset-0 geo-pattern z-0 pointer-events-none" />

      <main className="relative z-10 w-full max-w-[520px] flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="bg-white/95 dark:bg-white p-3 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] w-full max-w-[140px] flex items-center justify-center border border-slate-50">
            <img
              src="/logo-nuevo-sinfondo.svg"
              alt="Logo"
              className="w-full h-auto object-contain drop-shadow-sm"
            />
          </div>
          <p className="text-[#5e758d] dark:text-slate-400 font-medium text-sm sm:text-base">
            Completa tu Perfil de Alumno
          </p>
        </header>

        {/* Progress Bar */}
        <div className="bg-white dark:bg-[#1a2632] rounded-xl border border-slate-100 dark:border-slate-700/50 p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-semibold text-[#5e758d] dark:text-slate-400">
              Paso {currentStep} de 5
            </span>
            <span className="text-xs font-semibold text-primary">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="mt-2 text-xs text-[#5e758d] dark:text-slate-400">
            {currentStep === 3 && "Datos de Contacto"}
            {currentStep === 4 && "Datos Antropométricos"}
            {currentStep === 5 && "Objetivos y Experiencia"}
          </div>
        </div>

        {/* Forms Container */}
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.1)] border border-slate-100 dark:border-slate-700/50 p-6 sm:p-8 w-full">
          {/* Step 3: Personal Data */}
          {currentStep === 3 && (
            <form
              onSubmit={step3Form.handleSubmit(handleStep3Submit)}
              className="flex flex-col gap-5"
            >
              <div className="mb-4 text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold text-[#101418] dark:text-white">
                  Datos de Contacto
                </h2>
                <p className="text-sm text-[#5e758d] dark:text-slate-400 mt-1">
                  Información para mantenernos en contacto
                </p>
              </div>

              {/* Profile Image Upload */}
              <div className="flex flex-col items-center gap-3 mb-2">
                <label className="group relative cursor-pointer flex flex-col items-center gap-2">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-slate-50 dark:bg-[#0f1923] border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center transition-all duration-300 group-hover:border-primary group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10 overflow-hidden">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-slate-400 group-hover:text-primary text-4xl transition-colors">
                        add_a_photo
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-primary group-hover:underline">
                    {imagePreview ? "Cambiar Foto" : "Subir Foto (Opcional)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
                <p className="text-xs text-[#5e758d] dark:text-slate-400 text-center">
                  PNG, JPG o WEBP. Máximo 5MB
                </p>
              </div>

              {/* Phone */}
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-[#101418] dark:text-slate-200 text-sm font-medium">
                  Número de Teléfono *
                </span>
                <Input
                  type="tel"
                  placeholder="+54 9 11 1234-5678"
                  {...step3Form.register("phone")}
                  className="h-14"
                />
                {step3Form.formState.errors.phone && (
                  <span className="text-xs text-red-500">
                    {step3Form.formState.errors.phone.message}
                  </span>
                )}
              </label>

              {/* Instagram */}
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-[#101418] dark:text-slate-200 text-sm font-medium">
                  Instagram (Opcional)
                </span>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e758d]">
                    @
                  </span>
                  <Input
                    type="text"
                    placeholder="tu_usuario"
                    {...step3Form.register("instagram")}
                    className="h-14 pl-8"
                  />
                </div>
                {step3Form.formState.errors.instagram && (
                  <span className="text-xs text-red-500">
                    {step3Form.formState.errors.instagram.message}
                  </span>
                )}
              </label>

              <Button
                type="submit"
                className="mt-4 w-full h-14"
                disabled={isLoading}
              >
                Siguiente
              </Button>
            </form>
          )}

          {/* Step 4: Anthropometric Data */}
          {currentStep === 4 && (
            <form
              onSubmit={step4Form.handleSubmit(handleStep4Submit)}
              className="flex flex-col gap-5"
            >
              <div className="mb-4 text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold text-[#101418] dark:text-white">
                  Datos Antropométricos
                </h2>
                <p className="text-sm text-[#5e758d] dark:text-slate-400 mt-1">
                  Necesarios para personalizar tu plan
                </p>
              </div>

              {/* Birth Date */}
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-[#101418] dark:text-slate-200 text-sm font-medium">
                  Fecha de Nacimiento *
                </span>
                <Input
                  type="date"
                  className="h-14 block w-full appearance-none"
                  lang="es"
                  {...step4Form.register("birthDate")}
                  onFocus={(e) => {
                    if ("showPicker" in e.target) {
                      try {
                        (e.target as HTMLInputElement).showPicker();
                      } catch {
                        // Ignore errors if showPicker is not supported
                      }
                    }
                  }}
                />
                {step4Form.formState.errors.birthDate && (
                  <span className="text-xs text-red-500">
                    {step4Form.formState.errors.birthDate.message}
                  </span>
                )}
              </label>

              {/* Gender */}
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-[#101418] dark:text-slate-200 text-sm font-medium">
                  Sexo *
                </span>
                <select
                  {...step4Form.register("gender")}
                  className="form-select flex w-full rounded-lg text-[#101418] dark:text-white bg-white dark:bg-[#0f1923] border border-[#dae0e7] dark:border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 text-base transition-all outline-none"
                >
                  <option value="">Selecciona una opción</option>
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                  <option value="other">Otro</option>
                </select>
                {step4Form.formState.errors.gender && (
                  <span className="text-xs text-red-500">
                    {step4Form.formState.errors.gender.message}
                  </span>
                )}
              </label>

              {/* Height and Weight Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Height */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[#101418] dark:text-slate-200 text-sm font-medium">
                    Altura (cm) *
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="175"
                    {...step4Form.register("height", { valueAsNumber: true })}
                    className="h-14"
                  />
                  {step4Form.formState.errors.height && (
                    <span className="text-xs text-red-500">
                      {step4Form.formState.errors.height.message}
                    </span>
                  )}
                </label>

                {/* Weight */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[#101418] dark:text-slate-200 text-sm font-medium">
                    Peso (kg) *
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="70"
                    {...step4Form.register("weight", { valueAsNumber: true })}
                    className="h-14"
                  />
                  {step4Form.formState.errors.weight && (
                    <span className="text-xs text-red-500">
                      {step4Form.formState.errors.weight.message}
                    </span>
                  )}
                </label>
              </div>

              <div className="flex gap-3 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  className="flex-1 h-14"
                >
                  Anterior
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-14"
                  disabled={isLoading}
                >
                  Siguiente
                </Button>
              </div>
            </form>
          )}

          {/* Step 5: Physical Data and Goals */}
          {currentStep === 5 && (
            <form
              onSubmit={step5Form.handleSubmit(handleStep5Submit)}
              className="flex flex-col gap-5"
            >
              <div className="mb-4 text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold text-[#101418] dark:text-white">
                  Objetivos y Experiencia
                </h2>
                <p className="text-sm text-[#5e758d] dark:text-slate-400 mt-1">
                  Última información para personalizar tu entrenamiento
                </p>
              </div>

              {/* Activity Level */}
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-[#101418] dark:text-slate-200 text-sm font-medium">
                  Nivel de Actividad Física *
                </span>
                <select
                  {...step5Form.register("activityLevel")}
                  className="form-select flex w-full rounded-lg text-[#101418] dark:text-white bg-white dark:bg-[#0f1923] border border-[#dae0e7] dark:border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 text-base transition-all outline-none"
                >
                  <option value="">Selecciona tu nivel</option>
                  <option value="sedentary">
                    Sedentario (poco o ningún ejercicio)
                  </option>
                  <option value="light">
                    Ligero (ejercicio 1-3 días/semana)
                  </option>
                  <option value="moderate">
                    Moderado (ejercicio 3-5 días/semana)
                  </option>
                  <option value="active">
                    Activo (ejercicio 6-7 días/semana)
                  </option>
                  <option value="very_active">
                    Muy Activo (ejercicio intenso diario)
                  </option>
                </select>
                {step5Form.formState.errors.activityLevel && (
                  <span className="text-xs text-red-500">
                    {step5Form.formState.errors.activityLevel.message}
                  </span>
                )}
              </label>

              {/* Primary Goal */}
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-[#101418] dark:text-slate-200 text-sm font-medium">
                  Objetivo Principal *
                </span>
                <select
                  {...step5Form.register("primaryGoal")}
                  className="form-select flex w-full rounded-lg text-[#101418] dark:text-white bg-white dark:bg-[#0f1923] border border-[#dae0e7] dark:border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 text-base transition-all outline-none"
                >
                  <option value="">Selecciona tu objetivo</option>
                  <option value="aesthetic">Estético</option>
                  <option value="sports">Deportivo</option>
                  <option value="health">Salud</option>
                  <option value="readaptation">Readaptación</option>
                </select>
                {step5Form.formState.errors.primaryGoal && (
                  <span className="text-xs text-red-500">
                    {step5Form.formState.errors.primaryGoal.message}
                  </span>
                )}
              </label>

              {/* Training Experience */}
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-[#101418] dark:text-slate-200 text-sm font-medium">
                  Experiencia en Entrenamiento *
                </span>
                <select
                  {...step5Form.register("trainingExperience")}
                  className="form-select flex w-full rounded-lg text-[#101418] dark:text-white bg-white dark:bg-[#0f1923] border border-[#dae0e7] dark:border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary h-14 px-4 text-base transition-all outline-none"
                >
                  <option value="">Selecciona tu nivel</option>
                  <option value="none">Ninguna</option>
                  <option value="beginner">
                    Principiante (menos de 1 año)
                  </option>
                  <option value="intermediate">Intermedio (1-3 años)</option>
                  <option value="advanced">Avanzado (más de 3 años)</option>
                </select>
                {step5Form.formState.errors.trainingExperience && (
                  <span className="text-xs text-red-500">
                    {step5Form.formState.errors.trainingExperience.message}
                  </span>
                )}
              </label>

              {/* Sports */}
              <label className="flex flex-col gap-1.5 w-full">
                <span className="text-[#101418] dark:text-slate-200 text-sm font-medium">
                  Deportes que Practicas *
                </span>
                <Input
                  type="text"
                  placeholder="Ej: Fútbol, Natación, Running"
                  {...step5Form.register("sports")}
                  className="h-14"
                />
                {step5Form.formState.errors.sports && (
                  <span className="text-xs text-red-500">
                    {step5Form.formState.errors.sports.message}
                  </span>
                )}
              </label>

              {/* Previous Injuries */}
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border-2 border-red-200 dark:border-red-900/40">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="material-symbols-outlined text-red-600 dark:text-red-400"
                    style={{ fontSize: "20px" }}
                  >
                    health_and_safety
                  </span>
                  <span className="text-[#101418] dark:text-slate-200 text-sm font-medium">
                    Lesiones Previas (Opcional)
                  </span>
                </div>
                <textarea
                  {...step5Form.register("previousInjuries")}
                  placeholder="Describe lesiones previas que hayamos tenido..."
                  className="form-textarea flex w-full rounded-lg text-[#101418] dark:text-white bg-white dark:bg-[#0f1923] border border-red-300 dark:border-red-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 p-4 text-base transition-all outline-none resize-none"
                  rows={3}
                  maxLength={500}
                />
                {step5Form.formState.errors.previousInjuries && (
                  <span className="text-xs text-red-600 dark:text-red-400 mt-1 block">
                    {step5Form.formState.errors.previousInjuries.message}
                  </span>
                )}
              </div>

              {/* Medical Conditions */}
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border-2 border-red-200 dark:border-red-900/40">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="material-symbols-outlined text-red-600 dark:text-red-400"
                    style={{ fontSize: "20px" }}
                  >
                    medical_information
                  </span>
                  <span className="text-[#101418] dark:text-slate-200 text-sm font-medium">
                    Afecciones Médicas (Opcional)
                  </span>
                </div>
                <textarea
                  {...step5Form.register("medicalConditions")}
                  placeholder="Condiciones médicas relevantes..."
                  className="form-textarea flex w-full rounded-lg text-[#101418] dark:text-white bg-white dark:bg-[#0f1923] border border-red-300 dark:border-red-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 p-4 text-base transition-all outline-none resize-none"
                  rows={3}
                  maxLength={500}
                />
                {step5Form.formState.errors.medicalConditions && (
                  <span className="text-xs text-red-600 dark:text-red-400 mt-1 block">
                    {step5Form.formState.errors.medicalConditions.message}
                  </span>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  className="flex-1 h-14"
                >
                  Anterior
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-14"
                  disabled={isLoading}
                >
                  {isLoading ? "Completando..." : "Completar Perfil"}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Info */}
        <div className="flex justify-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500 pb-4">
          <div className="flex items-center gap-1 text-xs text-[#5e758d] font-semibold">
            <span className="material-symbols-outlined text-[16px]">lock</span>
            <span>Datos Seguros</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-[#5e758d] font-semibold">
            <span className="material-symbols-outlined text-[16px]">
              verified_user
            </span>
            <span>Verificado</span>
          </div>
        </div>
      </main>

      {/* Geo Pattern Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
                    .geo-pattern {
                        background-color: transparent;
                        background-image: radial-gradient(#0056b3 0.5px, transparent 0.5px), radial-gradient(#0056b3 0.5px, transparent 0.5px);
                        background-size: 20px 20px;
                        background-position: 0 0, 10px 10px;
                        opacity: 0.03;
                    }
                    .dark .geo-pattern {
                        background-image: radial-gradient(#ffffff 0.5px, transparent 0.5px), radial-gradient(#ffffff 0.5px, transparent 0.5px);
                        opacity: 0.03;
                    }
                `,
        }}
      />
    </div>
  );
}
