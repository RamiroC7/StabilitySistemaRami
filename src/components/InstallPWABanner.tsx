import { useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";

// Clave en localStorage para no volver a mostrar el banner si el usuario lo descartó
const DISMISSED_KEY = "pwa_banner_dismissed";

export function InstallPWABanner() {
    const { isInstallable, installPWA } = usePWAInstall();
    const [dismissed, setDismissed] = useState<boolean>(
        () => localStorage.getItem(DISMISSED_KEY) === "true"
    );

    const handleDismiss = () => {
        localStorage.setItem(DISMISSED_KEY, "true");
        setDismissed(true);
    };

    const handleInstall = async () => {
        await installPWA();
        // Si el usuario aceptó, el hook limpia isInstallable automáticamente.
        // Si lo rechazó, igual ocultamos el banner por la sesión.
        setDismissed(true);
    };

    // No renderiza nada si: no hay prompt disponible, ya fue instalada, o el usuario lo descartó
    if (!isInstallable || dismissed) return null;

    return (
        <div
            role="banner"
            aria-label="Instalar aplicación"
            className="
        mx-3 mt-3 mb-0
        flex items-center gap-3
        rounded-xl border border-primary/20
        bg-gradient-to-r from-primary/10 via-primary/5 to-transparent
        dark:from-primary/20 dark:via-primary/10 dark:to-transparent
        px-4 py-3
        shadow-sm
        animate-in fade-in slide-in-from-top-2 duration-300
      "
        >
            {/* Ícono */}
            <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-primary/15 dark:bg-primary/25">
                <Smartphone size={18} className="text-primary" />
            </div>

            {/* Texto */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-main dark:text-white leading-tight">
                    Instala Stability
                </p>
                <p className="text-xs text-text-secondary dark:text-slate-400 leading-tight mt-0.5 truncate">
                    Acceso rápido y modo offline desde tu celular
                </p>
            </div>

            {/* CTA */}
            <Button
                size="sm"
                onClick={handleInstall}
                className="shrink-0 h-8 px-3 text-xs gap-1.5"
                aria-label="Instalar la aplicación Stability"
            >
                <Download size={13} />
                Instalar
            </Button>

            {/* Cerrar */}
            <button
                onClick={handleDismiss}
                className="
          shrink-0 p-1 rounded-lg
          text-text-secondary dark:text-slate-500
          hover:bg-slate-100 dark:hover:bg-slate-700
          transition-colors
        "
                aria-label="Descartar notificación de instalación"
            >
                <X size={14} />
            </button>
        </div>
    );
}
