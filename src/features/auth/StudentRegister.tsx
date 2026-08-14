import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuthStore } from "@/features/auth/store/authStore"
import { toast } from "sonner"

// Step 1: Personal Data Schema
const personalDataSchema = z.object({
    fullName: z.string().min(2, 'Mínimo 2 caracteres'),
    age: z.string().min(1, 'Edad requerida'),
    gender: z.string().min(1, 'Selecciona tu género'),
    phone: z.string().min(8, 'Teléfono inválido'),
    instagram: z.string().optional(),
})

type PersonalDataForm = z.infer<typeof personalDataSchema>

export default function StudentRegister() {
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
    const navigate = useNavigate()
    const { isLoading } = useAuthStore()

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<PersonalDataForm>({
        resolver: zodResolver(personalDataSchema),
        defaultValues: {
            gender: '',
        },
    })

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setProfilePhoto(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const onSubmit = async (data: PersonalDataForm) => {
        try {
            // Here you would normally send the data to your backend
            console.log('Student registration data:', { ...data, profilePhoto })
            toast.success('¡Perfil creado exitosamente!')
            navigate("/", { replace: true })
        } catch {
            toast.error('Error al crear el perfil')
        }
    }

    const progressPercentage = 50 // Step 1 of 2

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col antialiased">
            {/* Top App Bar */}
            <header className="flex items-center justify-between px-4 py-3 bg-background-light dark:bg-background-dark sticky top-0 z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-text-main dark:text-white"
                >
                    <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                </button>
                <h2 className="text-text-main dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] text-center">
                    Sistema Stability
                </h2>
                <div className="size-10"></div> {/* Spacer for centering */}
            </header>

            {/* Scrollable Content */}
            <main className="flex-1 flex flex-col w-full max-w-md mx-auto px-6 pb-24 overflow-y-auto">
                {/* Headline */}
                <div className="mt-4 mb-6 text-center">
                    <h1 className="text-text-main dark:text-white tracking-tight text-[28px] font-bold leading-tight">
                        Creá tu Perfil
                    </h1>
                </div>

                {/* Progress Bar Section */}
                <div className="flex flex-col gap-2 mb-8">
                    <div className="flex justify-between items-end">
                        <p className="text-primary dark:text-blue-400 text-sm font-semibold uppercase tracking-wide">
                            Paso 1 de 2: Datos Personales
                        </p>
                        <p className="text-text-sub dark:text-gray-400 text-sm font-medium">
                            {progressPercentage}%
                        </p>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-500 ease-out"
                            style={{ width: `${progressPercentage}%` }}
                        ></div>
                    </div>
                </div>

                {/* Profile Photo Upload */}
                <div className="flex flex-col items-center gap-3 mb-8">
                    <div className="relative group cursor-pointer">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                            id="photo-upload"
                        />
                        <label htmlFor="photo-upload" className="cursor-pointer">
                            {/* Image Placeholder */}
                            <div className="size-32 rounded-full bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden relative">
                                {profilePhoto ? (
                                    <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <>
                                        {/* Gradient generic background if no photo */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 opacity-50"></div>
                                        <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-[40px] z-10">
                                            person
                                        </span>
                                    </>
                                )}
                            </div>
                            {/* Add Button Overlay */}
                            <div className="absolute bottom-0 right-0 bg-primary text-white size-10 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-background-dark">
                                <span className="material-symbols-outlined text-[20px] font-bold">add</span>
                            </div>
                        </label>
                    </div>
                    <label htmlFor="photo-upload" className="text-primary dark:text-blue-400 text-base font-semibold cursor-pointer">
                        Subir Foto
                    </label>
                </div>

                {/* Form Fields */}
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                    {/* Nombre Completo */}
                    <label className="flex flex-col gap-1.5">
                        <span className="text-text-main dark:text-gray-200 text-sm font-medium">
                            Nombre Completo
                        </span>
                        <input
                            {...register("fullName")}
                            className="w-full h-12 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-gray-800/50 text-text-main dark:text-white px-4 placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                            placeholder="Ej. Juan Pérez"
                            type="text"
                        />
                        {errors.fullName && (
                            <p className="text-sm text-destructive">{errors.fullName.message}</p>
                        )}
                    </label>

                    {/* Edad & Género Row */}
                    <div className="grid grid-cols-5 gap-4">
                        {/* Edad (2 columns) */}
                        <label className="col-span-2 flex flex-col gap-1.5">
                            <span className="text-text-main dark:text-gray-200 text-sm font-medium">Edad</span>
                            <input
                                {...register("age")}
                                className="w-full h-12 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-gray-800/50 text-text-main dark:text-white px-4 placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                                placeholder="Ej. 28"
                                type="number"
                            />
                            {errors.age && (
                                <p className="text-xs text-destructive">{errors.age.message}</p>
                            )}
                        </label>

                        {/* Género (3 columns) */}
                        <label className="col-span-3 flex flex-col gap-1.5 relative">
                            <span className="text-text-main dark:text-gray-200 text-sm font-medium">Género</span>
                            <div className="relative">
                                <select
                                    {...register("gender")}
                                    className="w-full h-12 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-gray-800/50 text-text-main dark:text-white px-4 pr-10 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all appearance-none"
                                >
                                    <option value="" disabled>Seleccionar</option>
                                    <option value="male">Masculino</option>
                                    <option value="female">Femenino</option>
                                    <option value="other">Otro</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                    expand_more
                                </span>
                            </div>
                            {errors.gender && (
                                <p className="text-xs text-destructive">{errors.gender.message}</p>
                            )}
                        </label>
                    </div>

                    {/* Teléfono / WhatsApp */}
                    <label className="flex flex-col gap-1.5">
                        <span className="text-text-main dark:text-gray-200 text-sm font-medium">
                            Teléfono / WhatsApp
                        </span>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400">
                                <span className="material-symbols-outlined text-[20px]">smartphone</span>
                            </div>
                            <input
                                {...register("phone")}
                                className="w-full h-12 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-gray-800/50 text-text-main dark:text-white pl-10 pr-4 placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                                placeholder="+54 9 11 1234 5678"
                                type="tel"
                            />
                        </div>
                        {errors.phone && (
                            <p className="text-sm text-destructive">{errors.phone.message}</p>
                        )}
                    </label>

                    {/* Instagram */}
                    <label className="flex flex-col gap-1.5">
                        <span className="text-text-main dark:text-gray-200 text-sm font-medium">
                            Usuario de Instagram
                        </span>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400">
                                <span className="material-symbols-outlined text-[20px]">alternate_email</span>
                            </div>
                            <input
                                {...register("instagram")}
                                className="w-full h-12 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-gray-800/50 text-text-main dark:text-white pl-10 pr-4 placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                                placeholder="tu_usuario"
                                type="text"
                            />
                        </div>
                    </label>
                </form>
            </main>

            {/* Footer Action */}
            <footer className="fixed bottom-0 left-0 w-full bg-background-light dark:bg-background-dark p-4 border-t border-gray-100 dark:border-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-md mx-auto">
                    <button
                        onClick={handleSubmit(onSubmit)}
                        disabled={isLoading}
                        className="w-full h-14 bg-primary hover:bg-primary/90 active:bg-primary/95 text-white text-base font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {isLoading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                                <span>Guardando...</span>
                            </>
                        ) : (
                            <>
                                <span>Siguiente Paso</span>
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </>
                        )}
                    </button>
                </div>
            </footer>
        </div>
    )
}
