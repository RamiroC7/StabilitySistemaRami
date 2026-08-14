import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/features/auth/store/authStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z
    .object({
        password: z
            .string()
            .min(8, "Mínimo 8 caracteres")
            .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
            .regex(/[0-9]/, "Debe contener al menos un número"),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Las contraseñas no coinciden",
        path: ["confirmPassword"],
    });

type FormData = z.infer<typeof schema>;

export default function ResetPassword() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const navigate = useNavigate();
    const { updatePassword } = useAuthStore();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        const { error } = await updatePassword(data.password);
        setIsSubmitting(false);

        if (error) {
            toast.error(error);
        } else {
            toast.success("¡Contraseña actualizada! Ya podés iniciar sesión.");
            navigate("/login", { replace: true });
        }
    };

    return (
        <div className="h-screen w-full flex overflow-hidden bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark transition-colors duration-300">
            {/* Left Panel */}
            <div className="hidden lg:flex w-1/2 relative items-center justify-center overflow-hidden bg-[#0b1d3a]">
                <img
                    alt="Gym background"
                    className="absolute inset-0 w-full h-full object-cover object-center opacity-30"
                    src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#0d2654]/95 via-[#1240a0]/80 to-[#0d2654]/90" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(37,99,235,0.25),transparent)]" />

                <div
                    className="relative z-10 flex flex-col items-center justify-center select-none"
                    style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                >
                    <div className="mb-6">
                        <svg
                            width="34"
                            height="34"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="text-white/80"
                            stroke="currentColor"
                            strokeWidth="1.2"
                        >
                            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                            <path d="M19.622 10.395l-1.097-2.65L20 6l-2-2-1.735 1.483-2.707-1.113L12.935 2h-1.954l-.632 2.401-2.645 1.115L6 4 4 6l1.453 1.789-1.08 2.657L2 11v2l2.348.655L5.4 16.3 4 18l2 2 1.791-1.46 2.606 1.072L11 22h2l.604-2.387 2.651-1.098C16.697 18.831 18 20 18 20l2-2-1.462-1.787 1.085-2.642L22 13v-2l-2.378-.605Z" />
                        </svg>
                    </div>

                    <h1
                        className="text-white tracking-[0.18em] font-normal"
                        style={{
                            fontSize: "clamp(2.8rem, 5vw, 4rem)",
                            letterSpacing: "0.18em",
                            fontFamily:
                                "'Palatino Linotype', 'Palatino', 'Book Antiqua', Georgia, serif",
                            textShadow: "0 2px 24px rgba(0,0,0,0.4)",
                            fontWeight: 400,
                        }}
                    >
                        STABILITY
                    </h1>

                    <div className="flex items-center gap-3 my-4">
                        <div className="h-px bg-white/40" style={{ width: "60px" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
                        <div className="h-px bg-white/40" style={{ width: "60px" }} />
                    </div>

                    <p
                        className="text-white/70 uppercase"
                        style={{
                            letterSpacing: "0.35em",
                            fontSize: "0.7rem",
                            fontFamily:
                                "'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif",
                            fontWeight: 400,
                        }}
                    >
                        Entrenamiento y Salud
                    </p>
                </div>
            </div>

            {/* Right Panel */}
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
                            Nueva contraseña
                        </h2>
                        <p className="text-muted-light dark:text-muted-dark text-sm">
                            Elegí una contraseña segura para tu cuenta
                        </p>
                    </div>

                    {/* Card */}
                    <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-xl dark:shadow-none dark:border dark:border-border-dark p-6 sm:p-8">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                            {/* Nueva Contraseña */}
                            <div>
                                <Label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                                >
                                    Nueva Contraseña
                                </Label>
                                <div className="relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="material-symbols-outlined text-gray-400 text-lg">
                                            lock
                                        </span>
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
                                        <span className="material-symbols-outlined text-gray-400 text-lg hover:text-gray-600 dark:hover:text-gray-200">
                                            {showPassword ? "visibility_off" : "visibility"}
                                        </span>
                                    </div>
                                </div>
                                {errors.password && (
                                    <p className="text-sm text-destructive mt-1">
                                        {errors.password.message}
                                    </p>
                                )}
                            </div>

                            {/* Confirmar Contraseña */}
                            <div>
                                <Label
                                    htmlFor="confirmPassword"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                                >
                                    Confirmar Contraseña
                                </Label>
                                <div className="relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="material-symbols-outlined text-gray-400 text-lg">
                                            lock_reset
                                        </span>
                                    </div>
                                    <input
                                        id="confirmPassword"
                                        type={showConfirm ? "text" : "password"}
                                        placeholder="••••••••"
                                        {...register("confirmPassword")}
                                        className="block w-full pl-10 pr-10 py-2.5 border border-border-light dark:border-border-dark rounded-md bg-input-light dark:bg-input-dark text-text-light dark:text-text-dark placeholder-gray-400 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                                    />
                                    <div
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                    >
                                        <span className="material-symbols-outlined text-gray-400 text-lg hover:text-gray-600 dark:hover:text-gray-200">
                                            {showConfirm ? "visibility_off" : "visibility"}
                                        </span>
                                    </div>
                                </div>
                                {errors.confirmPassword && (
                                    <p className="text-sm text-destructive mt-1">
                                        {errors.confirmPassword.message}
                                    </p>
                                )}
                            </div>

                            {/* Password hints */}
                            <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pl-1">
                                <li className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">
                                        check_circle
                                    </span>
                                    Mínimo 8 caracteres
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">
                                        check_circle
                                    </span>
                                    Al menos una mayúscula
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">
                                        check_circle
                                    </span>
                                    Al menos un número
                                </li>
                            </ul>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin text-[20px]">
                                            progress_activity
                                        </span>
                                        <span>Actualizando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Actualizar contraseña</span>
                                        <span className="material-symbols-outlined text-sm">
                                            arrow_forward
                                        </span>
                                    </>
                                )}
                            </Button>
                        </form>
                    </div>

                    {/* Back to login */}
                    <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                        <Link
                            to="/login"
                            className="font-medium text-primary hover:text-blue-700 dark:hover:text-blue-400 inline-flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                arrow_back
                            </span>
                            Volver al inicio de sesión
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
